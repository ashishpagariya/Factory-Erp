export async function addKarigar(name: string, wastagePct: number): Promise<ActionResult> {
  const { supabase, userId, role } = await actionContext();
  const denied = requireRole(role, ["Owner / Admin"]);
  if (denied) return denied;
  const { error } = await supabase.rpc("fn_add_karigar", { p_name: name, p_wastage_pct: wastagePct, p_user: userId });
  if (error) return { ok: false, message: pgErrorMessage(error) };
  revalidatePath("/masters");
  return { ok: true, message: `${name} added to Karigar Master.` };
}