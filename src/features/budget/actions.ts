
"use server";

import prisma from "@/lib/prisma";
import type { BudgetCategory, BudgetGroup, BudgetPlan } from "./types";

const DEVELOPMENT_USER_ID = "local-development-user";
const TRANSACTION_TIMEOUT_MS = 15_000;

type DatabaseBudgetCategory = {
  id: string;
  name: string;
  group: string;
  plannedAmountCents: number;
};

function assertDevelopmentOnly(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Budget database actions are disabled until authentication is configured.",
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

function isBudgetGroup(value: string): value is BudgetGroup {
  return (
    value === "essentials" ||
    value === "lifestyle" ||
    value === "financial"
  );
}

function toBudgetCategory(
  category: DatabaseBudgetCategory,
): BudgetCategory {
  if (!isBudgetGroup(category.group)) {
    throw new Error(
      `Invalid budget group stored for category "${category.name}".`,
    );
  }

  return {
    id: category.id,
    name: category.name,
    group: category.group,
    plannedAmountCents: category.plannedAmountCents,
  };
}

function validateCategories(categories: BudgetCategory[]): void {
  if (!Array.isArray(categories)) {
    throw new Error("Invalid budget categories.");
  }

  const ids = new Set<string>();

  for (const category of categories) {
    if (
      !category ||
      typeof category.id !== "string" ||
      category.id.trim() === "" ||
      typeof category.name !== "string" ||
      category.name.trim() === "" ||
      !isBudgetGroup(category.group) ||
      !Number.isSafeInteger(category.plannedAmountCents) ||
      category.plannedAmountCents < 0
    ) {
      throw new Error("One or more budget categories are invalid.");
    }

    if (ids.has(category.id)) {
      throw new Error("Duplicate budget category IDs are not allowed.");
    }

    ids.add(category.id);
  }
}

async function getCategoriesForUser(
  userId: string,
): Promise<BudgetCategory[]> {
  const categories = await prisma.budgetCategory.findMany({
    where: {
      userId,
      isArchived: false,
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      group: true,
      plannedAmountCents: true,
    },
  });

  return categories.map(toBudgetCategory);
}

/**
 * Returns the saved database budget.
 * Returns null when the user has no active budget categories yet.
 */
export async function getBudgetPlan(): Promise<BudgetPlan | null> {
  const userId = await getDevelopmentUserId();
  const categories = await getCategoriesForUser(userId);

  if (categories.length === 0) {
    return null;
  }

  return { categories };
}

/**
 * Imports the existing browser budget only if the database is empty.
 * If another request has already initialized it, existing database
 * categories are returned without being overwritten.
 */
export async function initializeBudgetPlan(
  categories: BudgetCategory[],
): Promise<BudgetPlan> {
  validateCategories(categories);

  const userId = await getDevelopmentUserId();

  return prisma.$transaction(
    async (tx) => {
      const existingCategories = await tx.budgetCategory.findMany({
        where: {
          userId,
          isArchived: false,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          group: true,
          plannedAmountCents: true,
        },
      });

      if (existingCategories.length > 0) {
        return {
          categories: existingCategories.map(toBudgetCategory),
        };
      }

      if (categories.length > 0) {
        await tx.budgetCategory.createMany({
          data: categories.map((category, index) => ({
            userId,
            name: category.name.trim(),
            group: category.group,
            plannedAmountCents: category.plannedAmountCents,
            sortOrder: index,
          })),
        });
      }

      const createdCategories = await tx.budgetCategory.findMany({
        where: {
          userId,
          isArchived: false,
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          group: true,
          plannedAmountCents: true,
        },
      });

      return {
        categories: createdCategories.map(toBudgetCategory),
      };
    },
    {
      maxWait: 10_000,
      timeout: TRANSACTION_TIMEOUT_MS,
    },
  );
}

/**
 * Saves the current budget to the database.
 * Existing categories are matched by ID and ownership.
 * Unknown IDs create new records owned by the development user.
 */
export async function saveBudgetPlanToDatabase(
  categories: BudgetCategory[],
): Promise<void> {
  validateCategories(categories);

  const userId = await getDevelopmentUserId();

  await prisma.$transaction(
    async (tx) => {
      if (categories.length === 0) {
        return;
      }

      // Fetch the user's existing category IDs in one query.
      const existingCategories = await tx.budgetCategory.findMany({
        where: {
          userId,
          id: {
            in: categories.map((category) => category.id),
          },
        },
        select: {
          id: true,
        },
      });

      const existingIds = new Set(
        existingCategories.map((category) => category.id),
      );

      const categoriesToUpdate = categories.filter((category) =>
        existingIds.has(category.id),
      );

      const categoriesToCreate = categories.filter(
        (category) => !existingIds.has(category.id),
      );

      // Update existing records concurrently within the transaction.
      await Promise.all(
        categoriesToUpdate.map((category) => {
          const sortOrder = categories.findIndex(
            (item) => item.id === category.id,
          );

          return tx.budgetCategory.update({
            where: {
              id: category.id,
            },
            data: {
              name: category.name.trim(),
              group: category.group,
              plannedAmountCents: category.plannedAmountCents,
              sortOrder,
            },
          });
        }),
      );

      // Insert any categories that do not yet have a database record.
      if (categoriesToCreate.length > 0) {
        await tx.budgetCategory.createMany({
          data: categoriesToCreate.map((category) => ({
            userId,
            name: category.name.trim(),
            group: category.group,
            plannedAmountCents: category.plannedAmountCents,
            sortOrder: categories.findIndex(
              (item) => item.id === category.id,
            ),
          })),
        });
      }
    },
    {
      maxWait: 10_000,
      timeout: TRANSACTION_TIMEOUT_MS,
    },
  );
}
