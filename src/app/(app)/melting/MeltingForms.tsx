"use client";
import { useMemo, useState } from "react";
import { MATERIALS } from "@/lib/constants";
import { meltBullionLots, remelt917Multi } from "@/lib/actions/melting";
import { Field, Button, Formula } from "@/components/ui/primitives";
import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";
import { g, pct } from "@/lib/format";

export type BullionLot = { id: string; purity: number; remaining_weight: number };
type LotRow = { lotId: string; weight: string };
type SourceRow = { matId: string; weight: string };

export function MeltingForms({ factoryBin, lots }: { factoryBin: Record<string, number>; lots: BullionLot[] }) {
  const remeltMats = MATERIALS.filter((m) => ["DYE", "KDM", "BALLS", "CHAIN"].includes(m.id));

  const [bRows, setBRows] = useState<LotRow[]>([{ lotId: lots[0]?.id ?? "", weight: "" }]);
  const [bActual, setBActual] = useState("");
  const [rRows, setRRows] = useState<SourceRow[]>([{ matId: remeltMats[0].id, weight: "" }]);
  const [rActual, setRActual] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  function addBRow() {
    setBRows((r) => [...r, { lotId: lots[0]?.id ?? "", weight: "" }]);
  }
  function removeBRow(idx: number) {
    setBRows((r) => r.filter((_, i) => i !== idx));
  }
  function updateBRow(idx: number, field: "lotId" | "weight", value: string) {
    setBRows((r) => r.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  }

  function addRRow() {
    setRRows((r) => [...r, { matId: remeltMats[0].id, weight: "" }]);
  }
  function removeRRow(idx: number) {
    setRRows((r) => r.filter((_, i) => i !== idx));
  }
  function updateRRow(idx: number, field: "matId" | "weight", value: string) {
    setRRows((r) => r.map((row, i) => (i === idx ? { ...row, [field]: value } : row)));
  }

  const bPreview = useMemo(() => {
    let fineIn = 0;
    let totalWeight = 0;
    let allValid = true;
    for (const row of bRows) {
      const w = parseFloat(row.weight);
      const lot = lots.find((l) => l.id === row.lotId);
      if (!w || w <= 0) continue;
      if (!lot || w > lot.remaining_weight + 0.0005) {
        allValid = false;
        continue;
      }
      fineIn += w * lot.purity;
      totalWeight += w;
    }
    fineIn = Math.round(fineIn * 100) / 10000;
    if (totalWeight <= 0 || !allValid) return null;
    const expected = Math.round((fineIn / 0.917) * 10000) / 10000;
    const alloy = Math.round((expected - totalWeight) * 10000) / 10000;
    return { fineIn, expected, alloy, totalWeight };
  }, [bRows, lots]);

  const rTotalWeight = useMemo(() => rRows.reduce((s, row) => s + (parseFloat(row.weight) || 0), 0), [rRows]);

  async function submitMelt() {
    setPending(true);
    try {
      const lotIds = bRows.map((r) => r.lotId);
      const weights = bRows.map((r) => parseFloat(r.weight));
      const res = await meltBullionLots(lotIds, weights, parseFloat(bActual));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setBRows([{ lotId: lots[0]?.id ?? "", weight: "" }]);
        setBActual("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }
  async function submitRemelt() {
    setPending(true);
    try {
      const matIds = rRows.map((r) => r.matId);
      const weights = rRows.map((r) => parseFloat(r.weight));
      const res = await remelt917Multi(matIds, weights, parseFloat(rActual));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setRRows([{ matId: remeltMats[0].id, weight: "" }]);
        setRActual("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
      <div>
        <div className="text-[11.5px] text-text-dim mb-1.5 font-semibold">Bullion Lots (pick exactly which batches to melt)</div>
        {lots.length === 0 && <div className="text-[12px] text-text-faint mb-3">No Bullion lots currently in stock.</div>}
        {lots.length > 0 &&
          bRows.map((row, idx) => (
            <div key={idx} className="flex gap-2 mb-2 items-start">
              <select value={row.lotId} onChange={(e) => updateBRow(idx, "lotId", e.target.value)} className="flex-1">
                {lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.id} — {pct(l.purity)} — {g(l.remaining_weight)} left
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.001"
                value={row.weight}
                onChange={(e) => updateBRow(idx, "weight", e.target.value)}
                placeholder="Weight (g)"
                className="max-w-[130px]"
              />
              {bRows.length > 1 && (
                <button type="button" onClick={() => removeBRow(idx)} className="bg-surface3 border border-border rounded-md px-2.5 text-[13px] text-red">
                  ✕
                </button>
              )}
            </div>
          ))}
        {lots.length > 0 && (
          <button type="button" onClick={addBRow} className="text-[12px] text-gold underline mb-3">
            + Add another lot
          </button>
        )}

        <Formula>
          {bPreview
            ? `Combined fine input = ${g(bPreview.fineIn)}\nExpected 91.7 output = ${g(bPreview.fineIn)} ÷ 0.917 = ${g(bPreview.expected)}\nAuto alloy required = ${g(bPreview.expected)} − ${g(bPreview.totalWeight)} = ${g(bPreview.alloy)}`
            : "Combined fine input = —\nExpected 91.7 output = —\nAuto alloy required = —"}
        </Formula>
        <div className="mt-3">
          <Field label="Actual Output Received (g)">
            <input type="number" step="0.001" value={bActual} onChange={(e) => setBActual(e.target.value)} placeholder="e.g. 108.800" />
          </Field>
        </div>
        <Button variant="gold" className="w-full" disabled={pending || !bPreview} onClick={submitMelt}>
          Post Melt
        </Button>
        <div className="text-[11px] text-text-faint mt-2">
          Only the purity of the lot(s) you select is used — not a blended average of everything in stock. Alloy Bin
          available: {g(factoryBin["ALLOY"] ?? 0)}.
        </div>
      </div>

      <div>
        <div className="text-[11.5px] text-text-dim mb-1.5 font-semibold">Materials to Remelt (add as many as you&apos;re combining)</div>
        {rRows.map((row, idx) => (
          <div key={idx} className="flex gap-2 mb-2 items-start">
            <select value={row.matId} onChange={(e) => updateRRow(idx, "matId", e.target.value)} className="flex-1">
              {remeltMats.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — bin {g(factoryBin[m.id] ?? 0)}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.001"
              value={row.weight}
              onChange={(e) => updateRRow(idx, "weight", e.target.value)}
              placeholder="Weight (g)"
              className="max-w-[130px]"
            />
            {rRows.length > 1 && (
              <button type="button" onClick={() => removeRRow(idx)} className="bg-surface3 border border-border rounded-md px-2.5 text-[13px] text-red">
                ✕
              </button>
            )}
          </div>
        ))}
        <button type="button" onClick={addRRow} className="text-[12px] text-gold underline mb-3">
          + Add another source
        </button>
        <Field label={`Actual Output Received (g) — total input: ${g(rTotalWeight)}`}>
          <input type="number" step="0.001" value={rActual} onChange={(e) => setRActual(e.target.value)} placeholder="e.g. 49.920" />
        </Field>
        <Button className="w-full" disabled={pending || rTotalWeight <= 0} onClick={submitRemelt}>
          Post Melt
        </Button>
        <div className="text-[11px] text-text-faint mt-2">No alloy is added — all sources here are already 91.7%.</div>
      </div>
    </div>
  );
}