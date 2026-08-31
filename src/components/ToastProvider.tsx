"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Toast = { id: number; message: string; type: "ok" | "err" };
const ToastCtx = createContext<(message: string, type?: "ok" | "err") => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, type: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 flex flex-col gap-2 z-[200]">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`bg-surface3 border border-border rounded-md px-4 py-2.5 text-[12.5px] min-w-[260px] max-w-[360px] shadow-2xl border-l-4 ${
              t.type === "ok" ? "border-l-green" : "border-l-red"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
