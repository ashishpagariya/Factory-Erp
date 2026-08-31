import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag, Badge } from "@/components/ui/primitives";
import { TagForm } from "./TagForm";
import { g } from "@/lib/format";
import type { Tag as TagRow } from "@/lib/types";

export default async function TaggingPage() {
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/tagging")) return <AccessDenied role={profile.role} />;

  const supabase = await createClient();
  const [{ data: wipBalances }, { data: jobsRaw }, { data: tags }] = await Promise.all([
    supabase.from("balances").select("*").eq("location", "DhodiWIP").gt("weight", 0.0005),
    supabase.from("job_cards").select("id, karigars(name)"),
    supabase.from("tags").select("*").order("created_at", { ascending: false }).limit(10),
  ]);

  const jobsById = new Map((jobsRaw ?? []).map((j) => [j.id, j]));
  const readyJobs = (wipBalances ?? [])
    .map((b) => ({ id: b.ref_id, wip: Number(b.weight), karigars: jobsById.get(b.ref_id)?.karigars }))
    .filter((j) => jobsById.has(j.id));

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="text-[21px] font-bold tracking-tight">Finished Goods — Tagging &amp; Kramasya Sync</h1>
        <Tag kind="control">Control</Tag>
        <Tag kind="config">Config</Tag>
      </div>
      <p className="text-text-dim text-[13px] mb-4 max-w-2xl leading-relaxed">
        Tagging is the bridge between factory completion and office inventory. Only tagged/approved finished goods can be
        selected for dispatch.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-4">
        <Card>
          <CardTitle>Tag Finished Product</CardTitle>
          <TagForm readyJobs={readyJobs as never} />
          <div className="text-[11px] text-text-faint mt-2">
            Kramasya owns the Tag No series. Sync status and last sync time are stored with the tag.
          </div>
        </Card>
        <Card>
          <CardTitle tag={<Tag kind="control">Control</Tag>}>Minimum Tag Data</CardTitle>
          <ul className="text-[12.5px] text-text-dim space-y-2 mb-4">
            <li>Tag No / Kramasya reference</li>
            <li>Job Card No</li>
            <li>Pieces, Final Gross, Final Net, Purity</li>
            <li>Date / tagged by</li>
          </ul>
          <div className="h-px bg-border-soft my-4" />
          <CardTitle tag={<Tag kind="must">Source UI</Tag>}>Tagged Product Receiver</CardTitle>
          <p className="text-[12px] text-text-dim">
            Receives or rejects finished goods coming back through QC. If a tagged product is rejected or sent for
            repair, the system keeps the same Job/Tag trace.
          </p>
        </Card>
      </div>

      <Card>
        <CardTitle>Recent Tags</CardTitle>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Tag No</th>
                <th>Job Card</th>
                <th className="text-right">Pcs</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Net</th>
                <th>Kramasya</th>
                <th>Dispatch</th>
              </tr>
            </thead>
            <tbody>
              {(tags ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-text-faint italic py-6">
                    No tags created yet.
                  </td>
                </tr>
              )}
              {(tags as TagRow[] | null)?.map((t) => (
                <tr key={t.tag_no}>
                  <td className="font-mono">{t.tag_no}</td>
                  <td>{t.job_id}</td>
                  <td className="num-cell">{t.pieces}</td>
                  <td className="num-cell">{g(t.gross)}</td>
                  <td className="num-cell">{g(t.net)}</td>
                  <td>
                    <Badge kind="accepted">Synced</Badge>
                  </td>
                  <td>
                    <Badge kind={t.dispatch_status === "Delivered" ? "accepted" : t.dispatch_status === "Transit" ? "pending" : "closed"}>
                      {t.dispatch_status === "InFactory" ? "In Factory" : t.dispatch_status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
