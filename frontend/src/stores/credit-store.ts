import { create } from "zustand";

interface CreditState {
  balance: number;
  totalRecharged: number;
  totalConsumed: number;
  totalGifted: number;
  setBalance: (balance: number) => void;
  deduct: (amount: number) => void;
  add: (amount: number) => void;
  loadFromAccount: (account: {
    balance: number;
    total_recharged: number;
    total_consumed: number;
    total_gifted: number;
  }) => void;
}

export const useCreditStore = create<CreditState>()((set) => ({
  balance: 0,
  totalRecharged: 0,
  totalConsumed: 0,
  totalGifted: 0,

  setBalance: (balance: number) => set({ balance }),

  deduct: (amount: number) =>
    set((state) => ({
      balance: state.balance - amount,
      totalConsumed: state.totalConsumed + amount,
    })),

  add: (amount: number) =>
    set((state) => ({
      balance: state.balance + amount,
      totalRecharged: state.totalRecharged + amount,
    })),

  loadFromAccount: (account) =>
    set({
      balance: account.balance,
      totalRecharged: account.total_recharged,
      totalConsumed: account.total_consumed,
      totalGifted: account.total_gifted,
    }),
}));
