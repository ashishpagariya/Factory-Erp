"use server";
import { revalidatePath } from "next/cache";
import { actionContext, requireRole, pgErrorMessage } from "./context";
import type { ActionResult } from "@/lib/types";

const CAN_WORK = ["Owner / Admin", "Factory Manager", "Supervisor"] as const;
const CAN_CORRECT = ["Owner / Admin", "Factory Manager"] as const;

export async function polishIssue(jobId: string, gross: number): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_WORK]);
  if (denied) return denied;
  const { data, error } = await supabase.rpc("fn_polish_issue", { p_job_id: jobId, p_gross: gross, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/polish-geru");
  return { ok: true, message: `${data} opened. ${gross} g issued to polish.`, data: { id: data as string } };
}

export async function polishReturn(polishId: string, returnedGross: number): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_WORK]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_polish_return", { p_polish_id: polishId, p_returned_gross: returnedGross, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/polish-geru");
  return { ok: true, message: `${polishId} closed.` };
}

export async function correctPolish(polishId: string, newIssued: number, newReturned: number | null): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_CORRECT]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_correct_polish", { p_polish_id: polishId, p_new_issued: newIssued, p_new_returned: newReturned, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/polish-geru");
  return { ok: true, message: `${polishId} corrected.` };
}

export async function geruIssue(jobId: string, gross: number): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_WORK]);
  if (denied) return denied;
  const { data, error } = await supabase.rpc("fn_geru_issue", { p_job_id: jobId, p_gross: gross, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/polish-geru");
  return { ok: true, message: `${data} opened. ${gross} g issued to Geru.`, data: { id: data as string } };
}

export async function geruReturn(geruId: string, returnedGross: number): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_WORK]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_geru_return", { p_geru_id: geruId, p_returned_gross: returnedGross, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/polish-geru");
  return { ok: true, message: `${geruId} closed.` };
}

export async function correctGeru(geruId: string, newIssued: number, newReturned: number | null): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_CORRECT]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_correct_geru", { p_geru_id: geruId, p_new_issued: newIssued, p_new_returned: newReturned, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/polish-geru");
  return { ok: true, message: `${geruId} corrected.` };
}

export async function settingIssue(
  jobId: string,
  productGross: number,
  stonesIssued: number,
  otherMaterialIssued: number
): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_WORK]);
  if (denied) return denied;
  const { data, error } = await supabase.rpc("fn_setting_issue", {
    p_job_id: jobId,
    p_product_gross: productGross,
    p_stones_issued: stonesIssued,
    p_other_material_issued: otherMaterialIssued,
    p_user: userId,
  });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/beads-stones");
  return { ok: true, message: `${data} opened for beads/stone setting.`, data: { id: data as string } };
}

export async function settingReturn(
  settingId: string,
  finalProductGross: number,
  unusedStonesReturned: number,
  unusedMaterialReturned: number
): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_WORK]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_setting_return", {
    p_setting_id: settingId,
    p_final_product_gross: finalProductGross,
    p_unused_stones_returned: unusedStonesReturned,
    p_unused_material_returned: unusedMaterialReturned,
    p_user: userId,
  });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/beads-stones");
  return { ok: true, message: `${settingId} closed. Reconciled exactly to 0.000 g.` };
}

export async function correctSetting(
  settingId: string,
  productGross: number,
  stonesIssued: number,
  otherMaterialIssued: number,
  finalProductGross: number | null,
  unusedStonesReturned: number | null,
  unusedMaterialReturned: number | null
): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_CORRECT]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_correct_setting", {
    p_setting_id: settingId,
    p_new_product_gross: productGross,
    p_new_stones_issued: stonesIssued,
    p_new_other_material_issued: otherMaterialIssued,
    p_new_final_product_gross: finalProductGross,
    p_new_unused_stones_returned: unusedStonesReturned,
    p_new_unused_material_returned: unusedMaterialReturned,
    p_user: userId,
  });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/beads-stones");
  return { ok: true, message: `${settingId} corrected — reconciled exactly to 0.000 g.` };
}