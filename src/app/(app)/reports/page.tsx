import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess, MATERIALS } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, Tag, Badge } from "@/components/ui/primitives";
import { StockTakeForm, ApproveStockTakeButton, CorrectStockTakeButton } from "./ReportsClient";
import { NiyadaSetOffForm } from "./NiyadaSetOffForm";
import { ExportExcelButton } from "@/components/ExportExcelButton";
import { g, pct } from "@/lib/format";
import type { LedgerRow, JobCard, Melt, PolishRecord, GeruRecord, StockTake, Tag as TagRow, Settlement, NiyadaSettlement } from "@/lib/types";

const TABS: [string, string][] = [
  ["ledger", "Universal Ledger"],
  ["material", "Material Balance"],
  ["karigar", "Karigar Ledger"],
  ["openjobs", "Open Job Report"],
  ["meltloss", "Melting Loss"],
  ["polishloss", "Polish Loss"],
  ["geru", "Geru"],
  ["niyada", "Niyada"],
  ["transit", "Transit Report"],
  ["finished", "Finished / Tagged"],
  ["stocktake", "Stock Take"],
];

function TabHeader({ title, isAdmin, exportData, filename }: { title: string; isAdmin: boolean; exportData: Record<string, unknown>[]; filename: string }) {
  return (
    <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
      <h3 className="text-[12.5px] uppercase tracking-wide text-text-dim font-bold">{title}</h3>
      {isAdmin && <ExportExcelButton data={exportData} filename={filename} />}
    </div>
  );
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string; sort?: string; dir?: string }> }) {
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/reports")) return <AccessDenied role={profile.role} />;
  const { tab: tabParam, sort, dir } = await searchParams;
  const tab = tabParam ?? "ledger";
  const supabase = await createClient();
  const isAdmin = profile.role === "Owner / Admin";

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="text-[21px] font-bold tracking-tight">Reports</h1>
        <Tag kind="control">Control</Tag>
      </div>
      <p className="text-text-dim text-[13px] mb-4 max-w-2xl leading-relaxed">
        All reports are generated from posted transactions — users never directly type stock balances.
      </p>
      <div className="flex gap-2 flex-wrap mb-4">
        {TABS.map(([key, label]) => (
          <Link
            key={key}
            href={`/reports?tab=${key}`}
            className={`rounded-full px-3.5 py-1.5 text-[12px] border ${
              tab === key ? "bg-gold-dim border-gold text-white" : "bg-surface2 border-border text-text-dim"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {tab === "ledger" && <LedgerTab supabase={supabase} sort={sort} dir={dir} isAdmin={isAdmin} />}
      {tab === "material" && <MaterialTab supabase={supabase} isAdmin={isAdmin} />}
      {tab === "karigar" && <KarigarTab supabase={supabase} isAdmin={isAdmin} />}
      {tab === "openjobs" && <OpenJobsTab supabase={supabase} isAdmin={isAdmin} />}
      {tab === "meltloss" && <MeltLossTab supabase={supabase} isAdmin={isAdmin} />}
      {tab === "polishloss" && <PolishLossTab supabase={supabase} isAdmin={isAdmin} />}
      {tab === "geru" && <GeruTab supabase={supabase} isAdmin={isAdmin} />}
      {tab === "niyada" && <NiyadaTab supabase={supabase} isAdmin={isAdmin} />}
      {tab === "transit" && <TransitTab supabase={supabase} isAdmin={isAdmin} />}
      {tab === "finished" && <FinishedTab supabase={supabase} isAdmin={isAdmin} />}
      {tab === "stocktake" && <StockTakeTab supabase={supabase} isAdmin={isAdmin} />}
    </div>
  );
}

async function LedgerTab({
  supabase,
  sort,
  dir,
  isAdmin,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  sort?: string;
  dir?: string;
  isAdmin: boolean;
}) {
  const sortCol = ["ts", "type", "gross", "fine"].includes(sort || "") ? (sort as string) : "ts";
  const ascending = dir === "asc";
  const { data } = await supabase.from("ledger").select("*").order(sortCol, { ascending, nullsFirst: false }).limit(200);
  const rows = (data as LedgerRow[]) ?? [];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
  const profileMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    (profiles ?? []).forEach((p) => {
      profileMap[p.id] = p.full_name || p.id.slice(0, 8);
    });
  }

  function sortLink(col: string, label: string) {
    const nextDir = sortCol === col && ascending ? "desc" : "asc";
    const arrow = sortCol === col ? (ascending ? " ▲" : " ▼") : "";
    return (
      <Link href={`/reports?tab=ledger&sort=${col}&dir=${nextDir}`} className="hover:text-gold">
        {label}
        {arrow}
      </Link>
    );
  }

  const exportData = rows.map((l) => ({
    Time: new Date(l.ts).toLocaleString(),
    Type: l.type,
    Reference: l.ref,
    Material: l.material,
    Gross: l.gross,
    Purity: l.purity,
    Fine: l.fine,
    From: l.from_location,
    To: l.to_location,
    User: l.user_id ? profileMap[l.user_id] ?? l.user_id : "—",
  }));

  return (
    <Card>
      <TabHeader title="Universal Transaction Ledger" isAdmin={isAdmin} exportData={exportData} filename="universal_ledger.xlsx" />
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>{sortLink("ts", "Time")}</th>
              <th>{sortLink("type", "Type")}</th>
              <th>Reference</th>
              <th>Material</th>
              <th className="text-right">{sortLink("gross", "Gross")}</th>
              <th className="text-right">Purity</th>
              <th className="text-right">{sortLink("fine", "Fine")}</th>
              <th>From</th>
              <th>To</th>
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-center text-text-faint italic py-6">
                  No transactions posted yet.
                </td>
              </tr>
            )}
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="text-[11px]">{new Date(l.ts).toLocaleString()}</td>
                <td>{l.type}</td>
                <td className="font-mono">{l.ref}</td>
                <td>{l.material ?? "—"}</td>
                <td className="num-cell">{l.gross != null ? g(l.gross) : "—"}</td>
                <td className="num-cell">{l.purity != null ? pct(l.purity) : "—"}</td>
                <td className="num-cell">{l.fine != null ? g(l.fine) : "—"}</td>
                <td>{l.from_location ?? "—"}</td>
                <td>{l.to_location ?? "—"}</td>
                <td className="text-[11px]">{l.user_id ? profileMap[l.user_id] ?? l.user_id.slice(0, 8) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function MaterialTab({ supabase, isAdmin }: { supabase: Awaited<ReturnType<typeof createClient>>; isAdmin: boolean }) {
  const [{ data: factoryBalances }, { data: transitBalances }, { data: wipBalances }] = await Promise.all([
    supabase.from("balances").select("*").eq("location", "FactoryBin"),
    supabase.from("balances").select("*").eq("location", "Transit_O2F"),
    supabase.from("balances").select("*").eq("location", "KarigarWIP"),
  ]);
  const factoryBin: Record<string, number> = {};
  (factoryBalances ?? []).forEach((b) => (factoryBin[b.material_id] = Number(b.weight)));
  const transit: Record<string, number> = {};
  (transitBalances ?? []).forEach((b) => (transit[b.material_id] = Number(b.weight)));
  const wipTotal = (wipBalances ?? []).reduce((s, b) => s + Number(b.weight), 0);

  const bullion = MATERIALS.filter((m) => m.category === "Bullion");
  const semiAndMfg = MATERIALS.filter((m) => m.category === "SemiFinished" || m.category === "Manufacturing");
  const nonGold = MATERIALS.filter((m) => m.category === "NonGold");

  function rowsFor(list: typeof MATERIALS) {
    return list.map((m) => ({
      Material: m.name,
      Category: m.category,
      "Factory Bin": factoryBin[m.id] ?? 0,
      "In Transit (O→F)": transit[m.id] ?? 0,
    }));
  }

  function table(list: typeof MATERIALS) {
    return (
      <table>
        <thead>
          <tr>
            <th>Material</th>
            <th>Category</th>
            <th className="text-right">Factory Bin</th>
            <th className="text-right">In Transit (O→F)</th>
          </tr>
        </thead>
        <tbody>
          {list.map((m) => (
            <tr key={m.id}>
              <td>{m.name}</td>
              <td>{m.category}</td>
              <td className="num-cell">{g(factoryBin[m.id] ?? 0)}</td>
              <td className="num-cell">{g(transit[m.id] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <TabHeader title="Bullion" isAdmin={isAdmin} exportData={rowsFor(bullion)} filename="material_bullion.xlsx" />
        {table(bullion)}
      </Card>
      <Card>
        <TabHeader title="Semi-Finished + Manufacturing" isAdmin={isAdmin} exportData={rowsFor(semiAndMfg)} filename="material_semi_manufacturing.xlsx" />
        {table(semiAndMfg)}
        <div className="text-[11px] text-text-faint mt-3">
          Total gold currently with karigars (all materials combined): {g(wipTotal)}
        </div>
      </Card>
      <Card>
        <TabHeader title="Stone + Alloy" isAdmin={isAdmin} exportData={rowsFor(nonGold)} filename="material_stone_alloy.xlsx" />
        {table(nonGold)}
      </Card>
    </div>
  );
}

async function KarigarTab({ supabase, isAdmin }: { supabase: Awaited<ReturnType<typeof createClient>>; isAdmin: boolean }) {
  const { data } = await supabase.from("job_cards").select("*, karigars(name)").order("created_at", { ascending: false });
  const jobs = (data as (JobCard & { karigars: { name: string } })[]) ?? [];
  const settlements = await Promise.all(
    jobs.map(async (j) => {
      if (j.settlement) return j.settlement;
      const { data } = await supabase.rpc("fn_compute_settlement", { p_job_id: j.id });
      return data as Settlement;
    })
  );

  const exportData = jobs.map((j, i) => {
    const s = settlements[i];
    return {
      "Job Card": j.id,
      Karigar: j.karigars?.name,
      Status: j.status,
      Issued: s?.totalIssued ?? null,
      Received: s?.totalReceived ?? null,
      Saving: s?.saving && s.saving > 0 ? s.saving : null,
      Loss: s?.loss && s.loss > 0 ? s.loss : null,
      Description: j.description ?? "",
    };
  });

  return (
    <Card>
      <TabHeader title="Karigar Ledger" isAdmin={isAdmin} exportData={exportData} filename="karigar_ledger.xlsx" />
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Job Card</th>
              <th>Karigar</th>
              <th>Status</th>
              <th className="text-right">Issued</th>
              <th className="text-right">Received</th>
              <th className="text-right">Saving</th>
              <th className="text-right">Loss</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-text-faint italic py-6">
                  No Job Cards yet.
                </td>
              </tr>
            )}
            {jobs.map((j, i) => {
              const s = settlements[i];
              return (
                <tr key={j.id}>
                  <td className="font-mono">{j.id}</td>
                  <td>{j.karigars?.name}</td>
                  <td>{j.status}</td>
                  <td className="num-cell">{s ? g(s.totalIssued) : "—"}</td>
                  <td className="num-cell">{s ? g(s.totalReceived) : "—"}</td>
                  <td className="num-cell text-green">{s && s.saving > 0 ? g(s.saving) : "—"}</td>
                  <td className="num-cell text-red">{s && s.loss > 0 ? g(s.loss) : "—"}</td>
                  <td className="text-[11.5px] text-text-dim max-w-[180px] truncate">{j.description || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function OpenJobsTab({ supabase, isAdmin }: { supabase: Awaited<ReturnType<typeof createClient>>; isAdmin: boolean }) {
  const { data } = await supabase.from("job_cards").select("*, karigars(name)").eq("status", "Open");
  const jobs = (data as (JobCard & { karigars: { name: string } })[]) ?? [];
  const settlements = await Promise.all(jobs.map((j) => supabase.rpc("fn_compute_settlement", { p_job_id: j.id })));

  const exportData = jobs.map((j, i) => {
    const s = settlements[i].data as Settlement;
    return {
      "Job Card": j.id,
      Karigar: j.karigars?.name,
      Issued: s.totalIssued,
      Received: s.totalReceived,
      Outstanding: s.totalIssued - s.totalReceived,
    };
  });

  return (
    <Card>
      <TabHeader title="Open Job Report" isAdmin={isAdmin} exportData={exportData} filename="open_job_report.xlsx" />
      <table>
        <thead>
          <tr>
            <th>Job Card</th>
            <th>Karigar</th>
            <th className="text-right">Issued</th>
            <th className="text-right">Received</th>
            <th className="text-right">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {jobs.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-text-faint italic py-6">
                No open jobs.
              </td>
            </tr>
          )}
          {jobs.map((j, i) => {
            const s = settlements[i].data as Settlement;
            return (
              <tr key={j.id}>
                <td className="font-mono">{j.id}</td>
                <td>{j.karigars?.name}</td>
                <td className="num-cell">{g(s.totalIssued)}</td>
                <td className="num-cell">{g(s.totalReceived)}</td>
                <td className="num-cell">{g(s.totalIssued - s.totalReceived)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

async function MeltLossTab({ supabase, isAdmin }: { supabase: Awaited<ReturnType<typeof createClient>>; isAdmin: boolean }) {
  const { data } = await supabase.from("melts").select("*").order("created_at", { ascending: false });
  const melts = (data as Melt[]) ?? [];
  const total = melts.reduce((s, m) => s + m.melt_loss, 0);

  const exportData = melts.map((m) => ({
    "Melt ID": m.id,
    Type: m.melt_type,
    Input: m.input_material,
    "Input Weight": m.input_weight,
    Expected: m.expected_output,
    Actual: m.actual_output,
    Loss: m.melt_loss,
  }));

  return (
    <Card>
      <TabHeader title="Melting Loss" isAdmin={isAdmin} exportData={exportData} filename="melting_loss.xlsx" />
      <table>
        <thead>
          <tr>
            <th>Melt ID</th>
            <th>Type</th>
            <th>Input</th>
            <th className="text-right">Expected</th>
            <th className="text-right">Actual</th>
            <th className="text-right">Loss</th>
          </tr>
        </thead>
        <tbody>
          {melts.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-text-faint italic py-6">
                No melts yet.
              </td>
            </tr>
          )}
          {melts.map((m) => (
            <tr key={m.id}>
              <td className="font-mono">{m.id}</td>
              <td>{m.melt_type}</td>
              <td>{m.input_material}</td>
              <td className="num-cell">{g(m.expected_output)}</td>
              <td className="num-cell">{g(m.actual_output)}</td>
              <td className="num-cell text-amber">{g(m.melt_loss)}</td>
            </tr>
          ))}
          {melts.length > 0 && (
            <tr>
              <td colSpan={5} className="text-right font-bold">
                Total
              </td>
              <td className="num-cell font-bold">{g(total)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

async function PolishLossTab({ supabase, isAdmin }: { supabase: Awaited<ReturnType<typeof createClient>>; isAdmin: boolean }) {
  const { data } = await supabase.from("polish_records").select("*").eq("status", "Closed").order("closed_at", { ascending: false });
  const records = (data as PolishRecord[]) ?? [];
  const total = records.reduce((s, r) => s + (r.loss ?? 0), 0);

  const exportData = records.map((r) => ({
    "Polish ID": r.id,
    "Job Card": r.job_id,
    Issued: r.issued_gross,
    Received: r.returned_gross,
    Loss: r.loss,
  }));

  return (
    <Card>
      <TabHeader title="Polish Loss" isAdmin={isAdmin} exportData={exportData} filename="polish_loss.xlsx" />
      <table>
        <thead>
          <tr>
            <th>Polish ID</th>
            <th>Job Card</th>
            <th className="text-right">Issued</th>
            <th className="text-right">Received</th>
            <th className="text-right">Loss</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-text-faint italic py-6">
                No closed polish records.
              </td>
            </tr>
          )}
          {records.map((r) => (
            <tr key={r.id}>
              <td className="font-mono">{r.id}</td>
              <td>{r.job_id}</td>
              <td className="num-cell">{g(r.issued_gross)}</td>
              <td className="num-cell">{g(r.returned_gross)}</td>
              <td className="num-cell text-amber">{g(r.loss)}</td>
            </tr>
          ))}
          {records.length > 0 && (
            <tr>
              <td colSpan={4} className="text-right font-bold">
                Total
              </td>
              <td className="num-cell font-bold">{g(total)}</td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

async function GeruTab({ supabase, isAdmin }: { supabase: Awaited<ReturnType<typeof createClient>>; isAdmin: boolean }) {
  const { data } = await supabase.from("geru_records").select("*").eq("status", "Closed").order("closed_at", { ascending: false });
  const records = (data as GeruRecord[]) ?? [];
  const totalAdded = records.filter((r) => r.direction === "Added").reduce((s, r) => s + Math.abs(r.raw_variance ?? 0), 0);
  const totalReduced = records.filter((r) => r.direction === "Reduced").reduce((s, r) => s + Math.abs(r.raw_variance ?? 0), 0);

  const exportData = records.map((r) => ({
    "Geru ID": r.id,
    "Job Card": r.job_id,
    Issued: r.issued_gross,
    Returned: r.returned_gross,
    Direction: r.direction,
    Variance: r.raw_variance != null ? Math.abs(r.raw_variance) : null,
  }));

  return (
    <Card>
      <TabHeader title="Geru" isAdmin={isAdmin} exportData={exportData} filename="geru.xlsx" />
      <table>
        <thead>
          <tr>
            <th>Geru ID</th>
            <th>Job Card</th>
            <th className="text-right">Issued</th>
            <th className="text-right">Returned</th>
            <th>Direction</th>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-text-faint italic py-6">
                No closed Geru records.
              </td>
            </tr>
          )}
          {records.map((r) => (
            <tr key={r.id}>
              <td className="font-mono">{r.id}</td>
              <td>{r.job_id}</td>
              <td className="num-cell">{g(r.issued_gross)}</td>
              <td className="num-cell">{g(r.returned_gross)}</td>
              <td>
                {r.direction && (
                  <span className={r.direction === "Added" ? "text-amber" : "text-text-dim"}>
                    {r.direction} {g(Math.abs(r.raw_variance ?? 0))}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {records.length > 0 && (
        <div className="text-[11px] text-text-faint mt-3">
          Total Added: {g(totalAdded)} · Total Reduced: {g(totalReduced)}
        </div>
      )}
    </Card>
  );
}

async function NiyadaTab({ supabase, isAdmin }: { supabase: Awaited<ReturnType<typeof createClient>>; isAdmin: boolean }) {
  const [{ data: snapshot }, { data: history }] = await Promise.all([
    supabase.rpc("fn_niyada_current_snapshot"),
    supabase.from("niyada_settlements").select("*").order("created_at", { ascending: false }),
  ]);

  const snap = (snapshot as {
    periodStart: string;
    meltLossGrams: number;
    polishLossGrams: number;
    karigarLossGrams: number;
    totalNiyadaGrams: number;
  }) ?? { periodStart: "", meltLossGrams: 0, polishLossGrams: 0, karigarLossGrams: 0, totalNiyadaGrams: 0 };

  const historyRows = (history as NiyadaSettlement[]) ?? [];
  const exportData = historyRows.map((h) => ({
    ID: h.id,
    "Period Start": new Date(h.period_start).toLocaleString(),
    "Period End": new Date(h.period_end).toLocaleString(),
    "Total Niyada": h.total_niyada_grams,
    Recovered: h.recovered_grams,
    "Net Loss": h.net_loss_grams,
    "Melt Loss": h.melt_loss_grams,
    "Polish Loss": h.polish_loss_grams,
    "Karigar Loss": h.karigar_loss_grams,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="text-[12.5px] uppercase tracking-wide text-text-dim font-bold mb-1">
          Current Period — Niyada (Partial Recoverable Loss)
        </h3>
        <p className="text-[11px] text-text-faint mb-3">
          Since {snap.periodStart ? new Date(snap.periodStart).toLocaleDateString() : "the beginning"} — Melt Loss + Polish Loss + Karigar Loss (settled jobs: Total Issued − Total Received)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div>
            <div className="text-[11px] text-text-dim uppercase tracking-wide mb-1.5">Melt Loss</div>
            <div className="font-mono text-[18px] font-bold text-amber">{g(snap.meltLossGrams)}</div>
          </div>
          <div>
            <div className="text-[11px] text-text-dim uppercase tracking-wide mb-1.5">Polish Loss</div>
            <div className="font-mono text-[18px] font-bold text-amber">{g(snap.polishLossGrams)}</div>
          </div>
          <div>
            <div className="text-[11px] text-text-dim uppercase tracking-wide mb-1.5">Karigar Loss</div>
            <div className="font-mono text-[18px] font-bold text-amber">{g(snap.karigarLossGrams)}</div>
          </div>
          <div>
            <div className="text-[11px] text-text-dim uppercase tracking-wide mb-1.5">Total Niyada</div>
            <div className="font-mono text-[20px] font-bold text-gold-bright">{g(snap.totalNiyadaGrams)}</div>
          </div>
        </div>
      </Card>

      {isAdmin ? (
        <Card>
          <h3 className="text-[12.5px] uppercase tracking-wide text-text-dim font-bold mb-3">Set Off This Period</h3>
          <NiyadaSetOffForm totalNiyadaGrams={snap.totalNiyadaGrams} />
        </Card>
      ) : (
        <Card>
          <p className="text-[11px] text-text-faint">Only Owner/Admin can set off a Niyada period.</p>
        </Card>
      )}

      <Card>
        <TabHeader title="Set-Off History" isAdmin={isAdmin} exportData={exportData} filename="niyada_history.xlsx" />
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Period</th>
                <th className="text-right">Total</th>
                <th className="text-right">Recovered</th>
                <th className="text-right">Net Loss</th>
                <th className="text-right">Melt</th>
                <th className="text-right">Polish</th>
                <th className="text-right">Karigar</th>
              </tr>
            </thead>
            <tbody>
              {historyRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-text-faint italic py-6">
                    No set-offs recorded yet.
                  </td>
                </tr>
              )}
              {historyRows.map((h) => (
                <tr key={h.id}>
                  <td className="font-mono">{h.id}</td>
                  <td className="text-[11px]">
                    {new Date(h.period_start).toLocaleDateString()} – {new Date(h.period_end).toLocaleDateString()}
                  </td>
                  <td className="num-cell">{g(h.total_niyada_grams)}</td>
                  <td className="num-cell text-green">{g(h.recovered_grams)}</td>
                  <td className="num-cell text-red font-bold">{g(h.net_loss_grams)}</td>
                  <td className="num-cell">{g(h.melt_loss_grams)}</td>
                  <td className="num-cell">{g(h.polish_loss_grams)}</td>
                  <td className="num-cell">{g(h.karigar_loss_grams)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

async function TransitTab({ supabase, isAdmin }: { supabase: Awaited<ReturnType<typeof createClient>>; isAdmin: boolean }) {
  const [{ data: o2f }, { data: f2o }] = await Promise.all([
    supabase.from("balances").select("*").eq("location", "Transit_O2F").gt("weight", 0.0005),
    supabase.from("balances").select("*").eq("location", "Transit_F2O").gt("weight", 0.0005),
  ]);
  const o2fExport = (o2f ?? []).map((b) => ({ Material: b.material_id, Weight: Number(b.weight) }));
  const f2oExport = (f2o ?? []).map((b) => ({ Item: b.material_id, Weight: Number(b.weight) }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
      <Card>
        <TabHeader title="Office → Factory Transit" isAdmin={isAdmin} exportData={o2fExport} filename="transit_office_to_factory.xlsx" />
        <table>
          <thead>
            <tr>
              <th>Material</th>
              <th className="text-right">Weight</th>
            </tr>
          </thead>
          <tbody>
            {(o2f ?? []).length === 0 && (
              <tr>
                <td colSpan={2} className="text-center text-text-faint italic py-6">
                  Nothing in transit.
                </td>
              </tr>
            )}
            {(o2f ?? []).map((b) => (
              <tr key={b.id}>
                <td>{b.material_id}</td>
                <td className="num-cell">{g(Number(b.weight))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card>
        <TabHeader title="Factory → Office Transit" isAdmin={isAdmin} exportData={f2oExport} filename="transit_factory_to_office.xlsx" />
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th className="text-right">Weight</th>
            </tr>
          </thead>
          <tbody>
            {(f2o ?? []).length === 0 && (
              <tr>
                <td colSpan={2} className="text-center text-text-faint italic py-6">
                  Nothing in transit.
                </td>
              </tr>
            )}
            {(f2o ?? []).map((b) => (
              <tr key={b.id}>
                <td>{b.material_id}</td>
                <td className="num-cell">{g(Number(b.weight))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

async function FinishedTab({ supabase, isAdmin }: { supabase: Awaited<ReturnType<typeof createClient>>; isAdmin: boolean }) {
  const { data } = await supabase.from("tags").select("*").order("created_at", { ascending: false });
  const tags = (data as TagRow[]) ?? [];

  const exportData = tags.map((t) => ({
    "Tag No": t.tag_no,
    Job: t.job_id,
    Pieces: t.pieces,
    Gross: t.gross,
    Net: t.net,
    Dispatch: t.dispatch_status,
  }));

  return (
    <Card>
      <TabHeader title="Finished / Tagged" isAdmin={isAdmin} exportData={exportData} filename="finished_tagged.xlsx" />
      <table>
        <thead>
          <tr>
            <th>Tag No</th>
            <th>Job</th>
            <th className="text-right">Pcs</th>
            <th className="text-right">Gross</th>
            <th className="text-right">Net</th>
            <th>Dispatch</th>
          </tr>
        </thead>
        <tbody>
          {tags.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-text-faint italic py-6">
                No tags yet.
              </td>
            </tr>
          )}
          {tags.map((t) => (
            <tr key={t.tag_no}>
              <td className="font-mono">{t.tag_no}</td>
              <td>{t.job_id}</td>
              <td className="num-cell">{t.pieces}</td>
              <td className="num-cell">{g(t.gross)}</td>
              <td className="num-cell">{g(t.net)}</td>
              <td>
                <Badge kind={t.dispatch_status === "Delivered" ? "accepted" : t.dispatch_status === "Transit" ? "pending" : "closed"}>
                  {t.dispatch_status === "InFactory" ? "In Factory" : t.dispatch_status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

async function StockTakeTab({ supabase, isAdmin }: { supabase: Awaited<ReturnType<typeof createClient>>; isAdmin: boolean }) {
  const [{ data: balances }, { data: takes }] = await Promise.all([
    supabase.from("balances").select("*").eq("location", "FactoryBin"),
    supabase.from("stock_takes").select("*").order("created_at", { ascending: false }),
  ]);
  const factoryBin: Record<string, number> = {};
  (balances ?? []).forEach((b) => (factoryBin[b.material_id] = Number(b.weight)));
  const takesRows = (takes as StockTake[]) ?? [];

  const exportData = takesRows.map((s) => ({
    ID: s.id,
    Material: s.material_id,
    System: s.system_weight,
    Physical: s.physical_weight,
    Variance: s.variance,
    Status: s.status,
    Reason: s.reason ?? "",
  }));

  return (
    <Card>
      <TabHeader title="Physical Stock Take" isAdmin={isAdmin} exportData={exportData} filename="stock_take.xlsx" />
      <StockTakeForm materials={MATERIALS} factoryBin={factoryBin} />
      <div className="text-[11px] text-text-faint mb-3">
        Count does not directly overwrite stock. Variance requires a reason and Admin approval before any adjustment posts.
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Material</th>
            <th className="text-right">System</th>
            <th className="text-right">Physical</th>
            <th className="text-right">Variance</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {takesRows.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-text-faint italic py-6">
                No stock takes recorded.
              </td>
            </tr>
          )}
          {takesRows.map((s) => (
            <tr key={s.id}>
              <td className="font-mono">{s.id}</td>
              <td>{s.material_id}</td>
              <td className="num-cell">{g(s.system_weight)}</td>
              <td className="num-cell">{g(s.physical_weight)}</td>
              <td className={`num-cell ${Math.abs(s.variance) < 0.0005 ? "text-green" : "text-amber"}`}>{g(s.variance)}</td>
              <td>
                <Badge kind={s.status === "Pending" ? "pending" : "accepted"}>{s.status}</Badge>
              </td>
                            <td>
                {s.status === "Pending" && isAdmin && <ApproveStockTakeButton id={s.id} />}
                {s.status === "Approved" && isAdmin && <CorrectStockTakeButton id={s.id} currentPhysical={s.physical_weight} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}