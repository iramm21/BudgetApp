
"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";

import { getIncomeSettings } from "@/features/income/actions";
import { getBudgetPlan } from "@/features/budget/actions";
import { getTransactions } from "@/features/transactions/actions";

const currency = (cents: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);

function formatDate(dateString: string) {
  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) return dateString;

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function subscribeToGreeting() {
  return () => {};
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";

  return "Good evening";
}

function getServerGreeting() {
  return "Hello";
}

const groupDetails = [
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
] as const;

type DashboardIncome = Awaited<ReturnType<typeof getIncomeSettings>>;
type DashboardBudget = Awaited<ReturnType<typeof getBudgetPlan>>;
type DashboardTransactions = Awaited<ReturnType<typeof getTransactions>>;

function DashboardContent() {
  const [incomeSettings, setIncomeSettings] =
    useState<DashboardIncome>(null);
  const [budgetPlan, setBudgetPlan] =
    useState<DashboardBudget>(null);
  const [transactions, setTransactions] =
    useState<DashboardTransactions>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const greeting = useSyncExternalStore(
    subscribeToGreeting,
    getGreeting,
    getServerGreeting,
  );

  const fetchDashboardData = useCallback(async () => {
    const [income, budget, transactionRecords] = await Promise.all([
      getIncomeSettings(),
      getBudgetPlan(),
      getTransactions(),
    ]);

    return {
      income,
      budget,
      transactionRecords,
    };
  }, []);

  const loadDashboard = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const {
        income,
        budget,
        transactionRecords,
      } = await fetchDashboardData();

      setIncomeSettings(income);
      setBudgetPlan(budget);
      setTransactions(transactionRecords);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);

      setLoadError(
        "We couldn't load your financial data. Check your connection and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [fetchDashboardData]);

  useEffect(() => {
    let cancelled = false;

    async function initialiseDashboard() {
      try {
        const {
          income,
          budget,
          transactionRecords,
        } = await fetchDashboardData();

        if (cancelled) return;

        setIncomeSettings(income);
        setBudgetPlan(budget);
        setTransactions(transactionRecords);
      } catch (error) {
        if (cancelled) return;

        console.error("Failed to load dashboard data:", error);

        setLoadError(
          "We couldn't load your financial data. Check your connection and try again.",
        );
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void initialiseDashboard();

    return () => {
      cancelled = true;
    };
  }, [fetchDashboardData]);

  const categories = budgetPlan?.categories ?? [];

  const baseIncomeCents = incomeSettings?.baseNetPayCents ?? 0;

  const payPeriodIncomeCents = baseIncomeCents;

  const totalPlannedCents = categories.reduce(
    (total, category) => total + category.plannedAmountCents,
    0,
  );

  const totalSpentCents = transactions.reduce(
    (total, transaction) =>
      total +
      (transaction.type === "expense" ? transaction.amountCents : 0),
    0,
  );

  const transactionIncomeCents = transactions.reduce(
    (total, transaction) =>
      total +
      (transaction.type === "income" ? transaction.amountCents : 0),
    0,
  );

  const budgetRemainingCents =
    payPeriodIncomeCents - totalPlannedCents;

  const allocationPercentage =
    payPeriodIncomeCents > 0
      ? (totalPlannedCents / payPeriodIncomeCents) * 100
      : 0;

  const recentTransactions = [...transactions]
    .sort((a, b) => {
      const dateComparison = b.date.localeCompare(a.date);

      if (dateComparison !== 0) return dateComparison;

      return b.id.localeCompare(a.id);
    })
    .slice(0, 5);

  const allocationIsOver = allocationPercentage > 100;

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <div className="space-y-3">
          <div className="h-3 w-28 animate-pulse rounded bg-[var(--border)]" />
          <div className="h-9 w-64 max-w-full animate-pulse rounded bg-[var(--border)]" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-[var(--border)]" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-32 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface)]"
            />
          ))}
        </div>

        <p className="text-sm text-[var(--muted)]">
          Loading your dashboard...
        </p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto w-full max-w-7xl">
        <section
          className="rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-background)] p-5 sm:p-6"
          role="alert"
        >
          <h1 className="text-xl font-bold text-[var(--foreground)]">
            Unable to load your dashboard
          </h1>

          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {loadError}
          </p>

          <button
            type="button"
            onClick={() => void loadDashboard()}
            className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]"
          >
            Try again
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-7 sm:space-y-8">
      {/* Page heading */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            Your finances
          </p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--foreground)] sm:text-4xl">
            {greeting}
          </h1>

          <p className="mt-2 text-sm leading-6 text-[var(--muted)] sm:text-base">
            Here&apos;s an overview of your financial position.
          </p>
        </div>

        <Link
          href="/transactions"
          className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 sm:self-auto"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="size-4"
            aria-hidden="true"
          >
            <path
              d="M12 5v14M5 12h14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Add transaction
        </Link>
      </header>

      {/* Income setup notice */}
      {!incomeSettings && (
        <section
          className="rounded-xl border border-[var(--warning)]/25 bg-[var(--warning-background)] p-4 sm:p-5"
          aria-labelledby="income-notice-title"
        >
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/70 text-[var(--warning)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-5"
                aria-hidden="true"
              >
                <path
                  d="M12 8v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <div>
              <h2
                id="income-notice-title"
                className="text-sm font-semibold text-[var(--foreground)]"
              >
                Set up your reliable income
              </h2>

              <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
                Add your regular take-home pay to calculate your budget
                against income you can rely on. Overtime can stay separate.
              </p>

              <Link
                href="/income"
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)] hover:underline"
              >
                Configure income
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Financial summary */}
      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Financial summary"
      >
        <StatCard
          label="Reliable income"
          value={
            incomeSettings
              ? currency(baseIncomeCents)
              : "Not configured"
          }
          description={
            incomeSettings
              ? `Per ${incomeSettings.payFrequency === "weekly" ? "week" : "fortnight"}`
              : "Set up your income"
          }
          icon="income"
          accent="blue"
        />

        <StatCard
          label="Income per pay period"
          value={
            incomeSettings
              ? currency(payPeriodIncomeCents)
              : "—"
          }
          description="Based on base pay only"
          icon="calendar"
          accent="indigo"
        />

        <StatCard
          label="Planned budget"
          value={currency(totalPlannedCents)}
          description="Per configured pay period"
          icon="budget"
          accent="slate"
        />

        <StatCard
          label="Recorded expenses"
          value={currency(totalSpentCents)}
          description="All recorded expense transactions"
          icon="expenses"
          accent="amber"
        />
      </section>

      {/* Main dashboard grid */}
      <section className="grid items-start gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="min-w-0 space-y-5 lg:col-span-2 lg:space-y-6">
          {/* Budget overview */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  Budget overview
                </h2>

                <p className="mt-1 text-sm leading-5 text-[var(--muted)]">
                  Your planned allocations compared with reliable income.
                </p>
              </div>

              <Link
                href="/budget"
                className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--primary)] hover:underline"
              >
                Edit budget
                <span aria-hidden="true">→</span>
              </Link>
            </div>

            <div className="mt-5 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-4">
                <p className="text-sm text-[var(--muted)]">
                  Planned allocations
                </p>

                <p className="mt-2 break-words text-2xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                  {currency(totalPlannedCents)}
                </p>
              </div>

              <div
                className={`rounded-xl border p-4 ${
                  budgetRemainingCents < 0
                    ? "border-red-200 bg-[var(--danger-background)]"
                    : "border-[var(--border)] bg-[var(--surface-secondary)]"
                }`}
              >
                <p className="text-sm text-[var(--muted)]">
                  {budgetRemainingCents < 0
                    ? "Budget shortfall"
                    : "Unallocated income"}
                </p>

                <p
                  className={`mt-2 break-words text-2xl font-bold tracking-tight tabular-nums ${
                    budgetRemainingCents < 0
                      ? "text-[var(--danger)]"
                      : "text-[var(--success)]"
                  }`}
                >
                  {incomeSettings
                    ? currency(budgetRemainingCents)
                    : "—"}
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-[var(--border)] pt-5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-[var(--muted)]">
                  Income allocated
                </span>

                <span
                  className={`font-semibold tabular-nums ${
                    allocationIsOver
                      ? "text-[var(--danger)]"
                      : "text-[var(--foreground)]"
                  }`}
                >
                  {incomeSettings
                    ? `${allocationPercentage.toFixed(1)}%`
                    : "—"}
                </span>
              </div>

              <div
                className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]"
                role="progressbar"
                aria-label="Income allocated"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(
                  Math.max(allocationPercentage, 0),
                  100,
                )}
                aria-valuetext={
                  incomeSettings
                    ? `${allocationPercentage.toFixed(1)}% allocated`
                    : "Income not configured"
                }
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

              {incomeSettings && allocationIsOver && (
                <p
                  role="alert"
                  className="mt-3 text-sm font-medium text-[var(--danger)]"
                >
                  Your planned budget exceeds your reliable income.
                </p>
              )}

              {incomeSettings &&
                allocationPercentage < 100 &&
                allocationPercentage >= 0 && (
                  <p className="mt-3 text-sm text-[var(--muted)]">
                    You have{" "}
                    <span className="font-semibold text-[var(--success)]">
                      {currency(budgetRemainingCents)}
                    </span>{" "}
                    remaining to allocate.
                  </p>
                )}
            </div>
          </section>

          {/* Recent transactions */}
          <section className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-4 py-4 sm:px-6 sm:py-5">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  Recent transactions
                </h2>

                <p className="mt-1 text-sm text-[var(--muted)]">
                  Your five latest recorded transactions.
                </p>
              </div>

              <Link
                href="/transactions"
                className="shrink-0 text-sm font-semibold text-[var(--primary)] hover:underline"
              >
                View all
              </Link>
            </div>

            {recentTransactions.length === 0 ? (
              <div className="px-5 py-10 text-center sm:px-6">
                <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-[var(--surface-secondary)] text-[var(--muted)]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="size-6"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h4"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <p className="mt-4 font-semibold text-[var(--foreground)]">
                  No transactions yet
                </p>

                <p className="mx-auto mt-1 max-w-sm text-sm leading-5 text-[var(--muted)]">
                  Record your first transaction to start tracking spending.
                </p>

                <Link
                  href="/transactions"
                  className="mt-4 inline-flex min-h-10 items-center justify-center rounded-lg border border-[var(--border-strong)] px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-secondary)]"
                >
                  Add your first transaction
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border)]">
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between gap-3 px-4 py-4 transition-colors hover:bg-[var(--surface-secondary)]/70 sm:gap-4 sm:px-6"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                          transaction.type === "income"
                            ? "bg-[var(--success-background)] text-[var(--success)]"
                            : "bg-[var(--surface-secondary)] text-[var(--muted)]"
                        }`}
                        aria-hidden="true"
                      >
                        {transaction.type === "income" ? (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="size-4"
                          >
                            <path
                              d="M12 19V5m-6 6 6-6 6 6"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            className="size-4"
                          >
                            <path
                              d="M12 5v14m6-6-6 6-6-6"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                          {transaction.description}
                        </p>

                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {formatDate(transaction.date)}
                        </p>
                      </div>
                    </div>

                    <p
                      className={`shrink-0 text-sm font-semibold tabular-nums ${
                        transaction.type === "income"
                          ? "text-[var(--success)]"
                          : "text-[var(--foreground)]"
                      }`}
                    >
                      {transaction.type === "income" ? "+" : "−"}
                      {currency(transaction.amountCents)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right-hand dashboard panels */}
        <aside className="min-w-0 space-y-5 lg:space-y-6">
          {/* Budget breakdown */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-5">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Budget breakdown
            </h2>

            <p className="mt-1 text-sm text-[var(--muted)]">
              Planned allocations by group.
            </p>

            <div className="mt-5 space-y-5">
              {groupDetails.map((group, index) => {
                const groupTotal = categories
                  .filter((category) => category.group === group.id)
                  .reduce(
                    (total, category) =>
                      total + category.plannedAmountCents,
                    0,
                  );

                const percentage =
                  totalPlannedCents > 0
                    ? (groupTotal / totalPlannedCents) * 100
                    : 0;

                const barStyles = [
                  "bg-[var(--primary)]",
                  "bg-indigo-500",
                  "bg-teal-600",
                ];

                return (
                  <div key={group.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {group.title}
                        </p>

                        <p className="mt-0.5 text-xs leading-4 text-[var(--muted)]">
                          {group.description}
                        </p>
                      </div>

                      <span className="shrink-0 text-sm font-semibold tabular-nums text-[var(--foreground)]">
                        {currency(groupTotal)}
                      </span>
                    </div>

                    <div
                      className="mt-2.5 h-2 overflow-hidden rounded-full bg-[var(--surface-secondary)]"
                      role="progressbar"
                      aria-label={`${group.title} share of planned budget`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.min(percentage, 100)}
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barStyles[index]}`}
                        style={{
                          width: `${Math.min(
                            Math.max(percentage, 0),
                            100,
                          )}%`,
                        }}
                      />
                    </div>

                    <p className="mt-1.5 text-xs text-[var(--muted)]">
                      {percentage.toFixed(1)}% of planned budget
                    </p>
                  </div>
                );
              })}
            </div>

            <Link
              href="/budget"
              className="mt-6 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-secondary)]"
            >
              Manage categories
              <span aria-hidden="true">→</span>
            </Link>
          </section>

          {/* Transaction summary */}
          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-5">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Transaction summary
            </h2>

            <p className="mt-1 text-sm text-[var(--muted)]">
              Totals across all recorded transactions.
            </p>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--muted)]">
                  Recorded income
                </span>

                <span className="text-sm font-semibold tabular-nums text-[var(--success)]">
                  {currency(transactionIncomeCents)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[var(--muted)]">
                  Recorded expenses
                </span>

                <span className="text-sm font-semibold tabular-nums text-[var(--foreground)]">
                  {currency(totalSpentCents)}
                </span>
              </div>

              <div className="border-t border-[var(--border)] pt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    Net transactions
                  </span>

                  <span
                    className={`text-sm font-bold tabular-nums ${
                      transactionIncomeCents - totalSpentCents < 0
                        ? "text-[var(--danger)]"
                        : "text-[var(--success)]"
                    }`}
                  >
                    {currency(transactionIncomeCents - totalSpentCents)}
                  </span>
                </div>

                <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
                  Calculated from recorded transactions only, not your
                  configured base income.
                </p>
              </div>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  icon,
  accent,
}: {
  label: string;
  value: string;
  description: string;
  icon: "income" | "calendar" | "budget" | "expenses";
  accent: "blue" | "indigo" | "slate" | "amber";
}) {
  const iconStyles = {
    blue: "bg-blue-50 text-blue-700",
    indigo: "bg-indigo-50 text-indigo-700",
    slate: "bg-slate-100 text-slate-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <section className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-center gap-2.5">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${iconStyles[accent]}`}
          aria-hidden="true"
        >
          {icon === "income" && (
            <svg viewBox="0 0 24 24" fill="none" className="size-5">
              <path
                d="M12 19V5m-6 6 6-6 6 6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}

          {icon === "calendar" && (
            <svg viewBox="0 0 24 24" fill="none" className="size-5">
              <path
                d="M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1Zm3 8h3m-3 3h3"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}

          {icon === "budget" && (
            <svg viewBox="0 0 24 24" fill="none" className="size-5">
              <path
                d="M5 5h14v14H5zM8 9h8M8 12h8M8 15h5"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}

          {icon === "expenses" && (
            <svg viewBox="0 0 24 24" fill="none" className="size-5">
              <path
                d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>

        <p className="text-sm font-medium text-[var(--muted)]">
          {label}
        </p>
      </div>

      <p className="mt-4 break-words text-2xl font-bold tracking-tight tabular-nums text-[var(--foreground)] sm:text-[1.7rem]">
        {value}
      </p>

      <p className="mt-1.5 text-xs leading-5 text-[var(--muted)]">
        {description}
      </p>
    </section>
  );
}

export default function Dashboard() {
  return <DashboardContent />;
}
