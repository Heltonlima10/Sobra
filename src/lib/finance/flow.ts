import { categoryById, type MonthSnapshot } from "@/lib/finance/model";

export type FlowRole = "in" | "gap" | "need" | "want" | "save" | "room";

export type FlowNode = {
  name: string;
  role: FlowRole;
};

export type FlowLink = {
  source: number;
  target: number;
  value: number;
};

export type Cashflow = {
  mode: "actual" | "plan";
  grouped: boolean;
  usesPlan: boolean;
  sourceCount: number;
  nodes: FlowNode[];
  links: FlowLink[];
};

const MAX_LEAVES = 6;

type Leaf = { name: string; role: FlowRole; cents: number };

function incomeName(categoryId: string): string {
  if (categoryId === "outras-entradas") return "Outras";
  return categoryById(categoryId)?.name ?? "Entrada";
}

function assemble(
  sources: Leaf[],
  dests: Leaf[],
  meta: Pick<Cashflow, "mode" | "grouped" | "usesPlan">,
): Cashflow {
  const hub = sources.length;
  const nodes: FlowNode[] = [
    ...sources.map(({ name, role }) => ({ name, role })),
    { name: "No mês", role: "in" },
    ...dests.map(({ name, role }) => ({ name, role })),
  ];
  const links: FlowLink[] = [
    ...sources.map((leaf, index) => ({ source: index, target: hub, value: leaf.cents })),
    ...dests.map((leaf, index) => ({ source: hub, target: hub + 1 + index, value: leaf.cents })),
  ];
  return { ...meta, sourceCount: sources.length, nodes, links };
}

export function flowFromLeaves(
  sources: Leaf[],
  dests: Leaf[],
  meta: Pick<Cashflow, "mode" | "grouped" | "usesPlan">,
): Cashflow | null {
  const src = sources.filter((leaf) => leaf.cents > 0);
  const dst = dests.filter((leaf) => leaf.cents > 0);
  if (src.length === 0 || dst.length === 0) return null;
  return assemble(src, dst, meta);
}

export function buildCashflow(snapshot: MonthSnapshot): Cashflow | null {
  const received = snapshot.received;
  const spent = snapshot.spent;
  const saved = snapshot.saved;
  const base = snapshot.base;
  const moved = spent + saved;

  if (received <= 0 && moved <= 0) {
    if (base <= 0) return null;
    const keep = Math.min(Math.max(snapshot.reserved, 0), base);
    const room = base - keep;
    const dests: Leaf[] = [];
    if (keep > 0) dests.push({ name: "Para guardar", role: "save", cents: keep });
    if (room > 0) dests.push({ name: "Para gastar", role: "room", cents: room });
    if (dests.length === 0) return null;
    return assemble([{ name: "Previsto", role: "in", cents: base }], dests, {
      mode: "plan",
      grouped: false,
      usesPlan: true,
    });
  }

  const sources: Leaf[] = [];
  if (received > 0) {
    const byId = new Map<string, number>();
    for (const tx of snapshot.monthTransactions) {
      if (tx.kind !== "income" || tx.amountCents <= 0) continue;
      byId.set(tx.categoryId, (byId.get(tx.categoryId) ?? 0) + tx.amountCents);
    }
    for (const [id, cents] of byId) {
      sources.push({ name: incomeName(id), role: "in", cents });
    }
    sources.sort((a, b) => b.cents - a.cents);
  } else if (base > 0) {
    sources.push({ name: "Previsto", role: "in", cents: base });
  }

  const expenses: Leaf[] = snapshot.byCategory
    .filter((row) => row.spent > 0)
    .map((row): Leaf => ({
      name: row.category.name,
      role: row.category.bucket === "want" ? "want" : "need",
      cents: row.spent,
    }))
    .sort((a, b) => b.cents - a.cents);

  const grouped = expenses.length > MAX_LEAVES;
  const dests: Leaf[] = expenses.slice(0, MAX_LEAVES);
  if (grouped) {
    const tail = expenses.slice(MAX_LEAVES);
    const cents = tail.reduce((sum, leaf) => sum + leaf.cents, 0);
    const want = tail.reduce((sum, leaf) => sum + (leaf.role === "want" ? leaf.cents : 0), 0);
    dests.push({ name: "Outros", role: want * 2 > cents ? "want" : "need", cents });
  }
  if (saved > 0) dests.push({ name: "Guardou", role: "save", cents: saved });

  const sourceTotal = sources.reduce((sum, leaf) => sum + leaf.cents, 0);
  const destTotal = dests.reduce((sum, leaf) => sum + leaf.cents, 0);
  if (sourceTotal > destTotal) {
    dests.push({ name: "Ainda cabe", role: "room", cents: sourceTotal - destTotal });
  } else if (destTotal > sourceTotal) {
    sources.push({
      name: sourceTotal === 0 ? "Sem renda" : "Faltou",
      role: "gap",
      cents: destTotal - sourceTotal,
    });
  }

  if (sources.length === 0 || dests.length === 0) return null;
  return assemble(sources, dests, {
    mode: "actual",
    grouped,
    usesPlan: received <= 0 && base > 0,
  });
}

export function flowCaption(flow: Cashflow, snapshot: MonthSnapshot): string {
  if (flow.mode === "plan") {
    return "Nada saiu ainda. O verde é o que o plano separa para guardar. O resto ainda pode sair.";
  }
  if (flow.usesPlan) {
    return "A entrada ainda não foi anotada. O fluxo usa a renda prevista do plano.";
  }
  if (snapshot.base > 0 && snapshot.spent + snapshot.saved > snapshot.base) {
    return "Saiu mais do que entrou. Faltou é o buraco do mês — segure o que for vontade.";
  }
  const want = snapshot.byCategory
    .filter((row) => row.category.bucket === "want")
    .reduce((sum, row) => sum + row.spent, 0);
  const grouped = flow.grouped ? " As menores saídas estão juntas em Outros; a lista tem cada uma." : "";
  if (want > 0) {
    return `Vermelho é vontade. É o primeiro lugar para economizar, não a conta fixa.${grouped}`;
  }
  if (snapshot.saved > 0) {
    return `Verde é o que ficou guardado. O restante foi essencial.${grouped}`;
  }
  return `Cada faixa é uma parte do que entrou neste mês.${grouped}`;
}
