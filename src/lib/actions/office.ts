"use server";
import { revalidatePath } from "next/cache";
import { actionContext, requireRole, pgErrorMessage } from "./context";
import type { ActionResult } from "@/lib/types";

export async function officeDispatch(
  materialId: string,
  gross: number,
  purity: number | null
): Promise<ActionResult<{ id: string }>> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin", "Office Manager"]);
  if (denied) return denied;

  const { data, error } = await supabase.rpc("fn_office_dispatch", {
    p_material_id: materialId,
    p_gross: gross,
    p_purity: purity,
    p_user: userId,
  });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/office-flow");
  revalidatePath("/");
  return { ok: true, message: `Dispatch ${data} posted. ${gross} g moved to Transit.`, data: { id: data as string } };
}

export async function factoryAcceptExact(dispatchId: string): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin", "Factory Manager", "Supervisor"]);
  if (denied) return denied;

  const { error } = await supabase.rpc("fn_factory_accept_exact", { p_dispatch_id: dispatchId, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/factory-inward");
  revalidatePath("/");
  return { ok: true, message: `${dispatchId} accepted into Factory Bin.` };
}

export async function factoryAcceptWithDiscrepancy(
  dispatchId: string,
  receivedGross: number,
  reason: string
): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin", "Factory Manager", "Supervisor"]);
  if (denied) return denied;

  const { error } = await supabase.rpc("fn_factory_accept_discrepancy", {
    p_dispatch_id: dispatchId,
    p_received_gross: receivedGross,
    p_reason: reason,
    p_user: userId,
  });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/factory-inward");
  return { ok: true, message: `Discrepancy raised on ${dispatchId}.` };
}

export async function resolveDiscrepancy(dispatchId: string, acceptAsIs: boolean): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin", "Supervisor"]);
  if (denied) return denied;

  const { error } = await supabase.rpc("fn_resolve_discrepancy", {
    p_dispatch_id: dispatchId,
    p_accept_received_as_is: acceptAsIs,
    p_user: userId,
  });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/factory-inward");
  return { ok: true, message: `${dispatchId} resolved.` };
}

export async function correctOfficeDispatch(dispatchId: string, gross: number, purity: number | null): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin", "Office Manager"]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_correct_office_dispatch", {
    p_dispatch_id: dispatchId,
    p_new_gross: gross,
    p_new_purity: purity,
    p_user: userId,
  });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/office-flow");
  revalidatePath("/factory-inward");
  return { ok: true, message: `${dispatchId} corrected.` };
}