import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess, OFFICE_DISPATCHABLE, MATERIALS } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag } from "@/components/ui/primitives";
import { DispatchFinishedForm, DispatchMaterialForm, AcceptFDButton } from "./DispatchClient";
import type { Tag as TagRow, FactoryDispatch } from "@/lib/types";

export default async function DispatchPage() {
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/dispatch")) return <AccessDenied role={profile.role} />;

  const supabase = await createClient();
  const [{ data: readyTags }, { data: factoryBalances }, { data: pendingFD }, { data: acceptedFD }, { data: fdItems }] = await Promise.all([
    supabase.from("tags").select("*").eq("dispatch_status", "InFactory").order("created_at", { ascending: false }),
    supabase.from("balances").select("*").eq("location", "FactoryBin"),
    supabase.from("factory_dispatches").select("*").eq("status", "Pending").order("created_at"),
    supabase.from("factory_dispatches").select("*").eq("status", "Accepted").order("accepted_at", { ascending: false }).limit(6),
    supabase.from("factory_dispatch_items").select("*"),
  ]);

  const factoryBin: Record<string, number> = {};
  (factoryBalances ?? []).forEach((b) => (factoryBin[b.material_id] = Number(b.weight)));
  const materialsForReturn = MATERIALS.filter((m) => OFFICE_DISPATCHABLE.includes(m.category));
  type FDItem = { dispatch_id: string; tag_no: string | null; material_id: string | null; gross: number };
  const itemsByDispatch = new Map<string, FDItem[]>();
  ((fdItems as FDItem[]) ?? []).forEach((it) => {
    const arr = itemsByDispatch.get(it.dispatch_id) ?? [];
    arr.push(it);
    itemsByDispatch.set(it.dispatch_id, arr);
  });

  function describeItems(dispatchId: string) {
    return (itemsByDispatch.get(dispatchId) ?? [])
      .map((it) => (it.tag_no ? it.tag_no : `${it.material_id} ${it.gross} g`))
      .join(", ");
  }

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="text-[21px] font-bold tracking-tight">Factory Manager — Dispatch to Office</h1>
        <Tag kind="must">Must</Tag>
      </div>
      <p className="text-text-dim text-[13px] mb-4 max-w-2xl leading-relaxed">
        Factory dispatches finished goods, or returns bullion/semi-finished/non-gold material back to office.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-4">
        <Card>
          <CardTitle>Dispatch Finished Goods</CardTitle>
          <DispatchFinishedForm tags={(readyTags as TagRow[]) ?? []} />
        </Card>
        <Card>
          <CardTitle>Return Bullion / Semi-Finished / Non-Gold</CardTitle>
          <DispatchMaterialForm materials={materialsForReturn} factoryBin={factoryBin} />
        </Card>
      </div>

      <Card className="mb-4">
        <CardTitle tag={<Tag kind="must">Must</Tag>}>Office Manager — Accept from Factory</CardTitle>
        <table>
          <thead>
            <tr>
              <th>Dispatch ID</th>
              <th>Category</th>
              <th>Items</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(pendingFD ?? []).length === 0 && (
              <tr>
                <td colSpan={4} className="text-center text-text-faint italic py-6">
                  Nothing pending office acceptance.
                </td>
              </tr>
            )}
            {(pendingFD as FactoryDispatch[] | null)?.map((d) => (
              <tr key={d.id}>
                <td className="font-mono">{d.id}</td>
                <td>{d.category}</td>
                <td className="text-[12px]">{describeItems(d.id)}</td>
                <td>
                  <AcceptFDButton id={d.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardTitle>Recently Accepted at Office</CardTitle>
        <table>
          <thead>
            <tr>
              <th>Dispatch ID</th>
              <th>Category</th>
              <th>Items</th>
            </tr>
          </thead>
          <tbody>
            {(acceptedFD ?? []).length === 0 && (
              <tr>
                <td colSpan={3} className="text-center text-text-faint italic py-6">
                  Nothing accepted yet.
                </td>
              </tr>
            )}
            {(acceptedFD as FactoryDispatch[] | null)?.map((d) => (
              <tr key={d.id}>
                <td className="font-mono">{d.id}</td>
                <td>{d.category}</td>
                <td className="text-[12px]">{describeItems(d.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
