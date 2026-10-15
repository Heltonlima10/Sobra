import { CATEGORIES, type MonthSnapshot } from "@/lib/finance/model";
import { flowFromLeaves, type Cashflow, type FlowRole } from "@/lib/finance/flow";

export type SimLine = {
  id: string;
  name: string;
  kind: "income" | "expense";
  role: FlowRole;
  cents: number;
};

const MAX_LEAVES = 6;

function incomeName(categoryId: string): string {
  if (categoryId === "outras-entradas") return "Outras";
  return CATEGORIES.find((category) => category.id === categoryId)?.name ?? "Entrada";
}

export function seedSimulation(snapshot: MonthSnapshot): SimLine[] {
  const byId = new Map<string, number>();
  for (const tx of snapshot.monthTransactions) {
    if (tx.kind !== "income" || tx.amountCents <= 0) continue;
    byId.set(tx.categoryId, (byId.get(tx.categoryId) ?? 0) + tx.amountCents);
  }

  const incomes: SimLine[] = [];
  if (byId.size > 0) {
    for (const [id, cents] of byId) {
      incomes.push({ id: `in:${id}`, name: incomeName(id), kind: "income", role: "in", cents });
    }
    incomes.sort((a, b) => b.cents - a.cents);
    if (!incomes.some((line) => line.id === "in:extra")) {
      incomes.push({ id: "in:extra", name: "Extra", kind: "income", role: "in", cents: 0 });
    }
  } else if (snapshot.plannedIncome > 0) {
    incomes.push({
      id: "in:previsto",
      name: "Renda prevista",
      kind: "income",
      role: "in",
      cents: snapshot.plannedIncome,
    });
    incomes.push({ id: "in:extra", name: "Extra", kind: "income", role: "in", cents: 0 });
  } else {
    incomes.push({ id: "in:renda", name: "Renda", kind: "income", role: "in", cents: 0 });
  }

  const expenses: SimLine[] = CATEGORIES.filter((category) => category.kind === "expense").map((category) => {
    const spent = snapshot.byCategory.find((row) => row.category.id === category.id)?.spent ?? 0;
    return {
      id: `ex:${category.id}`,
      name: category.name,
      kind: "expense" as const,
      role: category.bucket === "want" ? "want" : "need",
      cents: spent,
    };
  });
  expenses.sort((a, b) => b.cents - a.cents || a.name.localeCompare(b.name, "pt-BR"));

  return [...incomes, ...expenses];
}

export function applyOverrides(seed: SimLine[], overrides: Record<string, number>): SimLine[] {
  return seed.map((line) => ({ ...line, cents: overrides[line.id] ?? line.cents }));
}

export function simulationTotals(lines: SimLine[]): { income: number; expense: number; balance: number; rate: number } {
  const income = lines.filter((line) => line.kind === "income").reduce((sum, line) => sum + line.cents, 0);
  const expense = lines.filter((line) => line.kind === "expense").reduce((sum, line) => sum + line.cents, 0);
  const balance = income - expense;
  const rate = income > 0 ? Math.round((balance / income) * 100) : 0;
  return { income, expense, balance, rate };
}

export function sliderMax(kind: SimLine["kind"], seedCents: number): number {
  const floor = kind === "income" ? 1_500_000 : 600_000;
  const scaled = Math.ceil((seedCents * 1.75) / 10_000) * 10_000;
  return Math.max(floor, scaled, seedCents);
}

export function simulationFlow(lines: SimLine[]): Cashflow | null {
  const sources = lines
    .filter((line) => line.kind === "income" && line.cents > 0)
    .map((line) => ({ name: line.name, role: line.role, cents: line.cents }));
  let dests = lines
    .filter((line) => line.kind === "expense" && line.cents > 0)
    .map((line) => ({ name: line.name, role: line.role, cents: line.cents }));

  const income = sources.reduce((sum, leaf) => sum + leaf.cents, 0);
  const expense = dests.reduce((sum, leaf) => sum + leaf.cents, 0);
  if (income === 0 && expense === 0) return null;

  let grouped = false;
  if (dests.length > MAX_LEAVES) {
    grouped = true;
    const head = dests.slice(0, MAX_LEAVES - 1);
    const tail = dests.slice(MAX_LEAVES - 1);
    const cents = tail.reduce((sum, leaf) => sum + leaf.cents, 0);
    const want = tail.reduce((sum, leaf) => sum + (leaf.role === "want" ? leaf.cents : 0), 0);
    head.push({ name: "Outros", role: want * 2 > cents ? "want" : "need", cents });
    dests = head;
  }

  if (income > expense) dests.push({ name: "Sobra", role: "room", cents: income - expense });
  else if (expense > income) sources.push({ name: "Faltou", role: "gap", cents: expense - income });

  const usesPlan = lines.some((line) => line.id === "in:previsto" && line.cents > 0);

  return flowFromLeaves(sources, dests, { mode: "actual", grouped, usesPlan });
}

export function simulationNote(
  totals: { income: number; expense: number; balance: number },
  reserved: number,
  dirty: boolean,
  grouped: boolean,
  usesPlan: boolean,
): string {
  const tail = grouped ? " As menores saídas estão juntas em Outros." : "";
  if (totals.income <= 0 && totals.expense <= 0) {
    return "Arraste a renda ou uma despesa. O desenho mostra para onde o dinheiro iria.";
  }
  if (totals.income <= 0) {
    return "Sem renda, tudo que sai vira falta. Suba o que entra para ver se o mês cabe.";
  }
  if (!dirty && usesPlan) {
    return "A entrada ainda não foi anotada. O fluxo usa a renda do plano. Arraste uma despesa para ver a sobra mudar.";
  }
  if (!dirty) {
    return `Isto é o mês anotado. Arraste para testar um corte antes de mudar o hábito.${tail}`;
  }
  if (totals.balance < 0) {
    return `Nesta simulação falta dinheiro. O corte que cabe é vontade — lazer, delivery, compra — não o aluguel.${tail}`;
  }
  if (reserved > 0 && totals.balance < reserved) {
    return `A sobra não cobre a meta de guardar. Ou corta mais um gasto de vontade, ou a meta deste mês é menor.${tail}`;
  }
  if (reserved > 0) {
    return `A meta de guardar cabe, e ainda fica livre o que passar dela. Separar isso quando o dinheiro entra é o que faz sobrar.${tail}`;
  }
  return `A sobra é o que não virou despesa. Nada disso foi gravado no extrato.${tail}`;
}
