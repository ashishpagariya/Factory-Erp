import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag } from "@/components/ui/primitives";
import { PendingRow, DiscrepancyRow } from "./Rows";
import { g } from "@/lib/format";
import type { OfficeDispatch } from "@/lib/types";

export default async function FactoryInwardPage() {
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/factory-inward")) return <AccessDenied role={profile.role} />;

  const supabase = await createClient();
  const [{ data: pending }, { data: discrepancy }, { data: accepted }] = await Promise.all([
    supabase.from("office_dispatches").select("*").eq("status", "Pending").order("created_at"),
    supabase.from("office_dispatches").select("*").eq("status", "Discrepancy").order("created_at"),
    supabase.from("office_dispatches").select("*").eq("status", "Accepted").order("accepted_at", { ascending: false }).limit(6),
  ]);

  const canResolve = profile.role === "Owner / Admin" || profile.role === "Supervisor";

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="text-[21px] font-bold tracking-tight">Factory Manager — Accept Material from Office</h1>
        <Tag kind="must">Must</Tag>
      </div>
      <p className="text-text-dim text-[13px] mb-5 max-w-2xl leading-relaxed">
        Factory must accept the exact Office Dispatch line — confirm what actually arrived, don&apos;t retype material or purity.
      </p>

      <Card className="mb-4">
        <CardTitle tag={<Tag kind="must">Must</Tag>}>Pending Inward</CardTitle>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Dispatch ID</th>
                <th>Material</th>
                <th className="text-right">Sent</th>
                <th className="text-right">Purity</th>
                <th>Received Weight</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(pending ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-text-faint italic py-6">
                    No pending inward. Post an Office Dispatch first.
                  </td>
                </tr>
              )}
              {(pending as OfficeDispatch[] | null)?.map((d) => (
                <PendingRow key={d.id} d={d} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-[11px] text-text-faint mt-2">
          Leave received-weight empty to accept exactly as sent. A different value raises a discrepancy instead of a silent adjustment.
        </div>
      </Card>

      <Card className="mb-4">
        <CardTitle tag={<Tag kind="control">Control</Tag>}>Discrepancy Records</CardTitle>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Dispatch ID</th>
                <th>Material</th>
                <th className="text-right">Sent</th>
                <th className="text-right">Received</th>
                <th className="text-right">Diff</th>
                <th>Reason</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(discrepancy ?? []).length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-text-faint italic py-6">
                    No open discrepancies.
                  </td>
                </tr>
              )}
              {(discrepancy as OfficeDispatch[] | null)?.map((d) => (
                <DiscrepancyRow key={d.id} d={d} canResolve={canResolve} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <CardTitle>Recently Accepted</CardTitle>
        <table>
          <thead>
            <tr>
              <th>Dispatch ID</th>
              <th>Material</th>
              <th className="text-right">Gross</th>
              <th className="text-right">Fine</th>
            </tr>
          </thead>
          <tbody>
            {(accepted ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-text-faint italic py-6">
                  Nothing accepted yet.
                </td>
              </tr>
            )}
            {(accepted as OfficeDispatch[] | null)?.map((d) => (
              <tr key={d.id}>
                <td className="font-mono">{d.id}</td>
                <td>{d.material_id}</td>
                <td className="num-cell">{g(d.gross)}</td>
                <td className="num-cell">{d.fine != null ? g(d.fine) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
