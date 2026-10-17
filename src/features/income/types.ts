
export type PayFrequency = "weekly" | "fortnightly";

export type IncomeSettings = {
  payFrequency: PayFrequency;
  baseNetPayCents: number;
};

export type PayRecord = {
  id: string;
  payDate: string;
  basePayCents: number;
  overtimePayCents: number;
  otherIncomeCents: number;
  deductionsCents: number;
  netPayCents: number;
};
