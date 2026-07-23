"use client";
import { create } from "zustand";

// ── Global toast notifications ──────────────────────────────────────
// Lightweight, ambient feedback for actions (trade placed, deposit
// succeeded, market updated, etc.) — separate from inline form errors,
// which should stay inline next to the field that caused them.

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastState {
  toasts: ToastItem[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: number) => void;
}

let nextId = 1;
const DURATION_MS = 3800;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, type = "success") => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, DURATION_MS);
  },
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Fire a toast from anywhere — components, store actions, etc. */
export function toast(message: string, type: ToastType = "success") {
  useToastStore.getState().addToast(message, type);
}
