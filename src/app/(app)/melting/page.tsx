import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag } from "@/components/ui/primitives";
import { MeltingForms } from "./MeltingForms";
import { g } from "@/lib/format";
import type { Melt } from "@/lib/types";

export default async function MeltingPage() {
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/melting")) return <AccessDenied role={profile.role} />;

  const supabase = await createClient();
  const [{ data: balances }, { data: melts }] = await Promise.all([
    supabase.from("balances").select("*").eq("location", "FactoryBin"),
    supabase.from("melts").select("*").order("created_at", { ascending: false }).limit(8),
  ]);

  const factoryBin: Record<string, number> = {};
  (balances ?? []).forEach((b) => (factoryBin[b.material_id] = Number(b.weight)));

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
        <MeltingForms factoryBin={factoryBin} />
      </Card>

      <Card>
        <CardTitle>Melt History</CardTitle>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Melt ID</th>
                <th>Type</th>
                <th>Input</th>
                <th className="text-right">Input Wt</th>
                <th className="text-right">Alloy</th>
                <th className="text-right">Expected</th>
                <th className="text-right">Actual</th>
                <th className="text-right">Loss</th>
              </tr>
            </thead>
            <tbody>
              {(melts ?? []).length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-text-faint italic py-6">
                    No melts posted yet.
                  </td>
                </tr>
              )}
              {(melts as Melt[] | null)?.map((m) => (
                <tr key={m.id}>
                  <td className="font-mono">{m.id}</td>
                  <td>{m.melt_type}</td>
                  <td>{m.input_material}</td>
                  <td className="num-cell">{g(m.input_weight)}</td>
                  <td className="num-cell">{g(m.auto_alloy)}</td>
                  <td className="num-cell">{g(m.expected_output)}</td>
                  <td className="num-cell">{g(m.actual_output)}</td>
                  <td className="num-cell text-amber">{g(m.melt_loss)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
