import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canAccess } from "@/lib/constants";
import { Stat, Card, CardTitle } from "@/components/ui/primitives";
import { g } from "@/lib/format";
import type { Role } from "@/lib/types";

const TILES = [
  { href: "/admin-dashboard", icon: "◆", title: "Admin Gold Dashboard", desc: "Total accountable gold, drill-down, reconciliation." },
  { href: "/office-flow", icon: "⇄", title: "Office Flow", desc: "Dispatch to factory / accept from factory." },
  { href: "/factory-inward", icon: "↧", title: "Factory Inward", desc: "Pending dispatch acceptance & discrepancy." },
  { href: "/melting", icon: "◎", title: "Melting", desc: "Bullion → 91.7 and 91.7 remelt." },
  { href: "/karigar-job", icon: "⚒", title: "Karigar Job", desc: "Create / issue / return / live balance." },
  { href: "/polish-geru", icon: "✦", title: "Polish & Geru", desc: "Process IDs, issue and return." },
  { href: "/beads-stones", icon: "◈", title: "Beads / Stones", desc: "Setting issue / return / zero-mismatch rule." },
  { href: "/settlement", icon: "⚖", title: "Settlement", desc: "Wastage, saving / loss, auto next Job." },
  { href: "/dispatch", icon: "↥", title: "Dispatch", desc: "Factory → Office transit / acceptance." },
  { href: "/reports", icon: "▤", title: "Reports", desc: "Balances, ledgers, loss, transit." },
  { href: "/masters", icon: "⚙", title: "Masters", desc: "Karigar / material / users & roles." },
];

const HOME_STATS: Record<Role, string[]> = {
  "Owner / Admin": ["pendingIn", "discrepancies", "openJobs", "pendingOut"],
  "Office Manager": ["pendingOut"],
  "Factory Manager": ["openJobs"],
  Supervisor: ["pendingIn", "discrepancies", "openJobs", "pendingOut"],
  "Tagged Product Receiver": [],
};

export default async function HomePage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const stats = HOME_STATS[profile.role] ?? [];

  const [{ count: pendingIn }, { count: discrepancies }, { count: openJobs }, { count: pendingOut }] = await Promise.all([
    supabase.from("office_dispatches").select("*", { count: "exact", head: true }).eq("status", "Pending"),
    supabase.from("office_dispatches").select("*", { count: "exact", head: true }).eq("status", "Discrepancy"),
    supabase.from("job_cards").select("*", { count: "exact", head: true }).eq("status", "Open"),
    supabase.from("factory_dispatches").select("*", { count: "exact", head: true }).eq("status", "Pending"),
  ]);

  let unreconciled: number | null = null;
  if (profile.role === "Owner / Admin") {
    const { data } = await supabase.rpc("fn_unreconciled_fine");
    unreconciled = typeof data === "number" ? data : null;
  }

  const visibleTiles = TILES.filter((t) => canAccess(profile.role, t.href));

  return (
    <div>
      <div className="mb-1 flex items-baseline gap-3 flex-wrap">
        <h1 className="text-[21px] font-bold tracking-tight">Home — {profile.role}</h1>
      </div>
      <p className="text-text-dim text-[13px] mb-5 max-w-2xl leading-relaxed">
        {profile.full_name ? `Welcome back, ${profile.full_name}.` : "Welcome."} Your role controls which screens and
        actions are available below.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 mb-6">
        {stats.includes("pendingIn") && (
          <Link href="/office-flow">
            <Stat label="Office → Factory Pending" value={String(pendingIn ?? 0)} sub="Awaiting factory acceptance" />
          </Link>
        )}
        {stats.includes("discrepancies") && (
          <Link href="/factory-inward">
            <Stat label="Discrepancies Open" value={String(discrepancies ?? 0)} tone={discrepancies ? "red" : "default"} sub="Sent ≠ Received" />
          </Link>
        )}
        {stats.includes("openJobs") && (
          <Link href="/karigar-job">
            <Stat label="Open Job Cards" value={String(openJobs ?? 0)} sub="One per Karigar" />
          </Link>
        )}
        {stats.includes("pendingOut") && (
          <Link href="/dispatch">
            <Stat label="Factory → Office Pending" value={String(pendingOut ?? 0)} sub="Awaiting office acceptance" />
          </Link>
        )}
        {profile.role === "Owner / Admin" && (
          <Link href="/admin-dashboard">
            <Stat
              label="Unreconciled Gold"
              value={unreconciled !== null ? g(Math.abs(unreconciled)) : "—"}
              tone={unreconciled !== null && Math.abs(unreconciled) > 0.001 ? "red" : "green"}
              sub="Target: 0.000 g"
            />
          </Link>
        )}
      </div>

      <Card>
        <CardTitle>Screens available to {profile.role}</CardTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {visibleTiles.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="bg-gradient-to-br from-surface2 to-surface border border-border rounded-xl p-4 hover:border-gold-dim hover:-translate-y-0.5 transition block"
            >
              <div className="w-8.5 h-8.5 w-[34px] h-[34px] rounded-lg bg-surface3 border border-border flex items-center justify-center text-[16px] mb-3">
                {t.icon}
              </div>
              <h3 className="font-bold text-[14px] mb-1">{t.title}</h3>
              <p className="text-text-dim text-[12px] leading-relaxed">{t.desc}</p>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}