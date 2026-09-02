"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { dispatchJobFinishedDirect, factoryDispatchMaterial, officeAccept, officeAcceptWithDiscrepancy, resolveOfficeDiscrepancy } from "@/lib/actions/misc";
import { Button, Field, Badge } from "@/components/ui/primitives";
import { g } from "@/lib/format";
import type { Material } from "@/lib/types";

export type JobWithWip = { id: string; karigarName: string; wip: number };

export function DispatchJobFinishedForm({ jobs }: { jobs: JobWithWip[] }) {
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [pieces, setPieces] = useState("");
  const [purity, setPurity] = useState("91.70");
  const [gross, setGross] = useState("");
  const [net, setNet] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  if (jobs.length === 0) {
    return <p className="text-[12px] text-text-faint">No job currently has finished product ready to dispatch.</p>;
  }

  async function submit() {
    setPending(true);
    try {
      const res = await dispatchJobFinishedDirect(jobId, parseInt(pieces || "0"), parseFloat(gross), parseFloat(net), parseFloat(purity));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setPieces("");
        setGross("");
        setNet("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Field label="Job Card">
        <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
          {jobs.map((j) => (
            <option key={j.id} value={j.id}>
              {j.id} — {j.karigarName} (WIP {g(j.wip)})
            </option>
          ))}
        </select>
      </Field>
      <div className="flex gap-2.5">
        <div className="flex-1">
          <Field label="Pieces">
            <input type="number" value={pieces} onChange={(e) => setPieces(e.target.value)} placeholder="e.g. 12" />
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
        Dispatch Finished Goods → Transit
      </Button>
      <div className="text-[11px] text-text-faint mt-2">
        Tagging &amp; Kramasya sync now happen automatically as part of this dispatch.
      </div>
    </div>
  );
}

export function DispatchMaterialForm({ materials, factoryBin }: { materials: Material[]; factoryBin: Record<string, number> }) {
  const available = materials.filter((m) => (factoryBin[m.id] ?? 0) > 0);
  const [matId, setMatId] = useState(available[0]?.id ?? "");
  const [weight, setWeight] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit() {
    setPending(true);
    try {
      const res = await factoryDispatchMaterial(matId, parseFloat(weight));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setWeight("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Field label="Material">
        <select value={matId} onChange={(e) => setMatId(e.target.value)} disabled={available.length === 0}>
          {available.length === 0 && <option>Nothing available</option>}
          {available.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — Bin {g(factoryBin[m.id] ?? 0)}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Weight (g)">
        <input type="number" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} />
      </Field>
      <Button className="w-full" disabled={pending || available.length === 0} onClick={submit}>
        Dispatch → Transit
      </Button>
    </div>
  );
}

export type PendingFD = { id: string; category: string; grossTotal: number; netTotal: number | null; items: string };

export function AcceptRow({ fd }: { fd: PendingFD }) {
  const [received, setReceived] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function accept() {
    setPending(true);
    try {
      let res;
      if (received === "") {
        res = await officeAccept(fd.id);
      } else {
        const rv = parseFloat(received);
        if (Math.abs(rv - fd.grossTotal) < 0.0005) {
          res = await officeAccept(fd.id);
        } else {
          const reason = window.prompt("Received weight differs from what was dispatched. Reason for discrepancy:", "Scale variance") || "Not specified";
          res = await officeAcceptWithDiscrepancy(fd.id, rv, reason);
        }
      }
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <tr>
      <td className="font-mono">{fd.id}</td>
      <td>{fd.category}</td>
      <td className="text-[12px]">{fd.items}</td>
      <td className="num-cell">{g(fd.grossTotal)}</td>
      <td className="num-cell">{fd.netTotal != null ? g(fd.netTotal) : "—"}</td>
      <td>
        <input
          type="number"
          step="0.001"
          value={received}
          onChange={(e) => setReceived(e.target.value)}
          placeholder={String(fd.grossTotal)}
          className="w-[120px]"
        />
      </td>
      <td>
        <Button size="sm" variant="gold" disabled={pending} onClick={accept}>
          Accept
        </Button>
      </td>
    </tr>
  );
}

export function OfficeDiscrepancyRow({ fd, received, reason, canResolve }: { fd: PendingFD; received: number; reason: string; canResolve: boolean }) {
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function resolve() {
    setPending(true);
    try {
      const res = await resolveOfficeDiscrepancy(fd.id, true);
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <tr>
      <td className="font-mono">{fd.id}</td>
      <td>{fd.category}</td>
      <td className="num-cell">{g(fd.grossTotal)}</td>
      <td className="num-cell">{g(received)}</td>
      <td className="num-cell text-red">{g(received - fd.grossTotal)}</td>
      <td>{reason}</td>
      <td>
        {canResolve ? (
          <Button size="sm" disabled={pending} onClick={resolve}>
            Accept as received
          </Button>
        ) : (
          <span className="text-[11px] text-text-faint">
            <Badge kind="pending">Awaiting Admin</Badge>
          </span>
        )}
      </td>
    </tr>
  );
}