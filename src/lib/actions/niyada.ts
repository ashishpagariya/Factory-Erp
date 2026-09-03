"use server";
import { revalidatePath } from "next/cache";
import { actionContext, requireRole, pgErrorMessage } from "./context";
import type { ActionResult } from "@/lib/types";

export async function settleNiyada(recoveredGrams: number): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin"]);
  if (denied) return denied;
  const { data, error } = await supabase.rpc("fn_settle_niyada", { p_recovered_grams: recoveredGrams, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/reports");
  return { ok: true, message: `${data} recorded — Niyada set off.`, data: { id: data as string } };
}