"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { postStockTake, approveStockTake, correctStockTake } from "@/lib/actions/misc";
import { Button, Field } from "@/components/ui/primitives";
import { g } from "@/lib/format";
import type { Material } from "@/lib/types";

export function StockTakeForm({ materials, factoryBin }: { materials: Material[]; factoryBin: Record<string, number> }) {
  const [matId, setMatId] = useState(materials[0]?.id ?? "");
  const [physical, setPhysical] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit() {
    setPending(true);
    try {
      const res = await postStockTake(matId, parseFloat(physical));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setPhysical("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex gap-2.5 flex-wrap items-end mb-3">
      <div className="flex-1 min-w-[160px]">
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
      <div className="flex-1 min-w-[140px]">
        <Field label="Physical Count (g)">
          <input type="number" step="0.001" value={physical} onChange={(e) => setPhysical(e.target.value)} />
        </Field>
      </div>
      <Button variant="gold" disabled={pending} onClick={submit}>
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
    const reason = window.prompt("Reason for approving this stock adjustment:", "Physical count confirmed");
    if (!reason) return;
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
    <Button size="sm" variant="gold" disabled={pending} onClick={approve}>
      Approve
    </Button>
  );
}

export function CorrectStockTakeButton({ id, currentPhysical }: { id: string; currentPhysical: number }) {
  const [editing, setEditing] = useState(false);
  const [physical, setPhysical] = useState(String(currentPhysical));
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function save() {
    if (!window.confirm(`Correct this stock adjustment?`)) return;
    setPending(true);
    try {
      const res = await correctStockTake(id, parseFloat(physical));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
    return (
      <Button size="sm" onClick={() => setEditing(true)}>
        Edit
      </Button>
    );
  }

  return (
    <div className="flex gap-1.5 items-center">
      <input type="number" step="0.001" value={physical} onChange={(e) => setPhysical(e.target.value)} className="w-[100px]" />
      <Button size="sm" variant="gold" disabled={pending} onClick={save}>
        Save
      </Button>
    </div>
  );
}