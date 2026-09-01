import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag, Formula, Callout } from "@/components/ui/primitives";
import { JobPicker } from "../polish-geru/PolishGeruClient";
import { ConfirmSettlementButton } from "./ConfirmSettlementButton";
import { g, pct, fmt } from "@/lib/format";
import type { Settlement } from "@/lib/types";

export default async function SettlementPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/settlement")) return <AccessDenied role={profile.role} />;
  const { job: jobParam } = await searchParams;

  const supabase = await createClient();
  const { data: openJobs } = await supabase.from("job_cards").select("id, karigars(name), wastage_pct").eq("status", "Open");
  const { data: wipBalances } = await supabase.from("balances").select("*").eq("location", "DhodiWIP");
  const wipByJob: Record<string, number> = {};
  (wipBalances ?? []).forEach((b) => (wipByJob[b.ref_id] = Number(b.weight)));
  const jobsWithWip = (openJobs ?? []).map((j) => ({ ...j, wip: wipByJob[j.id] ?? 0 }));
  const jobId = jobParam ?? jobsWithWip[0]?.id ?? null;

  if (!jobId) {
    return (
      <div>
        <div className="flex items-baseline gap-3 flex-wrap mb-1">
          <h1 className="text-[21px] font-bold tracking-tight">Job Settlement</h1>
          <Tag kind="must">Must</Tag>
        </div>
        <Card className="mt-4">No open Job Cards to settle. Create one from Karigar Job.</Card>
      </div>
    );
  }

  const job = openJobs!.find((j) => j.id === jobId)!;
  const [
    { data: settlement },
    { data: openPolish },
    { data: openGeru },
    { data: openSetting },
    { data: dhodiReturns },
    { data: issueRows },
    { data: returnRows },
  ] = await Promise.all([
    supabase.rpc("fn_compute_settlement", { p_job_id: jobId }),
    supabase.from("polish_records").select("id", { count: "exact" }).eq("job_id", jobId).eq("status", "Open"),
    supabase.from("geru_records").select("id", { count: "exact" }).eq("job_id", jobId).eq("status", "Open"),
    supabase.from("setting_records").select("id", { count: "exact" }).eq("job_id", jobId).eq("status", "Open"),
    supabase.from("job_returns").select("id", { count: "exact" }).eq("job_id", jobId).eq("return_type", "Dhodi"),
    supabase.from("job_issues").select("*").eq("job_id", jobId).order("created_at"),
    supabase.from("job_returns").select("*").eq("job_id", jobId).order("created_at"),
  ]);

  const s = settlement as Settlement;
  const gates: string[] = [];
  if ((openPolish ?? []).length) gates.push("Open Polish ID exists.");
  if ((openGeru ?? []).length) gates.push("Open Geru ID exists.");
  if ((openSetting ?? []).length) gates.push("Open Setting ID exists.");
  if (!(dhodiReturns ?? []).length) gates.push("No Dhodi has been received yet.");

  const issuesAndReturns = [
    ...(issueRows ?? []).map((r) => ({ kind: "Issued" as const, material: r.material_id, weight: r.weight, ts: r.created_at })),
    ...(returnRows ?? []).map((r) => ({
      kind: "Received" as const,
      material: r.return_type === "Dhodi" ? `Dhodi (${r.pieces} pcs, net)` : r.material_id,
      weight: r.return_type === "Dhodi" ? r.net : r.weight,
      ts: r.created_at,
    })),
  ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="text-[21px] font-bold tracking-tight">Job Settlement — {jobId}</h1>
        <Tag kind="must">Must</Tag>
      </div>
      <p className="text-text-dim text-[13px] mb-4 max-w-2xl leading-relaxed">
        Settlement happens only after all issue and receipt is completed. Semi-Finished Goods get NO wastage;
        Manufacturing Materials get wastage.
      </p>
      <div className="mb-4">
        <JobPicker jobs={jobsWithWip as any} current={jobId} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-4">
        <Card>
          <CardTitle tag={<Tag kind="control">Control</Tag>}>Gate Checks</CardTitle>
          {gates.length === 0 ? (
            <div className="bg-[#0F1E14] border border-[#1d4a37] text-[#8FE0B4] rounded-md px-4 py-3 text-[13px] font-semibold">
              All gate checks passed — ready to settle.
            </div>
          ) : (
            <div className="space-y-2">
              {gates.map((gtext) => (
                <Callout key={gtext} kind="block">
                  {gtext}
                </Callout>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardTitle tag={<Tag kind="config">Config</Tag>}>Allowed Wastage — Final Frozen Rule</CardTitle>
          <Formula>{`Used Semi-Finished = Issued − Unused Returned\nAllowed Wastage = (Dhodi Net − Used Semi-Finished) × Karigar %`}</Formula>
        </Card>
      </div>

      <Card className="mb-4">
        <CardTitle tag={<Tag kind="control">Control</Tag>}>Settlement Preview</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          <div className="bg-surface2 border border-border rounded-lg p-3">
            <div className="text-[11px] text-text-dim uppercase mb-1">Total Issued</div>
            <div className="font-mono text-[18px] font-bold">{g(s.totalIssued)}</div>
          </div>
          <div className="bg-surface2 border border-border rounded-lg p-3">
            <div className="text-[11px] text-text-dim uppercase mb-1">Total Received</div>
            <div className="font-mono text-[18px] font-bold">{g(s.totalReceived)}</div>
          </div>
          <div className="bg-surface2 border border-border rounded-lg p-3">
            <div className="text-[11px] text-text-dim uppercase mb-1">Dhodi Net</div>
            <div className="font-mono text-[18px] font-bold">{g(s.dhodiNet)}</div>
          </div>
          <div className="bg-surface2 border border-border rounded-lg p-3">
            <div className="text-[11px] text-text-dim uppercase mb-1">Used Semi-Finished</div>
            <div className="font-mono text-[18px] font-bold">{g(s.usedSemiFinished)}</div>
          </div>
          <div className="bg-surface2 border border-border rounded-lg p-3">
            <div className="text-[11px] text-text-dim uppercase mb-1">Wastage Base</div>
            <div className="font-mono text-[18px] font-bold">{g(s.wastageBase)}</div>
          </div>
          <div className="bg-surface2 border border-border rounded-lg p-3">
            <div className="text-[11px] text-text-dim uppercase mb-1">Allowed Wastage ({pct(job.wastage_pct)})</div>
            <div className="font-mono text-[18px] font-bold text-gold-bright">{fmt(s.allowedWastage, 4)} g</div>
          </div>
        </div>
        <div className="h-px bg-border-soft my-4" />
        <Formula>{`Settlement Variance = Total Issued − Total Received − Allowed Wastage\n= ${fmt(s.totalIssued, 3)} − ${fmt(s.totalReceived, 3)} − ${fmt(s.allowedWastage, 4)}\n= ${fmt(s.variance, 4)} g  →  ${s.saving > 0 ? `Saving from Karigar = ${g(s.saving)}` : s.loss > 0 ? `Loss / recoverable from Karigar = ${g(s.loss)}` : "Exactly settled"}`}</Formula>
        <div className="h-px bg-border-soft my-4" />
        <div className="flex items-center gap-2.5 flex-wrap">
          <ConfirmSettlementButton jobId={jobId} disabled={gates.length > 0} />
          {gates.length > 0 && <span className="text-[11px] text-text-faint">Resolve the gate checks above to enable settlement.</span>}
        </div>
      </Card>

      <Card>
        <CardTitle>Materials Issued vs Received — {jobId}</CardTitle>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Material</th>
                <th className="text-right">Weight</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {issuesAndReturns.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-text-faint italic py-6">
                    Nothing posted on this job yet.
                  </td>
                </tr>
              )}
              {issuesAndReturns.map((row, i) => (
                <tr key={i}>
                  <td>
                    <span className={row.kind === "Issued" ? "text-amber" : "text-green"}>{row.kind}</span>
                  </td>
                  <td>{row.material}</td>
                  <td className="num-cell">{g(row.weight)}</td>
                  <td className="text-[11px] text-text-faint">{new Date(row.ts).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}