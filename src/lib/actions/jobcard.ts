"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { actionContext, requireRole, pgErrorMessage } from "./context";
import type { ActionResult } from "@/lib/types";

const CAN_WORK_JOB = ["Owner / Admin", "Factory Manager", "Supervisor"] as const;
const CAN_CORRECT = ["Owner / Admin", "Factory Manager"] as const;

export async function createJobCard(karigarId: string): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_WORK_JOB]);
  if (denied) return denied;

  const { data, error } = await supabase.rpc("fn_create_job_card", {
    p_karigar_id: karigarId,
    p_opening_type: null,
    p_opening_amount: null,
    p_opening_note: null,
    p_user: userId,
  });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/karigar-job");
  return { ok: true, message: `${data} created.`, data: { id: data as string } };
}

export async function issueToKarigar(jobId: string, materialId: string, weight: number): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_WORK_JOB]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_issue_to_karigar", { p_job_id: jobId, p_material_id: materialId, p_weight: weight, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath(`/karigar-job/${jobId}`);
  return { ok: true, message: `${weight} g issued on ${jobId}.` };
}

export async function issueStoneToKarigar(jobId: string, weight: number): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_WORK_JOB]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_issue_stone_to_karigar", { p_job_id: jobId, p_weight: weight, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath(`/karigar-job/${jobId}`);
  return { ok: true, message: `${weight} g Stone issued on ${jobId}.` };
}

export async function receiveDhodi(jobId: string, pieces: number, gross: number, net: number): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_WORK_JOB]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_receive_dhodi", { p_job_id: jobId, p_pieces: pieces, p_gross: gross, p_net: net, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath(`/karigar-job/${jobId}`);
  return { ok: true, message: `Dhodi received: ${pieces} pcs, Gross ${gross} g, Net ${net} g.` };
}

export async function receiveMaterialReturn(jobId: string, materialId: string, weight: number): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_WORK_JOB]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_receive_material_return", { p_job_id: jobId, p_material_id: materialId, p_weight: weight, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath(`/karigar-job/${jobId}`);
  return { ok: true, message: `${weight} g returned to Factory Bin.` };
}

export async function receiveStoneReturn(jobId: string, weight: number): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_WORK_JOB]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_receive_stone_return", { p_job_id: jobId, p_weight: weight, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath(`/karigar-job/${jobId}`);
  return { ok: true, message: `${weight} g Stone returned.` };
}

export async function settleJobAction(jobId: string): Promise<ActionResult<{ newJobId: string }>> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_WORK_JOB]);
  if (denied) return denied;
  const { data, error } = await supabase.rpc("fn_settle_job", { p_job_id: jobId, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath(`/karigar-job/${jobId}`);
  revalidatePath("/karigar-job");
  revalidatePath("/settlement");
  return { ok: true, message: `${jobId} settled & locked. New Job ${data} auto-created.`, data: { newJobId: data as string } };
}

export async function settleJobAndRedirect(jobId: string) {
  const res = await settleJobAction(jobId);
  if (res.ok) redirect(`/karigar-job/${res.data!.newJobId}`);
}

export async function updateJobDescription(jobId: string, description: string): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_WORK_JOB]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_update_job_description", { p_job_id: jobId, p_description: description, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath(`/karigar-job/${jobId}`);
  revalidatePath("/karigar-job");
  return { ok: true, message: "Description saved." };
}

export async function correctJobIssue(issueId: string, jobId: string, newWeight: number): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_CORRECT]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_correct_job_issue", { p_issue_id: issueId, p_new_weight: newWeight, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath(`/karigar-job/${jobId}`);
  return { ok: true, message: `Issue ${issueId} corrected.` };
}

export async function correctMaterialReturn(returnId: string, jobId: string, newWeight: number): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_CORRECT]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_correct_material_return", { p_return_id: returnId, p_new_weight: newWeight, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath(`/karigar-job/${jobId}`);
  return { ok: true, message: `Return ${returnId} corrected.` };
}

export async function correctDhodiReceipt(
  returnId: string,
  jobId: string,
  pieces: number,
  gross: number,
  net: number
): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, [...CAN_CORRECT]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_correct_dhodi_receipt", {
    p_return_id: returnId,
    p_new_pieces: pieces,
    p_new_gross: gross,
    p_new_net: net,
    p_user: userId,
  });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath(`/karigar-job/${jobId}`);
  return { ok: true, message: `Dhodi receipt ${returnId} corrected.` };
}