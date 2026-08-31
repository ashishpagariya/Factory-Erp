import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { error, notice } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-8 h-8 rounded-md bg-gradient-to-br from-gold-dim via-gold-bright to-gold-dim flex items-center justify-center text-[13px] font-bold text-[#191305] font-mono">
            AT
          </div>
          <div>
            <div className="font-bold text-[15px] leading-tight">AurumTemple</div>
            <div className="text-[10.5px] text-text-faint uppercase tracking-wide leading-tight">JJJ Factory ERP</div>
          </div>
        </div>

        {notice && (
          <div className="mb-4 text-[12.5px] bg-[#0F1E14] border border-[#1d4a37] text-[#8FE0B4] rounded-md p-3">
            {notice}
          </div>
        )}
        {error && (
          <div className="mb-4 text-[12.5px] bg-[#241010] border border-[#4d2222] text-[#F4B9B9] rounded-md p-3">
            {error}
          </div>
        )}

        <form action={signIn} className="bg-surface border border-border rounded-xl p-5 mb-4">
          <h2 className="text-[13px] font-bold text-text-dim uppercase tracking-wide mb-4">Sign in</h2>
          <label className="block text-[11.5px] text-text-dim mb-1.5 font-semibold">Email</label>
          <input name="email" type="email" required className="mb-3" placeholder="you@jjjjewellers.com" />
          <label className="block text-[11.5px] text-text-dim mb-1.5 font-semibold">Password</label>
          <input name="password" type="password" required className="mb-4" placeholder="••••••••" />
          <button
            type="submit"
            className="w-full rounded-md bg-gradient-to-b from-gold-bright to-gold text-[#211703] font-bold py-2.5 text-[13px]"
          >
            Sign in
          </button>
        </form>

        <details className="bg-surface border border-border rounded-xl p-5">
          <summary className="text-[13px] font-bold text-text-dim uppercase tracking-wide cursor-pointer">
            Create an account
          </summary>
          <form action={signUp} className="mt-4">
            <label className="block text-[11.5px] text-text-dim mb-1.5 font-semibold">Full name</label>
            <input name="full_name" type="text" required className="mb-3" placeholder="Suresh Kumar" />
            <label className="block text-[11.5px] text-text-dim mb-1.5 font-semibold">Email</label>
            <input name="email" type="email" required className="mb-3" placeholder="you@jjjjewellers.com" />
            <label className="block text-[11.5px] text-text-dim mb-1.5 font-semibold">Password</label>
            <input name="password" type="password" required minLength={6} className="mb-4" placeholder="At least 6 characters" />
            <button type="submit" className="w-full rounded-md bg-surface3 border border-border py-2.5 text-[13px] font-medium">
              Create account
            </button>
            <p className="text-[11px] text-text-faint mt-3">
              New accounts default to the Factory Manager role. An Owner/Admin can change roles from Supabase — see the README.
            </p>
          </form>
        </details>
      </div>
    </div>
  );
}
