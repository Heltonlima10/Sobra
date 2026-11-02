import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { FlowChart } from "@/components/finance/flow-chart";
import { Button } from "@/components/finance/ui";
import { cn } from "@/lib/cn";
import { formatBRL, deriveMonth, todayISO, centsToInput, parseBRL } from "@/lib/finance/model";
import {
  applyOverrides,
  seedSimulation,
  simulationFlow,
  simulationNote,
  simulationTotals,
  sliderMax,
  type SimLine,
} from "@/lib/finance/simulate";
import { useFinance } from "@/lib/finance/store";

export function FlowScreen({ month }: { month: string }) {
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
  const snapshot = useMemo(() => deriveMonth(data, month, todayISO()), [data, month]);
  const seed = useMemo(() => seedSimulation(snapshot), [snapshot]);
  const seedKey = seed.map((line) => `${line.id}:${line.cents}`).join("|");
  const [seenKey, setSeenKey] = useState(seedKey);
  const [overrides, setOverrides] = useState<Record<string, number>>({});
  if (seenKey !== seedKey) {
    setSeenKey(seedKey);
    setOverrides({});
  }

  const lines = useMemo(() => applyOverrides(seed, overrides), [seed, overrides]);
  const totals = useMemo(() => simulationTotals(lines), [lines]);
  const flow = useMemo(() => simulationFlow(lines), [lines]);
  const dirty = seed.some((line) => (overrides[line.id] ?? line.cents) !== line.cents);
  const seedCents = new Map(seed.map((line) => [line.id, line.cents]));
  const byId = new Map(lines.map((line) => [line.id, line]));
  const incomes = seed.filter((line) => line.kind === "income").map((line) => byId.get(line.id) ?? line);
  const expenses = seed.filter((line) => line.kind === "expense").map((line) => byId.get(line.id) ?? line);
  const spentLines = expenses.filter((line) => (seedCents.get(line.id) ?? 0) > 0);
  const quietLines = expenses.filter((line) => (seedCents.get(line.id) ?? 0) === 0);
  const note = simulationNote(totals, snapshot.reserved, dirty, flow?.grouped ?? false, flow?.usesPlan ?? false);
  const short = totals.balance < 0;

  function setLine(id: string, cents: number) {
    setOverrides((current) => ({ ...current, [id]: cents }));
  }

  return (
    <div className="flex flex-col gap-6">
      <section>
        <h1 className="text-base font-medium">Fluxo do mês</h1>
        <p className="mt-1 text-sm leading-6 text-muted">
          O desenho sai do que você anotou. Arrastar ou digitar só responde "e se" — o extrato não muda.
        </p>
      </section>

      <dl className="grid grid-cols-3 items-end gap-3 border-y border-line py-4">
        <div>
          <dt className="text-sm text-muted">Despesas</dt>
          <dd className="mt-1 text-sm font-medium tabular-nums">{formatBRL(totals.expense)}</dd>
        </div>
        <div className="text-center">
          <dt className="text-sm text-muted">{short ? "Falta" : "Sobra"}</dt>
          <dd
            className={cn(
              "mt-1 font-display text-3xl leading-none font-medium tabular-nums",
              short ? "text-danger" : "text-good",
            )}
          >
            {formatBRL(Math.abs(totals.balance))}
          </dd>
        </div>
        <div className="text-right">
          <dt className="text-sm text-muted">Do que entrou</dt>
          <dd className={cn("mt-1 text-sm font-medium tabular-nums", short ? "text-danger" : "text-good")}>
            {totals.rate}%
          </dd>
        </div>
      </dl>

      <FlowChart flow={flow} caption={note} />

      <section className="flex flex-col">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-medium">Ajustar o mês</h2>
          {dirty ? (
            <Button variant="ghost" className="h-11 px-0 text-sm" onClick={() => setOverrides({})}>
              Voltar ao mês
            </Button>
          ) : null}
        </div>
        <p className="mt-1 mb-2 text-sm leading-6 text-muted">
          Arraste ou digite um valor. O desenho responde na hora e o extrato não muda.
        </p>
        <AdjustGroup title="O que entra" lines={incomes} seedCents={seedCents} onChange={setLine} />
        {spentLines.length > 0 ? (
          <AdjustGroup title="O que sai" lines={spentLines} seedCents={seedCents} onChange={setLine} />
        ) : (
          <AdjustGroup title="O que sai" lines={quietLines} seedCents={seedCents} onChange={setLine} />
        )}
        {spentLines.length > 0 && quietLines.length > 0 ? (
          <details className="border-t border-line">
            <summary className="flex h-12 cursor-pointer list-none items-center text-sm text-muted">
              Categorias sem gasto neste mês
            </summary>
            <SliderRows lines={quietLines} seedCents={seedCents} onChange={setLine} />
          </details>
        ) : null}
      </section>
    </div>
  );
}

function AdjustGroup({
  title,
  lines,
  seedCents,
  onChange,
}: {
  title: string;
  lines: SimLine[];
  seedCents: Map<string, number>;
  onChange: (id: string, cents: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const total = lines.reduce((sum, line) => sum + line.cents, 0);
  return (
    <section className="border-t border-line">
      <button
        type="button"
        className="press flex h-12 w-full items-center justify-between gap-3"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="text-sm font-medium">{title}</span>
        <span className="text-sm text-muted tabular-nums">{formatBRL(total)}</span>
      </button>
      {open ? <SliderRows lines={lines} seedCents={seedCents} onChange={onChange} /> : null}
    </section>
  );
}

function SliderRows({
  lines,
  seedCents,
  onChange,
}: {
  lines: SimLine[];
  seedCents: Map<string, number>;
  onChange: (id: string, cents: number) => void;
}) {
  return (
    <div className="flex flex-col pb-2">
      {lines.map((line) => {
        const ceiling = sliderMax(line.kind, seedCents.get(line.id) ?? line.cents);
        const value = Math.max(0, line.cents);
        const max = Math.max(ceiling, value);
        return (
          <div key={line.id} className="border-t border-line py-2">
            <div className="flex min-w-0 items-center gap-2 text-sm text-ink">
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  line.role === "want" || line.role === "gap" ? "bg-danger" : line.role === "room" || line.role === "save" ? "bg-good" : "bg-ink",
                )}
              />
              <span className="truncate">
                {line.name}
                {line.role === "want" ? <span className="text-muted"> · vontade</span> : null}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <input
                type="range"
                className="min-w-0 flex-1"
                min={0}
                max={max}
                step={100}
                value={Math.min(value, max)}
                aria-label={line.name}
                aria-valuetext={formatBRL(value)}
                onChange={(event) => onChange(line.id, Number(event.target.value))}
              />
              <AmountField cents={value} label={line.name} onCommit={(cents) => onChange(line.id, cents)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AmountField({
  cents,
  label,
  onCommit,
}: {
  cents: number;
  label: string;
  onCommit: (cents: number) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={`Valor de ${label}`}
      className="h-11 w-28 shrink-0 rounded-md border border-line bg-surface px-2 text-right text-sm text-ink tabular-nums outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      value={text ?? formatBRL(cents)}
      onFocus={(event) => {
        setText(centsToInput(cents));
        requestAnimationFrame(() => event.currentTarget.select());
      }}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        if (text != null) {
          const parsed = parseBRL(text);
          if (parsed != null) onCommit(parsed);
        }
        setText(null);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
      }}
    />
  );
}
