"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { settingIssue, settingReturn } from "@/lib/actions/process";
import { Button, Field, Badge } from "@/components/ui/primitives";
import { g } from "@/lib/format";
import type { SettingRecord } from "@/lib/types";

export function SettingIssueForm({ jobId, wip, stoneBin }: { jobId: string | null; wip: number; stoneBin: number }) {
  const [prod, setProd] = useState("");
  const [stone, setStone] = useState("");
  const [other, setOther] = useState("0");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit() {
    if (!jobId) return;
    setPending(true);
    try {
      const res = await settingIssue(jobId, parseFloat(prod), parseFloat(stone || "0"), parseFloat(other || "0"));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setProd("");
        setStone("");
        setOther("0");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  if (!jobId) return <p className="text-[12px] text-text-faint">Select an open Job Card above.</p>;

  return (
    <div>
      <Field label={`Geru Product Gross (g) — from Finished WIP: ${g(wip)}`}>
        <input type="number" step="0.001" value={prod} onChange={(e) => setProd(e.target.value)} />
      </Field>
      <Field label={`Stones Issued (g) — Stone Bin: ${g(stoneBin)}`}>
        <input type="number" step="0.001" value={stone} onChange={(e) => setStone(e.target.value)} />
      </Field>
      <Field label="Other Material Issued (g)">
        <input type="number" step="0.001" value={other} onChange={(e) => setOther(e.target.value)} />
      </Field>
      <Button variant="gold" className="w-full" disabled={pending} onClick={submit}>
        Post Setting Issue
      </Button>
    </div>
  );
}

export function SettingRow({ r }: { r: SettingRecord }) {
  const [finalG, setFinalG] = useState("");
  const [stoneR, setStoneR] = useState("");
  const [matR, setMatR] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const totalOut = r.product_gross + r.stones_issued + r.other_material_issued;

  async function close() {
    setPending(true);
    try {
      const res = await settingReturn(r.id, parseFloat(finalG || "0"), parseFloat(stoneR || "0"), parseFloat(matR || "0"));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="bg-surface2 border border-border rounded-lg p-3.5 mb-2.5">
      <div className="flex gap-4 flex-wrap text-[12px] text-text-dim mb-2.5">
        <span>
          ID <b className="text-text font-mono">{r.id}</b>
        </span>
        <span>
          Job <b className="text-text font-mono">{r.job_id}</b>
        </span>
        <span>
          Total Out <b className="text-text font-mono">{g(totalOut)}</b>
        </span>
        <span>
          Status <Badge kind={r.status === "Open" ? "open" : "closed"}>{r.status}</Badge>
        </span>
      </div>
      {r.status === "Open" ? (
        <div className="flex gap-2 flex-wrap">
          <input type="number" step="0.001" value={finalG} onChange={(e) => setFinalG(e.target.value)} placeholder="Final product gross" className="max-w-[160px]" />
          <input type="number" step="0.001" value={stoneR} onChange={(e) => setStoneR(e.target.value)} placeholder="Unused stones back" className="max-w-[160px]" />
          <input type="number" step="0.001" value={matR} onChange={(e) => setMatR(e.target.value)} placeholder="Unused material back" className="max-w-[160px]" />
          <Button variant="gold" disabled={pending} onClick={close}>
            Close Setting
          </Button>
        </div>
      ) : (
        <div className="text-[12px] text-text-dim flex gap-4 flex-wrap">
          <span>
            Final <b className="text-text font-mono">{g(r.final_product_gross)}</b>
          </span>
          <span>
            Stones back <b className="text-text font-mono">{g(r.unused_stones_returned)}</b>
          </span>
          <span>
            Material back <b className="text-text font-mono">{g(r.unused_material_returned)}</b>
          </span>
          <span>
            Mismatch{" "}
            <b className={Math.abs(r.mismatch ?? 0) < 0.0005 ? "text-green" : "text-red"}>{g(r.mismatch)}</b>
          </span>
        </div>
      )}
    </div>
  );
}
