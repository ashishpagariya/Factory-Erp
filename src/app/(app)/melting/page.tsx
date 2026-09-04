import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag } from "@/components/ui/primitives";
import { MeltingForms } from "./MeltingForms";
import { MeltHistoryTable } from "./MeltHistoryTable";
import type { Melt } from "@/lib/types";

export default async function MeltingPage() {
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/melting")) return <AccessDenied role={profile.role} />;

  const supabase = await createClient();
  const [{ data: balances }, { data: melts }, { data: lotsRaw }] = await Promise.all([
    supabase.from("balances").select("*").eq("location", "FactoryBin"),
    supabase.from("melts").select("*").order("created_at", { ascending: false }).limit(5),
    supabase.from("bullion_lots").select("*").gt("remaining_weight", 0.0005).order("received_at"),
  ]);

  const factoryBin: Record<string, number> = {};
  (balances ?? []).forEach((b) => (factoryBin[b.material_id] = Number(b.weight)));

  const lots = (lotsRaw ?? []).map((l) => ({ id: l.id, purity: Number(l.purity), remaining_weight: Number(l.remaining_weight) }));

  const meltRows = (melts as Melt[]) ?? [];
  const meltIds = meltRows.map((m) => m.id);
  const { data: meltInputs } =
    meltIds.length > 0 ? await supabase.from("melt_inputs").select("*").in("melt_id", meltIds) : { data: [] };

  const inputsByMeltId: Record<string, { material_id: string; weight: number }[]> = {};
  (meltInputs ?? []).forEach((row) => {
    const arr = inputsByMeltId[row.melt_id] ?? [];
    arr.push({ material_id: row.material_id, weight: Number(row.weight) });
    inputsByMeltId[row.melt_id] = arr;
  });

  const canEdit = profile.role === "Owner / Admin" || profile.role === "Factory Manager";

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="text-[21px] font-bold tracking-tight">Factory Manager — Melting</h1>
        <Tag kind="must">Must</Tag>
      </div>
      <p className="text-text-dim text-[13px] mb-5 max-w-2xl leading-relaxed">
        Pick exactly which Bullion lot(s) you&apos;re melting — each keeps its own purity from when Office sent it.
        91.7 → 91.7 remelt (no alloy) works as before.
      </p>

      <Card className="mb-4">
        <MeltingForms factoryBin={factoryBin} lots={lots} />
      </Card>

      <Card>
        <CardTitle>Melt History (last 5)</CardTitle>
        <div className="overflow-x-auto">
          <MeltHistoryTable melts={meltRows} inputsByMeltId={inputsByMeltId} canEdit={canEdit} lots={lots} />
        </div>
        {canEdit && (
          <div className="text-[11px] text-text-faint mt-2">
            Editing reverses the melt&apos;s original effect on the lot(s)/bins involved, then reapplies with the
            corrected numbers.
          </div>
        )}
      </Card>
    </div>
  );
}