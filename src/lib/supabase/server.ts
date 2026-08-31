import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// One client per request, bound to the signed-in user's session via cookies.
// All the SECURITY DEFINER Postgres functions run as that user for RLS
// purposes on reads; the functions themselves enforce the business rules,
// and the caller's role (from `profiles`) is what gates which UI actions
// are even reachable — see src/lib/auth.ts.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // called from a Server Component render — safe to ignore when
            // middleware is also refreshing the session
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // see note above
          }
        },
      },
    }
  );
}
