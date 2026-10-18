
"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  SAVINGS_CATEGORIES,
  type SavingsCategory,
  type SavingsGoal,
} from "./types";
import {
  getSavingsGoals,
  createSavingsGoal,
  addSavingsContribution,
  deleteSavingsGoal,
} from "./actions";

const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 2,
});

function formatMoney(cents: number): string {
  return currency.format(cents / 100);
}

function dollarsToCents(value: string): number {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

export default function SavingsPage() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [pageError, setPageError] = useState("");

  const [goalName, setGoalName] = useState("");
  const [goalCategory, setGoalCategory] =
    useState<SavingsCategory>("Emergency Fund");
  const [goalTarget, setGoalTarget] = useState("");

  const [activeContributionId, setActiveContributionId] =
    useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadGoals() {
      try {
        const savedGoals = await getSavingsGoals();

        if (!cancelled) {
          setGoals(savedGoals);
          setPageError("");
        }
      } catch (error) {
        if (!cancelled) {
          setPageError(
            `Could not load your savings goals. ${getErrorMessage(error)}`,
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoaded(true);
        }
      }
    }

    void loadGoals();

    return () => {
      cancelled = true;
    };
  }, []);

  const totals = useMemo(() => {
    const saved = goals.reduce(
      (total, goal) => total + goal.savedAmountCents,
      0,
    );

    const target = goals.reduce(
      (total, goal) => total + goal.targetAmountCents,
      0,
    );

    const completed = goals.filter(
      (goal) => goal.savedAmountCents >= goal.targetAmountCents,
    ).length;

    const remaining = goals.reduce(
      (total, goal) =>
        total +
        Math.max(0, goal.targetAmountCents - goal.savedAmountCents),
      0,
    );

    return {
      saved,
      target,
      remaining,
      completed,
      progress: target > 0 ? Math.min(100, (saved / target) * 100) : 0,
    };
  }, [goals]);

  async function handleCreateGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = goalName.trim();
    const targetAmountCents = dollarsToCents(goalTarget);

    if (!name || targetAmountCents <= 0 || isSaving) return;

    setIsSaving(true);
    setPageError("");

    try {
      const createdGoal = await createSavingsGoal({
        name,
        category: goalCategory,
        targetAmountCents,
      });

      setGoals((currentGoals) => [...currentGoals, createdGoal]);
      setGoalName("");
      setGoalCategory("Emergency Fund");
      setGoalTarget("");
    } catch (error) {
      setPageError(
        `Could not create the savings goal. ${getErrorMessage(error)}`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleContribution(
    event: FormEvent<HTMLFormElement>,
    goalId: string,
  ) {
    event.preventDefault();

    const amountCents = dollarsToCents(contributionAmount);

    if (amountCents <= 0 || isSaving) return;

    setIsSaving(true);
    setPageError("");

    try {
      const updatedGoal = await addSavingsContribution(
        goalId,
        amountCents,
      );

      setGoals((currentGoals) =>
        currentGoals.map((goal) =>
          goal.id === updatedGoal.id ? updatedGoal : goal,
        ),
      );

      setContributionAmount("");
      setActiveContributionId(null);
    } catch (error) {
      setPageError(
        `Could not save the contribution. ${getErrorMessage(error)}`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteGoal(goalId: string) {
    const goal = goals.find((item) => item.id === goalId);

    if (!goal || isSaving) return;

    const confirmed = window.confirm(
      `Delete "${goal.name}" from your savings tracker? This removes its recorded balance from this app.`,
    );

    if (!confirmed) return;

    setIsSaving(true);
    setPageError("");

    try {
      await deleteSavingsGoal(goalId);

      setGoals((currentGoals) =>
        currentGoals.filter((item) => item.id !== goalId),
      );

      if (activeContributionId === goalId) {
        setActiveContributionId(null);
        setContributionAmount("");
      }
    } catch (error) {
      setPageError(
        `Could not delete the savings goal. ${getErrorMessage(error)}`,
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (!isLoaded) {
    return (
      <main className="mx-auto w-full max-w-7xl space-y-7 pb-10">
        <header className="space-y-2">
          <p className="text-sm font-semibold text-[var(--primary)]">
            YOUR FINANCIAL FUTURE
          </p>
          <h1>Savings</h1>
          <p className="text-sm text-[var(--muted)]">
            Set meaningful goals, track your progress, and build your savings
            one contribution at a time.
          </p>
        </header>

        <section
          className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-6"
          aria-live="polite"
        >
          <p className="text-sm text-[var(--muted)]">
            Loading your savings...
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl space-y-7 pb-10">
      <header className="space-y-2">
        <p className="text-sm font-semibold text-[var(--primary)]">
          YOUR FINANCIAL FUTURE
        </p>
        <h1>Savings</h1>
        <p className="max-w-2xl text-sm text-[var(--muted)]">
          Set meaningful goals, track your progress, and build your savings
          one contribution at a time.
        </p>
      </header>

      {pageError && (
        <div
          role="alert"
          className="rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--danger-background)] p-4 text-sm text-[var(--danger)]"
        >
          {pageError}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total saved"
          value={formatMoney(totals.saved)}
          detail="Across all your goals"
        />
        <SummaryCard
          label="Combined targets"
          value={formatMoney(totals.target)}
          detail={`${goals.length} savings ${goals.length === 1 ? "goal" : "goals"}`}
        />
        <SummaryCard
          label="Still to save"
          value={formatMoney(totals.remaining)}
          detail="To reach your targets"
        />
        <SummaryCard
          label="Goals completed"
          value={`${totals.completed} / ${goals.length}`}
          detail="Targets reached"
        />
      </section>

      <section className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Overall progress</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Your combined saved balance compared with all targets.
            </p>
          </div>
          <span className="text-lg font-bold text-[var(--primary)]">
            {formatPercent(totals.progress)}
          </span>
        </div>

        <div
          className="h-3 overflow-hidden rounded-full bg-[var(--surface-secondary)]"
          role="progressbar"
          aria-label="Overall savings progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(totals.progress)}
        >
          <div
            className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-300"
            style={{ width: `${totals.progress}%` }}
          />
        </div>

        <div className="mt-3 flex justify-between gap-3 text-sm text-[var(--muted)]">
          <span>{formatMoney(totals.saved)} saved</span>
          <span>{formatMoney(totals.target)} target</span>
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Your savings goals</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Track each goal separately.
              </p>
            </div>
            <span className="rounded-full bg-[var(--surface)] px-3 py-1 text-sm font-medium text-[var(--muted)] ring-1 ring-[var(--border)]">
              {goals.length} total
            </span>
          </div>

          {goals.length === 0 ? (
            <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-6 py-12 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-secondary)]">
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6 text-[var(--primary)]"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7v10M7 12h10" />
                </svg>
              </div>
              <h3 className="text-base font-semibold">
                Start your first savings goal
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">
                Whether it is an emergency fund or a house deposit, give your
                money a purpose.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {goals.map((goal) => {
                const progress =
                  (goal.savedAmountCents / goal.targetAmountCents) * 100;
                const cappedProgress = Math.min(100, progress);
                const remaining = Math.max(
                  0,
                  goal.targetAmountCents - goal.savedAmountCents,
                );
                const isComplete =
                  goal.savedAmountCents >= goal.targetAmountCents;

                return (
                  <article
                    key={goal.id}
                    className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <span className="inline-flex rounded-full bg-[var(--surface-secondary)] px-2.5 py-1 text-xs font-semibold text-[var(--muted)]">
                          {goal.category}
                        </span>
                        <h3 className="mt-3 break-words text-lg font-bold">
                          {goal.name}
                        </h3>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {isComplete
                            ? "Target reached — excellent work!"
                            : `${formatMoney(remaining)} left to reach your target`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleDeleteGoal(goal.id)}
                        disabled={isSaving}
                        className="self-start rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] transition hover:bg-[var(--danger-background)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label={`Delete ${goal.name}`}
                      >
                        Delete
                      </button>
                    </div>

                    <div className="mt-5 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-[var(--muted)]">
                          SAVED SO FAR
                        </p>
                        <p className="mt-1 break-words text-2xl font-bold tracking-tight">
                          {formatMoney(goal.savedAmountCents)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-medium text-[var(--muted)]">
                          TARGET
                        </p>
                        <p className="mt-1 font-semibold">
                          {formatMoney(goal.targetAmountCents)}
                        </p>
                      </div>
                    </div>

                    <div
                      className="mt-4 h-2.5 overflow-hidden rounded-full bg-[var(--surface-secondary)]"
                      role="progressbar"
                      aria-label={`${goal.name} progress`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(cappedProgress)}
                    >
                      <div
                        className={`h-full rounded-full transition-[width] duration-300 ${
                          isComplete
                            ? "bg-[var(--success)]"
                            : "bg-[var(--primary)]"
                        }`}
                        style={{ width: `${cappedProgress}%` }}
                      />
                    </div>

                    <div className="mt-2 text-right text-xs font-semibold text-[var(--muted)]">
                      {formatPercent(cappedProgress)}
                    </div>

                    {activeContributionId === goal.id ? (
                      <form
                        onSubmit={(event) =>
                          void handleContribution(event, goal.id)
                        }
                        className="mt-5 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] p-4"
                      >
                        <label
                          htmlFor={`contribution-${goal.id}`}
                          className="mb-2 block text-sm font-semibold"
                        >
                          Contribution amount (AUD)
                        </label>
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <input
                            id={`contribution-${goal.id}`}
                            type="number"
                            min="0.01"
                            step="0.01"
                            inputMode="decimal"
                            required
                            autoFocus
                            value={contributionAmount}
                            onChange={(event) =>
                              setContributionAmount(event.target.value)
                            }
                            placeholder="e.g. 100.00"
                            disabled={isSaving}
                            className="min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 outline-none transition focus:border-[var(--primary)] disabled:opacity-60"
                          />
                          <button
                            type="submit"
                            disabled={isSaving}
                            className="rounded-lg bg-[var(--primary)] px-4 py-2.5 font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isSaving ? "Saving..." : "Save contribution"}
                          </button>
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => {
                              setActiveContributionId(null);
                              setContributionAmount("");
                            }}
                            className="rounded-lg border border-[var(--border)] px-4 py-2.5 font-semibold transition hover:bg-[var(--surface)] disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => {
                          setActiveContributionId(goal.id);
                          setContributionAmount("");
                        }}
                        className="mt-5 w-full rounded-lg bg-[var(--primary)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        + Add contribution
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <aside className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-6">
          <h2 className="text-lg font-bold">Create a savings goal</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Set a target and start tracking your progress.
          </p>

          <form onSubmit={(event) => void handleCreateGoal(event)} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="goal-name"
                className="mb-1.5 block text-sm font-semibold"
              >
                Goal name
              </label>
              <input
                id="goal-name"
                type="text"
                maxLength={80}
                required
                value={goalName}
                onChange={(event) => setGoalName(event.target.value)}
                placeholder="e.g. First home deposit"
                disabled={isSaving}
                className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 outline-none transition focus:border-[var(--primary)] disabled:opacity-60"
              />
            </div>

            <div>
              <label
                htmlFor="goal-category"
                className="mb-1.5 block text-sm font-semibold"
              >
                Category
              </label>
              <select
                id="goal-category"
                value={goalCategory}
                onChange={(event) =>
                  setGoalCategory(event.target.value as SavingsCategory)
                }
                disabled={isSaving}
                className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 outline-none transition focus:border-[var(--primary)] disabled:opacity-60"
              >
                {SAVINGS_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="goal-target"
                className="mb-1.5 block text-sm font-semibold"
              >
                Target amount (AUD)
              </label>
              <input
                id="goal-target"
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                required
                value={goalTarget}
                onChange={(event) => setGoalTarget(event.target.value)}
                placeholder="e.g. 20000.00"
                disabled={isSaving}
                className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 outline-none transition focus:border-[var(--primary)] disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Create savings goal"}
            </button>
          </form>

          <div className="mt-6 rounded-[var(--radius-md)] bg-[var(--surface-secondary)] p-4">
            <h3 className="text-sm font-semibold">A useful reminder</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Keep your goal balances up to date with your real savings. This
              tracker does not verify your bank balance or transfer money.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]">
      <p className="text-sm font-medium text-[var(--muted)]">{label}</p>
      <p className="mt-2 break-words text-2xl font-bold tracking-tight">
        {value}
      </p>
      <p className="mt-2 text-xs text-[var(--muted)]">{detail}</p>
    </article>
  );
}
