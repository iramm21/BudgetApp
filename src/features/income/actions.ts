
"use server";

import prisma from "@/lib/prisma";
import type { IncomeSettings, PayFrequency } from "./types";

const DEVELOPMENT_USER_ID = "local-development-user";

function assertDevelopmentOnly(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Income database actions are disabled until authentication is configured.",
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

function toPayFrequency(days: number): PayFrequency {
  if (days === 7) {
    return "weekly";
  }

  if (days === 14) {
    return "fortnightly";
  }

  throw new Error("Invalid pay frequency stored in the database.");
}

function validateIncomeSettings(settings: IncomeSettings): void {
  if (
    !settings ||
    !Number.isSafeInteger(settings.baseNetPayCents) ||
    settings.baseNetPayCents < 0 ||
    (settings.payFrequency !== "weekly" &&
      settings.payFrequency !== "fortnightly")
  ) {
    throw new Error("Invalid income settings.");
  }
}

/**
 * Retrieves the development user's income settings from the database.
 */
export async function getIncomeSettings(): Promise<IncomeSettings | null> {
  const userId = await getDevelopmentUserId();

  const settings = await prisma.incomeSettings.findUnique({
    where: { userId },
    select: {
      baseNetPayCents: true,
      payFrequencyDays: true,
    },
  });

  if (!settings) {
    return null;
  }

  return {
    baseNetPayCents: settings.baseNetPayCents,
    payFrequency: toPayFrequency(settings.payFrequencyDays),
  };
}

/**
 * Creates or updates the development user's income settings.
 */
export async function saveIncomeSettings(
  settings: IncomeSettings,
): Promise<void> {
  validateIncomeSettings(settings);

  const userId = await getDevelopmentUserId();
  const payFrequencyDays = settings.payFrequency === "weekly" ? 7 : 14;

  await prisma.incomeSettings.upsert({
    where: { userId },
    update: {
      baseNetPayCents: settings.baseNetPayCents,
      payFrequencyDays,
    },
    create: {
      userId,
      baseNetPayCents: settings.baseNetPayCents,
      payFrequencyDays,
      currency: "AUD",
    },
  });
}
