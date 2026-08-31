"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { tagProduct } from "@/lib/actions/misc";
import { Field, Button } from "@/components/ui/primitives";
import { g } from "@/lib/format";

export function TagForm({ readyJobs }: { readyJobs: { id: string; karigars?: { name: string }; wip: number }[] }) {
  const [jobId, setJobId] = useState(readyJobs[0]?.id ?? "");
  const [pcs, setPcs] = useState("");
  const [purity, setPurity] = useState("91.70");
  const [gross, setGross] = useState("");
  const [net, setNet] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit() {
    setPending(true);
    try {
      const res = await tagProduct(jobId, parseInt(pcs || "0"), parseFloat(gross), parseFloat(net), parseFloat(purity));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setPcs("");
        setGross("");
        setNet("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  if (readyJobs.length === 0) {
    return <p className="text-[12px] text-text-faint">No finished WIP is currently ready to tag.</p>;
  }

  return (
    <div>
      <Field label="Job Card">
        <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
          {readyJobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.id} — {j.karigars?.name} (WIP {g(j.wip)})
            </option>
          ))}
        </select>
      </Field>
      <div className="flex gap-2.5">
        <div className="flex-1">
          <Field label="Pieces">
            <input type="number" value={pcs} onChange={(e) => setPcs(e.target.value)} placeholder="e.g. 12" />
          </Field>
        </div>
        <div className="flex-1">
          <Field label="Purity">
            <input type="number" step="0.01" value={purity} onChange={(e) => setPurity(e.target.value)} />
          </Field>
        </div>
      </div>
      <div className="flex gap-2.5">
        <div className="flex-1">
          <Field label="Final Gross (g)">
            <input type="number" step="0.001" value={gross} onChange={(e) => setGross(e.target.value)} />
          </Field>
        </div>
        <div className="flex-1">
          <Field label="Final Net (g)">
            <input type="number" step="0.001" value={net} onChange={(e) => setNet(e.target.value)} />
          </Field>
        </div>
      </div>
      <Button variant="gold" className="w-full" disabled={pending} onClick={submit}>
        Save Tag → Sync Kramasya
      </Button>
    </div>
  );
}
