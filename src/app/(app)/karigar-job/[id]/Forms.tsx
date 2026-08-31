"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { issueToKarigar, issueStoneToKarigar, receiveDhodi, receiveMaterialReturn, receiveStoneReturn } from "@/lib/actions/jobcard";
import { KARIGAR_ISSUABLE, MAT } from "@/lib/constants";
import { Field, Button } from "@/components/ui/primitives";
import { g } from "@/lib/format";

export function IssueForm({ jobId, factoryBin, disabled }: { jobId: string; factoryBin: Record<string, number>; disabled: boolean }) {
  const [matId, setMatId] = useState(KARIGAR_ISSUABLE[0]);
  const [weight, setWeight] = useState("");
  const [stoneWeight, setStoneWeight] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function issue() {
    setPending(true);
    try {
      const res = await issueToKarigar(jobId, matId, parseFloat(weight));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setWeight("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }
  async function issueStone() {
    setPending(true);
    try {
      const res = await issueStoneToKarigar(jobId, parseFloat(stoneWeight));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setStoneWeight("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Field label="Material">
        <select value={matId} onChange={(e) => setMatId(e.target.value)} disabled={disabled}>
          {KARIGAR_ISSUABLE.map((id) => (
            <option key={id} value={id}>
              {MAT(id)!.name} — Bin {g(factoryBin[id] ?? 0)}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex gap-2.5">
        <input type="number" step="0.001" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="Weight (g)" disabled={disabled} />
        <Button variant="gold" disabled={disabled || pending} onClick={issue}>
          Post Issue
        </Button>
      </div>
      <div className="h-px bg-border-soft my-3.5" />
      <div className="flex gap-2.5">
        <input type="number" step="0.001" value={stoneWeight} onChange={(e) => setStoneWeight(e.target.value)} placeholder="Stone weight (g)" disabled={disabled} />
        <Button disabled={disabled || pending} onClick={issueStone}>
          Issue Stone
        </Button>
      </div>
    </div>
  );
}

export function ReceiveForm({
  jobId,
  outstanding,
  disabled,
}: {
  jobId: string;
  outstanding: Record<string, number>;
  disabled: boolean;
}) {
  const outstandingIds = Object.keys(outstanding).filter((k) => outstanding[k] > 0.0005);
  const [pieces, setPieces] = useState("");
  const [gross, setGross] = useState("");
  const [net, setNet] = useState("");
  const [retMat, setRetMat] = useState(outstandingIds[0] ?? "");
  const [retWeight, setRetWeight] = useState("");
  const [stoneRet, setStoneRet] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function dhodi() {
    setPending(true);
    try {
      const res = await receiveDhodi(jobId, parseInt(pieces || "0"), parseFloat(gross), parseFloat(net));
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
  async function matReturn() {
    setPending(true);
    try {
      const res = await receiveMaterialReturn(jobId, retMat, parseFloat(retWeight));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setRetWeight("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }
  async function stoneReturn() {
    setPending(true);
    try {
      const res = await receiveStoneReturn(jobId, parseFloat(stoneRet));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setStoneRet("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Field label="Dhodi — Pieces / Gross / Net">
        <div className="flex gap-2">
          <input type="number" value={pieces} onChange={(e) => setPieces(e.target.value)} placeholder="Pieces" className="max-w-[90px]" disabled={disabled} />
          <input type="number" step="0.001" value={gross} onChange={(e) => setGross(e.target.value)} placeholder="Gross g" disabled={disabled} />
          <input type="number" step="0.001" value={net} onChange={(e) => setNet(e.target.value)} placeholder="Net g" disabled={disabled} />
        </div>
      </Field>
      <Button variant="gold" className="w-full" disabled={disabled || pending} onClick={dhodi}>
        Receive Dhodi
      </Button>
      <div className="h-px bg-border-soft my-3.5" />
      <Field label="Material Return">
        <div className="flex gap-2">
          <select value={retMat} onChange={(e) => setRetMat(e.target.value)} disabled={disabled || outstandingIds.length === 0}>
            {outstandingIds.length === 0 && <option>Nothing outstanding</option>}
            {outstandingIds.map((id) => (
              <option key={id} value={id}>
                {MAT(id)!.name} (outstanding {g(outstanding[id])})
              </option>
            ))}
          </select>
          <input type="number" step="0.001" value={retWeight} onChange={(e) => setRetWeight(e.target.value)} placeholder="Weight g" className="max-w-[120px]" disabled={disabled} />
        </div>
      </Field>
      <Button className="w-full" disabled={disabled || pending || outstandingIds.length === 0} onClick={matReturn}>
        Return Material
      </Button>
      <div className="h-px bg-border-soft my-3.5" />
      <div className="flex gap-2.5">
        <input type="number" step="0.001" value={stoneRet} onChange={(e) => setStoneRet(e.target.value)} placeholder="Stone return g" disabled={disabled} />
        <Button disabled={disabled || pending} onClick={stoneReturn}>
          Return Stone
        </Button>
      </div>
    </div>
  );
}
