"use client";

import { useEffect } from "react";
import { Check, CircleAlert, X } from "lucide-react";
import type { ToastMessage } from "@/lib/types";

type ToastProps = {
  toast: ToastMessage | null;
  onDismiss: () => void;
};

export default function Toast({ toast, onDismiss }: ToastProps) {
  useEffect(() => {
    if (!toast) {
      return;
    }
    const timer = window.setTimeout(onDismiss, 3200);
    return () => window.clearTimeout(timer);
  }, [onDismiss, toast]);

  if (!toast) {
    return null;
  }

  const success = toast.type === "success";

  return (
    <div
      role="status"
      className={`fixed top-4 right-4 z-[70] flex max-w-sm items-start gap-3 rounded-2xl border px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ${
        success
          ? "border-[#F59E0B]/40 bg-[#121826] text-white"
          : "border-red-400/40 bg-[#121826] text-white"
      }`}
    >
      {success ? (
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#F59E0B]" />
      ) : (
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
      )}
      <p className="text-sm leading-5">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-1 rounded-full p-1 text-zinc-500 transition hover:text-white"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
