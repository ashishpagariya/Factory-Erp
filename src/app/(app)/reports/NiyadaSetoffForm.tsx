"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { settleNiyada } from "@/lib/actions/niyada";
import { Button, Field } from "@/components/ui/primitives";
import { g } from "@/lib/format";

export function NiyadaSetOffForm({ totalNiyadaGrams }: { totalNiyadaGrams: number }) {
  const [recovered, setRecovered] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const recoveredNum = parseFloat(recovered) || 0;
  const net = totalNiyadaGrams - recoveredNum;

  async function submit() {
    if (!window.confirm(`Set off this period's Niyada?\n\nTotal: ${totalNiyadaGrams.toFixed(3)} g\nRecovered: ${recoveredNum.toFixed(3)} g\nNet loss: ${net.toFixed(3)} g\n\nThis closes the current period.`)) return;
    setPending(true);
    try {
      const res = await settleNiyada(recoveredNum);
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setRecovered("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Field label={`Grams Recovered (e.g. from dust) — total Niyada this period: ${g(totalNiyadaGrams)}`}>
        <input type="number" step="0.001" value={recovered} onChange={(e) => setRecovered(e.target.value)} placeholder="e.g. 350.000" />
      </Field>
      <div className="text-[13px] font-mono mb-3">
        Net loss to set off = {g(totalNiyadaGrams)} − {g(recoveredNum)} = <span className="text-amber font-bold">{g(net)}</span>
      </div>
      <Button variant="gold" disabled={pending || totalNiyadaGrams <= 0.0005} onClick={submit}>
        Set Off This Period
      </Button>
      {totalNiyadaGrams <= 0.0005 && <div className="text-[11px] text-text-faint mt-2">Nothing accumulated in the current period yet.</div>}
    </div>
  );
}