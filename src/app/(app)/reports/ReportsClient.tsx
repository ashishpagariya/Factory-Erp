"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { postStockTake, approveStockTake } from "@/lib/actions/misc";
import { Button, Field } from "@/components/ui/primitives";
import { g } from "@/lib/format";
import type { Material } from "@/lib/types";

export function StockTakeForm({ materials, factoryBin }: { materials: Material[]; factoryBin: Record<string, number> }) {
  const [matId, setMatId] = useState(materials[0]?.id ?? "");
  const [phys, setPhys] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit() {
    setPending(true);
    try {
      const res = await postStockTake(matId, parseFloat(phys));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setPhys("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex gap-2.5 flex-wrap items-end">
      <div className="min-w-[220px]">
        <Field label="Material">
          <select value={matId} onChange={(e) => setMatId(e.target.value)}>
            {materials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — system {g(factoryBin[m.id] ?? 0)}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="min-w-[160px]">
        <Field label="Physical weight">
          <input type="number" step="0.001" value={phys} onChange={(e) => setPhys(e.target.value)} />
        </Field>
      </div>
      <Button variant="gold" disabled={pending} onClick={submit} className="mb-3">
        Record Count
      </Button>
    </div>
  );
}

export function ApproveStockTakeButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();
  async function approve() {
    const reason = window.prompt("Reason for approving this stock adjustment:", "Physical count verified");
    if (reason === null) return;
    setPending(true);
    try {
      const res = await approveStockTake(id, reason);
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }
  return (
    <Button size="sm" disabled={pending} onClick={approve}>
      Approve
    </Button>
  );
}
