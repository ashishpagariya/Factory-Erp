"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { factoryAcceptExact, factoryAcceptWithDiscrepancy, resolveDiscrepancy } from "@/lib/actions/office";
import { g } from "@/lib/format";
import { Button } from "@/components/ui/primitives";
import type { OfficeDispatch } from "@/lib/types";

export function PendingRow({ d }: { d: OfficeDispatch }) {
  const [received, setReceived] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function accept() {
    setPending(true);
    try {
      let res;
      if (received === "") {
        res = await factoryAcceptExact(d.id);
      } else {
        const rv = parseFloat(received);
        if (rv === d.gross) {
          res = await factoryAcceptExact(d.id);
        } else {
          const reason = window.prompt("Received weight differs from sent. Reason for discrepancy:", "Scale variance") || "Not specified";
          res = await factoryAcceptWithDiscrepancy(d.id, rv, reason);
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
      <td className="font-mono">{d.id}</td>
      <td>{d.material_id}</td>
      <td className="num-cell">{g(d.gross)}</td>
      <td className="num-cell">{d.purity != null ? `${d.purity}%` : "—"}</td>
      <td>
        <input
          type="number"
          step="0.001"
          value={received}
          onChange={(e) => setReceived(e.target.value)}
          placeholder={String(d.gross)}
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

export function DiscrepancyRow({ d, canResolve }: { d: OfficeDispatch; canResolve: boolean }) {
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function resolve() {
    setPending(true);
    try {
      const res = await resolveDiscrepancy(d.id, true);
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <tr>
      <td className="font-mono">{d.id}</td>
      <td>{d.material_id}</td>
      <td className="num-cell">{g(d.gross)}</td>
      <td className="num-cell">{g(d.received_gross)}</td>
      <td className="num-cell text-red">{g((d.received_gross ?? 0) - d.gross)}</td>
      <td>{d.discrepancy_reason}</td>
      <td>
        {canResolve ? (
          <Button size="sm" disabled={pending} onClick={resolve}>
            Accept as received
          </Button>
        ) : (
          <span className="text-[11px] text-text-faint">Awaiting Admin</span>
        )}
      </td>
    </tr>
  );
}
