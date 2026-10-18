
"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import type { BudgetCategory, BudgetGroup } from "./types";
import {
  loadBudgetPlan,
  saveBudgetPlan as saveBudgetPlanToStorage,
  DEFAULT_CATEGORIES,
} from "./storage";
import {
  getBudgetPlan,
  initializeBudgetPlan,
  saveBudgetPlanToDatabase,
} from "./actions";
import { loadIncomeSettings } from "@/features/income/storage";
import {
  getTransactions,
} from "@/features/transactions/actions";
import {
  loadTransactions,
  saveTransactions,
} from "@/features/transactions/storage";
import type { Transaction } from "@/features/transactions/types";
import { calculateCategorySpendingCents } from "@/features/transactions/calculations";
import {
  calculateAllocationPercentage,
  calculateRemainingCents,
  calculateTotalAllocatedCents,
} from "./calculations";

type DraftCategory = Omit<BudgetCategory, "plannedAmountCents"> & {
  plannedAmount: string;
};

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

const groupDetails: {
  id: BudgetGroup;
  title: string;
  description: string;
}[] = [
  {
    id: "essentials",
    title: "Essentials",
    description: "The costs you need to cover first.",
  },
  {
    id: "lifestyle",
    title: "Lifestyle",
    description: "Flexible spending and enjoyment.",
  },
  {
    id: "financial",
    title: "Financial goals & other",
    description: "Savings, debt and other expenses.",
  },
];

const currency = (cents: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getPeriodStartDate(days: number): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return formatLocalDate(start);
}

function BudgetPlannerForm() {
  const [periodDays, setPeriodDays] = useState<7 | 14>(14);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [categories, setCategories] = useState<DraftCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [transactionLoadError, setTransactionLoadError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const incomeSettings = loadIncomeSettings();
  const incomeCents = incomeSettings?.baseNetPayCents ?? 0;

  useEffect(() => {
    let cancelled = false;

    async function loadBudget() {
      try {
        let plan = await getBudgetPlan();

        if (plan === null) {
          const browserPlan = loadBudgetPlan();
          plan = await initializeBudgetPlan(browserPlan.categories);
        }

        if (cancelled) return;

        setCategories(
          plan.categories.map((category) => ({
            id: category.id,
            name: category.name,
            group: category.group,
            plannedAmount: (
              category.plannedAmountCents / 100
            ).toFixed(2),
          })),
        );

        saveBudgetPlanToStorage(plan);
        setLoadError(false);
      } catch (error) {
        console.error(
          "Failed to load the budget from the database:",
          error,
        );

        if (cancelled) return;

        setCategories(
          loadBudgetPlan().categories.map((category) => ({
            id: category.id,
            name: category.name,
            group: category.group,
            plannedAmount: (
              category.plannedAmountCents / 100
            ).toFixed(2),
          })),
        );

        setLoadError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    async function loadDatabaseTransactions() {
      try {
        const databaseTransactions = await getTransactions();

        if (cancelled) return;

        const normalisedTransactions: Transaction[] =
          databaseTransactions.map((transaction) => ({
            ...transaction,
            categoryId: transaction.categoryId ?? "",
          }));

        setTransactions(normalisedTransactions);
        saveTransactions(normalisedTransactions);
        setTransactionLoadError(false);
      } catch (error) {
        console.error(
          "Failed to load transactions from the database:",
          error,
        );

        if (cancelled) return;

        // Browser data is a fallback only if the database cannot be read.
        setTransactions(loadTransactions());
        setTransactionLoadError(true);
      }
    }

    void loadBudget();
    void loadDatabaseTransactions();

    return () => {
      cancelled = true;
    };
  }, []);

  const validCategories: BudgetCategory[] = categories.map((category) => {
    const amount =
      category.plannedAmount.trim() === ""
        ? 0
        : Number(category.plannedAmount);

    return {
      id: category.id,
      name: category.name,
      group: category.group,
      plannedAmountCents: Math.round(amount * 100),
    };
  });

  const inputsValid = categories.every((category) => {
    if (category.plannedAmount.trim() === "") return true;

    const amount = Number(category.plannedAmount);

    return (
      Number.isFinite(amount) &&
      amount >= 0 &&
      Number.isSafeInteger(Math.round(amount * 100))
    );
  });

  const totalAllocatedCents =
    calculateTotalAllocatedCents(validCategories);

  const payPeriodDays =
    incomeSettings?.payFrequency === "weekly" ? 7 : 14;

  const periodBudgetScale = periodDays / payPeriodDays;

  const periodIncomeCents = Math.round(
    incomeCents * periodBudgetScale,
  );

  const periodAllocatedCents = Math.round(
    totalAllocatedCents * periodBudgetScale,
  );

  const remainingCents = calculateRemainingCents(
    periodIncomeCents,
    periodAllocatedCents,
  );

  const allocationPercentage = calculateAllocationPercentage(
    periodAllocatedCents,
    periodIncomeCents,
  );

  const periodStartDate = getPeriodStartDate(periodDays);
  const periodEndDate = formatLocalDate(new Date());

  const periodTransactions = transactions.filter(
    (transaction) =>
      transaction.type === "expense" &&
      transaction.date >= periodStartDate &&
      transaction.date <= periodEndDate,
  );

  const payPeriodLabel =
    periodDays === 7 ? "last 7 days" : "last 14 days";

  function updateAmount(id: string, value: string) {
    setCategories((current) =>
      current.map((category) =>
        category.id === id
          ? { ...category, plannedAmount: value }
          : category,
      ),
    );

    setSaved(false);
    setSaveError(false);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!inputsValid || isSaving || isLoading) return;

    setIsSaving(true);
    setSaved(false);
    setSaveError(false);

    const plan = {
      categories: validCategories,
    };

    try {
      await saveBudgetPlanToDatabase(plan.categories);
      saveBudgetPlanToStorage(plan);

      setSaved(true);
      setLoadError(false);
    } catch (error) {
      console.error(
        "Failed to save the budget to the database:",
        error,
      );

      saveBudgetPlanToStorage(plan);
      setSaveError(true);
    } finally {
      setIsSaving(false);
    }
  }

  const allocationIsOver = allocationPercentage > 100;

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="h-9 w-64 animate-pulse rounded bg-[var(--border)]" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-[var(--border)]" />
        <div className="h-32 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]" />
        <p className="text-sm text-[var(--muted)]">
          Loading your budget...
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 sm:space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Finances{" "}
          <span className="mx-1.5 text-[var(--border-strong)]">/</span>
          Budget
        </p>

        <div>
          <h1 className="text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            Budget planner
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
            Give every dollar a job before you spend it. Plan around your
            reliable income, not overtime.
          </p>
        </div>
      </header>

      {!incomeSettings && (
        <section
          className="rounded-xl border border-[var(--warning)]/25 bg-[var(--warning-background)] p-4 sm:p-5"
          aria-labelledby="income-notice-title"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/70 text-[var(--warning)]">
              <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden="true">
                <path
                  d="M12 8v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div className="min-w-0">
              <h2
                id="income-notice-title"
                className="text-sm font-semibold text-[var(--foreground)]"
              >
                Set up your base income first
              </h2>
              <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
                You can still plan your categories, but your remaining balance
                will appear once you save your income settings.
              </p>
              <Link
                href="/income"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)] hover:underline"
              >
                Go to income settings
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      {loadError && (
        <section
          role="alert"
          className="rounded-xl border border-red-200 bg-[var(--danger-background)] p-4"
        >
          <p className="text-sm font-medium text-[var(--danger)]">
            Could not load your budget from the database. Browser data is
            displayed as a fallback. Saving to the database may also fail.
          </p>
        </section>
      )}

      {transactionLoadError && (
        <section
          role="alert"
          className="rounded-xl border border-red-200 bg-[var(--danger-background)] p-4"
        >
          <p className="text-sm font-medium text-[var(--danger)]">
            Could not load transactions from the database. Spending figures
            may be based on browser data and may not reflect your latest
            transactions.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-sm font-semibold text-[var(--foreground)]">
            Spending period
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Compare planned spending with transactions from the {payPeriodLabel}.
          </p>
        </div>

        <div className="w-full sm:w-auto sm:min-w-40">
          <label htmlFor="spending-period" className="sr-only">
            Spending period
          </label>
          <select
            id="spending-period"
            value={periodDays}
            onChange={(event) =>
              setPeriodDays(Number(event.target.value) as 7 | 14)
            }
            className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm font-medium text-[var(--foreground)] outline-none transition focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-100 sm:min-w-40"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
          </select>
        </div>
      </section>

      <section
        className="grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3"
        aria-label="Budget summary"
      >
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
                <path
                  d="M4 7.5h16M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm9 9h3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p className="text-sm font-medium text-[var(--muted)]">
              Budgeted income
            </p>
          </div>
          <p className="mt-4 text-2xl font-bold tracking-tight tabular-nums text-[var(--foreground)] sm:text-3xl">
            {incomeSettings ? currency(periodIncomeCents) : "—"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-light)]">
            Reliable income for this period
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-700">
              <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
                <path
                  d="M5 5h14v14H5zM8 9h8M8 12h8M8 15h5"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p className="text-sm font-medium text-[var(--muted)]">
              Planned expenses
            </p>
          </div>
          <p className="mt-4 text-2xl font-bold tracking-tight tabular-nums text-[var(--foreground)] sm:text-3xl">
            {currency(periodAllocatedCents)}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-light)]">
            Allocated across your categories
          </p>
        </div>

        <div
          className={`rounded-xl border p-4 shadow-[var(--shadow-card)] sm:col-span-2 sm:p-5 xl:col-span-1 ${
            remainingCents < 0
              ? "border-red-200 bg-[var(--danger-background)]"
              : "border-[var(--border)] bg-[var(--surface)]"
          }`}
        >
          <div className="flex items-center gap-2">
            <span
              className={`flex size-8 items-center justify-center rounded-lg ${
                remainingCents < 0
                  ? "bg-white/80 text-[var(--danger)]"
                  : "bg-[var(--success-background)] text-[var(--success)]"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
                <path
                  d="m5 12 4 4L19 6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p className="text-sm font-medium text-[var(--muted)]">
              {remainingCents < 0 ? "Over budget" : "Unallocated income"}
            </p>
          </div>
          <p
            className={`mt-4 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl ${
              remainingCents < 0
                ? "text-[var(--danger)]"
                : "text-[var(--success)]"
            }`}
          >
            {incomeSettings ? currency(remainingCents) : "—"}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {remainingCents < 0
              ? "Your plan exceeds your income"
              : "Income left after planned expenses"}
          </p>
        </div>
      </section>

      {incomeSettings && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                Income allocation
              </h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                How much of your reliable income has a job?
              </p>
            </div>
            <p
              className={`text-lg font-bold tabular-nums ${
                allocationIsOver
                  ? "text-[var(--danger)]"
                  : "text-[var(--foreground)]"
              }`}
            >
              {allocationPercentage.toFixed(1)}%
            </p>
          </div>

          <div
            className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]"
            role="progressbar"
            aria-label="Income allocated"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(
              Math.max(allocationPercentage, 0),
              100,
            )}
            aria-valuetext={`${allocationPercentage.toFixed(1)}% allocated`}
          >
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                allocationIsOver
                  ? "bg-[var(--danger)]"
                  : "bg-[var(--success)]"
              }`}
              style={{
                width: `${Math.min(
                  Math.max(allocationPercentage, 0),
                  100,
                )}%`,
              }}
            />
          </div>

          {allocationPercentage < 100 && (
            <p className="mt-3 text-sm text-[var(--muted)]">
              You still have{" "}
              <span className="font-semibold text-[var(--success)]">
                {currency(remainingCents)}
              </span>{" "}
              to allocate.
            </p>
          )}

          {allocationIsOver && (
            <p
              role="alert"
              className="mt-3 text-sm font-medium text-[var(--danger)]"
            >
              Your planned expenses exceed your reliable income. Reduce your
              allocations before relying on overtime to cover the difference.
            </p>
          )}

          {allocationPercentage === 100 && (
            <p className="mt-3 text-sm font-medium text-[var(--success)]">
              Every dollar of your reliable income has been allocated.
            </p>
          )}
        </section>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
              Your budget
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Set a planned amount for each category.
            </p>
          </div>
          <p className="text-xs text-[var(--muted-light)]">
            Amounts in AUD
          </p>
        </div>

        {groupDetails.map((group) => {
          const groupCategories = categories.filter(
            (category) => category.group === group.id,
          );

          const groupTotal = Math.round(
            validCategories
              .filter((category) => category.group === group.id)
              .reduce(
                (total, category) =>
                  total + category.plannedAmountCents,
                0,
              ) * periodBudgetScale,
          );

          return (
            <section
              key={group.id}
              className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]"
              aria-labelledby={`group-${group.id}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-4 sm:px-5">
                <div>
                  <h3
                    id={`group-${group.id}`}
                    className="text-base font-semibold text-[var(--foreground)]"
                  >
                    {group.title}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {group.description}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--muted)]">
                    Group total
                  </p>
                  <p className="mt-0.5 text-base font-bold tabular-nums text-[var(--foreground)]">
                    {currency(groupTotal)}
                  </p>
                </div>
              </div>

              <div className="divide-y divide-[var(--border)] px-4 sm:px-5">
                {groupCategories.length === 0 && (
                  <p className="py-5 text-sm text-[var(--muted)]">
                    No categories in this group yet.
                  </p>
                )}

                {groupCategories.map((category) => {
                  const plannedAmountCents =
                    validCategories.find(
                      (item) => item.id === category.id,
                    )?.plannedAmountCents ?? 0;

                  const plannedForPeriod = Math.round(
                    plannedAmountCents * periodBudgetScale,
                  );

                  const spentForPeriod = calculateCategorySpendingCents(
                    periodTransactions,
                    category.id,
                  );

                  const categoryRemaining =
                    plannedForPeriod - spentForPeriod;

                  const categoryIsOver = categoryRemaining < 0;

                  return (
                    <div
                      key={category.id}
                      className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-5"
                    >
                      <div className="min-w-0 flex-1">
                        <label
                          htmlFor={`amount-${category.id}`}
                          className="block text-sm font-semibold text-[var(--foreground)]"
                        >
                          {category.name}
                        </label>

                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
                          <span>
                            Planned{" "}
                            <span className="font-medium text-[var(--foreground)]">
                              {currency(plannedForPeriod)}
                            </span>
                          </span>
                          <span>
                            Spent{" "}
                            <span className="font-medium text-[var(--foreground)]">
                              {currency(spentForPeriod)}
                            </span>
                          </span>
                        </div>

                        <p
                          className={`mt-1.5 text-xs font-medium ${
                            categoryIsOver
                              ? "text-[var(--danger)]"
                              : "text-[var(--success)]"
                          }`}
                        >
                          {categoryIsOver ? "Over by " : "Remaining "}
                          {currency(Math.abs(categoryRemaining))}
                        </p>
                      </div>

                      <div className="w-full sm:w-36 sm:shrink-0">
                        <label
                          htmlFor={`amount-${category.id}`}
                          className="mb-1.5 block text-xs font-medium text-[var(--muted)] sm:sr-only"
                        >
                          Planned amount for {category.name}
                        </label>

                        <div className="relative">
                          <span
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--muted)]"
                            aria-hidden="true"
                          >
                            $
                          </span>
                          <input
                            id={`amount-${category.id}`}
                            name={`amount-${category.id}`}
                            type="number"
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={category.plannedAmount}
                            onChange={(event) =>
                              updateAmount(
                                category.id,
                                event.target.value,
                              )
                            }
                            aria-invalid={
                              category.plannedAmount.trim() !== "" &&
                              !(
                                Number.isFinite(
                                  Number(category.plannedAmount),
                                ) &&
                                Number(category.plannedAmount) >= 0 &&
                                Number.isSafeInteger(
                                  Math.round(
                                    Number(category.plannedAmount) * 100,
                                  ),
                                )
                              )
                            }
                            className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] py-2.5 pl-7 pr-3 text-right text-sm font-medium tabular-nums text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted-light)] focus:border-[var(--primary)] focus:ring-2 focus:ring-blue-100"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-secondary)] px-4 py-3 sm:px-5">
                <span className="text-xs font-medium text-[var(--muted)]">
                  Total planned
                </span>
                <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                  {currency(groupTotal)}
                </span>
              </div>
            </section>
          );
        })}

        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            {saved && (
              <p
                role="status"
                className="flex items-center gap-2 text-sm font-medium text-[var(--success)]"
              >
                <span
                  className="flex size-5 items-center justify-center rounded-full bg-[var(--success-background)]"
                  aria-hidden="true"
                >
                  ✓
                </span>
                Budget saved to the database.
              </p>
            )}

            {saveError && (
              <p
                role="alert"
                className="text-sm font-medium text-[var(--danger)]"
              >
                Could not save your budget to the database. Your changes have
                been preserved in this browser where possible. Check the
                terminal for details.
              </p>
            )}

            {!inputsValid && (
              <p className="text-sm font-medium text-[var(--danger)]">
                Enter valid, non-negative amounts before saving.
              </p>
            )}

            {!saved && !saveError && inputsValid && (
              <p className="text-xs leading-5 text-[var(--muted)]">
                Changes are saved when you select Save budget.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!inputsValid || isSaving || isLoading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden="true">
              <path
                d="M5 4h12l3 3v13H4V4h1Zm3 0v6h8V4M8 20v-7h8v7"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {isSaving ? "Saving..." : "Save budget"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function BudgetPlanner() {
  const isMounted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (!isMounted) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <div className="h-3 w-28 animate-pulse rounded bg-[var(--border)]" />
        <div className="h-9 w-64 max-w-full animate-pulse rounded bg-[var(--border)]" />
        <div className="h-4 w-80 max-w-full animate-pulse rounded bg-[var(--border)]" />

        <div className="grid gap-3 pt-4 sm:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-32 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]"
            />
          ))}
        </div>

        <p className="text-sm text-[var(--muted)]">
          Loading your budget...
        </p>
      </div>
    );
  }

  return <BudgetPlannerForm />;
}
