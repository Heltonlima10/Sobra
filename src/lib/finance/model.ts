export type FlowKind = "expense" | "income";

export type Category = {
  id: string;
  name: string;
  kind: FlowKind;
  bucket: "need" | "want" | "income";
  weight: number;
  icon: string;
};

export type Transaction = {
  id: string;
  kind: FlowKind;
  amountCents: number;
  categoryId: string;
  date: string;
  note: string;
  createdAt: string;
};

export type Goal = {
  id: string;
  name: string;
  targetCents: number;
  initialCents: number;
};

export type Contribution = {
  id: string;
  goalId: string;
  amountCents: number;
  date: string;
  note: string;
  createdAt: string;
};

export type FinanceData = {
  onboarded: boolean;
  monthlyIncomeCents: number;
  savingsPercent: number;
  transactions: Transaction[];
  contributions: Contribution[];
  budgets: Record<string, number>;
  budgetBasisCents: number | null;
  budgetSavingsPercent: number | null;
  goals: Goal[];
  sample: boolean;
};

export const CATEGORIES: Category[] = [
  { id: "moradia", name: "Moradia", kind: "expense", bucket: "need", weight: 30, icon: "home" },
  { id: "mercado", name: "Mercado", kind: "expense", bucket: "need", weight: 12, icon: "basket" },
  { id: "contas", name: "Contas", kind: "expense", bucket: "need", weight: 8, icon: "receipt" },
  { id: "transporte", name: "Transporte", kind: "expense", bucket: "need", weight: 6, icon: "bus" },
  { id: "saude", name: "Saúde", kind: "expense", bucket: "need", weight: 4, icon: "health" },
  { id: "educacao", name: "Educação", kind: "expense", bucket: "need", weight: 2, icon: "study" },
  { id: "comer-fora", name: "Comer fora", kind: "expense", bucket: "want", weight: 6, icon: "food" },
  { id: "lazer", name: "Lazer", kind: "expense", bucket: "want", weight: 5, icon: "ticket" },
  { id: "assinaturas", name: "Assinaturas", kind: "expense", bucket: "want", weight: 3, icon: "repeat" },
  { id: "compras", name: "Compras", kind: "expense", bucket: "want", weight: 4, icon: "bag" },
  { id: "pessoal", name: "Pessoal", kind: "expense", bucket: "want", weight: 2, icon: "user" },
  { id: "salario", name: "Salário", kind: "income", bucket: "income", weight: 0, icon: "wallet" },
  { id: "extra", name: "Extra", kind: "income", bucket: "income", weight: 0, icon: "plus" },
  { id: "outras-entradas", name: "Outras entradas", kind: "income", bucket: "income", weight: 0, icon: "down" },
];

const ESSENTIAL_IDS = ["moradia", "mercado", "contas", "transporte"] as const;

export function categoryById(id: string): Category | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

export function categoriesByKind(kind: FlowKind): Category[] {
  return CATEGORIES.filter((category) => category.kind === kind);
}

export function uid(): string {
  return crypto.randomUUID();
}

export function todayISO(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "01";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function currentMonthKey(now = new Date()): string {
  return todayISO(now).slice(0, 7);
}

export function parseISODate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function daysInMonth(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year ?? 1970, month ?? 1, 0).getDate();
}

export function shiftMonth(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(year ?? 1970, (month ?? 1) - 1 + delta, 1);
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${nextMonth}`;
}

export function monthIndex(monthKey: string): number {
  const [year, month] = monthKey.split("-").map(Number);
  return (year ?? 0) * 12 + ((month ?? 1) - 1);
}

export function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseBRL(input: string): number | null {
  const clean = input.trim().replace(/\s/g, "").replace(/^R\$\s?/i, "");
  if (!clean) return null;
  const normalized = clean.includes(",") ? clean.replace(/\./g, "").replace(",", ".") : clean;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

export function suggestedBudgets(incomeCents: number, savingsPercent: number): Record<string, number> {
  const spendable = Math.max(0, Math.round((incomeCents * (100 - savingsPercent)) / 100));
  const expenses = CATEGORIES.filter((category) => category.kind === "expense");
  const weightSum = expenses.reduce((sum, category) => sum + category.weight, 0);
  const budgets: Record<string, number> = {};
  let assigned = 0;
  expenses.forEach((category, index) => {
    if (index === expenses.length - 1) {
      budgets[category.id] = Math.max(0, spendable - assigned);
      return;
    }
    const amount = Math.round((spendable * category.weight) / weightSum);
    budgets[category.id] = amount;
    assigned += amount;
  });
  return budgets;
}

export function emergencyTarget(incomeCents: number, budgets: Record<string, number>): number {
  const fromBudgets = ESSENTIAL_IDS.reduce((sum, id) => sum + (budgets[id] ?? 0), 0);
  const monthly = fromBudgets > 0 ? fromBudgets : Math.round(incomeCents * 0.5);
  return Math.max(300000, monthly * 3);
}

export type CategorySpend = {
  category: Category;
  spent: number;
  limit: number;
};

export type MonthSnapshot = {
  month: string;
  isCurrent: boolean;
  dayOfMonth: number;
  daysInMonth: number;
  plannedIncome: number;
  received: number;
  spent: number;
  saved: number;
  base: number;
  reserved: number;
  leftToSpend: number;
  projectedSpend: number | null;
  perDay: number | null;
  byCategory: CategorySpend[];
  monthTransactions: Transaction[];
  monthContributions: Contribution[];
};

export function deriveMonth(data: FinanceData, month: string, today = todayISO()): MonthSnapshot {
  const isCurrent = today.slice(0, 7) === month;
  const dim = daysInMonth(month);
  const dayOfMonth = isCurrent ? Number(today.slice(8, 10)) : dim;
  const monthTransactions = data.transactions.filter((item) => item.date.startsWith(month));
  const monthContributions = data.contributions.filter((item) => item.date.startsWith(month));
  const received = monthTransactions
    .filter((item) => item.kind === "income")
    .reduce((sum, item) => sum + item.amountCents, 0);
  const spent = monthTransactions
    .filter((item) => item.kind === "expense")
    .reduce((sum, item) => sum + item.amountCents, 0);
  const saved = monthContributions.reduce((sum, item) => sum + item.amountCents, 0);
  const plannedIncome = data.monthlyIncomeCents;
  const base = received > 0 ? received : plannedIncome;
  const reserved = Math.round((base * data.savingsPercent) / 100);
  const committedSave = Math.max(reserved, saved);
  const leftToSpend = base - committedSave - spent;
  const byCategory = CATEGORIES.filter((category) => category.kind === "expense").map((category) => ({
    category,
    spent: monthTransactions
      .filter((item) => item.kind === "expense" && item.categoryId === category.id)
      .reduce((sum, item) => sum + item.amountCents, 0),
    limit: data.budgets[category.id] ?? 0,
  }));

  let projectedSpend: number | null = null;
  let perDay: number | null = null;
  if (isCurrent && dayOfMonth > 0 && base > 0) {
    if (spent > 0) projectedSpend = Math.round((spent / dayOfMonth) * dim);
    const daysLeft = Math.max(1, dim - dayOfMonth + 1);
    const room = base - committedSave;
    perDay = Math.max(0, Math.round((room - spent) / daysLeft));
  }

  return {
    month,
    isCurrent,
    dayOfMonth,
    daysInMonth: dim,
    plannedIncome,
    received,
    spent,
    saved,
    base,
    reserved,
    leftToSpend,
    projectedSpend,
    perDay,
    byCategory,
    monthTransactions,
    monthContributions,
  };
}

export type Tone = "alert" | "warn" | "good" | "info";

export function prognosis(snapshot: MonthSnapshot): { tone: Tone; text: string } | null {
  if (snapshot.base <= 0 && snapshot.spent <= 0) {
    return {
      tone: "info",
      text: "Coloque quanto entra por mês para saber o que ainda pode sair.",
    };
  }
  if (snapshot.base <= 0) {
    return {
      tone: "warn",
      text: "Há saídas, mas nenhuma renda. Defina quanto entra para ver se o mês cabe.",
    };
  }
  if (snapshot.spent <= 0 && snapshot.saved <= 0) {
    return {
      tone: "info",
      text: `Se guardar ${snapshot.reserved > 0 ? formatBRL(snapshot.reserved) : "a meta"}, o resto pode ser gasto. Anote a primeira saída no dia em que ela acontecer.`,
    };
  }
  if (!snapshot.isCurrent) {
    if (snapshot.leftToSpend >= 0) {
      return {
        tone: "good",
        text: `Este mês fechou com ${formatBRL(snapshot.leftToSpend)} dentro do plano.`,
      };
    }
    return {
      tone: "alert",
      text: `Este mês fechou ${formatBRL(Math.abs(snapshot.leftToSpend))} além do plano.`,
    };
  }
  if (snapshot.projectedSpend != null && snapshot.projectedSpend > snapshot.base) {
    return {
      tone: "alert",
      text: `Nesse ritmo as saídas fecham em ${formatBRL(snapshot.projectedSpend)}, acima do que entra. Segure o que não for conta fixa.`,
    };
  }
  if (
    snapshot.projectedSpend != null &&
    snapshot.projectedSpend > snapshot.base - Math.max(snapshot.reserved, snapshot.saved)
  ) {
    const daily =
      snapshot.perDay && snapshot.perDay > 0
        ? ` Cerca de ${formatBRL(snapshot.perDay)} por dia mantém a meta de guardar.`
        : " Não sobra cota diária sem furar a meta.";
    return {
      tone: "warn",
      text: `Nesse ritmo as saídas fecham em ${formatBRL(snapshot.projectedSpend)} e a meta de guardar não cabe.${daily}`,
    };
  }
  if (snapshot.spent > 0) {
    return {
      tone: "good",
      text: "Nesse ritmo o mês fecha com a meta de guardar inteira. Separe esse valor antes que vire gasto.",
    };
  }
  return null;
}

export function spendByBucket(snapshot: MonthSnapshot): { need: number; want: number } {
  let need = 0;
  let want = 0;
  for (const row of snapshot.byCategory) {
    if (row.category.bucket === "need") need += row.spent;
    else if (row.category.bucket === "want") want += row.spent;
  }
  return { need, want };
}

export function goalSaved(goal: Goal, contributions: Contribution[]): number {
  return (
    goal.initialCents +
    contributions.filter((item) => item.goalId === goal.id).reduce((sum, item) => sum + item.amountCents, 0)
  );
}

export function defaultEntryDate(month: string, today = todayISO()): string {
  if (today.startsWith(month)) return today;
  return `${month}-01`;
}
