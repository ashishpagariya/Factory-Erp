import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag, Badge } from "@/components/ui/primitives";
import { CreateJobForm } from "./CreateJobForm";
import { g, pct } from "@/lib/format";
import type { JobCard, Karigar, Settlement } from "@/lib/types";

export default async function KarigarJobPage() {
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/karigar-job")) return <AccessDenied role={profile.role} />;

  const supabase = await createClient();
  const [{ data: karigars }, { data: openJobs }, { data: closedJobs }] = await Promise.all([
    supabase.from("karigars").select("*").eq("active", true).order("name"),
    supabase.from("job_cards").select("*, karigars(name)").eq("status", "Open").order("created_at", { ascending: false }),
    supabase.from("job_cards").select("*, karigars(name)").eq("status", "Settled").order("settled_at", { ascending: false }).limit(6),
  ]);

  const settlementPreviews: Record<string, Settlement> = {};
  await Promise.all(
    (openJobs ?? []).map(async (j) => {
      const { data } = await supabase.rpc("fn_compute_settlement", { p_job_id: j.id });
      if (data) settlementPreviews[j.id] = data as Settlement;
    })
  );

  const busyIds = new Set((openJobs ?? []).map((j) => j.karigar_id));

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="text-[21px] font-bold tracking-tight">Karigar Job Card</h1>
        <Tag kind="must">Must</Tag>
      </div>
      <p className="text-text-dim text-[13px] mb-5 max-w-2xl leading-relaxed">
        Only ONE open Job Card is allowed per Karigar. The Job Card backs all issue, return, process work and settlement.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-4">
        <Card>
          <CardTitle>Open Job Cards</CardTitle>
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Job Card</th>
                  <th>Karigar</th>
                  <th className="text-right">Wastage %</th>
                  <th className="text-right">Issued</th>
                  <th className="text-right">Received</th>
                  <th>Description</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {(openJobs ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-text-faint italic py-6">
                      No open Job Cards.
                    </td>
                  </tr>
                )}
                {(openJobs as (JobCard & { karigars: { name: string } })[] | null)?.map((j) => {
                  const s = settlementPreviews[j.id];
                  return (
                    <tr key={j.id}>
                      <td className="font-mono">
                        <Link href={`/karigar-job/${j.id}`} className="text-gold hover:underline">
                          {j.id}
                        </Link>
                      </td>
                      <td>{j.karigars?.name}</td>
                      <td className="num-cell">{pct(j.wastage_pct)}</td>
                      <td className="num-cell">{s ? g(s.totalIssued) : "—"}</td>
                      <td className="num-cell">{s ? g(s.totalReceived) : "—"}</td>
                      <td className="text-[11.5px] text-text-dim max-w-[180px] truncate">{j.description || "—"}</td>
                      <td>
                        <Badge kind="open">Open</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <Card>
          <CardTitle tag={<Tag kind="must">Must</Tag>}>Create Job</CardTitle>
          <CreateJobForm karigars={(karigars as Karigar[]) ?? []} busyIds={busyIds} />
        </Card>
      </div>

      <Card>
        <CardTitle>Recently Closed</CardTitle>
        <table>
          <thead>
            <tr>
              <th>Job Card</th>
              <th>Karigar</th>
              <th>Status</th>
              <th className="text-right">Saving</th>
              <th className="text-right">Loss</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {(closedJobs ?? []).length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-text-faint italic py-6">
                  No settled jobs yet.
                </td>
              </tr>
            )}
            {(closedJobs as (JobCard & { karigars: { name: string } })[] | null)?.map((j) => (
              <tr key={j.id}>
                <td className="font-mono">
                  <Link href={`/karigar-job/${j.id}`} className="text-gold hover:underline">
                    {j.id}
                  </Link>
                </td>
                <td>{j.karigars?.name}</td>
                <td>
                  <Badge kind="settled">Settled</Badge>
                </td>
                <td className="num-cell text-green">{j.settlement && j.settlement.saving > 0 ? g(j.settlement.saving) : "—"}</td>
                <td className="num-cell text-red">{j.settlement && j.settlement.loss > 0 ? g(j.settlement.loss) : "—"}</td>
                <td className="text-[11.5px] text-text-dim max-w-[180px] truncate">{j.description || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}