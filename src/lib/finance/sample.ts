import {
  suggestedBudgets,
  type Contribution,
  type FinanceData,
  type Transaction,
} from "@/lib/finance/model";

export const SAMPLE_MONTH = "2026-10";

type Seed = [date: string, categoryId: string, amountCents: number, note: string];

const SEEDS: Seed[] = [
  ["2026-09-02", "moradia", 150000, "Aluguel"],
  ["2026-09-03", "transporte", 2200, "Ônibus"],
  ["2026-09-04", "mercado", 18000, "Feira"],
  ["2026-09-05", "salario", 480000, "Salário"],
  ["2026-09-05", "assinaturas", 5490, "Streaming"],
  ["2026-09-06", "contas", 18900, "Internet e celular"],
  ["2026-09-08", "transporte", 1800, "Ônibus"],
  ["2026-09-11", "mercado", 24600, "Compra da semana"],
  ["2026-09-12", "comer-fora", 4200, "Almoço"],
  ["2026-09-14", "comer-fora", 3800, "Lanche"],
  ["2026-09-15", "transporte", 3500, "Aplicativo"],
  ["2026-09-16", "saude", 6400, "Farmácia"],
  ["2026-09-18", "mercado", 31200, "Mercado"],
  ["2026-09-18", "lazer", 7200, "Cinema"],
  ["2026-09-20", "comer-fora", 5600, "Jantar"],
  ["2026-09-21", "assinaturas", 3490, "Música"],
  ["2026-09-22", "transporte", 2800, "Ônibus"],
  ["2026-09-23", "compras", 18900, "Camiseta"],
  ["2026-09-25", "mercado", 15800, "Hortifruti"],
  ["2026-09-26", "comer-fora", 4500, "Delivery"],
  ["2026-09-27", "pessoal", 4500, "Barbearia"],
  ["2026-09-28", "lazer", 4800, "Café com amigos"],
  ["2026-09-29", "transporte", 3200, "Aplicativo"],
  ["2026-09-30", "comer-fora", 3900, "Almoço"],
  ["2026-10-01", "assinaturas", 3490, "Música"],
  ["2026-10-02", "moradia", 150000, "Aluguel"],
  ["2026-10-03", "mercado", 18600, "Mercado"],
  ["2026-10-03", "comer-fora", 3800, "Delivery"],
  ["2026-10-04", "contas", 18900, "Internet e celular"],
  ["2026-10-04", "comer-fora", 4500, "Almoço"],
  ["2026-10-05", "salario", 480000, "Salário"],
  ["2026-10-05", "assinaturas", 5490, "Streaming"],
  ["2026-10-06", "transporte", 3400, "Aplicativo"],
  ["2026-10-06", "comer-fora", 5200, "Delivery"],
  ["2026-10-07", "mercado", 24200, "Compra da semana"],
  ["2026-10-07", "comer-fora", 2900, "Lanche"],
  ["2026-10-08", "transporte", 2700, "Ônibus"],
  ["2026-10-09", "comer-fora", 6100, "Jantar"],
];

const INCOME_IDS = new Set(["salario", "extra", "outras-entradas"]);

function toTransaction(seed: Seed, index: number): Transaction {
  const [date, categoryId, amountCents, note] = seed;
  return {
    id: `sample-tx-${index + 1}`,
    kind: INCOME_IDS.has(categoryId) ? "income" : "expense",
    amountCents,
    categoryId,
    date,
    note,
    createdAt: `${date}T15:00:00.000Z`,
  };
}

export function buildSample(): FinanceData {
  const income = 480000;
  const percent = 18;
  const contribution: Contribution = {
    id: "sample-save-1",
    goalId: "goal-reserva",
    amountCents: 30000,
    date: "2026-09-05",
    note: "No dia do salário",
    createdAt: "2026-09-05T15:00:00.000Z",
  };
  return {
    onboarded: true,
    monthlyIncomeCents: income,
    savingsPercent: percent,
    transactions: SEEDS.map(toTransaction),
    contributions: [contribution],
    budgets: suggestedBudgets(income, percent),
    budgetBasisCents: income,
    budgetSavingsPercent: percent,
    goals: [
      {
        id: "goal-reserva",
        name: "Reserva de emergência",
        targetCents: 800000,
        initialCents: 64000,
      },
      {
        id: "goal-curso",
        name: "Curso",
        targetCents: 150000,
        initialCents: 20000,
      },
    ],
    sample: true,
  };
}
