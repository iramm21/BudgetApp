
import type { Metadata } from "next";
import SavingsPage from "@/features/savings/SavingsPage";

export const metadata: Metadata = {
  title: "Savings",
};

export default function Page() {
  return <SavingsPage />;
}
