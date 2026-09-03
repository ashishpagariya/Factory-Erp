import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag, Stat, Badge } from "@/components/ui/primitives";
import { SellGoldForm, GiveToOfficeButton } from "./KarigarSalesClient";
import { g } from "@/lib/format";
import type { Karigar, KarigarGoldSale } from "@/lib/types";

export default async function KarigarSalesPage() {
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/karigar-sales")) return <AccessDenied role={profile.role} />;

  const supabase = await createClient();
  const [{ data: karigars }, { data: openJobs }, { data: sales }, { data: accumulatedFine }] = await Promise.all([
    supabase.from("karigars").select("*").eq("active", true).order("name"),
    supabase.from("job_cards").select("karigar_id, opening_type, opening_amount").eq("status", "Open"),
    supabase.from("karigar_gold_sales").select("*, karigars(name)").order("created_at", { ascending: false }).limit(50),
    supabase.rpc("fn_karigar_gold_purchases_fine"),
  ]);

  const availableBalances: Record<string, number> = {};
  (openJobs ?? []).forEach((j) => {
    if (j.opening_type === "Receipt" && j.opening_amount) availableBalances[j.karigar_id] = Number(j.opening_amount);
  });

  const salesRows = (sales as KarigarGoldSale[]) ?? [];
  const totalGrams = salesRows.reduce((s, r) => s + Number(r.grams), 0);
  const totalAmount = salesRows.reduce((s, r) => s + Number(r.amount), 0);
  const accumulatedRows = salesRows.filter((r) => r.status === "Accumulated");
  const accumulatedGrams = accumulatedRows.reduce((s, r) => s + Number(r.grams), 0);
  const accumulatedAmount = accumulatedRows.reduce((s, r) => s + Number(r.amount), 0);

  const canGiveToOffice = profile.role === "Owner / Admin" || profile.role === "Factory Manager";

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="text-[21px] font-bold tracking-tight">Karigar Gold Sales</h1>
        <Tag kind="config">Config</Tag>
      </div>
      <p className="text-text-dim text-[13px] mb-5 max-w-2xl leading-relaxed">
        A karigar can sell their saved gold credit to the factory at an agreed rate. The gold accumulates here until
        it&apos;s periodically handed over to Office.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-4">
        <Stat label="Total Sales (all time)" value={g(totalGrams)} sub={`₹${totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`} />
        <Stat
          label="Accumulated (awaiting handover)"
          value={g(accumulatedGrams)}
          tone={accumulatedGrams > 0.0005 ? "gold" : "default"}
          sub={`₹${accumulatedAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`}
        />
        <Stat label="Fine-Gold Equivalent Held" value={g(typeof accumulatedFine === "number" ? accumulatedFine : 0)} sub="91.7% basis" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-4">
        <Card>
          <CardTitle tag={<Tag kind="must">Must</Tag>}>Record a Sale</CardTitle>
          <SellGoldForm karigars={(karigars as Karigar[]) ?? []} availableBalances={availableBalances} />
        </Card>
        <Card>
          <CardTitle>Monthly Handover</CardTitle>
          <p className="text-[12.5px] text-text-dim mb-4">
            Once accumulated gold has been physically handed to Office, mark it here — this is a single lump-sum action,
            not itemized per sale.
          </p>
          {canGiveToOffice ? (
            <GiveToOfficeButton accumulatedGrams={accumulatedGrams} />
          ) : (
            <p className="text-[11px] text-text-faint">Only Admin or Factory Manager can record a handover.</p>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>Sales History</CardTitle>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Karigar</th>
                <th className="text-right">Grams</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {salesRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-text-faint italic py-6">
                    No gold sales recorded yet.
                  </td>
                </tr>
              )}
              {salesRows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono">{r.id}</td>
                  <td>{r.karigars?.name}</td>
                  <td className="num-cell">{g(r.grams)}</td>
                  <td className="num-cell">₹{Number(r.rate_per_gram).toLocaleString("en-IN")}</td>
                  <td className="num-cell">₹{Number(r.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}</td>
                  <td>
                    <Badge kind={r.status === "Accumulated" ? "pending" : "accepted"}>{r.status === "GivenToOffice" ? "Given to Office" : "Accumulated"}</Badge>
                  </td>
                  <td className="text-[11px] text-text-faint">{new Date(r.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {salesRows.length > 0 && (
          <div className="text-[12px] text-text-dim mt-3 font-semibold">
            Totals: {g(totalGrams)} · ₹{totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
        )}
      </Card>
    </div>
  );
}