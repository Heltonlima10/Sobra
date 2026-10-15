import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { buildSample } from "@/lib/finance/sample";
import {
  suggestedBudgets,
  uid,
  type Contribution,
  type FinanceData,
  type Goal,
  type Transaction,
} from "@/lib/finance/model";

type DraftTx = Omit<Transaction, "id" | "createdAt">;
type DraftGoal = Omit<Goal, "id">;
type DraftSave = Omit<Contribution, "id" | "createdAt">;

type FinanceState = FinanceData & {
  finishOnboarding: (incomeCents: number, savingsPercent: number) => void;
  setPlan: (incomeCents: number, savingsPercent: number) => void;
  applySuggestedBudgets: () => void;
  setBudget: (categoryId: string, limitCents: number) => void;
  addTransaction: (draft: DraftTx) => void;
  updateTransaction: (id: string, draft: DraftTx) => void;
  deleteTransaction: (id: string) => void;
  addGoal: (draft: DraftGoal) => string;
  updateGoal: (id: string, draft: DraftGoal) => void;
  deleteGoal: (id: string) => void;
  addContribution: (draft: DraftSave) => void;
  updateContribution: (id: string, draft: DraftSave) => void;
  deleteContribution: (id: string) => void;
  loadSample: () => void;
  reset: () => void;
};

export const emptyFinance = (): FinanceData => ({
  onboarded: false,
  monthlyIncomeCents: 0,
  savingsPercent: 20,
  transactions: [],
  contributions: [],
  budgets: {},
  budgetBasisCents: null,
  budgetSavingsPercent: null,
  goals: [],
  sample: false,
});

export const useFinance = create<FinanceState>()(
  persist(
    (set) => ({
      ...emptyFinance(),
      finishOnboarding: (incomeCents, savingsPercent) =>
        set({
          onboarded: true,
          sample: false,
          monthlyIncomeCents: incomeCents,
          savingsPercent,
          budgets: incomeCents > 0 ? suggestedBudgets(incomeCents, savingsPercent) : {},
          budgetBasisCents: incomeCents > 0 ? incomeCents : null,
          budgetSavingsPercent: incomeCents > 0 ? savingsPercent : null,
        }),
      setPlan: (incomeCents, savingsPercent) =>
        set({ monthlyIncomeCents: incomeCents, savingsPercent }),
      applySuggestedBudgets: () =>
        set((state) => ({
          budgets:
            state.monthlyIncomeCents > 0
              ? suggestedBudgets(state.monthlyIncomeCents, state.savingsPercent)
              : {},
          budgetBasisCents: state.monthlyIncomeCents > 0 ? state.monthlyIncomeCents : null,
          budgetSavingsPercent: state.monthlyIncomeCents > 0 ? state.savingsPercent : null,
        })),
      setBudget: (categoryId, limitCents) =>
        set((state) => ({ budgets: { ...state.budgets, [categoryId]: limitCents } })),
      addTransaction: (draft) =>
        set((state) => ({
          transactions: [
            { ...draft, id: uid(), createdAt: new Date().toISOString() },
            ...state.transactions,
          ],
        })),
      updateTransaction: (id, draft) =>
        set((state) => ({
          transactions: state.transactions.map((item) => (item.id === id ? { ...item, ...draft } : item)),
        })),
      deleteTransaction: (id) =>
        set((state) => ({ transactions: state.transactions.filter((item) => item.id !== id) })),
      addGoal: (draft) => {
        const id = uid();
        set((state) => ({ goals: [...state.goals, { ...draft, id }] }));
        return id;
      },
      updateGoal: (id, draft) =>
        set((state) => ({
          goals: state.goals.map((goal) => (goal.id === id ? { ...goal, ...draft } : goal)),
        })),
      deleteGoal: (id) =>
        set((state) => ({
          goals: state.goals.filter((goal) => goal.id !== id),
          contributions: state.contributions.filter((item) => item.goalId !== id),
        })),
      addContribution: (draft) =>
        set((state) => ({
          contributions: [
            { ...draft, id: uid(), createdAt: new Date().toISOString() },
            ...state.contributions,
          ],
        })),
      updateContribution: (id, draft) =>
        set((state) => ({
          contributions: state.contributions.map((item) => (item.id === id ? { ...item, ...draft } : item)),
        })),
      deleteContribution: (id) =>
        set((state) => ({ contributions: state.contributions.filter((item) => item.id !== id) })),
      loadSample: () => set(buildSample()),
      reset: () => set(emptyFinance()),
    }),
    {
      name: "sobra-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({
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
      }),
    },
  ),
);
