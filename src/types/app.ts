export type CategoryType = "income" | "expense";

export type Category = {
  id: string;
  name: string;
  type: CategoryType;
  isActive?: boolean;
};

export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  date: any; // Firestore Timestamp
  /** Set when the document was created; tie-break for same-day rows on reports. */
  createdAt?: unknown;
  updatedAt?: unknown;
  amount: number;
  type: TransactionType;
  categoryId: string;
  description?: string;
  notes?: string;
  monthKey: string;
};

