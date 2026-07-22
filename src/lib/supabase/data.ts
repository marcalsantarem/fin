import type { SupabaseClient } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  user_id: string;
  name: string;
  default_currency: string;
  theme: "classic" | "atelier" | "pulse";
  color_mode: "light" | "dark" | "system";
};

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: string;
  initial_balance_cents: number;
  current_balance_cents: number;
  color: string;
  icon: string;
  active: boolean;
};

export type CreditCardRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  name: string;
  limit_amount_cents: number;
  closing_day: number;
  due_day: number;
  color: string;
  active: boolean;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  type: "income" | "expense";
  parent_id: string | null;
  color: string;
  icon: string;
  active: boolean;
};

export type TransactionRow = {
  id: string;
  user_id: string;
  type: "income" | "expense";
  description: string;
  amount_cents: number;
  transaction_date: string;
  due_date: string | null;
  paid_date: string | null;
  competence_month: string;
  account_id: string | null;
  credit_card_id: string | null;
  category_id: string | null;
  status: "pending" | "paid" | "overdue" | "cancelled" | "scheduled";
  notes: string | null;
  installment_group_id: string | null;
  recurrence_id: string | null;
  installment_number: number | null;
  installments_total: number | null;
  category: Pick<Category, "id" | "name" | "color" | "icon"> | null;
  account: Pick<Account, "id" | "name"> | null;
  credit_card: Pick<CreditCardRow, "id" | "name"> | null;
};

export type InstallmentGroup = {
  id: string;
  user_id: string;
  description: string;
  total_amount_cents: number;
  installments_count: number;
  first_due_date: string;
  category_id: string | null;
  account_id: string | null;
  credit_card_id: string | null;
  notes: string | null;
};

export type Recurrence = {
  id: string;
  user_id: string;
  description: string;
  amount_cents: number;
  type: "income" | "expense";
  frequency: "weekly" | "monthly" | "quarterly" | "semiannual" | "annual";
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  category_id: string | null;
  account_id: string | null;
  credit_card_id: string | null;
  active: boolean;
  category: Pick<Category, "id" | "name"> | null;
};

export type FinanceData = {
  profile: Profile | null;
  accounts: Account[];
  cards: CreditCardRow[];
  categories: Category[];
  transactions: TransactionRow[];
  installments: InstallmentGroup[];
  recurrences: Recurrence[];
};

export const emptyFinanceData: FinanceData = {
  profile: null,
  accounts: [],
  cards: [],
  categories: [],
  transactions: [],
  installments: [],
  recurrences: [],
};

export async function loadFinanceData(client: SupabaseClient): Promise<FinanceData> {
  const [profile, accounts, cards, categories, transactions, installments, recurrences] = await Promise.all([
    client.from("profiles").select("id,user_id,name,default_currency,theme,color_mode").maybeSingle(),
    client.from("accounts").select("id,user_id,name,type,initial_balance_cents,current_balance_cents,color,icon,active").is("deleted_at", null).order("created_at"),
    client.from("credit_cards").select("id,user_id,account_id,name,limit_amount_cents,closing_day,due_day,color,active").is("deleted_at", null).order("created_at"),
    client.from("categories").select("id,user_id,name,type,parent_id,color,icon,active").is("deleted_at", null).order("name"),
    client.from("transactions").select("id,user_id,type,description,amount_cents,transaction_date,due_date,paid_date,competence_month,account_id,credit_card_id,category_id,status,notes,installment_group_id,recurrence_id,installment_number,installments_total,category:categories(id,name,color,icon),account:accounts(id,name),credit_card:credit_cards(id,name)").is("deleted_at", null).order("due_date", { ascending: false }).order("created_at", { ascending: false }),
    client.from("installment_groups").select("id,user_id,description,total_amount_cents,installments_count,first_due_date,category_id,account_id,credit_card_id,notes").is("deleted_at", null).order("created_at", { ascending: false }),
    client.from("recurrences").select("id,user_id,description,amount_cents,type,frequency,day_of_month,start_date,end_date,category_id,account_id,credit_card_id,active,category:categories(id,name)").is("deleted_at", null).order("created_at", { ascending: false }),
  ]);

  const responseWithError = [profile, accounts, cards, categories, transactions, installments, recurrences].find((response) => response.error);
  if (responseWithError?.error) throw responseWithError.error;

  return {
    profile: profile.data as Profile | null,
    accounts: (accounts.data ?? []) as Account[],
    cards: (cards.data ?? []) as CreditCardRow[],
    categories: (categories.data ?? []) as Category[],
    transactions: (transactions.data ?? []) as unknown as TransactionRow[],
    installments: (installments.data ?? []) as InstallmentGroup[],
    recurrences: (recurrences.data ?? []) as unknown as Recurrence[],
  };
}
