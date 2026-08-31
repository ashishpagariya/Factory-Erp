import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag, Badge } from "@/components/ui/primitives";
import { OfficeDispatchForm } from "./OfficeDispatchForm";
import { g, pct } from "@/lib/format";
import Link from "next/link";
import type { OfficeDispatch } from "@/lib/types";

export default async function OfficeFlowPage() {
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/office-flow")) return <AccessDenied role={profile.role} />;

  const supabase = await createClient();
  const [{ data: dispatches }, { data: balances }] = await Promise.all([
    supabase.from("office_dispatches").select("*").order("created_at", { ascending: false }).limit(30),
    supabase.from("balances").select("*").eq("location", "OfficeStock"),
  ]);

  const officeStock: Record<string, number> = {};
  (balances ?? []).forEach((b) => (officeStock[b.material_id] = Number(b.weight)));

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="text-[21px] font-bold tracking-tight">Office Manager — Office → Factory Dispatch</h1>
        <Tag kind="must">Must</Tag>
      </div>
      <p className="text-text-dim text-[13px] mb-5 max-w-2xl leading-relaxed">
        One screen supports every material category without allowing the wrong purity into the wrong bin.
      </p>
      <Link href="/" className="inline-block mb-4 text-[12.5px] text-text-dim hover:text-gold">
        ‹ Back to Home
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-4">
        <Card>
          <CardTitle tag={<Tag kind="must">Must</Tag>}>Create Dispatch</CardTitle>
          <OfficeDispatchForm officeStock={officeStock} />
        </Card>
        <Card>
          <CardTitle tag={<Tag kind="control">Control</Tag>}>What Must Be Blocked</CardTitle>
          <ul className="text-[12.5px] text-text-dim space-y-2">
            <li>Changing EF/Gejje/Screw/Repair purity from 91.7</li>
            <li>Choosing a gold bin for Stone / Alloy</li>
            <li>Posting zero or negative weight</li>
            <li>Dispatching more than Office stock holds</li>
            <li>Editing after factory accepts</li>
          </ul>
          <div className="h-px bg-border-soft my-4" />
          <p className="text-[12px] text-text-dim mb-3">
            Accepting material back from the factory happens on the Dispatch screen once Factory posts a dispatch.
          </p>
          <Link href="/dispatch" className="text-[12.5px] text-gold underline">
            Go to Factory → Office Acceptance
          </Link>
        </Card>
      </div>

      <Card>
        <CardTitle>Office Dispatches</CardTitle>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Dispatch ID</th>
                <th>Material</th>
                <th className="text-right">Gross</th>
                <th className="text-right">Purity</th>
                <th className="text-right">Fine</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {(dispatches ?? []).length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-text-faint italic py-6">
                    No dispatches yet — create one above.
                  </td>
                </tr>
              )}
              {(dispatches as OfficeDispatch[] | null)?.map((d) => (
                <tr key={d.id}>
                  <td className="font-mono">{d.id}</td>
                  <td>{d.material_id}</td>
                  <td className="num-cell">{g(d.gross)}</td>
                  <td className="num-cell">{d.purity != null ? pct(d.purity) : "—"}</td>
                  <td className="num-cell">{d.fine != null ? g(d.fine) : "—"}</td>
                  <td>
                    <Badge kind={d.status === "Pending" ? "pending" : d.status === "Discrepancy" ? "discrepancy" : "accepted"}>
                      {d.status}
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
