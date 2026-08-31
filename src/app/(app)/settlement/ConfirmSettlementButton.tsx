"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { settleJobAction } from "@/lib/actions/jobcard";
import { Button } from "@/components/ui/primitives";

export function ConfirmSettlementButton({ jobId, disabled }: { jobId: string; disabled: boolean }) {
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit() {
    setPending(true);
    try {
      const res = await settleJobAction(jobId);
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok && res.data) router.push(`/karigar-job/${res.data.newJobId}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <Button variant="gold" disabled={disabled || pending} onClick={submit}>
      {pending ? "Settling…" : "Confirm Settlement"}
    </Button>
  );
}
