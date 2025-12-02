import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Operator } from '../types';

interface OperatorState {
  // List of operators the user has access to
  operators: Operator[];
  // Currently selected operator for viewing data
  selectedOperator: Operator | null;
  // Loading state
  isLoading: boolean;
  // Actions
  setOperators: (operators: Operator[]) => void;
  selectOperator: (operator: Operator | null) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
}

export const useOperatorStore = create<OperatorState>()(
  persist(
    (set) => ({
      operators: [],
      selectedOperator: null,
      isLoading: false,
      setOperators: (operators) => {
        set({ operators });
        // If only one operator, auto-select it
        if (operators.length === 1) {
          set({ selectedOperator: operators[0] });
        }
      },
      selectOperator: (operator) => set({ selectedOperator: operator }),
      setLoading: (isLoading) => set({ isLoading }),
      clear: () => set({ operators: [], selectedOperator: null, isLoading: false }),
    }),
    {
      name: 'operator-storage',
      partialize: (state) => ({
        selectedOperator: state.selectedOperator,
      }),
    }
  )
);
