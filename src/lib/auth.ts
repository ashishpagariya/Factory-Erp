import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { redirect } from "next/navigation";

export async function getCurrentProfile(): Promise<{ userId: string; profile: Profile } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return null;
  return { userId: user.id, profile: profile as Profile };
}

export async function requireProfile(): Promise<{ userId: string; profile: Profile }> {
  const session = await getCurrentProfile();
  if (!session) redirect("/login");
  return session;
}
