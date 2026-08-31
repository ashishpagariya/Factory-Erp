import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag, Stat, Callout } from "@/components/ui/primitives";
import { IssueForm, ReceiveForm } from "./Forms";
import { g, pct } from "@/lib/format";
import { MAT } from "@/lib/constants";
import type { Settlement } from "@/lib/types";

export default async function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/karigar-job")) return <AccessDenied role={profile.role} />;

  const supabase = await createClient();
  const [{ data: job }, { data: settlement }, { data: wipBalances }, { data: factoryBalances }] = await Promise.all([
    supabase.from("job_cards").select("*, karigars(name)").eq("id", id).single(),
    supabase.rpc("fn_compute_settlement", { p_job_id: id }),
    supabase.from("balances").select("*").eq("location", "KarigarWIP").eq("ref_id", id),
    supabase.from("balances").select("*").eq("location", "FactoryBin"),
  ]);

  if (!job) notFound();

  const s = settlement as Settlement;
  const outstanding: Record<string, number> = {};
  (wipBalances ?? []).forEach((b) => (outstanding[b.material_id] = Number(b.weight)));
  const factoryBin: Record<string, number> = {};
  (factoryBalances ?? []).forEach((b) => (factoryBin[b.material_id] = Number(b.weight)));

  const isOpen = job.status === "Open";
  const jobKarigarName = (job as { karigars?: { name: string } }).karigars?.name ?? "—";

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="text-[21px] font-bold tracking-tight">Job Card {job.id}</h1>
        <Tag kind={isOpen ? "control" : "config"}>{isOpen ? "Open" : job.status}</Tag>
      </div>
      <p className="text-text-dim text-[13px] mb-4">
        {jobKarigarName} · created {new Date(job.created_at).toLocaleDateString()}
        {!isOpen && job.settled_at ? ` · Settled ${new Date(job.settled_at).toLocaleDateString()}` : ""}
      </p>
      <Link href="/karigar-job" className="inline-block mb-4 text-[12.5px] text-text-dim hover:text-gold">
        ‹ Back to Job Cards
      </Link>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-4">
        <Stat label="Karigar" value={jobKarigarName} sub={`Wastage ${pct(job.wastage_pct)} (snapshotted)`} />
        <Stat label="Total Issued" value={g(s.totalIssued)} tone="gold" />
        <Stat label="Total Received" value={g(s.totalReceived)} />
      </div>

      {job.opening_type && (
        <div className="mb-4">
          <Callout kind="config">
            <b>Opening {job.opening_type}:</b> {job.opening_note} — {g(job.opening_amount)}. This participates in this
            job&apos;s settlement.
          </Callout>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-4">
        <Card>
          <CardTitle tag={<Tag kind="must">Must</Tag>}>Issue Materials / Stones</CardTitle>
          <IssueForm jobId={job.id} factoryBin={factoryBin} disabled={!isOpen} />
          <table className="mt-3">
            <thead>
              <tr>
                <th>Material</th>
                <th className="text-right">Outstanding WIP</th>
              </tr>
            </thead>
            <tbody>
              {Object.keys(outstanding).filter((k) => outstanding[k] > 0.0005).length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center text-text-faint italic py-4">
                    No material currently with karigar.
                  </td>
                </tr>
              )}
              {Object.keys(outstanding)
                .filter((k) => outstanding[k] > 0.0005)
                .map((k) => (
                  <tr key={k}>
                    <td>{MAT(k)?.name ?? k}</td>
                    <td className="num-cell">{g(outstanding[k])}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <CardTitle tag={<Tag kind="must">Must</Tag>}>Receive from Karigar</CardTitle>
          <ReceiveForm jobId={job.id} outstanding={outstanding} disabled={!isOpen} />
        </Card>
      </div>

      <Card>
        <CardTitle tag={<Tag kind="control">Control</Tag>}>Live Balance &amp; Reconciliation</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
          <Stat label="Dhodi Net Total" value={g(s.dhodiNet)} />
          <Stat label="Used Semi-Finished" value={g(s.usedSemiFinished)} />
          <Stat label="Wastage Base" value={g(s.wastageBase)} />
          <Stat label={`Allowed Wastage`} value={g(s.allowedWastage, 4)} tone="gold" sub={`${g(s.wastageBase)} × ${pct(job.wastage_pct)}`} />
          <Stat
            label={s.saving > 0 ? "Saving" : s.loss > 0 ? "Loss" : "Variance"}
            value={s.saving > 0 ? g(s.saving) : s.loss > 0 ? g(s.loss) : g(0)}
            tone={s.saving > 0 ? "green" : s.loss > 0 ? "red" : "default"}
          />
          <Stat label="Job Status" value={job.status} />
        </div>
        <div className="h-px bg-border-soft my-4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link href={`/polish-geru?job=${job.id}`} className="text-center bg-surface2 border border-border rounded-full px-3 py-2 text-[12px] hover:border-gold-dim">
            Polish / Geru →
          </Link>
          <Link href={`/beads-stones?job=${job.id}`} className="text-center bg-surface2 border border-border rounded-full px-3 py-2 text-[12px] hover:border-gold-dim">
            Beads / Stones →
          </Link>
          <Link href={`/settlement?job=${job.id}`} className="text-center bg-surface2 border border-border rounded-full px-3 py-2 text-[12px] hover:border-gold-dim">
            Settlement Preview →
          </Link>
        </div>
      </Card>
    </div>
  );
}
