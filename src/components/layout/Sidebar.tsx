
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "Overview", href: "/" },
  { label: "Income", href: "/income" },
  { label: "Budget", href: "/budget" },
  { label: "Transactions", href: "/transactions" },
  { label: "Savings", href: "/savings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex min-h-screen w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] px-4 py-6 sm:w-64 sm:px-5">
      {/* Brand */}
      <Link
        href="/"
        className="mb-10 flex items-center gap-3 rounded-lg px-2 outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label="Budget home"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-white shadow-sm">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="size-5"
            aria-hidden="true"
          >
            <path
              d="M4 19V5M4 19H20M8 15V11M12 15V7M16 15V9"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="min-w-0">
          <p className="text-lg font-bold tracking-tight text-[var(--foreground)]">
            Budget
          </p>
          <p className="text-xs font-medium text-[var(--muted)]">
            Personal finance
          </p>
        </div>
      </Link>

      {/* Navigation */}
      <nav aria-label="Main navigation" className="flex-1">
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted-light)]">
          Workspace
        </p>

        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--primary)] shadow-[var(--shadow-card)]"
                      : "border-transparent text-[var(--muted)] hover:border-[var(--border)] hover:bg-[var(--surface-secondary)] hover:text-[var(--foreground)]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${
                      isActive
                        ? "bg-[var(--primary)]"
                        : "bg-[var(--border-strong)] group-hover:bg-[var(--muted)]"
                    }`}
                    aria-hidden="true"
                  />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="mt-8 border-t border-[var(--border)] px-3 pt-5">
        <p className="text-xs font-medium text-[var(--muted)]">
          Take control of your money.
        </p>
        <p className="mt-1 text-xs text-[var(--muted-light)]">
          Plan · Track · Improve
        </p>
      </div>
    </aside>
  );
}
