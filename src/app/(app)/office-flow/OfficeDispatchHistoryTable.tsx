"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { correctOfficeDispatch } from "@/lib/actions/office";
import { MAT } from "@/lib/constants";
import { Button, Badge } from "@/components/ui/primitives";
import { g, pct } from "@/lib/format";
import type { OfficeDispatch } from "@/lib/types";

export function OfficeDispatchHistoryTable({ dispatches, canEdit }: { dispatches: OfficeDispatch[]; canEdit: boolean }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Dispatch ID</th>
          <th>Material</th>
          <th className="text-right">Gross</th>
          <th className="text-right">Purity</th>
          <th className="text-right">Fine</th>
          <th>Status</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {dispatches.length === 0 && (
          <tr>
            <td colSpan={7} className="text-center text-text-faint italic py-6">
              No dispatches yet — create one above.
            </td>
          </tr>
        )}
        {dispatches.map((d) => (
          <DispatchRow key={d.id} d={d} canEdit={canEdit} />
        ))}
      </tbody>
    </table>
  );
}

function DispatchRow({ d, canEdit }: { d: OfficeDispatch; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [gross, setGross] = useState(String(d.gross));
  const [purity, setPurity] = useState(d.purity != null ? String(d.purity) : "");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const mat = MAT(d.material_id);
  const blocked = d.status === "Discrepancy" || d.discrepancy_reason != null;

  async function save() {
    if (!window.confirm(`Correct ${d.id}? This adjusts Factory Bin / Transit and the Admin Dashboard accordingly.`)) return;
    setPending(true);
    try {
      const p = mat?.category === "Bullion" ? parseFloat(purity) : mat?.category === "SemiFinished" ? 91.7 : null;
      const res = await correctOfficeDispatch(d.id, parseFloat(gross), p);
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <tr>
        <td className="font-mono">{d.id}</td>
        <td>{d.material_id}</td>
        <td className="num-cell">{g(d.gross)}</td>
        <td className="num-cell">{d.purity != null ? pct(d.purity) : "—"}</td>
        <td className="num-cell">{d.fine != null ? g(d.fine) : "—"}</td>
        <td>
          <Badge kind={d.status === "Pending" ? "pending" : d.status === "Discrepancy" ? "discrepancy" : "accepted"}>{d.status}</Badge>
        </td>
        <td>
          {canEdit && !blocked && (
            <Button size="sm" onClick={() => setEditing((e) => !e)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
          )}
          {canEdit && blocked && <span className="text-[10.5px] text-text-faint">Not correctable</span>}
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={7} className="bg-surface2">
            <div className="p-3 flex gap-2.5 items-end flex-wrap">
              <div className="max-w-[160px]">
                <label className="block text-[11px] text-text-dim mb-1">Gross (g)</label>
                <input type="number" step="0.001" value={gross} onChange={(e) => setGross(e.target.value)} />
              </div>
              {mat?.category === "Bullion" && (
                <div className="max-w-[160px]">
                  <label className="block text-[11px] text-text-dim mb-1">Purity (%)</label>
                  <input type="number" step="0.01" value={purity} onChange={(e) => setPurity(e.target.value)} />
                </div>
              )}
              <Button variant="gold" size="sm" disabled={pending} onClick={save}>
                Save Correction
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}