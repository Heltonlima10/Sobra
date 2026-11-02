import { useEffect, useState } from "react";
import { EntrySheet, type SheetRequest } from "@/components/finance/entry-sheet";
import {
  GoalsScreen,
  HomeScreen,
  LimitsScreen,
  MonthSwitcher,
  MovesScreen,
  Setup,
} from "@/components/finance/screens";
import { FlowScreen } from "@/components/finance/flow-screen";
import { Button, Sheet } from "@/components/finance/ui";
import { cn } from "@/lib/cn";
import { currentMonthKey } from "@/lib/finance/model";
import { SAMPLE_MONTH } from "@/lib/finance/sample";
import { useFinance } from "@/lib/finance/store";

type Tab = "home" | "flow" | "moves" | "limits" | "goals";

const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Início" },
  { id: "flow", label: "Fluxo" },
  { id: "moves", label: "Extrato" },
  { id: "limits", label: "Limites" },
  { id: "goals", label: "Metas" },
];

export function FinanceApp() {
  useEffect(() => {
    void Promise.resolve(useFinance.persist.rehydrate());
  }, []);

  return <FinanceBody />;
}

function FinanceBody() {
  const onboarded = useFinance((state) => state.onboarded);
  const loadSample = useFinance((state) => state.loadSample);
  const reset = useFinance((state) => state.reset);
  const [month, setMonth] = useState(currentMonthKey);
  const [tab, setTab] = useState<Tab>("home");
  const [sheet, setSheet] = useState<SheetRequest | null>(null);
  const [ajustes, setAjustes] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab, month, onboarded]);

  if (!onboarded) {
    return (
      <main>
        <Setup
          onExample={() => {
            loadSample();
            setMonth(SAMPLE_MONTH);
            setTab("home");
          }}
        />
      </main>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="safe-top sticky top-0 z-20 bg-bg px-5">
        <div className="flex items-center justify-between">
          <p className="font-display text-2xl text-ink">sobra</p>
          <button type="button" className="press h-11 px-2 text-sm text-muted" onClick={() => setAjustes(true)}>
            Ajustes
          </button>
        </div>
        <MonthSwitcher month={month} onChange={setMonth} />
      </header>

      <main className="flex-1 px-5 pt-4 pb-40">
        {tab === "home" ? (
          <HomeScreen
            month={month}
            onOpen={setSheet}
            onSeeAll={() => setTab("moves")}
            onSimulate={() => setTab("flow")}
          />
        ) : null}
        {tab === "flow" ? <FlowScreen month={month} /> : null}
        {tab === "moves" ? <MovesScreen month={month} onOpen={setSheet} /> : null}
        {tab === "limits" ? <LimitsScreen month={month} /> : null}
        {tab === "goals" ? <GoalsScreen onSave={(goalId) => setSheet({ mode: "create", kind: "save", goalId })} /> : null}
      </main>

      <footer className="safe-bottom fixed bottom-0 left-1/2 z-20 w-full max-w-lg -translate-x-1/2 border-t border-line bg-bg px-5 pt-3">
        <Button className="w-full" onClick={() => setSheet({ mode: "create", kind: "expense" })}>
          Anotar
        </Button>
        <nav className="mt-1 grid grid-cols-5" aria-label="Seções">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "press relative h-12 text-sm",
                  active ? "font-medium text-ink" : "text-muted",
                )}
                aria-current={active ? "page" : undefined}
                onClick={() => setTab(item.id)}
              >
                {active ? <span className="absolute inset-x-4 top-0 h-0.5 bg-ink" /> : null}
                {item.label}
              </button>
            );
          })}
        </nav>
      </footer>

      <EntrySheet
        request={sheet}
        month={month}
        onClose={() => setSheet(null)}
        onSaved={(date) => setMonth(date.slice(0, 7))}
      />

      <Sheet
        open={ajustes}
        onOpenChange={(open) => {
          setAjustes(open);
          if (!open) setConfirmReset(false);
        }}
        title="Ajustes"
        description="Os números ficam só neste aparelho. Se limpar os dados do navegador, eles somem."
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm leading-6 text-muted">
            Anote no dia, guarde quando o dinheiro entra e trate o limite como teto. No celular, adicione esta página à
            tela inicial para abrir como um aplicativo.
          </p>
          <Button
            variant="ghost"
            className="w-full border border-line"
            onClick={() => {
              loadSample();
              setMonth(SAMPLE_MONTH);
              setTab("home");
              setAjustes(false);
            }}
          >
            Carregar mês de exemplo
          </Button>
          {confirmReset ? (
            <Button
              variant="danger"
              className="w-full"
              onClick={() => {
                reset();
                setAjustes(false);
                setConfirmReset(false);
                setMonth(currentMonthKey());
              }}
            >
              Confirmar e apagar
            </Button>
          ) : (
            <Button variant="danger" className="w-full" onClick={() => setConfirmReset(true)}>
              Apagar meus dados
            </Button>
          )}
        </div>
      </Sheet>
    </div>
  );
}
