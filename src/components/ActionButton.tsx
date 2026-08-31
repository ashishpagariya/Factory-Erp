"use client";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useToast } from "@/components/ToastProvider";
import { Button } from "@/components/ui/primitives";
import type { ActionResult } from "@/lib/types";

/**
 * Wraps a Server Action so a page can trigger it from a button, show the
 * resulting toast, and refresh server-rendered data — without every page
 * re-implementing the same pending/toast/refresh plumbing.
 */
export function ActionButton<T>({
  action,
  variant = "gold",
  size = "md",
  className,
  children,
  onSuccess,
}: {
  action: () => Promise<ActionResult<T>>;
  variant?: "default" | "gold" | "danger" | "ghost";
  size?: "md" | "sm";
  className?: string;
  children: ReactNode;
  onSuccess?: (data: T | undefined) => void;
}) {
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          const res = await action();
          toast(res.message, res.ok ? "ok" : "err");
          if (res.ok) {
            onSuccess?.(res.data);
            router.refresh();
          }
        } catch (e) {
          toast(e instanceof Error ? e.message : "Something went wrong", "err");
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? "Working…" : children}
    </Button>
  );
}
