"use server";
import { revalidatePath } from "next/cache";
import { actionContext, requireRole, pgErrorMessage } from "./context";
import type { ActionResult } from "@/lib/types";

export async function sellKarigarGold(karigarId: string, grams: number, rate: number): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin", "Factory Manager", "Supervisor"]);
  if (denied) return denied;
  const { data, error } = await supabase.rpc("fn_sell_karigar_gold", {
    p_karigar_id: karigarId,
    p_grams: grams,
    p_rate: rate,
    p_user: userId,
  });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/karigar-sales");
  return { ok: true, message: `${data} recorded — ${grams} g at ₹${rate}/g.`, data: { id: data as string } };
}

export async function giveKarigarGoldToOffice(): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin", "Factory Manager"]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_give_karigar_gold_to_office", { p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/karigar-sales");
  return { ok: true, message: "Accumulated gold handed over to Office." };
}