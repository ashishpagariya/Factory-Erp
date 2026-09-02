"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { factoryDispatchFinished, factoryDispatchMaterial, officeAccept, officeAcceptWithDiscrepancy, resolveOfficeDiscrepancy } from "@/lib/actions/misc";
import { Button, Field, Badge } from "@/components/ui/primitives";
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