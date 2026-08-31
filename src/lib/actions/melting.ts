"use server";
import { revalidatePath } from "next/cache";
import { actionContext, requireRole, pgErrorMessage } from "./context";
import type { ActionResult } from "@/lib/types";

const CAN_MELT = ["Owner / Admin", "Factory Manager", "Supervisor"] as const;

export async function meltBullion(materialId: string, inputWeight: number, actualOutput: number): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_MELT]);
  if (denied) return denied;

  const { data, error } = await supabase.rpc("fn_melt_bullion", {
    p_material_id: materialId,
    p_input_weight: inputWeight,
    p_actual_output: actualOutput,
    p_user: userId,
  });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/melting");
  return { ok: true, message: `${data} posted. Output ${actualOutput} g.` };
}

export async function remelt917(materialId: string, inputWeight: number, actualOutput: number): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_MELT]);
  if (denied) return denied;

  const { data, error } = await supabase.rpc("fn_remelt_917", {
    p_material_id: materialId,
    p_input_weight: inputWeight,
    p_actual_output: actualOutput,
    p_user: userId,
  });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/melting");
  return { ok: true, message: `${data} posted. Output ${actualOutput} g.` };
}
