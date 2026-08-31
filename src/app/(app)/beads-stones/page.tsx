import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag, Formula, Callout } from "@/components/ui/primitives";
import { JobPicker } from "../polish-geru/PolishGeruClient";
import { SettingIssueForm, SettingRow } from "./BeadsStonesClient";
import type { SettingRecord } from "@/lib/types";

export default async function BeadsStonesPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/beads-stones")) return <AccessDenied role={profile.role} />;
  const { job: jobParam } = await searchParams;

  const supabase = await createClient();
  const { data: openJobs } = await supabase.from("job_cards").select("id, karigars(name)").eq("status", "Open");
  const { data: wipBalances } = await supabase.from("balances").select("*").eq("location", "DhodiWIP");
  const { data: stoneBalance } = await supabase.from("balances").select("*").eq("location", "FactoryBin").eq("material_id", "STONE").maybeSingle();

  const wipByJob: Record<string, number> = {};
  (wipBalances ?? []).forEach((b) => (wipByJob[b.ref_id] = Number(b.weight)));
  const jobsWithWip = (openJobs ?? []).map((j) => ({ ...j, wip: wipByJob[j.id] ?? 0 }));
  const jobId = jobParam ?? jobsWithWip[0]?.id ?? null;

  const { data: settingRecords } = jobId
    ? await supabase.from("setting_records").select("*").eq("job_id", jobId).order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="text-[21px] font-bold tracking-tight">Beads &amp; Stones</h1>
        <Tag kind="must">Must</Tag>
      </div>
      <p className="text-text-dim text-[13px] mb-4 max-w-2xl leading-relaxed">
        After Geru, the product can be issued for fixing beads and stones. Issued weight must reconcile exactly with
        receipt — NO stone/beads loss is accepted.
      </p>
      <div className="mb-4">
        <JobPicker jobs={jobsWithWip} current={jobId} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-4">
        <Card>
          <CardTitle tag={<Tag kind="must">Must</Tag>}>Issue for Setting</CardTitle>
          <SettingIssueForm jobId={jobId} wip={jobId ? wipByJob[jobId] ?? 0 : 0} stoneBin={Number(stoneBalance?.weight ?? 0)} />
        </Card>
        <Card>
          <CardTitle tag={<Tag kind="block">Must Reconcile</Tag>}>Reconciliation Rule</CardTitle>
          <Formula>{`Difference = Total Out − Total Back/Used\nIf Difference = 0.000 g → OK\nIf Difference ≠ 0 → BLOCK CLOSURE`}</Formula>
          <div className="mt-2.5">
            <Callout kind="block">
              No approval can convert a stone/beads mismatch into an accepted loss. The operator cannot hide a mismatch by
              editing an earlier posted weight.
            </Callout>
          </div>
        </Card>
      </div>
      <Card>
        <CardTitle>Open / Recent Setting Records</CardTitle>
        {((settingRecords as SettingRecord[]) ?? []).length === 0 && (
          <p className="text-[12px] text-text-faint">No setting records for this job yet.</p>
        )}
        {(settingRecords as SettingRecord[] | null)?.map((r) => (
          <SettingRow key={r.id} r={r} />
        ))}
      </Card>
    </div>
  );
}
