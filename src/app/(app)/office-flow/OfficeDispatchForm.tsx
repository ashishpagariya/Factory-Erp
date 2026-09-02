"use client";
import { useState } from "react";
import { MATERIALS, OFFICE_DISPATCHABLE, MAT } from "@/lib/constants";
import { officeDispatch } from "@/lib/actions/office";
import { Field, Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";

export function OfficeDispatchForm() {
  const dispatchable = MATERIALS.filter((m) => OFFICE_DISPATCHABLE.includes(m.category));
  const [materialId, setMaterialId] = useState(dispatchable[0].id);
  const [weight, setWeight] = useState("");
  const [purity, setPurity] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const mat = MAT(materialId)!;

  async function submit() {
    setPending(true);
    try {
      const w = parseFloat(weight);
      const p = mat.category === "Bullion" ? parseFloat(purity) : null;
      const res = await officeDispatch(materialId, w, p);
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setWeight("");
        setPurity("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Field label="Material">
        <select value={materialId} onChange={(e) => setMaterialId(e.target.value)}>
          {dispatchable.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.category}
              {m.category === "SemiFinished" ? " (91.7 locked)" : ""}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex gap-2.5 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <Field label="Gross Weight (g)">
            <input type="number" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 66.000" />
          </Field>
        </div>
        <div className="flex-1 min-w-[140px]">
          {mat.category === "Bullion" ? (
            <Field label="Purity (%)">
              <input type="number" step="0.01" min={99.01} max={100} value={purity} onChange={(e) => setPurity(e.target.value)} placeholder="e.g. 99.90" />
            </Field>
          ) : mat.category === "SemiFinished" ? (
            <Field label="Purity">
              <input value="91.70% (locked)" disabled />
            </Field>
          ) : (
            <Field label="Purity">
              <input value="Not applicable" disabled />
            </Field>
          )}
        </div>
      </div>
      <Button variant="gold" className="w-full" disabled={pending} onClick={submit}>
        Create Dispatch → Transit
      </Button>
      <div className="text-[11px] text-text-faint mt-2">
        Bullion: purity entered, must stay &gt;99 up to 100. Semi-finished: purity auto-locked 91.7. Non-gold: purity not
        applicable.
      </div>
    </div>
  );
}