import { createClient } from "@/lib/supabase/server";
import type { ActionResult, Role } from "@/lib/types";

export async function actionContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, userId: null, role: null as Role | null };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return { supabase, userId: user.id, role: (profile?.role as Role) ?? null };
}

export function requireRole(role: Role | null, allowed: Role[] | "ALL"): ActionResult<any> | null {
  if (!role) return { ok: false, message: "You must be signed in." };
  if (allowed === "ALL") return null;
  if (allowed.includes(role)) return null;
  return { ok: false, message: `Your role (${role}) can't do this.` };
}

// Postgres raises a plain exception message from `raise exception`; surface it directly.
export function pgErrorMessage(error: { message: string } | null): string {
  if (!error) return "Something went wrong.";
  const m = error.message || "Something went wrong.";
  return m.replace(/^.*?:\s*/, "");
}
