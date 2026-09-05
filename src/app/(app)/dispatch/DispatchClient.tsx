"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import {
  dispatchJobFinishedDirect,
  factoryDispatchMaterial,
  officeAccept,
  officeAcceptWithDiscrepancy,
  resolveOfficeDiscrepancy,
  correctFactoryDispatchMaterial,
  correctFinishedDispatch,
} from "@/lib/actions/misc";
import { Button, Field, Badge } from "@/components/ui/primitives";
import { g } from "@/lib/format";
import type { Material } from "@/lib/types";

export type JobWithWip = { id: string; karigarName: string; wip: number; expectedNet: number; expectedStone: number; geruAdded: number };

export function DispatchJobFinishedForm({ jobs }: { jobs: JobWithWip[] }) {
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [pieces, setPieces] = useState("");
  const [purity, setPurity] = useState("91.70");
  const [gross, setGross] = useState("");
  const [stoneWeight, setStoneWeight] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const job = jobs.find((j) => j.id === jobId);

  const preview = useMemo(() => {
    if (!job) return null;
    const gr = gross === "" ? null : parseFloat(gross);
    const st = stoneWeight === "" ? null : parseFloat(stoneWeight);
    if (gr == null || st == null || isNaN(gr) || isNaN(st)) return null;

    const ratio = job.wip > 0.0005 ? Math.min(gr, job.wip) / job.wip : 1;
    const expectedNetPortion = job.expectedNet * ratio;
    const expectedStonePortion = job.expectedStone * ratio;

    const taggedNet = gr - st;
    const netAdjustment = expectedNetPortion - taggedNet;
    const stoneDiff = st - expectedStonePortion;

    return { taggedNet, netAdjustment, stoneDiff, expectedNetPortion, expectedStonePortion };
  }, [gross, stoneWeight, job]);

  if (jobs.length === 0) {
    return <p className="text-[12px] text-text-faint">No job currently has finished product ready to dispatch.</p>;
  }

  async function submit() {
    if (!job) return;
    setPending(true);
    try {
      const res = await dispatchJobFinishedDirect(jobId, parseInt(pieces || "0"), parseFloat(gross), parseFloat(stoneWeight || "0"), parseFloat(purity));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setPieces("");
        setGross("");
        setStoneWeight("");
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

      {job && (
        <div className="bg-surface2 border border-border rounded-lg p-3 mb-3 grid grid-cols-2 gap-y-2 gap-x-3 text-[12.5px]">
          <div className="text-text-dim">Expected Gross (pipeline)</div>
          <div className="text-right font-mono font-semibold">{g(job.wip)}</div>
          <div className="text-text-dim">Expected Stone</div>
          <div className="text-right font-mono font-semibold">{g(job.expectedStone)}</div>
          <div className="text-text-dim">Expected Net</div>
          <div className="text-right font-mono font-semibold">{g(job.expectedNet)}</div>
          <div className="text-text-dim">Geru Added (informational)</div>
          <div className="text-right font-mono font-semibold">{g(job.geruAdded)}</div>
        </div>
      )}

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
          <Field label="Gross — measured now (g)">
            <input type="number" step="0.001" value={gross} onChange={(e) => setGross(e.target.value)} placeholder="e.g. 126.210" />
          </Field>
        </div>
        <div className="flex-1">
          <Field label="Stone Weight — measured now (g)">
            <input type="number" step="0.001" value={stoneWeight} onChange={(e) => setStoneWeight(e.target.value)} placeholder="e.g. 12.600" />
          </Field>
        </div>
      </div>

      {preview && (
        <div className="bg-surface2 border border-border rounded-lg p-3 mb-3 text-[12.5px] space-y-1.5">
          <div className="flex justify-between">
            <span className="text-text-dim">Tagged Net (Gross − Stone)</span>
            <span className="font-mono font-semibold">{g(preview.taggedNet)}</span>
          </div>
          <div className="flex justify-between">
            <span className={Math.abs(preview.stoneDiff) < 0.0005 ? "text-text-dim" : "text-amber"}>Stone Difference vs Expected</span>
            <span className={`font-mono ${Math.abs(preview.stoneDiff) < 0.0005 ? "" : "text-amber"}`}>{g(preview.stoneDiff)}</span>
          </div>
          <div className="h-px bg-border-soft my-1" />
          <div className="flex justify-between font-bold">
            <span className={preview.netAdjustment > 0.0005 ? "text-red" : preview.netAdjustment < -0.0005 ? "text-green" : "text-text-dim"}>
              {preview.netAdjustment > 0.0005 ? "Loss" : preview.netAdjustment < -0.0005 ? "Profit" : "Net Adjustment"}
            </span>
            <span className={`font-mono ${preview.netAdjustment > 0.0005 ? "text-red" : preview.netAdjustment < -0.0005 ? "text-green" : ""}`}>
              {g(Math.abs(preview.netAdjustment))}
            </span>
          </div>
        </div>
      )}

      <Button variant="gold" className="w-full" disabled={pending || !job} onClick={submit}>
        Dispatch Finished Goods → Transit
      </Button>
      <div className="text-[11px] text-text-faint mt-2">
        Tagging &amp; Kramasya sync happen automatically. Both Gross and Stone are your actual measurements — any gap vs
        the pipeline&apos;s expected figures is recorded as a Profit or Loss.
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

export type PendingFD = {
  id: string;
  category: string;
  grossTotal: number;
  netTotal: number | null;
  items: string;
  itemType: "material" | "finished" | "other";
  materialId?: string;
  tagNo?: string;
  pieces?: number;
  stoneWeight?: number;
};

export function AcceptRow({ fd, canEdit }: { fd: PendingFD; canEdit: boolean }) {
  const [received, setReceived] = useState("");
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editWeight, setEditWeight] = useState(String(fd.grossTotal));
  const [editPieces, setEditPieces] = useState(String(fd.pieces ?? 0));
  const [editStone, setEditStone] = useState(String(fd.stoneWeight ?? 0));
  const toast = useToast();
  const router = useRouter();

  const editedNetPreview = fd.itemType === "finished" ? parseFloat(editWeight || "0") - parseFloat(editStone || "0") : null;

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

  async function saveCorrection() {
    if (!window.confirm(`Correct ${fd.id}?`)) return;
    setPending(true);
    try {
      const res =
        fd.itemType === "material"
          ? await correctFactoryDispatchMaterial(fd.id, parseFloat(editWeight))
          : await correctFinishedDispatch(fd.id, parseInt(editPieces || "0"), parseFloat(editWeight), parseFloat(editStone));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  const editable = canEdit && (fd.itemType === "material" || fd.itemType === "finished");

  return (
    <>
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
        <td className="flex gap-1.5">
          <Button size="sm" variant="gold" disabled={pending} onClick={accept}>
            Accept
          </Button>
          {editable && (
            <Button size="sm" onClick={() => setEditing((e) => !e)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
          )}
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={7} className="bg-surface2">
            <div className="p-2 flex gap-2 items-end flex-wrap">
              {fd.itemType === "finished" && (
                <div>
                  <label className="block text-[11px] text-text-dim mb-1">Pieces</label>
                  <input type="number" value={editPieces} onChange={(e) => setEditPieces(e.target.value)} className="max-w-[90px]" />
                </div>
              )}
              <div>
                <label className="block text-[11px] text-text-dim mb-1">{fd.itemType === "finished" ? "Gross" : "Weight"} (g)</label>
                <input type="number" step="0.001" value={editWeight} onChange={(e) => setEditWeight(e.target.value)} className="max-w-[130px]" />
              </div>
              {fd.itemType === "finished" && (
                <div>
                  <label className="block text-[11px] text-text-dim mb-1">Stone Weight (g)</label>
                  <input type="number" step="0.001" value={editStone} onChange={(e) => setEditStone(e.target.value)} className="max-w-[130px]" />
                </div>
              )}
              {fd.itemType === "finished" && editedNetPreview != null && (
                <div className="text-[12px] font-mono text-gold-bright pb-2">Net → {g(editedNetPreview)}</div>
              )}
              <Button variant="gold" size="sm" disabled={pending} onClick={saveCorrection}>
                Save
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
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