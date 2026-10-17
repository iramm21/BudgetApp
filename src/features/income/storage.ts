
import type { IncomeSettings } from "./types";

const STORAGE_KEY = "budget-app:income-settings:v1";

function isIncomeSettings(value: unknown): value is IncomeSettings {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const settings = value as Record<string, unknown>;

  return (
    (settings.payFrequency === "weekly" ||
      settings.payFrequency === "fortnightly") &&
    typeof settings.baseNetPayCents === "number" &&
    Number.isSafeInteger(settings.baseNetPayCents) &&
    settings.baseNetPayCents >= 0
  );
}

export function loadIncomeSettings(): IncomeSettings | null {
  try {
    const storedValue = localStorage.getItem(STORAGE_KEY);

    if (storedValue === null) {
      return null;
    }

    const parsed: unknown = JSON.parse(storedValue);

    return isIncomeSettings(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveIncomeSettings(
  settings: IncomeSettings,
): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
