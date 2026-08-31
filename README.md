# AurumTemple — JJJ Factory ERP (production build)

A production Next.js + Supabase implementation of the Stage 1 Factory ERP
blueprint (the 63-slide "FINAL DEVELOPER BLUEPRINT" + click-through mockup
deck). This is a **separate, fresh project** — it does not touch your
existing AurumTemple Next.js/Supabase codebase.

It covers all 13 modules: Admin Gold Dashboard, Role & Home, Office Flow,
Factory Inward, Melting, Karigar Job, Polish & Geru, Beads/Stones,
Settlement, Tagging & QC, Dispatch, Reports, and Masters.

## Where the business logic lives

Every mutating operation (office dispatch, factory accept, melting, job
card issue/return, polish/geru, the beads-stones zero-mismatch rule,
settlement, tagging, dispatch, stock take) is implemented as a Postgres
function in `supabase/migrations/0001_init.sql`, called from the app via
`supabase.rpc(...)`. This keeps every balance update + ledger entry
atomic, and matches the blueprint's own rule that "all reports are
generated from posted transactions — users should never directly type
stock balances."

The formulas (melt conversion, wastage, settlement, the Admin dashboard's
fine-gold reconciliation) are ported from a click-through HTML prototype
that was built and tested first — including a real double-counting bug
that turned up in prototype testing ("Gold With Karigars" was being
counted once as outstanding-with-karigar and again once the same gold
came back embodied in a returned Dhodi). The fix (compute it from
`Total Issued − Total Received` on open jobs only, via
`fn_compute_settlement`) is carried through in `fn_karigar_wip_fine()` in
`0002_dashboard_and_rls.sql`.

**One open item, by design, not a bug:** after a full run through Polish
→ Geru → Beads/Stones → Settlement → Tag → Dispatch, the Admin
dashboard's "Unreconciled Gold" figure can show a small non-zero residual
(well under 1% of total accountable gold). This traces to a genuine
tension in the blueprint itself: the Settlement layer values wastage
using Dhodi **Net**, while the dashboard's Data Design formula values
everything as **Gross × Purity%** — and these disagree once stones are
embedded in a finished piece (Gross ≠ Net). It's called out directly on
the Admin Dashboard as a CONFIG item. Decide which figure should feed the
dashboard's fine-gold formula for a stone-set piece, and adjust
`fn_finished_tagged_fine()` / `fn_transit_fine()` / `fn_office_accept()`
accordingly.

## Stack

- Next.js 15 (App Router, Server Components + Server Actions)
- Supabase (Postgres + Auth + Row Level Security)
- Tailwind CSS v3, hand-rolled UI primitives in `src/components/ui` (no
  shadcn CLI — that needs network access to install; the components use
  the same styling conventions so you can swap in shadcn later if you want)

## Setup

**1. Create a Supabase project** at https://supabase.com (or use the
Supabase CLI locally).

**2. Run the migrations**, in order, via the SQL editor in the Supabase
dashboard, or the CLI:

```bash
supabase db push
# or paste supabase/migrations/0001_init.sql then 0002_dashboard_and_rls.sql
# into the SQL editor, in that order
```

Then optionally seed demo karigars:

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
# or paste supabase/seed.sql into the SQL editor
```

**3. Copy the env file and fill in your project's values** (Project
Settings → API in the Supabase dashboard):

```bash
cp .env.local.example .env.local
```

**4. Install dependencies and run:**

```bash
npm install
npm run dev
```

Open http://localhost:3000 — you'll land on `/login`. Create an account;
new accounts default to the **Factory Manager** role.

**5. Promote your first Owner/Admin.** Roles aren't self-service (a
Factory Manager account can't grant itself Admin — that would defeat the
point of RLS). After signing up, run this once in the Supabase SQL
editor, using your own user's email:

```sql
update profiles set role = 'Owner / Admin'
where id = (select id from auth.users where email = 'you@jjjjewellers.com');
```

Once you're an Admin, you can change everyone else's role from the
**Masters** screen in the app.

## What's simulated vs. real here

- **Kramasya sync**: the blueprint's tagging step calls this out as an
  integration point. `fn_tag_product` marks `synced = true` immediately —
  there's no real Kramasya API call. Wire that up in `fn_tag_product` (or
  in the `tagProduct` server action) when you have Kramasya API access.
- **Day-close / business date**: not implemented. The blueprint's Day
  Close automation (slide 43-ish) needs a scheduled job (Supabase Edge
  Function + cron, or a small external scheduler) — it's not meaningful
  to build without deciding where that job runs.
- **Notifications**: not implemented as push/email — the data needed for
  them (pending dispatches, discrepancies, open jobs, aging WIP) is all
  queryable from the tables/RPCs already in place; add a notifications
  table + trigger, or a scheduled digest, when you're ready.

## Testing note

This was written and structured carefully, and the business-logic
formulas were validated against a click-through prototype I could
actually run and debug live (Playwright + a headless browser). I was
**not able to run this Next.js/Supabase app itself** in the sandbox this
was built in — no network access, so no `npm install`, no live Supabase
connection. Do a manual smoke test end-to-end (dispatch → accept → melt →
job card → settle → tag → dispatch → accept, and one deliberate
beads/stones mismatch to confirm it blocks) before trusting it with real
inventory.
