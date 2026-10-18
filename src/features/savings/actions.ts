
"use server";

import prisma from "@/lib/prisma";
import {
  SAVINGS_CATEGORIES,
  type SavingsCategory,
  type SavingsGoal,
} from "./types";

const DEVELOPMENT_USER_ID = "local-development-user";
const CATEGORY_NOTE_PREFIX = "[budget-app-category]:";

type DatabaseSavingsGoal = {
  id: string;
  name: string;
  targetAmountCents: number;
  currentAmountCents: number;
  targetDate: Date | null;
  notes: string | null;
  isCompleted: boolean;
  sortOrder: number;
  createdAt: Date;
};

function assertDevelopmentOnly(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Savings database actions are disabled until authentication is configured.",
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

function isSavingsCategory(value: string): value is SavingsCategory {
  return (SAVINGS_CATEGORIES as readonly string[]).includes(value);
}

function getCategoryFromNotes(notes: string | null): SavingsCategory {
  if (notes?.startsWith(CATEGORY_NOTE_PREFIX)) {
    const category = notes.slice(CATEGORY_NOTE_PREFIX.length);

    if (isSavingsCategory(category)) {
      return category;
    }
  }

  return SAVINGS_CATEGORIES[0];
}

function toSavingsGoal(record: DatabaseSavingsGoal): SavingsGoal {
  return {
    id: record.id,
    name: record.name,
    category: getCategoryFromNotes(record.notes),
    targetAmountCents: record.targetAmountCents,
    savedAmountCents: record.currentAmountCents,
    createdAt: record.createdAt.toISOString(),
  };
}

function validateGoalName(name: unknown): asserts name is string {
  if (
    typeof name !== "string" ||
    name.trim().length === 0 ||
    name.trim().length > 80
  ) {
    throw new Error("Goal names must contain between 1 and 80 characters.");
  }
}

function validatePositiveAmount(
  amountCents: unknown,
  label: string,
): asserts amountCents is number {
  if (
    typeof amountCents !== "number" ||
    !Number.isSafeInteger(amountCents) ||
    amountCents <= 0
  ) {
    throw new Error(`${label} must be a positive amount in cents.`);
  }
}

function validateGoalId(id: unknown): asserts id is string {
  if (typeof id !== "string" || id.trim().length === 0) {
    throw new Error("Invalid savings goal ID.");
  }
}

function validateCategory(
  category: unknown,
): asserts category is SavingsCategory {
  if (typeof category !== "string" || !isSavingsCategory(category)) {
    throw new Error("Please select a valid savings category.");
  }
}

export async function getSavingsGoals(): Promise<SavingsGoal[]> {
  const userId = await getDevelopmentUserId();

  const goals = await prisma.savingsGoal.findMany({
    where: { userId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      targetAmountCents: true,
      currentAmountCents: true,
      targetDate: true,
      notes: true,
      isCompleted: true,
      sortOrder: true,
      createdAt: true,
    },
  });

  return goals.map(toSavingsGoal);
}

export async function createSavingsGoal(input: {
  name: string;
  category: SavingsCategory;
  targetAmountCents: number;
}): Promise<SavingsGoal> {
  validateGoalName(input?.name);
  validateCategory(input?.category);
  validatePositiveAmount(input?.targetAmountCents, "Target amount");

  const userId = await getDevelopmentUserId();

  const lastGoal = await prisma.savingsGoal.findFirst({
    where: { userId },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const created = await prisma.savingsGoal.create({
    data: {
      userId,
      name: input.name.trim(),
      targetAmountCents: input.targetAmountCents,
      currentAmountCents: 0,
      notes: `${CATEGORY_NOTE_PREFIX}${input.category}`,
      sortOrder: (lastGoal?.sortOrder ?? -1) + 1,
    },
    select: {
      id: true,
      name: true,
      targetAmountCents: true,
      currentAmountCents: true,
      targetDate: true,
      notes: true,
      isCompleted: true,
      sortOrder: true,
      createdAt: true,
    },
  });

  return toSavingsGoal(created);
}

export async function addSavingsContribution(
  goalId: string,
  amountCents: number,
): Promise<SavingsGoal> {
  validateGoalId(goalId);
  validatePositiveAmount(amountCents, "Contribution");

  const userId = await getDevelopmentUserId();

  const existing = await prisma.savingsGoal.findFirst({
    where: {
      id: goalId,
      userId,
    },
    select: {
      id: true,
      currentAmountCents: true,
      targetAmountCents: true,
    },
  });

  if (!existing) {
    throw new Error("Savings goal not found.");
  }

  const newBalance = existing.currentAmountCents + amountCents;

  if (!Number.isSafeInteger(newBalance)) {
    throw new Error("The contribution would exceed the supported balance.");
  }

  const updated = await prisma.savingsGoal.update({
    where: { id: existing.id },
    data: {
      currentAmountCents: { increment: amountCents },
      isCompleted: newBalance >= existing.targetAmountCents,
    },
    select: {
      id: true,
      name: true,
      targetAmountCents: true,
      currentAmountCents: true,
      targetDate: true,
      notes: true,
      isCompleted: true,
      sortOrder: true,
      createdAt: true,
    },
  });

  return toSavingsGoal(updated);
}

export async function deleteSavingsGoal(goalId: string): Promise<void> {
  validateGoalId(goalId);

  const userId = await getDevelopmentUserId();

  const result = await prisma.savingsGoal.deleteMany({
    where: {
      id: goalId,
      userId,
    },
  });

  if (result.count === 0) {
    throw new Error("Savings goal not found.");
  }
}
