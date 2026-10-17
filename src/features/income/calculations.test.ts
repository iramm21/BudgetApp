
import { describe, expect, it } from "vitest";
import { calculateEstimatedNetPay } from "./calculations";
import type { PayRecord } from "./types";

describe("calculateEstimatedNetPay", () => {
  it("calculates estimated net pay after deductions", () => {
    const record: PayRecord = {
      id: "pay-1",
      payDate: "2026-10-16",
      basePayCents: 235658,
      overtimePayCents: 42000,
      otherIncomeCents: 5000,
      deductionsCents: 30000,
      netPayCents: 0,
    };

    expect(calculateEstimatedNetPay(record)).toBe(252658);
  });
});

describe("calculateEstimatedNetPay", () => {
  it("calculates estimated net pay after deductions", () => {
    const record: PayRecord = {
      id: "pay-1",
      payDate: "2026-10-16",
      basePayCents: 235658,
      overtimePayCents: 0,
      otherIncomeCents: 0,
      deductionsCents: 30000,
      netPayCents: 0,
    };

    expect(calculateEstimatedNetPay(record)).toBe(205658);
  });
});
