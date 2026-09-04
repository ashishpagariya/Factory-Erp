"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ToastProvider";
import { sellKarigarGold, giveKarigarGoldToOffice, correctKarigarGoldSale } from "@/lib/actions/karigarSales";
import { Button, Field, Badge } from "@/components/ui/primitives";
import { g } from "@/lib/format";
import type { Karigar, KarigarGoldSale } from "@/lib/types";

export function SellGoldForm({ karigars, availableBalances }: { karigars: Karigar[]; availableBalances: Record<string, number> }) {
  const [karigarId, setKarigarId] = useState(karigars[0]?.id ?? "");
  const [grams, setGrams] = useState("");
  const [rate, setRate] = useState("");
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const available = availableBalances[karigarId] ?? 0;
  const amount = useMemo(() => {
    const gr = parseFloat(grams);
    const rt = parseFloat(rate);
    if (!gr || !rt) return null;
    return gr * rt;
  }, [grams, rate]);

  async function submit() {
    setPending(true);
    try {
      const res = await sellKarigarGold(karigarId, parseFloat(grams), parseFloat(rate));
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) {
        setGrams("");
        setRate("");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <Field label="Karigar">
        <select value={karigarId} onChange={(e) => setKarigarId(e.target.value)}>
          {karigars.map((k) => (
            <option key={k.id} value={k.id}>
              {k.name} — saved: {g(availableBalances[k.id] ?? 0)}
            </option>
          ))}
        </select>
      </Field>
      <div className="text-[11px] text-text-faint mb-2.5">
        Available to sell: <b className="text-text font-mono">{g(available)}</b> (their current saved credit)
      </div>
      <div className="flex gap-2.5">
        <div className="flex-1">
          <Field label="Grams Sold">
            <input type="number" step="0.001" value={grams} onChange={(e) => setGrams(e.target.value)} placeholder="e.g. 2.000" />
          </Field>
        </div>
        <div className="flex-1">
          <Field label="Rate (₹ / gram)">
            <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="e.g. 14300" />
          </Field>
        </div>
      </div>
      {amount != null && (
        <div className="text-[13px] text-gold-bright font-mono mb-3">
          Amount = ₹{amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
        </div>
      )}
      <Button variant="gold" className="w-full" disabled={pending || available <= 0.0005} onClick={submit}>
        Record Purchase
      </Button>
      {available <= 0.0005 && <div className="text-[11px] text-text-faint mt-2">This karigar has no saved credit right now.</div>}
    </div>
  );
}

export function GiveToOfficeButton({ accumulatedGrams }: { accumulatedGrams: number }) {
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();

  async function submit() {
    if (!window.confirm(`Hand over ${accumulatedGrams.toFixed(3)} g of accumulated gold to Office?`)) return;
    setPending(true);
    try {
      const res = await giveKarigarGoldToOffice();
      toast(res.message, res.ok ? "ok" : "err");
      if (res.ok) router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button disabled={pending || accumulatedGrams <= 0.0005} onClick={submit}>
      Give Accumulated Gold to Office
    </Button>
  );
}

export function SaleRow({ sale, canEdit }: { sale: KarigarGoldSale; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [grams, setGrams] = useState(String(sale.grams));
  const [rate, setRate] = useState(String(sale.rate_per_gram));
  const [pending, setPending] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const blocked = sale.status === "GivenToOffice";

  async function save() {
    if (!window.confirm(`Correct ${sale.id}?`)) return;
    setPending(true);
    try {
      const res = await correctKarigarGoldSale(sale.id, parseFloat(grams), parseFloat(rate));
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
        <td className="font-mono">{sale.id}</td>
        <td>{sale.karigars?.name}</td>
        <td className="num-cell">{g(sale.grams)}</td>
        <td className="num-cell">₹{Number(sale.rate_per_gram).toLocaleString("en-IN")}</td>
        <td className="num-cell">₹{Number(sale.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
        <td>
          <Badge kind={sale.status === "Accumulated" ? "pending" : "accepted"}>{sale.status === "GivenToOffice" ? "Given to Office" : "Accumulated"}</Badge>
        </td>
        <td className="text-[11px] text-text-faint">{new Date(sale.created_at).toLocaleString()}</td>
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
          <td colSpan={8} className="bg-surface2">
            <div className="p-2 flex gap-2 items-end flex-wrap">
              <div>
                <label className="block text-[11px] text-text-dim mb-1">Grams</label>
                <input type="number" step="0.001" value={grams} onChange={(e) => setGrams(e.target.value)} className="max-w-[120px]" />
              </div>
              <div>
                <label className="block text-[11px] text-text-dim mb-1">Rate (₹/g)</label>
                <input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} className="max-w-[120px]" />
              </div>
              <Button variant="gold" size="sm" disabled={pending} onClick={save}>
                Save
              </Button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}