import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag, Stat, Formula } from "@/components/ui/primitives";
import { g } from "@/lib/format";
import { MATERIALS } from "@/lib/constants";
import type { DashboardSnapshot } from "@/lib/types";

export default async function AdminDashboardPage() {
  const { profile } = await requireProfile();
  if (profile.role !== "Owner / Admin") return <AccessDenied role={profile.role} />;

  const supabase = await createClient();
  const [{ data: snapshot }, { data: factoryBalances }] = await Promise.all([
    supabase.rpc("fn_dashboard_snapshot"),
    supabase.from("balances").select("*").eq("location", "FactoryBin"),
  ]);

  const s = snapshot as DashboardSnapshot;
  const factoryBin: Record<string, number> = {};
  (factoryBalances ?? []).forEach((b) => (factoryBin[b.material_id] = Number(b.weight)));
  const totalNetFactory = MATERIALS.filter((m) => m.category !== "NonGold").reduce((sum, m) => sum + (factoryBin[m.id] ?? 0), 0);
  const reconciled = Math.abs(s.unreconciledFine) < 0.001;

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="text-[21px] font-bold tracking-tight">Admin Dashboard — Total Gold Invested / Accountable</h1>
        <Tag kind="control">Control</Tag>
      </div>
      <p className="text-text-dim text-[13px] mb-5 max-w-2xl leading-relaxed">
        Where is every gram of gold currently accountable to the factory?
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
        <Stat label="Total Net Weight — Factory Bin" value={g(totalNetFactory)} tone="gold" />
        <Stat label="Total Fine / Pure Gold — Factory Bin" value={g(s.currentAccountableFine)} tone="gold" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 mb-4">
        <Link href="/reports?tab=material">
          <Stat label="Bullion" value={g(s.bullionFine)} sub="Click → material details" />
        </Link>
        <Link href="/reports?tab=material">
          <Stat label="Semi-Finished" value={g(s.semiFine)} sub="Click → material details" />
        </Link>
        <Link href="/reports?tab=material">
          <Stat label="Manufacturing" value={g(s.mfgFine)} sub="Click → material details" />
        </Link>
        <Link href="/karigar-job">
          <Stat label="Gold With Karigars" value={g(s.karigarWipFine)} sub="Only one open Job per Karigar" />
        </Link>
        <Link href="/polish-geru">
          <Stat label="WIP / Finished (Polish, Geru, Dhodi)" value={g(s.processWipFine)} />
        </Link>
        <Link href="/tagging">
          <Stat label="Tagged Finished" value={g(s.finishedTaggedFine)} />
        </Link>
        <Link href="/reports?tab=transit">
          <Stat label="Transit O→F pending" value={g(s.transitO2F)} />
        </Link>
        <Link href="/reports?tab=transit">
          <Stat label="Transit F→O pending" value={g(s.transitF2O)} />
        </Link>
        <Stat label="Total Accountable (fine)" value={g(s.currentAccountableFine)} />
      </div>

      <Card className="mb-4">
        <CardTitle tag={<Tag kind="must">Must</Tag>}>Gold Investment Reconciliation</CardTitle>
        <Formula>{`Office / Opening Gold Investment (Fine) − Gold Returned to Office (Fine)\n   =\nCurrent Accountable Gold (Fine) + Authorised Losses (Fine) ± Approved Stock Adjustments`}</Formula>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-4">
          <Stat label="Office Investment (Fine)" value={g(s.officeInvestmentFine)} />
          <Stat label="Returned to Office (Fine)" value={g(s.officeReceivedFine)} />
          <Stat label="Authorised Loss (Fine)" value={g(s.authorisedLossFine)} sub="Melting + Polish + realized Job-Card wastage" />
        </div>
        <div className="h-px bg-border-soft my-4" />
        <div
          className={`rounded-lg px-4 py-3 text-[13px] font-semibold flex items-center justify-between gap-2.5 ${
            reconciled ? "bg-[#0F1E14] border border-[#1d4a37] text-[#8FE0B4]" : "bg-[#241010] border border-[#4d2222] text-[#F4B9B9]"
          }`}
        >
          <span>UNRECONCILED GOLD = {g(reconciled ? 0 : s.unreconciledFine)}</span>
          {!reconciled && (
            <Link href="/reports?tab=ledger" className="underline">
              Click → difference source
            </Link>
          )}
          {reconciled && <span>✓ Reconciled</span>}
        </div>
        <div className="text-[11px] text-text-faint mt-2.5">
          Non-zero shows red with a drill-down into the ledger. A small residual is expected whenever Dhodi Gross ≠ Net, or
          beads/stones are embedded in a tagged piece: the Data Design rule (Fine = Gross × Purity%) and the Settlement
          rule (wastage uses Dhodi <b>Net</b>) value the same product differently. This is a CONFIG decision for the team
          to confirm — which figure should feed the Admin dashboard&apos;s fine-gold formula for a finished, stone-set
          piece.
        </div>
      </Card>

      <Card>
        <CardTitle tag={<Tag kind="control">Control</Tag>}>Dashboard Drill-Down Hierarchy</CardTitle>
        <div className="text-[11px] text-text-dim mb-3 font-mono">TOTAL → CATEGORY → MATERIAL → LOCATION / KARIGAR → TRANSACTION</div>
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th className="text-right">Net (Factory Bin)</th>
              <th className="text-right">Fine</th>
            </tr>
          </thead>
          <tbody>
            {MATERIALS.filter((m) => m.category !== "NonGold").map((m) => (
              <tr key={m.id}>
                <td>
                  <Link href="/reports?tab=ledger" className="hover:text-gold">
                    {m.name}
                  </Link>
                </td>
                <td className="num-cell">{g(factoryBin[m.id] ?? 0)}</td>
                <td className="num-cell">{g(((factoryBin[m.id] ?? 0) * (m.purity ?? 0)) / 100)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
