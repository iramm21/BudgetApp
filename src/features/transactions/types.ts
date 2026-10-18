
export type TransactionType = "expense" | "income";

export type Transaction = {
  id: string;
  description: string;
  amountCents: number;
  date: string;
  categoryId: string;
  type: TransactionType;
};

export type TransactionDraft = Omit<Transaction, "id">;

/**
 * Database-compatible transaction shape.
 * A transaction can exist without a category.
 */
export type DatabaseTransaction = Omit<Transaction, "categoryId"> & {
  categoryId: string | null;
};
