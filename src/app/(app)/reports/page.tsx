import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess, MATERIALS } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag, Badge } from "@/components/ui/primitives";
import { StockTakeForm, ApproveStockTakeButton } from "./ReportsClient";
import { g, pct } from "@/lib/format";
import type { LedgerRow, JobCard, Melt, PolishRecord, GeruRecord, StockTake, Tag as TagRow, Settlement } from "@/lib/types";

const TABS: [string, string][] = [
  ["ledger", "Universal Ledger"],
  ["material", "Material Balance"],
  ["karigar", "Karigar Ledger"],
  ["openjobs", "Open Job Report"],
  ["meltloss", "Melting Loss"],
  ["polishloss", "Polish Loss"],
  ["geru", "Geru"],
  ["transit", "Transit Report"],
  ["finished", "Finished / Tagged"],
  ["stocktake", "Stock Take"],
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/reports")) return <AccessDenied role={profile.role} />;
  const { tab: tabParam } = await searchParams;
  const tab = tabParam ?? "ledger";
  const supabase = await createClient();

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

      {tab === "ledger" && <LedgerTab supabase={supabase} />}
      {tab === "material" && <MaterialTab supabase={supabase} />}
      {tab === "karigar" && <KarigarTab supabase={supabase} />}
      {tab === "openjobs" && <OpenJobsTab supabase={supabase} />}
      {tab === "meltloss" && <MeltLossTab supabase={supabase} />}
      {tab === "polishloss" && <PolishLossTab supabase={supabase} />}
      {tab === "geru" && <GeruTab supabase={supabase} />}
      {tab === "transit" && <TransitTab supabase={supabase} />}
      {tab === "finished" && <FinishedTab supabase={supabase} />}
      {tab === "stocktake" && <StockTakeTab supabase={supabase} isAdmin={profile.role === "Owner / Admin"} />}
    </div>
  );
}

async function LedgerTab({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data } = await supabase.from("ledger").select("*").order("ts", { ascending: false }).limit(40);
  const rows = (data as LedgerRow[]) ?? [];
  return (
    <Card>
      <CardTitle>Universal Transaction Ledger</CardTitle>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Reference</th>
              <th>Material</th>
              <th className="text-right">Gross</th>
              <th className="text-right">Purity</th>
              <th className="text-right">Fine</th>
              <th>From</th>
              <th>To</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center text-text-faint italic py-6">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function MaterialTab({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
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

  return (
    <Card>
      <CardTitle>Material Balance — Factory Bin</CardTitle>
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
          {MATERIALS.map((m) => (
            <tr key={m.id}>
              <td>{m.name}</td>
              <td>{m.category}</td>
              <td className="num-cell">{g(factoryBin[m.id] ?? 0)}</td>
              <td className="num-cell">{g(transit[m.id] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-[11px] text-text-faint mt-3">
        Total gold currently with karigars (all materials combined): {g(wipTotal)}
      </div>
    </Card>
  );
}

async function KarigarTab({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data } = await supabase.from("job_cards").select("*, karigars(name)").order("created_at", { ascending: false });
  const jobs = (data as (JobCard & { karigars: { name: string } })[]) ?? [];
  const settlements = await Promise.all(
    jobs.map(async (j) => {
      if (j.settlement) return j.settlement;
      const { data } = await supabase.rpc("fn_compute_settlement", { p_job_id: j.id });
      return data as Settlement;
    })
  );

  return (
    <Card>
      <CardTitle>Karigar Ledger</CardTitle>
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
              <th>Opening Carry-fwd</th>
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
                  <td>{j.opening_note ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

async function OpenJobsTab({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data } = await supabase.from("job_cards").select("*, karigars(name)").eq("status", "Open");
  const jobs = (data as (JobCard & { karigars: { name: string } })[]) ?? [];
  const settlements = await Promise.all(jobs.map((j) => supabase.rpc("fn_compute_settlement", { p_job_id: j.id })));

  return (
    <Card>
      <CardTitle>Open Job Report</CardTitle>
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

async function MeltLossTab({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data } = await supabase.from("melts").select("*").order("created_at", { ascending: false });
  const melts = (data as Melt[]) ?? [];
  const total = melts.reduce((s, m) => s + m.melt_loss, 0);
  return (
    <Card>
      <CardTitle>Melting Loss</CardTitle>
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

async function PolishLossTab({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data } = await supabase.from("polish_records").select("*").eq("status", "Closed").order("closed_at", { ascending: false });
  const records = (data as PolishRecord[]) ?? [];
  const total = records.reduce((s, r) => s + (r.loss ?? 0), 0);
  return (
    <Card>
      <CardTitle>Polish Loss</CardTitle>
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

async function GeruTab({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data } = await supabase.from("geru_records").select("*").eq("status", "Closed").order("closed_at", { ascending: false });
  const records = (data as GeruRecord[]) ?? [];
  const totalAdded = records.filter((r) => r.direction === "Added").reduce((s, r) => s + Math.abs(r.raw_variance ?? 0), 0);
  const totalReduced = records.filter((r) => r.direction === "Reduced").reduce((s, r) => s + Math.abs(r.raw_variance ?? 0), 0);
  return (
    <Card>
      <CardTitle>Geru</CardTitle>
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

async function TransitTab({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const [{ data: o2f }, { data: f2o }] = await Promise.all([
    supabase.from("balances").select("*").eq("location", "Transit_O2F").gt("weight", 0.0005),
    supabase.from("balances").select("*").eq("location", "Transit_F2O").gt("weight", 0.0005),
  ]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
      <Card>
        <CardTitle>Office → Factory Transit</CardTitle>
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
        <CardTitle>Factory → Office Transit</CardTitle>
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

async function FinishedTab({ supabase }: { supabase: Awaited<ReturnType<typeof createClient>> }) {
  const { data } = await supabase.from("tags").select("*").order("created_at", { ascending: false });
  const tags = (data as TagRow[]) ?? [];
  return (
    <Card>
      <CardTitle>Finished / Tagged</CardTitle>
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

  return (
    <Card>
      <CardTitle>Physical Stock Take</CardTitle>
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
              <td>{s.status === "Pending" && isAdmin && <ApproveStockTakeButton id={s.id} />}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}