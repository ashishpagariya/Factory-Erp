"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { createJobCard } from "@/lib/actions/jobcard";
import { Button, Field } from "@/components/ui/primitives";
import type { Karigar } from "@/lib/types";

export function CreateJobForm({ karigars, busyIds }: { karigars: Karigar[]; busyIds: Set<string> }) {
  const [karigarId, setKarigarId] = useState(karigars.find((k) => !busyIds.has(k.id))?.id ?? karigars[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit() {
    setPending(true);
    try {
      const res = await createJobCard(karigarId);
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok && res.data) router.push(`/karigar-job/${res.data.id}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Field label="Karigar">
        <select value={karigarId} onChange={(e) => setKarigarId(e.target.value)}>
          {karigars.map((k) => (
            <option key={k.id} value={k.id} disabled={busyIds.has(k.id)}>
              {k.name} — wastage {k.wastage_pct}%{busyIds.has(k.id) ? " (already has open Job)" : ""}
            </option>
          ))}
        </select>
      </Field>
      <Button variant="gold" className="w-full" disabled={pending || !karigarId} onClick={submit}>
        Create Job Card
      </Button>
      <div className="text-[11px] text-text-faint mt-2">
        Job Card number auto-generated. Karigar wastage % is snapshotted at creation.
      </div>
    </div>
  );
}
