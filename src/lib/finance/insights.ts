import { formatBRL, type MonthSnapshot, type Tone, type Transaction } from "@/lib/finance/model";

export type Insight = {
  id: string;
  tone: Tone;
  title: string;
  body: string;
};

const LEAK_SKIP = new Set(["moradia", "contas", "saude", "educacao"]);

function previousWindowSpent(transactions: Transaction[], month: string, day: number): number | null {
  const [yearText, monthText] = month.split("-");
  const date = new Date(Number(yearText), Number(monthText) - 2, 1);
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  const rows = transactions.filter((item) => item.kind === "expense" && item.date.startsWith(key));
  if (rows.length === 0) return null;
  return rows
    .filter((item) => Number(item.date.slice(8, 10)) <= day)
    .reduce((sum, item) => sum + item.amountCents, 0);
}

export function buildInsights(snapshot: MonthSnapshot, transactions: Transaction[]): Insight[] {
  const insights: Insight[] = [];
  const over = snapshot.byCategory
    .filter((item) => item.limit > 0 && item.spent > item.limit)
    .sort((a, b) => b.spent - b.limit - (a.spent - a.limit));

  if (over[0]) {
    const top = over[0];
    const extra =
      over.length > 1 ? ` ${over[1]?.category.name} também passou.` : " O que passar daqui sai da meta de guardar.";
    insights.push({
      id: "over-budget",
      tone: "alert",
      title: `${top.category.name} passou do limite`,
      body: `${formatBRL(top.spent)} de ${formatBRL(top.limit)}.${extra}`,
    });
  }

  const leaks = snapshot.byCategory
    .filter((item) => !LEAK_SKIP.has(item.category.id))
    .map((item) => {
      const small = snapshot.monthTransactions.filter(
        (tx) => tx.kind === "expense" && tx.categoryId === item.category.id && tx.amountCents <= 8000,
      );
      return {
        name: item.category.name,
        count: small.length,
        total: small.reduce((sum, tx) => sum + tx.amountCents, 0),
      };
    })
    .filter((item) => item.count >= 4 && item.total >= 8000)
    .sort((a, b) => b.total - a.total);

  if (leaks[0]) {
    const leak = leaks[0];
    insights.push({
      id: "leak",
      tone: "warn",
      title: `Vazamento em ${leak.name}`,
      body: `${leak.count} gastos pequenos somam ${formatBRL(leak.total)}. Antes do próximo, espere vinte minutos. Se ainda fizer sentido, anote na hora.`,
    });
  }

  if (snapshot.isCurrent && snapshot.dayOfMonth >= 5 && snapshot.saved === 0 && snapshot.reserved > 0 && snapshot.received > 0) {
    insights.push({
      id: "not-saved",
      tone: "warn",
      title: "Nada foi guardado ainda",
      body: `A meta do mês é ${formatBRL(snapshot.reserved)}. Transfira uma parte no dia em que o dinheiro entra, não no que sobrar no dia 30.`,
    });
  }

  if (snapshot.isCurrent && snapshot.spent > 0) {
    const previous = previousWindowSpent(transactions, snapshot.month, snapshot.dayOfMonth);
    if (previous != null) {
      const delta = snapshot.spent - previous;
      if (delta >= 5000) {
        insights.push({
          id: "higher",
          tone: "warn",
          title: "Mais alto que o mês passado",
          body: `Até o dia ${snapshot.dayOfMonth}, saiu ${formatBRL(delta)} a mais do que no mesmo período anterior.`,
        });
      } else if (delta <= -5000) {
        insights.push({
          id: "lower",
          tone: "good",
          title: "Mais baixo que o mês passado",
          body: `Até o dia ${snapshot.dayOfMonth}, saiu ${formatBRL(Math.abs(delta))} a menos. Se a folga for real, guarde hoje.`,
        });
      }
    }
  }

  const topShare = [...snapshot.byCategory].sort((a, b) => b.spent - a.spent)[0];
  if (topShare && snapshot.spent > 0 && topShare.spent / snapshot.spent >= 0.4 && topShare.category.id !== "moradia") {
    const pct = Math.round((topShare.spent / snapshot.spent) * 100);
    insights.push({
      id: "share",
      tone: "info",
      title: `${topShare.category.name} leva ${pct}% do que saiu`,
      body: "Quando uma categoria passa de 40%, o mês inteiro depende dela. Veja se dá para cortar uma compra aí.",
    });
  } else if (topShare && snapshot.spent > 0 && topShare.category.id === "moradia" && topShare.spent / snapshot.spent >= 0.45) {
    insights.push({
      id: "rent-share",
      tone: "info",
      title: "Moradia está levando quase metade",
      body: "No Brasil isso é comum. O corte possível costuma estar em comer fora, compras e assinatura — não no aluguel.",
    });
  }

  if (snapshot.received === 0 && snapshot.plannedIncome > 0 && snapshot.spent > 0) {
    insights.push({
      id: "income-missing",
      tone: "info",
      title: "A renda ainda não foi anotada",
      body: `Estou usando os ${formatBRL(snapshot.plannedIncome)} previstos. Quando o dinheiro cair, registre como entrada.`,
    });
  }

  const order: Record<Tone, number> = { alert: 0, warn: 1, good: 2, info: 3 };
  return insights.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 4);
}
