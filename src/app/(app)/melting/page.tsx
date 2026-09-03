import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess, MATERIALS } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag } from "@/components/ui/primitives";
import { MeltingForms } from "./MeltingForms";
import { MeltHistoryTable } from "./MeltHistoryTable";
import type { Melt } from "@/lib/types";

export default async function MeltingPage() {
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/melting")) return <AccessDenied role={profile.role} />;

  const supabase = await createClient();
  const bullionMats = MATERIALS.filter((m) => m.category === "Bullion");
  const [{ data: balances }, { data: melts }, ...purityResults] = await Promise.all([
    supabase.from("balances").select("*").eq("location", "FactoryBin"),
    supabase.from("melts").select("*").order("created_at", { ascending: false }).limit(5),
    ...bullionMats.map((m) => supabase.rpc("fn_bin_avg_purity", { p_material_id: m.id })),
  ]);

  const factoryBin: Record<string, number> = {};
  (balances ?? []).forEach((b) => (factoryBin[b.material_id] = Number(b.weight)));

  const avgPurity: Record<string, number | null> = {};
  bullionMats.forEach((m, i) => {
    avgPurity[m.id] = purityResults[i]?.data ?? null;
  });

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
        Bullion → 91.7 Melt Bar (auto alloy + melt loss) and 91.7 → 91.7 remelt (no alloy).
      </p>

      <Card className="mb-4">
        <MeltingForms factoryBin={factoryBin} avgPurity={avgPurity} />
      </Card>

      <Card>
        <CardTitle>Melt History (last 5)</CardTitle>
        <div className="overflow-x-auto">
          <MeltHistoryTable melts={meltRows} inputsByMeltId={inputsByMeltId} canEdit={canEdit} />
        </div>
        {canEdit && (
          <div className="text-[11px] text-text-faint mt-2">
            Editing reverses the melt&apos;s original effect on Factory Bin / Alloy / Melt Bar exactly, then reapplies
            with the corrected numbers.
          </div>
        )}
      </Card>
    </div>
  );
}