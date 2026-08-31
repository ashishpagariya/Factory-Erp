import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess, MATERIALS } from "@/lib/constants";
import { AccessDenied } from "@/components/AccessDenied";
import { Card, CardTitle, Tag, Badge } from "@/components/ui/primitives";
import { AddKarigarForm, RoleSelect } from "./MastersClient";
import { pct } from "@/lib/format";
import type { Karigar } from "@/lib/types";

export default async function MastersPage() {
  const { profile } = await requireProfile();
  if (!canAccess(profile.role, "/masters")) return <AccessDenied role={profile.role} />;

  const supabase = await createClient();
  const [{ data: karigars }, { data: openJobKarigarIds }, { data: profiles }] = await Promise.all([
    supabase.from("karigars").select("*").order("name"),
    supabase.from("job_cards").select("karigar_id").eq("status", "Open"),
    profile.role === "Owner / Admin" ? supabase.from("profiles").select("*").order("created_at") : Promise.resolve({ data: null }),
  ]);

  const busyIds = new Set((openJobKarigarIds ?? []).map((j) => j.karigar_id));

  return (
    <div>
      <div className="flex items-baseline gap-3 flex-wrap mb-1">
        <h1 className="text-[21px] font-bold tracking-tight">Masters</h1>
        <Tag kind="config">Config</Tag>
      </div>
      <p className="text-text-dim text-[13px] mb-4 max-w-2xl leading-relaxed">
        Karigar / material / users &amp; roles. Wastage Applicable is set once here so future materials can be classified
        without changing program code.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 mb-4">
        <Card>
          <CardTitle>Karigar Master</CardTitle>
          <table>
            <thead>
              <tr>
                <th>Karigar</th>
                <th className="text-right">Wastage %</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {((karigars as Karigar[]) ?? []).map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  <td className="num-cell">{pct(k.wastage_pct)}</td>
                  <td>
                    <Badge kind={busyIds.has(k.id) ? "open" : "closed"}>{busyIds.has(k.id) ? "Job Open" : "Available"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="h-px bg-border-soft my-4" />
          <AddKarigarForm />
        </Card>
        <Card>
          <CardTitle>Material Master</CardTitle>
          <table>
            <thead>
              <tr>
                <th>Material</th>
                <th>Category</th>
                <th className="text-right">Purity</th>
                <th>Wastage Applicable</th>
              </tr>
            </thead>
            <tbody>
              {MATERIALS.map((m) => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td>{m.category}</td>
                  <td className="num-cell">{m.purity != null ? pct(m.purity) : "—"}</td>
                  <td>
                    <Badge kind={m.wastage_applicable ? "open" : "closed"}>{m.wastage_applicable ? "YES" : "NO"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-[11px] text-text-faint mt-3">
            Semi-Finished = NO wastage (frozen). Manufacturing Materials = YES wastage (frozen).
          </div>
        </Card>
      </div>

      <Card>
        <CardTitle tag={<Tag kind="must">Source UI</Tag>}>Users &amp; Roles</CardTitle>
        {profile.role === "Owner / Admin" ? (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {(profiles ?? []).length === 0 && (
                <tr>
                  <td colSpan={2} className="text-center text-text-faint italic py-6">
                    No users yet.
                  </td>
                </tr>
              )}
              {(profiles ?? [])?.map((p) => (
                <tr key={p.id}>
                  <td>{p.full_name ?? p.id}</td>
                  <td>
                    <RoleSelect userId={p.id} currentRole={p.role} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Primary Access</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Office Manager</td>
                <td>Dispatch to factory; accept from factory</td>
              </tr>
              <tr>
                <td>Factory Manager</td>
                <td>Accept, melt, job cards, process, settle, dispatch</td>
              </tr>
              <tr>
                <td>Owner / Admin</td>
                <td>Full access / configuration / approval</td>
              </tr>
              <tr>
                <td>Supervisor</td>
                <td>First-line approvals / floor oversight</td>
              </tr>
              <tr>
                <td>Tagged Product Receiver</td>
                <td>Receive / reject finished goods</td>
              </tr>
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
