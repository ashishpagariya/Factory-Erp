"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { factoryDispatchFinished, factoryDispatchMaterial, officeAccept } from "@/lib/actions/misc";
import { Button, Field } from "@/components/ui/primitives";
import { g } from "@/lib/format";
import type { Tag, Material } from "@/lib/types";

export function DispatchFinishedForm({ tags }: { tags: Tag[] }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  function toggle(tagNo: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(tagNo)) next.delete(tagNo);
      else next.add(tagNo);
      return next;
    });
  }

  async function submit() {
    setPending(true);
    try {
      const res = await factoryDispatchFinished(Array.from(checked));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setChecked(new Set());
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  if (tags.length === 0) {
    return <p className="text-[12px] text-text-faint">No tagged product is currently sitting in the factory ready for dispatch.</p>;
  }

  return (
    <div>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>Tag No</th>
            <th>Job</th>
            <th className="text-right">Gross</th>
          </tr>
        </thead>
        <tbody>
          {tags.map((t) => (
            <tr key={t.tag_no}>
              <td>
                <input type="checkbox" checked={checked.has(t.tag_no)} onChange={() => toggle(t.tag_no)} />
              </td>
              <td className="font-mono">{t.tag_no}</td>
              <td>{t.job_id}</td>
              <td className="num-cell">{g(t.gross)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button variant="gold" className="w-full mt-2.5" disabled={pending || checked.size === 0} onClick={submit}>
        Dispatch Selected → Transit
      </Button>
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

export function AcceptFDButton({ id }: { id: string }) {
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();
  async function accept() {
    setPending(true);
    try {
      const res = await officeAccept(id);
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }
  return (
    <Button size="sm" variant="gold" disabled={pending} onClick={accept}>
      Accept
    </Button>
  );
}
