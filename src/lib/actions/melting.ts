"use server";
import { revalidatePath } from "next/cache";
import { actionContext, requireRole, pgErrorMessage } from "./context";
import type { ActionResult } from "@/lib/types";

const CAN_MELT = ["Owner / Admin", "Factory Manager", "Supervisor"] as const;

export async function meltBullionMulti(materialIds: string[], weights: number[], actualOutput: number): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_MELT]);
  if (denied) return denied;

  const { data, error } = await supabase.rpc("fn_melt_bullion_multi", {
    p_material_ids: materialIds,
    p_weights: weights,
    p_actual_output: actualOutput,
    p_user: userId,
  });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/melting");
  return { ok: true, message: `${data} posted. Output ${actualOutput} g from ${materialIds.length} source(s).` };
}

export async function remelt917Multi(materialIds: string[], weights: number[], actualOutput: number): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_MELT]);
  if (denied) return denied;

  const { data, error } = await supabase.rpc("fn_remelt_917_multi", {
    p_material_ids: materialIds,
    p_weights: weights,
    p_actual_output: actualOutput,
    p_user: userId,
  });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/melting");
  return { ok: true, message: `${data} posted. Output ${actualOutput} g from ${materialIds.length} source(s).` };
}