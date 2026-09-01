"use server";
import { revalidatePath } from "next/cache";
import { actionContext, requireRole, pgErrorMessage } from "./context";
import type { ActionResult } from "@/lib/types";

export async function tagProduct(
  jobId: string,
  pieces: number,
  gross: number,
  net: number,
  purity: number
): Promise<ActionResult<{ tagNo: string }>> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin", "Factory Manager", "Supervisor", "Tagged Product Receiver"]);
  if (denied) return denied;
  const { data, error } = await supabase.rpc("fn_tag_product", {
    p_job_id: jobId,
    p_pieces: pieces,
    p_gross: gross,
    p_net: net,
    p_purity: purity,
    p_user: userId,
  });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/tagging");
  return { ok: true, message: `${data} created and synced with Kramasya.`, data: { tagNo: data as string } };
}

export async function factoryDispatchFinished(tagNos: string[]): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin", "Factory Manager", "Supervisor"]);
  if (denied) return denied;
  const { data, error } = await supabase.rpc("fn_factory_dispatch_finished", { p_tag_nos: tagNos, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/dispatch");
  return { ok: true, message: `${data} posted for ${tagNos.length} tag(s).`, data: { id: data as string } };
}

export async function factoryDispatchMaterial(materialId: string, weight: number): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin", "Factory Manager", "Supervisor"]);
  if (denied) return denied;
  const { data, error } = await supabase.rpc("fn_factory_dispatch_material", { p_material_id: materialId, p_weight: weight, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/dispatch");
  return { ok: true, message: `${data} posted. ${weight} g moved to Transit.`, data: { id: data as string } };
}

export async function officeAccept(dispatchId: string): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin", "Office Manager"]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_office_accept", { p_dispatch_id: dispatchId, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/dispatch");
  return { ok: true, message: `${dispatchId} accepted into Office Stock.` };
}

export async function postStockTake(materialId: string, physicalWeight: number): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin", "Factory Manager", "Supervisor"]);
  if (denied) return denied;
  const { data, error } = await supabase.rpc("fn_stock_take", { p_material_id: materialId, p_physical_weight: physicalWeight, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/reports");
  return { ok: true, message: `${data} recorded. Awaiting Admin approval before any adjustment.`, data: { id: data as string } };
}

export async function approveStockTake(stockTakeId: string, reason: string): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin"]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_approve_stock_take", { p_stock_take_id: stockTakeId, p_reason: reason, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/reports");
  return { ok: true, message: `${stockTakeId} approved.` };
}

export async function addKarigar(name: string, wastagePct: number): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin"]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_add_karigar", { p_name: name, p_wastage_pct: wastagePct, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/masters");
  return { ok: true, message: `${name} added to Karigar Master.` };
}

export async function updateUserRole(userId: string, role: string): Promise<ActionResult> {
  const { supabase, role: callerRole } = await actionContext();
  const denied = requireRole(callerRole, ["Owner / Admin"]);
  if (denied) return denied;
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/masters");
  return { ok: true, message: `Role updated to ${role}.` };
}