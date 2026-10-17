
"use client";

import { useState, useSyncExternalStore, type FormEvent } from "react";
import { DEFAULT_CATEGORIES, loadBudgetPlan } from "@/features/budget/storage";
import { loadTransactions, saveTransactions } from "./storage";
import type { Transaction, TransactionType } from "./types";
import {
  calculateTotalExpensesCents,
  calculateTotalIncomeCents,
} from "./calculations";

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

const currency = (cents: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
  }).format(cents / 100);

function todayLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);

  if (!year || !month || !day) return date;

  return new Intl.DateTimeFormat("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function TransactionsForm() {
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    loadTransactions(),
  );

  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayLocal);
  const [categoryId, setCategoryId] = useState(DEFAULT_CATEGORIES[0].id);
  const [type, setType] = useState<TransactionType>("expense");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const budgetPlan = loadBudgetPlan();
  const categories = budgetPlan.categories.length
    ? budgetPlan.categories
    : DEFAULT_CATEGORIES;

  const totalExpenses = calculateTotalExpensesCents(transactions);
  const totalIncome = calculateTotalIncomeCents(transactions);
  const balance = totalIncome - totalExpenses;

  function clearFeedback() {
    setMessage("");
    setError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearFeedback();

    const numericAmount = Number(amount);
    const amountCents = Math.round(numericAmount * 100);

    if (!description.trim()) {
      setError("Enter a description.");
      return;
    }

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !Number.isSafeInteger(amountCents)
    ) {
      setError("Enter a valid amount greater than $0.");
      return;
    }

    if (!date) {
      setError("Choose a transaction date.");
      return;
    }

    if (
      type === "expense" &&
      !categories.some((category) => category.id === categoryId)
    ) {
      setError("Choose a valid budget category.");
      return;
    }

    const transaction: Transaction = {
      id: crypto.randomUUID(),
      description: description.trim(),
      amountCents,
      date,
      categoryId: type === "expense" ? categoryId : "income",
      type,
    };

    const updatedTransactions = [transaction, ...transactions];

    if (!saveTransactions(updatedTransactions)) {
      setError("Could not save. Check your browser storage settings.");
      return;
    }

    setTransactions(updatedTransactions);
    setDescription("");
    setAmount("");
    setDate(todayLocal());
    setError("");
    setMessage("Transaction saved.");
  }

  function handleDelete(id: string) {
    clearFeedback();

    const updatedTransactions = transactions.filter(
      (transaction) => transaction.id !== id,
    );

    if (!saveTransactions(updatedTransactions)) {
      setError("Could not delete the transaction. Please try again.");
      return;
    }

    setTransactions(updatedTransactions);
    setMessage("Transaction deleted.");
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Finances / Transactions
        </p>

        <div className="space-y-2">
          <h1>Transactions</h1>
          <p className="max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">
            Record money coming in and going out to keep your financial
            picture up to date.
          </p>
        </div>
      </header>

      {/* Financial summary */}
      <section
        aria-label="Transaction totals"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--muted)]">
                Recorded expenses
              </p>
              <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-[var(--foreground)] sm:text-3xl">
                {currency(totalExpenses)}
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Total expenses recorded
              </p>
            </div>

            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--danger-background)] text-[var(--danger)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-5"
                aria-hidden="true"
              >
                <path
                  d="M12 5v14m-6-6 6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--muted)]">
                Recorded income
              </p>
              <p className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-[var(--success)] sm:text-3xl">
                {currency(totalIncome)}
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Total income recorded
              </p>
            </div>

            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--success-background)] text-[var(--success)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-5"
                aria-hidden="true"
              >
                <path
                  d="M12 19V5m-6 6 6-6 6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:col-span-2 sm:p-6 xl:col-span-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--muted)]">
                Net recorded movement
              </p>
              <p
                className={`mt-3 text-2xl font-bold tracking-tight tabular-nums sm:text-3xl ${
                  balance >= 0
                    ? "text-[var(--success)]"
                    : "text-[var(--danger)]"
                }`}
              >
                {balance < 0 ? "−" : ""}
                {currency(Math.abs(balance))}
              </p>
              <p className="mt-2 text-xs text-[var(--muted)]">
                Income minus expenses
              </p>
            </div>

            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-secondary)] text-[var(--primary)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-5"
                aria-hidden="true"
              >
                <rect
                  x="3.5"
                  y="5.5"
                  width="17"
                  height="13"
                  rx="2"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path
                  d="M3.5 10h17M7.5 14h3"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Add transaction */}
      <section className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div className="mb-6">
          <h2>Add transaction</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            Add income or expenses as they happen. Expense transactions
            are assigned to one of your budget categories.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                htmlFor="type"
                className="block text-sm font-semibold text-[var(--foreground)]"
              >
                Transaction type
              </label>
              <select
                id="type"
                name="type"
                value={type}
                onChange={(event) => {
                  setType(event.target.value as TransactionType);
                  clearFeedback();
                }}
                className="min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-3 text-sm transition-colors hover:border-[var(--muted-light)] focus-visible:outline-none"
              >
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="date"
                className="block text-sm font-semibold text-[var(--foreground)]"
              >
                Date
              </label>
              <input
                id="date"
                name="date"
                type="date"
                required
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  clearFeedback();
                }}
                className="min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-3 text-sm transition-colors hover:border-[var(--muted-light)] focus-visible:outline-none"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="description"
                className="block text-sm font-semibold text-[var(--foreground)]"
              >
                Description
              </label>
              <input
                id="description"
                name="description"
                required
                maxLength={100}
                value={description}
                onChange={(event) => {
                  setDescription(event.target.value);
                  clearFeedback();
                }}
                placeholder="e.g. Weekly groceries"
                className="min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-3 text-sm transition-colors hover:border-[var(--muted-light)] focus-visible:outline-none"
              />
              <p className="text-xs text-[var(--muted)]">
                Use a short, recognisable description.
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="amount"
                className="block text-sm font-semibold text-[var(--foreground)]"
              >
                Amount <span className="font-normal text-[var(--muted)]">(AUD)</span>
              </label>
              <div className="relative">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
                >
                  $
                </span>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  required
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    clearFeedback();
                  }}
                  placeholder="0.00"
                  className="min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] py-3 pl-8 pr-3.5 text-sm tabular-nums transition-colors hover:border-[var(--muted-light)] focus-visible:outline-none"
                />
              </div>
            </div>
          </div>

          {type === "expense" && (
            <div className="space-y-2">
              <label
                htmlFor="category"
                className="block text-sm font-semibold text-[var(--foreground)]"
              >
                Budget category
              </label>
              <select
                id="category"
                name="category"
                value={categoryId}
                onChange={(event) => {
                  setCategoryId(event.target.value);
                  clearFeedback();
                }}
                className="min-h-12 w-full rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-3 text-sm transition-colors hover:border-[var(--muted-light)] focus-visible:outline-none"
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-[var(--muted)]">
                Choose the category this expense belongs to.
              </p>
            </div>
          )}

          <div className="space-y-3 border-t border-[var(--border)] pt-5">
            <button
              type="submit"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[var(--primary-hover)] sm:w-auto"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-4"
                aria-hidden="true"
              >
                <path
                  d="M12 5v14m-7-7h14"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Add transaction
            </button>

            {message && (
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
                {message}
              </p>
            )}

            {error && (
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
                    d="M12 8v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 0l7.5-13.1a2 2 0 0 0-3.4 0Z"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                {error}
              </p>
            )}
          </div>
        </form>
      </section>

      {/* Transaction history */}
      <section className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-5 sm:px-7">
          <div>
            <h2>Transaction history</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {transactions.length} recorded{" "}
              {transactions.length === 1 ? "transaction" : "transactions"}
            </p>
          </div>

          <div className="rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--muted)]">
            Most recent first
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[var(--surface-secondary)] text-[var(--muted)]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="size-6"
                aria-hidden="true"
              >
                <path
                  d="M7 3.75h7l4.25 4.5v11A1.75 1.75 0 0 1 16.5 21h-9A1.75 1.75 0 0 1 5.75 19.25V5.5A1.75 1.75 0 0 1 7.5 3.75Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path
                  d="M14 4v5h4m-9 4h6m-6 3h6"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            <h3 className="mt-4">No transactions yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--muted)]">
              Add your first income or expense above. Your recorded
              transactions will appear here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {transactions.map((transaction) => {
              const category = categories.find(
                (item) => item.id === transaction.categoryId,
              );
              const isIncome = transaction.type === "income";

              return (
                <li
                  key={transaction.id}
                  className="flex flex-col gap-4 px-5 py-4 transition-colors hover:bg-[var(--surface-secondary)]/70 sm:flex-row sm:items-center sm:justify-between sm:px-7"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
                        isIncome
                          ? "bg-[var(--success-background)] text-[var(--success)]"
                          : "bg-[var(--danger-background)] text-[var(--danger)]"
                      }`}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        className="size-5"
                        aria-hidden="true"
                      >
                        {isIncome ? (
                          <path
                            d="M12 19V5m-6 6 6-6 6 6"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ) : (
                          <path
                            d="M12 5v14m-6-6 6 6 6-6"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        )}
                      </svg>
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">
                        {transaction.description}
                      </p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {formatDate(transaction.date)}
                        <span aria-hidden="true"> · </span>
                        {isIncome ? "Income" : category?.name ?? "Uncategorised"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-4 pl-[52px] sm:justify-end sm:pl-0">
                    <p
                      className={`whitespace-nowrap text-sm font-bold tabular-nums ${
                        isIncome
                          ? "text-[var(--success)]"
                          : "text-[var(--foreground)]"
                      }`}
                    >
                      {isIncome ? "+" : "−"}
                      {currency(transaction.amountCents)}
                    </p>

                    <button
                      type="button"
                      onClick={() => handleDelete(transaction.id)}
                      aria-label={`Delete ${transaction.description}`}
                      className="inline-flex min-h-9 items-center justify-center rounded-lg border border-transparent px-3 py-2 text-xs font-semibold text-[var(--danger)] transition-colors hover:border-[var(--danger)]/20 hover:bg-[var(--danger-background)] focus-visible:outline-none"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function TransactionsPage() {
  const isMounted = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  if (!isMounted) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-3">
          <div className="h-3 w-40 animate-pulse rounded bg-[var(--border)]" />
          <div className="h-8 w-64 animate-pulse rounded bg-[var(--border)]" />
          <div className="h-4 w-80 max-w-full animate-pulse rounded bg-[var(--border)]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="h-32 animate-pulse rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]" />
          <div className="h-32 animate-pulse rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)]" />
        </div>
      </div>
    );
  }

  return <TransactionsForm />;
}
