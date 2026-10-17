import type { PayRecord } from "./types";

export function calculateEstimatedNetPay(record: PayRecord): number {
  const { basePayCents, overtimePayCents, otherIncomeCents, deductionsCents } = record;
  return basePayCents + overtimePayCents + otherIncomeCents - deductionsCents;
}