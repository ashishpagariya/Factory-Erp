"use client";
import { useMemo, useState } from "react";
import { MATERIALS, MAT } from "@/lib/constants";
import { meltBullion, remelt917 } from "@/lib/actions/melting";
import { Field, Button, Formula } from "@/components/ui/primitives";
import { useToast } from "@/components/ToastProvider";
import { useRouter } from "next/navigation";
import { g } from "@/lib/format";

export function MeltingForms({ factoryBin }: { factoryBin: Record<string, number> }) {
  const bullionMats = MATERIALS.filter((m) => m.category === "Bullion");
  const remeltMats = MATERIALS.filter((m) => ["DYE", "KDM", "BALLS", "CHAIN"].includes(m.id));

  const [bMat, setBMat] = useState(bullionMats[0].id);
  const [bWeight, setBWeight] = useState("");
  const [bActual, setBActual] = useState("");
  const [rMat, setRMat] = useState(remeltMats[0].id);
  const [rWeight, setRWeight] = useState("");
  const [rActual, setRActual] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const preview = useMemo(() => {
    const m = MAT(bMat)!;
    const w = parseFloat(bWeight);
    if (!w || w <= 0) return null;
    const fineIn = Math.round(w * m.purity! * 100) / 10000;
    const expected = Math.round((fineIn / 0.917) * 10000) / 10000;
    const alloy = Math.round((expected - w) * 10000) / 10000;
    return { fineIn, expected, alloy };
  }, [bMat, bWeight]);

  async function submitMelt() {
    setPending(true);
    try {
      const res = await meltBullion(bMat, parseFloat(bWeight), parseFloat(bActual));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setBWeight("");
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
      const res = await remelt917(rMat, parseFloat(rWeight), parseFloat(rActual));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setRWeight("");
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
        <Field label="Bullion Source">
          <select value={bMat} onChange={(e) => setBMat(e.target.value)}>
            {bullionMats.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — in bin {g(factoryBin[m.id] ?? 0)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Input Weight (g)">
          <input type="number" step="0.001" value={bWeight} onChange={(e) => setBWeight(e.target.value)} placeholder="e.g. 100.000" />
        </Field>
        <Formula>
          {preview
            ? `Fine input = ${bWeight} × ${MAT(bMat)!.purity}% = ${g(preview.fineIn)}\nExpected 91.7 output = ${g(preview.fineIn)} ÷ 0.917 = ${g(preview.expected)}\nAuto alloy required = ${g(preview.expected)} − ${g(parseFloat(bWeight))} = ${g(preview.alloy)}`
            : "Fine input = —\nExpected 91.7 output = —\nAuto alloy required = —"}
        </Formula>
        <div className="mt-3">
          <Field label="Actual Output Received (g)">
            <input type="number" step="0.001" value={bActual} onChange={(e) => setBActual(e.target.value)} placeholder="e.g. 108.800" />
          </Field>
        </div>
        <Button variant="gold" className="w-full" disabled={pending} onClick={submitMelt}>
          Post Melt
        </Button>
        <div className="text-[11px] text-text-faint mt-2">Alloy Bin available: {g(factoryBin["ALLOY"] ?? 0)}.</div>
      </div>
      <div>
        <Field label="Source Material">
          <select value={rMat} onChange={(e) => setRMat(e.target.value)}>
            {remeltMats.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} — in bin {g(factoryBin[m.id] ?? 0)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Input Weight (g)">
          <input type="number" step="0.001" value={rWeight} onChange={(e) => setRWeight(e.target.value)} placeholder="e.g. 50.000" />
        </Field>
        <Field label="Actual Output Received (g)">
          <input type="number" step="0.001" value={rActual} onChange={(e) => setRActual(e.target.value)} placeholder="e.g. 49.920" />
        </Field>
        <Button className="w-full" disabled={pending} onClick={submitRemelt}>
          Post Melt
        </Button>
        <div className="text-[11px] text-text-faint mt-2">No alloy is added when input and output purity are both 91.7.</div>
      </div>
    </div>
  );
}
