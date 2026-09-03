"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { correctMeltBullionMulti, correctRemeltMulti } from "@/lib/actions/melting";
import { MATERIALS, MAT } from "@/lib/constants";
import { Button } from "@/components/ui/primitives";
import { g } from "@/lib/format";
import type { Melt } from "@/lib/types";

type InputRow = { material_id: string; weight: number };
type MeltRow = Melt;

export function MeltHistoryTable({
  melts,
  inputsByMeltId,
  canEdit,
}: {
  melts: MeltRow[];
  inputsByMeltId: Record<string, InputRow[]>;
  canEdit: boolean;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Melt ID</th>
          <th>Type</th>
          <th>Input</th>
          <th className="text-right">Input Wt</th>
          <th className="text-right">Alloy</th>
          <th className="text-right">Expected</th>
          <th className="text-right">Actual</th>
          <th className="text-right">Loss</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {melts.length === 0 && (
          <tr>
            <td colSpan={9} className="text-center text-text-faint italic py-6">
              No melts posted yet.
            </td>
          </tr>
        )}
        {melts.map((m) => (
          <MeltHistoryRow key={m.id} melt={m} inputs={inputsByMeltId[m.id] ?? []} canEdit={canEdit} />
        ))}
      </tbody>
    </table>
  );
}

function MeltHistoryRow({ melt, inputs, canEdit }: { melt: MeltRow; inputs: InputRow[]; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const isBullion = melt.melt_type.startsWith("Bullion");
  const options = isBullion ? MATERIALS.filter((m) => m.category === "Bullion") : MATERIALS.filter((m) => ["DYE", "KDM", "BALLS", "CHAIN"].includes(m.id));

  const [rows, setRows] = useState<{ matId: string; weight: string }[]>(
    inputs.length > 0 ? inputs.map((i) => ({ matId: i.material_id, weight: String(i.weight) })) : [{ matId: options[0]?.id ?? "", weight: "" }]
  );
  const [actual, setActual] = useState(String(melt.actual_output));
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  function addRow() {
    setRows((r) => [...r, { matId: options[0]?.id ?? "", weight: "" }]);
  }
  function removeRow(idx: number) {
    setRows((r) => r.filter((_, i) => i !== idx));
  }
  function updateRow(idx: number, field: "matId" | "weight", value: string) {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  }

  async function save() {
    if (!window.confirm(`Correct ${melt.id}? This reverses the original bin effects and reapplies with the new numbers.`)) return;
    setPending(true);
    try {
      const matIds = rows.map((r) => r.matId);
      const weights = rows.map((r) => parseFloat(r.weight));
      const res = isBullion
        ? await correctMeltBullionMulti(melt.id, matIds, weights, parseFloat(actual))
        : await correctRemeltMulti(melt.id, matIds, weights, parseFloat(actual));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setEditing(false);
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  if (!inputs.length) {
    // Melt predates the correction feature — no stored input breakdown to edit safely.
    return (
      <tr>
        <td className="font-mono">{melt.id}</td>
        <td>{melt.melt_type}</td>
        <td>{melt.input_material}</td>
        <td className="num-cell">{g(melt.input_weight)}</td>
        <td className="num-cell">{g(melt.auto_alloy)}</td>
        <td className="num-cell">{g(melt.expected_output)}</td>
        <td className="num-cell">{g(melt.actual_output)}</td>
        <td className="num-cell text-amber">{g(melt.melt_loss)}</td>
        <td className="text-[10.5px] text-text-faint">Not correctable</td>
      </tr>
    );
  }

  return (
    <>
      <tr>
        <td className="font-mono">{melt.id}</td>
        <td>{melt.melt_type}</td>
        <td>{melt.input_material}</td>
        <td className="num-cell">{g(melt.input_weight)}</td>
        <td className="num-cell">{g(melt.auto_alloy)}</td>
        <td className="num-cell">{g(melt.expected_output)}</td>
        <td className="num-cell">{g(melt.actual_output)}</td>
        <td className="num-cell text-amber">{g(melt.melt_loss)}</td>
        <td>
          {canEdit && (
            <Button size="sm" onClick={() => setEditing((e) => !e)}>
              {editing ? "Cancel" : "Edit"}
            </Button>
          )}
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={9} className="bg-surface2">
            <div className="p-3">
              {rows.map((row, idx) => (
                <div key={idx} className="flex gap-2 mb-2 items-start">
                  <select value={row.matId} onChange={(e) => updateRow(idx, "matId", e.target.value)} className="flex-1">
                    {options.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.001"
                    value={row.weight}
                    onChange={(e) => updateRow(idx, "weight", e.target.value)}
                    placeholder="Weight (g)"
                    className="max-w-[130px]"
                  />
                  {rows.length > 1 && (
                    <button type="button" onClick={() => removeRow(idx)} className="bg-surface3 border border-border rounded-md px-2.5 text-[13px] text-red">
                      ✕
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addRow} className="text-[12px] text-gold underline mb-3 block">
                + Add another source
              </button>
              <div className="flex gap-2.5 items-end">
                <div className="flex-1 max-w-[200px]">
                  <label className="block text-[11px] text-text-dim mb-1">Actual Output (g)</label>
                  <input type="number" step="0.001" value={actual} onChange={(e) => setActual(e.target.value)} />
                </div>
                <Button variant="gold" size="sm" disabled={pending} onClick={save}>
                  Save Correction
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}