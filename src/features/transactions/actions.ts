
"use server";

import prisma from "@/lib/prisma";
import type {
  DatabaseTransaction,
  Transaction,
  TransactionType,
} from "./types";

const DEVELOPMENT_USER_ID = "local-development-user";

type TransactionInput = Omit<Transaction, "id">;

type DatabaseTransactionRecord = {
  id: string;
  description: string;
  amountCents: number;
  date: Date;
  categoryId: string | null;
  type: string;
};

function assertDevelopmentOnly(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Transaction database actions are disabled until authentication is configured.",
    );
  }
}

async function getDevelopmentUserId(): Promise<string> {
  assertDevelopmentOnly();

  const user = await prisma.user.upsert({
    where: { id: DEVELOPMENT_USER_ID },
    update: {},
    create: { id: DEVELOPMENT_USER_ID },
    select: { id: true },
  });

  return user.id;
}

function isTransactionType(value: string): value is TransactionType {
  return value === "expense" || value === "income";
}

function toTransaction(
  record: DatabaseTransactionRecord,
): DatabaseTransaction {
  if (!isTransactionType(record.type)) {
    throw new Error(`Invalid transaction type stored for "${record.description}".`);
  }

  return {
    id: record.id,
    description: record.description,
    amountCents: record.amountCents,
    date: record.date.toISOString().slice(0, 10),
    categoryId: record.categoryId,
    type: record.type,
  };
}

function validateTransaction(
  transaction: TransactionInput,
): void {
  if (
    !transaction ||
    typeof transaction.description !== "string" ||
    transaction.description.trim().length === 0 ||
    transaction.description.trim().length > 200 ||
    !Number.isSafeInteger(transaction.amountCents) ||
    transaction.amountCents <= 0 ||
    typeof transaction.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(transaction.date) ||
    !Number.isFinite(Date.parse(`${transaction.date}T00:00:00.000Z`)) ||
    typeof transaction.categoryId !== "string" ||
    (transaction.type !== "expense" && transaction.type !== "income")
  ) {
    throw new Error("Invalid transaction data.");
  }

  const parsedDate = new Date(`${transaction.date}T00:00:00.000Z`);

  if (parsedDate.toISOString().slice(0, 10) !== transaction.date) {
    throw new Error("Invalid transaction date.");
  }
}

async function validateCategory(
  userId: string,
  categoryId: string,
): Promise<string | null> {
  if (!categoryId.trim()) return null;

  const category = await prisma.budgetCategory.findFirst({
    where: {
      id: categoryId,
      userId,
      isArchived: false,
    },
    select: { id: true },
  });

  if (!category) {
    throw new Error("The selected budget category could not be found.");
  }

  return category.id;
}

export async function getTransactions(): Promise<DatabaseTransaction[]> {
  const userId = await getDevelopmentUserId();

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      description: true,
      amountCents: true,
      date: true,
      categoryId: true,
      type: true,
    },
  });

  return transactions.map(toTransaction);
}

export async function createTransaction(
  transaction: TransactionInput,
): Promise<DatabaseTransaction> {
  validateTransaction(transaction);

  const userId = await getDevelopmentUserId();
  const categoryId = await validateCategory(userId, transaction.categoryId);

  const created = await prisma.transaction.create({
    data: {
      userId,
      description: transaction.description.trim(),
      amountCents: transaction.amountCents,
      date: new Date(`${transaction.date}T00:00:00.000Z`),
      categoryId,
      type: transaction.type,
    },
    select: {
      id: true,
      description: true,
      amountCents: true,
      date: true,
      categoryId: true,
      type: true,
    },
  });

  return toTransaction(created);
}

export async function updateTransaction(
  id: string,
  transaction: TransactionInput,
): Promise<DatabaseTransaction> {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error("Invalid transaction ID.");
  }

  validateTransaction(transaction);

  const userId = await getDevelopmentUserId();
  const categoryId = await validateCategory(userId, transaction.categoryId);

  const existing = await prisma.transaction.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Transaction not found.");
  }

  const updated = await prisma.transaction.update({
    where: { id: existing.id },
    data: {
      description: transaction.description.trim(),
      amountCents: transaction.amountCents,
      date: new Date(`${transaction.date}T00:00:00.000Z`),
      categoryId,
      type: transaction.type,
    },
    select: {
      id: true,
      description: true,
      amountCents: true,
      date: true,
      categoryId: true,
      type: true,
    },
  });

  return toTransaction(updated);
}

export async function deleteTransaction(id: string): Promise<void> {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error("Invalid transaction ID.");
  }

  const userId = await getDevelopmentUserId();

  const result = await prisma.transaction.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) {
    throw new Error("Transaction not found.");
  }
}

/**
 * Imports existing browser transactions without duplicating records.
 * Categories are matched by their names when browser IDs differ
 * from the generated database IDs.
 */
export async function importTransactions(
  transactions: Transaction[],
): Promise<number> {
  if (!Array.isArray(transactions) || transactions.length > 5000) {
    throw new Error("Invalid transaction import.");
  }

  for (const transaction of transactions) {
    validateTransaction(transaction);
  }

  const userId = await getDevelopmentUserId();

  const categories = await prisma.budgetCategory.findMany({
    where: { userId, isArchived: false },
    select: { id: true, name: true },
  });

  const categoryById = new Map(
    categories.map((category) => [category.id, category.id]),
  );

  const categoryByName = new Map(
    categories.map((category) => [
      category.name.trim().toLowerCase(),
      category.id,
    ]),
  );

  const existing = await prisma.transaction.findMany({
    where: { userId },
    select: { description: true, amountCents: true, date: true, type: true },
  });

  const existingKeys = new Set(
    existing.map((transaction) =>
      [
        transaction.description,
        transaction.amountCents,
        transaction.date.toISOString().slice(0, 10),
        transaction.type,
      ].join("|"),
    ),
  );

  let importedCount = 0;

  for (const transaction of transactions) {
    const key = [
      transaction.description.trim(),
      transaction.amountCents,
      transaction.date,
      transaction.type,
    ].join("|");

    if (existingKeys.has(key)) continue;

    const matchingCategoryId =
      categoryById.get(transaction.categoryId) ??
      categoryByName.get(
        transaction.categoryId.trim().toLowerCase(),
      ) ??
      null;

    await prisma.transaction.create({
      data: {
        userId,
        description: transaction.description.trim(),
        amountCents: transaction.amountCents,
        date: new Date(`${transaction.date}T00:00:00.000Z`),
        categoryId: matchingCategoryId,
        type: transaction.type,
      },
    });

    existingKeys.add(key);
    importedCount += 1;
  }

  return importedCount;
}
