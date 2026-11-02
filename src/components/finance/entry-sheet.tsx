import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { CatIcon } from "@/components/finance/icons";
import { Button, fieldClass, Field, Sheet } from "@/components/finance/ui";
import { cn } from "@/lib/cn";
import {
  categoriesByKind,
  categoryById,
  centsToInput,
  defaultEntryDate,
  deriveMonth,
  emergencyTarget,
  formatBRL,
  parseBRL,
  type FlowKind,
} from "@/lib/finance/model";
import { useFinance } from "@/lib/finance/store";

export type SheetRequest =
  | { mode: "create"; kind: "expense" | "income" | "save"; goalId?: string }
  | { mode: "tx"; id: string }
  | { mode: "save"; id: string };

type EntryKind = "expense" | "income" | "save";

export function EntrySheet({
  request,
  month,
  onClose,
  onSaved,
}: {
  request: SheetRequest | null;
  month: string;
  onClose: () => void;
  onSaved?: (date: string) => void;
}) {
  return (
    <Sheet
      open={request != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={titleFor(request)}
      description="O valor fica guardado neste aparelho."
    >
      {request ? (
        <EntryForm
          key={sheetKey(request)}
          request={request}
          month={month}
          onClose={onClose}
          onSaved={onSaved}
        />
      ) : null}
    </Sheet>
  );
}

function sheetKey(request: SheetRequest): string {
  if (request.mode === "create") return `create-${request.kind}-${request.goalId ?? ""}`;
  return `${request.mode}-${request.id}`;
}

function titleFor(request: SheetRequest | null): string {
  if (!request || request.mode === "create") {
    if (request?.mode === "create" && request.kind === "income") return "Nova entrada";
    if (request?.mode === "create" && request.kind === "save") return "Guardar";
    return "Anotar saída";
  }
  if (request.mode === "save") return "Editar reserva";
  return "Editar lançamento";
}

function EntryForm({
  request,
  month,
  onClose,
  onSaved,
}: {
  request: SheetRequest;
  month: string;
  onClose: () => void;
  onSaved?: (date: string) => void;
}) {
  const transactions = useFinance((state) => state.transactions);
  const contributions = useFinance((state) => state.contributions);
  const goals = useFinance((state) => state.goals);
  const addTransaction = useFinance((state) => state.addTransaction);
  const updateTransaction = useFinance((state) => state.updateTransaction);
  const deleteTransaction = useFinance((state) => state.deleteTransaction);
  const addContribution = useFinance((state) => state.addContribution);
  const updateContribution = useFinance((state) => state.updateContribution);
  const deleteContribution = useFinance((state) => state.deleteContribution);
  const addGoal = useFinance((state) => state.addGoal);
  const plan = useFinance(
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

  const existingTx = request.mode === "tx" ? transactions.find((item) => item.id === request.id) : undefined;
  const existingSave = request.mode === "save" ? contributions.find((item) => item.id === request.id) : undefined;

  const [kind, setKind] = useState<EntryKind>(initialKind(request, existingTx?.kind));
  const [amount, setAmount] = useState(
    centsToInput(existingTx?.amountCents ?? existingSave?.amountCents ?? 0).replace(/^0,00$/, ""),
  );
  const [categoryId, setCategoryId] = useState(
    existingTx?.categoryId ?? (request.mode === "create" && request.kind === "income" ? "salario" : "mercado"),
  );
  const [goalId, setGoalId] = useState(
    existingSave?.goalId ?? (request.mode === "create" ? request.goalId : undefined) ?? goals[0]?.id ?? "",
  );
  const [date, setDate] = useState(existingTx?.date ?? existingSave?.date ?? defaultEntryDate(month));
  const [note, setNote] = useState(existingTx?.note ?? existingSave?.note ?? "");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const locked = request.mode === "save" || request.mode === "tx";
  const centsPreview = parseBRL(amount);
  const chosenCategory = categoryById(categoryId);
  const monthKey = date.slice(0, 7);
  const live =
    kind === "expense" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? deriveMonth(plan, monthKey) : null;
  let caution = "";
  if (
    chosenCategory?.bucket === "want" &&
    centsPreview != null &&
    centsPreview > 0 &&
    live?.isCurrent &&
    live.perDay != null
  ) {
    if (live.perDay === 0 || centsPreview > live.perDay) {
      caution =
        live.perDay === 0
          ? "O teto de hoje já acabou. Se não for urgente, deixe para amanhã. Anote mesmo assim se já saiu."
          : `Isso passa do que cabe hoje (${formatBRL(live.perDay)}). Se não for urgente, deixe para amanhã.`;
    }
  }

  const cautionRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!caution) return;
    cautionRef.current?.scrollIntoView({ block: "nearest" });
  }, [caution]);

  function switchKind(next: EntryKind) {
    if (request.mode !== "create" && next === "save") return;
    if (request.mode === "save") return;
    setKind(next);
    if (next === "income" && categoryById(categoryId)?.kind !== "income") setCategoryId("salario");
    if (next === "expense" && categoryById(categoryId)?.kind !== "expense") setCategoryId("mercado");
    setError("");
  }

  function submit() {
    const cents = parseBRL(amount);
    if (cents == null || cents <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Escolha uma data válida.");
      return;
    }
    if (kind === "save") {
      let targetGoal = goalId;
      if (!targetGoal) {
        if (goals.length === 0) {
          const state = useFinance.getState();
          targetGoal = addGoal({
            name: "Reserva de emergência",
            targetCents: emergencyTarget(state.monthlyIncomeCents, state.budgets),
            initialCents: 0,
          });
        } else {
          setError("Escolha uma meta.");
          return;
        }
      }
      const draft = { goalId: targetGoal, amountCents: cents, date, note: note.trim() };
      if (existingSave) updateContribution(existingSave.id, draft);
      else addContribution(draft);
      onSaved?.(date);
      onClose();
      return;
    }
    const flow = kind as FlowKind;
    const chosen = categoriesByKind(flow).some((category) => category.id === categoryId)
      ? categoryId
      : categoriesByKind(flow)[0]?.id;
    if (!chosen) return;
    const draft = { kind: flow, amountCents: cents, categoryId: chosen, date, note: note.trim() };
    if (existingTx) updateTransaction(existingTx.id, draft);
    else addTransaction(draft);
    onSaved?.(date);
    onClose();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-5"
    >
      {request.mode === "create" ? (
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-bg p-2">
          {(
            [
              ["expense", "Saída"],
              ["income", "Entrada"],
              ["save", "Guardar"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={cn(
                "press h-11 rounded-lg text-sm font-medium",
                kind === value ? "bg-ink text-surface" : "text-muted",
              )}
              onClick={() => switchKind(value)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      <Field label="Valor">
        <div className="flex items-baseline justify-center gap-2 border-b border-line pb-2">
          <span className="text-muted">R$</span>
          <input
            inputMode="decimal"
            autoFocus
            placeholder="0,00"
            value={amount}
            onChange={(event) => {
              setAmount(event.target.value);
              setError("");
            }}
            className="w-full bg-transparent text-center font-display text-4xl text-ink tabular-nums outline-none placeholder:text-faint"
            aria-label="Valor em reais"
          />
        </div>
      </Field>

      {caution ? (
        <p ref={cautionRef} className="text-sm leading-6 text-danger">
          {caution}
        </p>
      ) : null}

      {kind === "save" ? (
        goals.length > 0 ? (
          <Field label="Meta">
            <div className="flex flex-wrap gap-2">
              {goals.map((goal) => (
                <button
                  key={goal.id}
                  type="button"
                  className={cn(
                    "press h-11 rounded-md border px-3 text-sm",
                    goalId === goal.id ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink",
                  )}
                  onClick={() => setGoalId(goal.id)}
                >
                  {goal.name}
                </button>
              ))}
            </div>
          </Field>
        ) : (
          <p className="text-sm text-muted">
            Ainda não há meta. Ao guardar, crio uma reserva de emergência para você separar esse valor.
          </p>
        )
      ) : (
        <Field label="Categoria">
          <div className="flex flex-wrap gap-2">
            {categoriesByKind(kind).map((category) => {
              const selected = category.id === categoryId;
              return (
                <button
                  key={category.id}
                  type="button"
                  className={cn(
                    "press inline-flex h-11 items-center gap-2 rounded-md border px-3 text-sm",
                    selected ? "border-ink bg-ink text-surface" : "border-line bg-surface text-ink",
                  )}
                  onClick={() => setCategoryId(category.id)}
                >
                  <CatIcon name={category.icon} className="size-4" />
                  {category.name}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      <Field label="Data">
        <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} />
      </Field>

      <Field label="Nota" hint="Opcional. Ex.: aluguel, delivery, salário.">
        <input
          value={note}
          maxLength={80}
          onChange={(event) => setNote(event.target.value)}
          className={fieldClass}
          placeholder="Do que foi"
        />
      </Field>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <Button type="submit" className="w-full">
        Salvar
      </Button>

      {locked && (existingTx || existingSave) ? (
        confirmDelete ? (
          <Button
            variant="danger"
            className="w-full"
            onClick={() => {
              if (existingTx) deleteTransaction(existingTx.id);
              if (existingSave) deleteContribution(existingSave.id);
              onClose();
            }}
          >
            Confirmar exclusão
          </Button>
        ) : (
          <Button variant="ghost" className="w-full" onClick={() => setConfirmDelete(true)}>
            Apagar
          </Button>
        )
      ) : null}
    </form>
  );
}

function initialKind(request: SheetRequest, txKind: FlowKind | undefined): EntryKind {
  if (request.mode === "save") return "save";
  if (request.mode === "tx") return txKind ?? "expense";
  return request.kind;
}
