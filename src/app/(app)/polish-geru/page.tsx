import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag, Callout } from "@/components/ui/primitives";
import { JobPicker, PolishPanel, GeruPanel } from "./PolishGeruClient";

export default async function PolishGeruPage({ searchParams }: { searchParams: Promise<{ job?: string }> }) {
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/polish-geru")) return <AccessDenied role={profile.role} />;
  const { job: jobParam } = await searchParams;

  const supabase = await createClient();
  const { data: openJobs } = await supabase.from("job_cards").select("id, karigars(name)").eq("status", "Open");
  const { data: wipBalances } = await supabase.from("balances").select("*").eq("location", "DhodiWIP");
  const wipByJob: Record<string, number> = {};
  (wipBalances ?? []).forEach((b) => (wipByJob[b.ref_id] = Number(b.weight)));

  const jobsWithWip = (openJobs ?? []).map((j) => ({ ...j, wip: wipByJob[j.id] ?? 0 }));
  const jobId = jobParam ?? jobsWithWip[0]?.id ?? null;

  const [{ data: polishRecords }, { data: geruRecords }] = await Promise.all([
    jobId ? supabase.from("polish_records").select("*").eq("job_id", jobId).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    jobId ? supabase.from("geru_records").select("*").eq("job_id", jobId).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="text-[21px] font-bold tracking-tight">Polish &amp; Geru</h1>
        <Tag kind="must">Must</Tag>
      </div>
      <p className="text-text-dim text-[13px] mb-4 max-w-2xl leading-relaxed">
        Both processes are issued on the Job Card and get their own auto-generated ID. Return is only entered against the
        original open ID.
      </p>
      <div className="mb-4">
        <JobPicker jobs={jobsWithWip} current={jobId} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        <Card>
          <CardTitle tag={<Tag kind="must">Must</Tag>}>Polish</CardTitle>
          <PolishPanel jobId={jobId} records={(polishRecords as never[]) ?? []} wip={jobId ? wipByJob[jobId] ?? 0 : 0} />
        </Card>
        <Card>
          <CardTitle tag={<Tag kind="must">Must</Tag>}>Geru</CardTitle>
          <GeruPanel jobId={jobId} records={(geruRecords as never[]) ?? []} wip={jobId ? wipByJob[jobId] ?? 0 : 0} />
          <div className="mt-2.5">
            <Callout kind="control">
              Raw source formula: Issue − Return. Because the sign can confuse operators, the UI labels it Added / Reduced.
            </Callout>
          </div>
        </Card>
      </div>
    </div>
  );
}
