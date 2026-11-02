import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { useMemo, useState, type FormEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { CatIcon, NavChevron } from "@/components/finance/icons";
import { FlowChart } from "@/components/finance/flow-chart";
import { Button, fieldClass, Field, InsightCard, Meter, Panel, ToneLine } from "@/components/finance/ui";
import { cn } from "@/lib/cn";
import { buildInsights } from "@/lib/finance/insights";
import {
  CATEGORIES,
  categoryById,
  centsToInput,
  currentMonthKey,
  deriveMonth,
  emergencyTarget,
  formatBRL,
  goalSaved,
  monthIndex,
  parseBRL,
  parseISODate,
  prognosis,
  shiftMonth,
  spendByBucket,
  todayISO,
  type Contribution,
  type Transaction,
} from "@/lib/finance/model";
import { useFinance } from "@/lib/finance/store";
import type { SheetRequest } from "@/components/finance/entry-sheet";

export function monthLabel(month: string): string {
  const label = format(parseISODate(`${month}-01`), "MMMM 'de' yyyy", { locale: ptBR });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  const current = currentMonthKey();
  const atEnd = monthIndex(month) >= monthIndex(current);
  const atStart = monthIndex(month) <= monthIndex(current) - 24;
  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        className="press inline-flex size-11 items-center justify-center rounded-md text-ink disabled:opacity-30"
        aria-label="Mês anterior"
        disabled={atStart}
        onClick={() => onChange(shiftMonth(month, -1))}
      >
        <NavChevron dir="left" />
      </button>
      <p className="text-base font-medium text-ink">{monthLabel(month)}</p>
      <button
        type="button"
        className="press inline-flex size-11 items-center justify-center rounded-md text-ink disabled:opacity-30"
        aria-label="Próximo mês"
        disabled={atEnd}
        onClick={() => onChange(shiftMonth(month, 1))}
      >
        <NavChevron dir="right" />
      </button>
    </div>
  );
}

function useSnapshot(month: string) {
  const data = useFinance(
    useShallow((state) => ({
      onboarded: state.onboarded,
      monthlyIncomeCents: state.monthlyIncomeCents,
      savingsPercent: state.savingsPercent,
      transactions: state.transactions,
      contributions: state.contributions,
      budgets: state.budgets,
      budgetBasisCents: state.budgetBasisCents,
      budgetSavingsPercent: state.budgetSavingsPercent,
      goals: state.goals,
      sample: state.sample,
    })),
  );
  return useMemo(() => deriveMonth(data, month, todayISO()), [data, month]);
}

export function Setup({ onExample }: { onExample: () => void }) {
  const finish = useFinance((state) => state.finishOnboarding);
  const [income, setIncome] = useState("");
  const [percent, setPercent] = useState(20);
  const [error, setError] = useState("");
  const parsed = parseBRL(income);
  const reserve = parsed ? Math.round((parsed * percent) / 100) : 0;

  function start() {
    if (parsed == null || parsed <= 0) {
      setError("Informe quanto entra por mês. Uma média já serve.");
      return;
    }
    finish(parsed, percent);
  }

  return (
    <div className="rise mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-8 pb-10">
      <p className="font-display text-3xl text-ink">sobra</p>
      <h1 className="mt-6 max-w-sm font-display text-4xl leading-tight font-medium text-ink">
        Saiba para onde vai e separe o que precisa ficar.
      </h1>
      <p className="mt-3 max-w-sm text-base text-muted">
        Anote no dia, guarde quando o dinheiro entra, e olhe quanto cabe hoje — não o mês inteiro.
      </p>

      <form
        className="mt-8 flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          start();
        }}
      >
        <Field label="Quanto entra por mês?" hint="Salário, benefícios, extras. Uma média já serve.">
          <input
            inputMode="decimal"
            placeholder="0,00"
            value={income}
            onChange={(event) => {
              setIncome(event.target.value);
              setError("");
            }}
            className={fieldClass}
            aria-label="Renda mensal"
          />
        </Field>
        <Field
          label="Quanto quer guardar?"
          hint={
            reserve > 0
              ? `Ficam cerca de ${formatBRL(reserve)} por mês. O resto vira limite por categoria.`
              : "20% é um bom começo. Se a moradia for alta, 10% já muda o mês."
          }
        >
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={5}
              max={40}
              step={1}
              value={percent}
              onChange={(event) => setPercent(Number(event.target.value))}
              aria-valuetext={`${percent}%`}
            />
            <span className="w-12 text-right font-medium tabular-nums">{percent}%</span>
          </div>
        </Field>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <Button type="submit" className="w-full">
          Montar meu plano
        </Button>
      </form>

      <button type="button" className="press mt-3 h-11 text-sm text-muted" onClick={() => finish(0, 20)}>
        Só quero anotar, sem plano
      </button>
      <button type="button" className="press h-11 text-sm font-medium text-ink" onClick={onExample}>
        Ver com um mês de exemplo
      </button>

      <ol className="mt-8 flex flex-col gap-3 border-t border-line pt-6 text-sm text-muted">
        <li>1. Anote no mesmo dia. Memória não fecha mês.</li>
        <li>2. Guarde quando o dinheiro entra, não no que sobra.</li>
        <li>3. Limite é teto, não permissão para gastar.</li>
      </ol>
    </div>
  );
}

type OpenSheet = (request: SheetRequest) => void;

export function HomeScreen({
  month,
  onOpen,
  onSeeAll,
  onSimulate,
}: {
  month: string;
  onOpen: OpenSheet;
  onSeeAll: () => void;
  onSimulate: () => void;
}) {
  const transactions = useFinance((state) => state.transactions);
  const contributions = useFinance((state) => state.contributions);
  const goals = useFinance((state) => state.goals);
  const sample = useFinance((state) => state.sample);
  const reset = useFinance((state) => state.reset);
  const snapshot = useSnapshot(month);
  const line = prognosis(snapshot);
  const insights = useMemo(() => buildInsights(snapshot, transactions), [snapshot, transactions]);
  const spentRows = snapshot.byCategory.filter((item) => item.spent > 0).sort((a, b) => b.spent - a.spent);
  const buckets = spendByBucket(snapshot);
  const recent = recentRows(snapshot.monthTransactions, snapshot.monthContributions, goals).slice(0, 4);
  const overPlan = snapshot.base > 0 && snapshot.leftToSpend < 0;
  const dailyMode = snapshot.isCurrent && snapshot.perDay != null && snapshot.base > 0 && !overPlan;

  let heroLabel = snapshot.isCurrent ? "Ainda pode sair" : "Sobrou no plano";
  let heroValue = snapshot.leftToSpend;
  let heroHint: string | null = null;
  if (snapshot.base <= 0 && snapshot.spent <= 0) {
    heroLabel = "Renda do mês";
    heroValue = 0;
  } else if (snapshot.base <= 0) {
    heroLabel = "Saiu este mês";
    heroValue = snapshot.spent;
  } else if (overPlan) {
    heroLabel = "Passou do plano";
    heroValue = Math.abs(snapshot.leftToSpend);
    heroHint = snapshot.isCurrent
      ? "Hoje não cabe gasto de vontade. Conta fixa, se houver, ainda se anota."
      : null;
  } else if (dailyMode && snapshot.perDay != null) {
    heroLabel = "Hoje pode gastar";
    heroValue = snapshot.perDay;
    heroHint = `No mês ainda cabem ${formatBRL(snapshot.leftToSpend)}. Gastar isso de uma vez fura a meta.`;
  }

  return (
    <div className="flex flex-col gap-8">
      {sample ? (
        <Panel>
          <p className="text-sm leading-6 text-ink">
            Exemplo de uma renda de {formatBRL(480000)}. O aluguel cabe quase no limite e os deliveries já pesam. Não é o
            seu dinheiro.
          </p>
          <Button variant="ghost" className="mt-2 px-0" onClick={reset}>
            Apagar exemplo
          </Button>
        </Panel>
      ) : null}

      <section>
        <p className="text-sm text-muted">{heroLabel}</p>
        <p
          className={cn(
            "mt-1 font-display text-display leading-none font-medium tabular-nums",
            overPlan ? "text-danger" : "text-ink",
          )}
        >
          {snapshot.base <= 0 && snapshot.spent <= 0 ? "R$ —" : formatBRL(heroValue)}
        </p>
        {heroHint ? <p className="mt-2 text-sm leading-6 text-muted">{heroHint}</p> : null}
        {line ? (
          <div className="mt-3">
            <ToneLine tone={line.tone}>{line.text}</ToneLine>
          </div>
        ) : null}
      </section>

      <dl className="grid grid-cols-3 gap-3 border-y border-line py-4">
        <Stat label="Entrou" value={snapshot.received} />
        <Stat label="Saiu" value={snapshot.spent} />
        <Stat label="Guardou" value={snapshot.saved} />
      </dl>

      <section>
        <h2 className="text-base font-medium">Essencial e vontade</h2>
        {snapshot.spent <= 0 ? (
          <p className="mt-2 text-sm leading-6 text-muted">
            Essencial é moradia, mercado, conta e transporte. Vontade é delivery, lazer e compra. Só a segunda coluna
            é onde se economiza.
          </p>
        ) : (
          <>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <BucketStat label="Essencial" value={buckets.need} total={snapshot.spent} />
              <BucketStat
                label="Vontade"
                value={buckets.want}
                total={snapshot.spent}
                over={buckets.want / snapshot.spent >= 0.35}
              />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted">{bucketAdvice(buckets.need, buckets.want)}</p>
          </>
        )}
      </section>

      {snapshot.reserved > 0 ? (
        <section>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-medium">Meta de guardar</h2>
            <p className="text-sm text-muted tabular-nums">
              {formatBRL(snapshot.saved)} de {formatBRL(snapshot.reserved)}
            </p>
          </div>
          <Meter
            value={snapshot.saved}
            max={snapshot.reserved}
            label="Quanto já foi guardado neste mês"
            over={false}
          />
        </section>
      ) : null}

      <section>
        <h2 className="text-base font-medium">Para onde foi</h2>
        <FlowChart snapshot={snapshot} />
        <button type="button" className="press mt-2 h-11 text-sm font-medium text-ink" onClick={onSimulate}>
          Abrir o fluxo e simular
        </button>
        {spentRows.length > 0 ? (
          <ul className="mt-4 flex flex-col">
            {spentRows.map((row) => {
              const pct = snapshot.spent > 0 ? Math.round((row.spent / snapshot.spent) * 100) : 0;
              const over = row.limit > 0 && row.spent > row.limit;
              return (
                <li key={row.category.id} className="border-t border-line py-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-track text-ink">
                      <CatIcon name={row.category.icon} className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-sm font-medium">
                          {row.category.name}
                          {row.category.bucket === "want" ? (
                            <span className="font-normal text-muted"> · vontade</span>
                          ) : null}
                        </p>
                        <p className={cn("text-sm tabular-nums", over ? "text-danger" : "text-ink")}>
                          {formatBRL(row.spent)}
                        </p>
                      </div>
                      {over ? <p className="text-sm text-danger">Passou do limite de {formatBRL(row.limit)}</p> : null}
                    </div>
                    <span className="w-10 text-right text-sm text-muted tabular-nums">{pct}%</span>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      {insights.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-medium">O que fazer agora</h2>
          {insights.map((insight) => (
            <InsightCard key={insight.id} tone={insight.tone} title={insight.title} body={insight.body} />
          ))}
        </section>
      ) : null}

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-medium">Últimos</h2>
          {recent.length > 0 ? (
            <button type="button" className="press h-11 text-sm text-muted" onClick={onSeeAll}>
              Ver extrato
            </button>
          ) : null}
        </div>
        {recent.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Nada anotado neste mês.</p>
        ) : (
          <RowList rows={recent} onOpen={onOpen} />
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium tabular-nums">{formatBRL(value)}</dd>
    </div>
  );
}

function BucketStat({
  label,
  value,
  total,
  over = false,
}: {
  label: string;
  value: number;
  total: number;
  over?: boolean;
}) {
  return (
    <div>
      <p className="text-sm text-muted">{label}</p>
      <p className={cn("mt-1 text-base font-medium tabular-nums", over ? "text-danger" : "text-ink")}>
        {formatBRL(value)}
      </p>
      <div className="mt-2">
        <Meter value={value} max={total} label={label} over={over} />
      </div>
    </div>
  );
}

function bucketAdvice(need: number, want: number): string {
  const spent = need + want;
  if (spent <= 0) return "";
  if (want === 0) return "Até agora só saiu o essencial. Gasto por vontade aparece nesta coluna.";
  if (want / spent >= 0.35) {
    return "Mais de um terço do que saiu foi vontade. Economizar começa aqui, não no aluguel.";
  }
  return "A maior parte foi essencial. O que dá para cortar sem apertar conta fixa está na vontade.";
}

type Row = {
  id: string;
  date: string;
  title: string;
  note: string;
  amount: number;
  icon: string;
  tone: "expense" | "income" | "save";
  request: SheetRequest;
};

function recentRows(transactions: Transaction[], contributions: Contribution[], goals: { id: string; name: string }[]): Row[] {
  const spend: Row[] = transactions.map((item) => {
    const category = categoryById(item.categoryId);
    return {
      id: item.id,
      date: item.date,
      title: category?.name ?? "Lançamento",
      note: item.note,
      amount: item.amountCents,
      icon: category?.icon ?? "receipt",
      tone: item.kind,
      request: { mode: "tx", id: item.id },
    };
  });
  const saved: Row[] = contributions.map((item) => ({
    id: item.id,
    date: item.date,
    title: goals.find((goal) => goal.id === item.goalId)?.name ?? "Guardado",
    note: item.note,
    amount: item.amountCents,
    icon: "save",
    tone: "save",
    request: { mode: "save", id: item.id },
  }));
  return [...spend, ...saved].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

function dayLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return "Hoje";
  const yesterday = shiftDay(today, -1);
  if (iso === yesterday) return "Ontem";
  return format(parseISODate(iso), "d 'de' MMMM", { locale: ptBR });
}

function shiftDay(iso: string, delta: number): string {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + delta);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function RowList({ rows, onOpen }: { rows: Row[]; onOpen: OpenSheet }) {
  return (
    <ul>
      {rows.map((row) => (
        <li key={`${row.tone}-${row.id}`} className="border-t border-line">
          <button type="button" className="press flex w-full items-center gap-3 py-3 text-left" onClick={() => onOpen(row.request)}>
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-md bg-track">
              <CatIcon name={row.icon} className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{row.title}</span>
              <span className="block truncate text-sm text-muted">{row.note || dayLabel(row.date)}</span>
            </span>
            <span
              className={cn(
                "shrink-0 text-sm tabular-nums",
                row.tone === "income" && "text-good",
                row.tone === "expense" && "text-ink",
                row.tone === "save" && "text-ink",
              )}
            >
              {row.tone === "income" ? "+" : "−"}
              {formatBRL(row.amount)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function MovesScreen({ month, onOpen }: { month: string; onOpen: OpenSheet }) {
  const goals = useFinance((state) => state.goals);
  const snapshot = useSnapshot(month);
  const [filter, setFilter] = useState<"all" | "expense" | "income" | "save">("all");
  const rows = recentRows(snapshot.monthTransactions, snapshot.monthContributions, goals).filter((row) =>
    filter === "all" ? true : row.tone === filter,
  );
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const list = groups.get(row.date) ?? [];
    list.push(row);
    groups.set(row.date, list);
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 rounded-xl bg-track p-2">
        {(
          [
            ["all", "Tudo"],
            ["expense", "Saiu"],
            ["income", "Entrou"],
            ["save", "Guardei"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={cn(
              "press h-11 rounded-lg text-sm",
              filter === id ? "bg-surface font-medium text-ink" : "text-muted",
            )}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">Nada neste filtro. Anote uma saída, uma entrada ou um valor guardado.</p>
      ) : (
        [...groups.entries()].map(([date, list]) => (
          <section key={date} className="mt-6">
            <h2 className="text-sm font-medium text-muted">{dayLabel(date)}</h2>
            <RowList rows={list} onOpen={onOpen} />
          </section>
        ))
      )}
    </div>
  );
}

export function LimitsScreen({ month }: { month: string }) {
  const income = useFinance((state) => state.monthlyIncomeCents);
  const percent = useFinance((state) => state.savingsPercent);
  const budgets = useFinance((state) => state.budgets);
  const basis = useFinance((state) => state.budgetBasisCents);
  const basisPercent = useFinance((state) => state.budgetSavingsPercent);
  const setPlan = useFinance((state) => state.setPlan);
  const apply = useFinance((state) => state.applySuggestedBudgets);
  const setBudget = useFinance((state) => state.setBudget);
  const [incomeText, setIncomeText] = useState(income > 0 ? centsToInput(income) : "");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirm, setConfirm] = useState(false);
  const snapshot = useSnapshot(month);
  const stale = income > 0 && (basis !== income || basisPercent !== percent);
  const hasBudgets = Object.keys(budgets).length > 0;

  function commitIncome() {
    const parsed = parseBRL(incomeText);
    if (parsed == null) return;
    setPlan(parsed, percent);
  }

  function limitRow(category: (typeof CATEGORIES)[number]) {
    const row = snapshot.byCategory.find((item) => item.category.id === category.id);
    const spent = row?.spent ?? 0;
    const limit = budgets[category.id] ?? 0;
    const over = limit > 0 && spent > limit;
    return (
      <li key={category.id} className="border-t border-line py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">{category.name}</p>
            <p className={cn("text-sm tabular-nums", over ? "text-danger" : "text-muted")}>
              {formatBRL(spent)} de {limit > 0 ? formatBRL(limit) : "sem teto"}
            </p>
          </div>
          <button
            type="button"
            className="press h-11 shrink-0 text-sm text-ink"
            onClick={() => {
              setEditing(category.id);
              setDraft(limit > 0 ? centsToInput(limit) : "");
            }}
          >
            Ajustar
          </button>
        </div>
        <div className="mt-2">
          <Meter value={spent} max={limit || spent || 1} label={`Limite de ${category.name}`} over={over} />
        </div>
        {editing === category.id ? (
          <form
            className="mt-3 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = parseBRL(draft);
              if (parsed == null) return;
              setBudget(category.id, parsed);
              setEditing(null);
            }}
          >
            <input
              autoFocus
              inputMode="decimal"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className={fieldClass}
              aria-label={`Novo limite de ${category.name}`}
            />
            <Button type="submit" className="shrink-0">
              Ok
            </Button>
          </form>
        ) : null}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h2 className="font-display text-2xl font-medium">Limites do mês</h2>
        <p className="mt-1 text-sm text-muted">
          A renda menos o que você quer guardar vira teto. Moradia, mercado, contas e transporte vêm primeiro.
        </p>
      </section>

      <Field label="Renda mensal prevista">
        <input
          inputMode="decimal"
          value={incomeText}
          onChange={(event) => setIncomeText(event.target.value)}
          onBlur={commitIncome}
          className={fieldClass}
          placeholder="0,00"
          aria-label="Renda mensal prevista"
        />
      </Field>

      <Field label="Guardar" hint={`${percent}% de ${income > 0 ? formatBRL(income) : "a renda"} fica fora dos gastos.`}>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={5}
            max={40}
            value={percent}
            onChange={(event) => setPlan(income, Number(event.target.value))}
            aria-label="Percentual para guardar"
          />
          <span className="w-12 text-right font-medium tabular-nums">{percent}%</span>
        </div>
      </Field>

      {income <= 0 ? (
        <p className="text-sm text-muted">Defina a renda para eu sugerir um teto em cada categoria.</p>
      ) : stale || !hasBudgets ? (
        <Panel>
          <p className="text-sm text-ink">
            {hasBudgets
              ? "A renda ou a meta mudou. Recalcular substitui os tetos atuais."
              : "Ainda não há tetos. Posso montar a partir da renda."}
          </p>
          {confirm ? (
            <Button
              className="mt-3 w-full"
              onClick={() => {
                apply();
                setConfirm(false);
              }}
            >
              Confirmar recálculo
            </Button>
          ) : (
            <Button className="mt-3 w-full" onClick={() => (hasBudgets ? setConfirm(true) : apply())}>
              {hasBudgets ? "Recalcular limites" : "Criar limites"}
            </Button>
          )}
        </Panel>
      ) : (
        <button type="button" className="press h-11 self-start text-sm text-muted" onClick={() => setConfirm(true)}>
          Refazer sugestão
        </button>
      )}
      {confirm && hasBudgets && !stale ? (
        <Button
          onClick={() => {
            apply();
            setConfirm(false);
          }}
        >
          Confirmar e substituir
        </Button>
      ) : null}

      <section>
        <h3 className="text-base font-medium">Essencial</h3>
        <p className="mt-1 text-sm text-muted">Moradia, mercado, contas, transporte, saúde e educação.</p>
      </section>
      <ul className="flex flex-col">
        {CATEGORIES.filter((category) => category.kind === "expense" && category.bucket === "need").map((category) =>
          limitRow(category),
        )}
      </ul>

      <section>
        <h3 className="text-base font-medium">Vontade</h3>
        <p className="mt-1 text-sm text-muted">É aqui que se economiza: comer fora, lazer, assinatura e compra.</p>
      </section>
      <ul className="flex flex-col">
        {CATEGORIES.filter((category) => category.kind === "expense" && category.bucket === "want").map((category) =>
          limitRow(category),
        )}
      </ul>

      <ol className="flex flex-col gap-2 text-sm text-muted">
        <li>Anote no mesmo dia. Memória não fecha mês.</li>
        <li>Guarde quando o dinheiro entra, não no que sobra.</li>
        <li>Limite é teto, não permissão para gastar até zerar.</li>
      </ol>
    </div>
  );
}

export function GoalsScreen({ onSave }: { onSave: (goalId: string) => void }) {
  const goals = useFinance((state) => state.goals);
  const contributions = useFinance((state) => state.contributions);
  const income = useFinance((state) => state.monthlyIncomeCents);
  const budgets = useFinance((state) => state.budgets);
  const addGoal = useFinance((state) => state.addGoal);
  const deleteGoal = useFinance((state) => state.deleteGoal);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [initial, setInitial] = useState("");
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const hasReserve = goals.some((goal) => goal.name.toLowerCase().includes("reserva"));

  function create(event: FormEvent) {
    event.preventDefault();
    const targetCents = parseBRL(target);
    const initialCents = parseBRL(initial || "0") ?? 0;
    if (!name.trim()) {
      setError("Dê um nome para a meta.");
      return;
    }
    if (targetCents == null || targetCents <= 0) {
      setError("Informe quanto quer juntar.");
      return;
    }
    addGoal({ name: name.trim(), targetCents, initialCents });
    setName("");
    setTarget("");
    setInitial("");
    setError("");
    setOpen(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <section>
        <h2 className="font-display text-2xl font-medium">Metas</h2>
        <p className="mt-1 text-sm text-muted">
          Guardar é um destino, não uma sobra. O valor sai do que você pode gastar no mês.
        </p>
      </section>

      {!hasReserve ? (
        <Panel>
          <h3 className="text-base font-medium">Reserva de emergência</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            O ideal cobre cerca de 3 meses de moradia, mercado, contas e transporte. Aqui, isso dá{" "}
            {formatBRL(emergencyTarget(income, budgets))}.
          </p>
          <Button
            className="mt-3 w-full"
            onClick={() =>
              addGoal({
                name: "Reserva de emergência",
                targetCents: emergencyTarget(income, budgets),
                initialCents: 0,
              })
            }
          >
            Criar reserva
          </Button>
        </Panel>
      ) : null}

      <ul className="flex flex-col gap-3">
        {goals.map((goal) => {
          const saved = goalSaved(goal, contributions);
          const done = goal.targetCents > 0 && saved >= goal.targetCents;
          return (
            <li key={goal.id}>
              <Panel>
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-medium">{goal.name}</h3>
                  <p className="text-sm tabular-nums text-muted">
                    {formatBRL(saved)} de {formatBRL(goal.targetCents)}
                  </p>
                </div>
                <div className="mt-3">
                  <Meter value={saved} max={goal.targetCents} label={goal.name} />
                </div>
                <p className="mt-2 text-sm text-muted">{done ? "Meta batida. Pode subir o alvo ou abrir outra." : "Ainda falta juntar."}</p>
                <div className="mt-3 flex gap-2">
                  <Button className="flex-1" onClick={() => onSave(goal.id)}>
                    Guardar
                  </Button>
                  {pendingDelete === goal.id ? (
                    <Button variant="danger" className="flex-1" onClick={() => deleteGoal(goal.id)}>
                      Confirmar
                    </Button>
                  ) : (
                    <Button variant="ghost" className="flex-1" onClick={() => setPendingDelete(goal.id)}>
                      Apagar
                    </Button>
                  )}
                </div>
              </Panel>
            </li>
          );
        })}
      </ul>

      {open ? (
        <form className="flex flex-col gap-4" onSubmit={create}>
          <Field label="Nome">
            <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} placeholder="Viagem, dívida, curso" />
          </Field>
          <Field label="Quanto quer juntar">
            <input inputMode="decimal" value={target} onChange={(event) => setTarget(event.target.value)} className={fieldClass} placeholder="0,00" />
          </Field>
          <Field label="Quanto já tem" hint="Opcional.">
            <input inputMode="decimal" value={initial} onChange={(event) => setInitial(event.target.value)} className={fieldClass} placeholder="0,00" />
          </Field>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <Button type="submit" className="w-full">
            Salvar meta
          </Button>
        </form>
      ) : (
        <Button variant="ghost" className="w-full border border-line" onClick={() => setOpen(true)}>
          Nova meta
        </Button>
      )}
    </div>
  );
}
