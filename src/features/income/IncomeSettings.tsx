
"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { IncomeSettings, PayFrequency } from "./types";
import {
  getIncomeSettings,
  saveIncomeSettings as saveIncomeSettingsToDatabase,
} from "./actions";
import {
  loadIncomeSettings,
  saveIncomeSettings as saveIncomeSettingsToStorage,
} from "./storage";

export default function IncomeSettingsForm() {
  const [payFrequency, setPayFrequency] =
    useState<PayFrequency>("fortnightly");

  const [basePay, setBasePay] = useState("2356.58");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      const localSettings = loadIncomeSettings();

      try {
        const databaseSettings = await getIncomeSettings();

        if (cancelled) return;

        if (databaseSettings) {
          setPayFrequency(databaseSettings.payFrequency);
          setBasePay(
            (databaseSettings.baseNetPayCents / 100).toFixed(2),
          );

          // Keep the browser copy synchronised with the database.
          saveIncomeSettingsToStorage(databaseSettings);
          return;
        }

        // Import existing browser settings if the database is empty.
        if (localSettings) {
          await saveIncomeSettingsToDatabase(localSettings);

          if (cancelled) return;

          setPayFrequency(localSettings.payFrequency);
          setBasePay(
            (localSettings.baseNetPayCents / 100).toFixed(2),
          );
          return;
        }

        // Neither source has settings; retain the initial defaults.
      } catch (error) {
        console.error("Failed to load income settings:", error);

        if (cancelled) return;

        // Keep the existing browser settings available if the
        // database cannot be reached.
        if (localSettings) {
          setPayFrequency(localSettings.payFrequency);
          setBasePay(
            (localSettings.baseNetPayCents / 100).toFixed(2),
          );
        }

        setSaveError(true);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const amount = Number(basePay);

  const isValid =
    basePay.trim() !== "" &&
    Number.isFinite(amount) &&
    amount >= 0 &&
    Number.isSafeInteger(Math.round(amount * 100));

  const formattedAmount = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(isValid ? amount : 0);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValid || isLoading || isSaving) return;

    const settings: IncomeSettings = {
      payFrequency,
      baseNetPayCents: Math.round(amount * 100),
    };

    setSaved(false);
    setSaveError(false);
    setIsSaving(true);

    try {
      await saveIncomeSettingsToDatabase(settings);

      // The database is the primary source of truth.
      // Keep a browser copy as a fallback during development.
      saveIncomeSettingsToStorage(settings);

      setSaved(true);
    } catch (error) {
      console.error("Failed to save income settings:", error);
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  function handlePayChange(value: string) {
    setBasePay(value);
    setSaved(false);
    setSaveError(false);
  }

  function handleFrequencyChange(value: PayFrequency) {
    setPayFrequency(value);
    setSaved(false);
    setSaveError(false);
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Finances / Income
        </p>

        <div className="space-y-2">
          <h1>Income settings</h1>

          <p className="max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
            Set your reliable take-home pay so your budget is built
            around income you can depend on.
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-7">
          <div className="mb-7">
            <h2>Base income</h2>

            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              Enter your usual take-home pay, excluding overtime
              and other irregular income.
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label
                htmlFor="payFrequency"
                className="block text-sm font-semibold text-[var(--foreground)]"
              >
                Pay frequency
              </label>

              <select
                id="payFrequency"
                name="payFrequency"
                value={payFrequency}
                disabled={isLoading || isSaving}
                onChange={(event) =>
                  handleFrequencyChange(
                    event.target.value as PayFrequency,
                  )
                }
                className="min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-3 text-sm transition-colors hover:border-[var(--muted-light)] focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
              >
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="basePay"
                className="block text-sm font-semibold text-[var(--foreground)]"
              >
                Base take-home pay
                <span className="ml-1 font-normal text-[var(--muted)]">
                  (AUD)
                </span>
              </label>

              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg font-medium text-[var(--muted)]"
                >
                  $
                </span>

                <input
                  id="basePay"
                  name="basePay"
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  required
                  value={basePay}
                  disabled={isLoading || isSaving}
                  onChange={(event) =>
                    handlePayChange(event.target.value)
                  }
                  aria-describedby="basePay-help"
                  className="min-h-14 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] py-3 pl-9 pr-4 text-lg font-semibold tabular-nums transition-colors hover:border-[var(--muted-light)] focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
                  placeholder="0.00"
                />
              </div>

              <p
                id="basePay-help"
                className="text-sm leading-5 text-[var(--muted)]"
              >
                Overtime is tracked separately, so your budget
                doesn&apos;t rely on working extra shifts.
              </p>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="income-summary-title"
          className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]"
        >
          <div className="border-b border-[var(--border)] bg-[var(--surface-secondary)] px-5 py-4 sm:px-7">
            <div className="flex items-center gap-2">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-5 text-[var(--primary)]"
                aria-hidden="true"
              >
                <path
                  d="M12 3v18m5-13.5C17 5.6 14.8 4 12 4S7 5.5 7 7.5 9 11 12 12s5 2.5 5 4.5S14.8 20 12 20s-5-1.6-5-3.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>

              <h2
                id="income-summary-title"
                className="text-sm font-semibold"
              >
                Reliable income summary
              </h2>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            <p className="text-sm font-medium text-[var(--muted)]">
              Take-home pay per pay period
            </p>

            <p
              aria-live="polite"
              className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] tabular-nums sm:text-4xl"
            >
              {formattedAmount}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[var(--success-background)] px-2.5 py-1 text-xs font-semibold text-[var(--success)]">
                <span
                  className="mr-1.5 size-1.5 rounded-full bg-[var(--success)]"
                  aria-hidden="true"
                />
                Base income
              </span>

              <span className="text-sm text-[var(--muted)]">
                {payFrequency === "weekly"
                  ? "Paid every week"
                  : "Paid every fortnight"}
              </span>
            </div>

            <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--muted)]">
              Use dependable income as the foundation of your budget.
              Treat overtime and one-off payments as extra money rather
              than money you need to cover regular expenses.
            </p>
          </div>
        </section>

        <div className="space-y-3">
          <button
            type="submit"
            disabled={!isValid || isLoading || isSaving}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {isSaving ? (
              "Saving..."
            ) : isLoading ? (
              "Loading..."
            ) : (
              <>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className="size-4"
                  aria-hidden="true"
                >
                  <path
                    d="m5 12 4 4L19 6"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Save income settings
              </>
            )}
          </button>

          {saved && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--success)]/20 bg-[var(--success-background)] p-3 text-sm font-medium text-[var(--success)]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              >
                <path
                  d="m5 12 4 4L19 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Income settings saved to the database.
            </p>
          )}

          {saveError && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-[var(--radius-md)] border border-[var(--danger)]/20 bg-[var(--danger-background)] p-3 text-sm font-medium text-[var(--danger)]"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              >
                <path
                  d="M12 8v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-13.1a2 2 0 0 0-3.4 0Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Could not load or save settings in the database. Check the
              terminal for details. Existing browser settings are preserved.
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
