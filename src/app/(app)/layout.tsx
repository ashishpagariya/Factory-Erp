import { requireProfile } from "@/lib/auth";
import { TopBar } from "@/components/TopBar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar role={profile.role} fullName={profile.full_name} />
      <div className="flex-1 max-w-[1360px] w-full mx-auto px-4 md:px-[26px] py-6 md:py-[22px]">{children}</div>
      <footer className="text-center text-text-faint text-[11px] py-8 px-6">
        AurumTemple — production build ported from the Stage 1 Factory ERP blueprint
      </footer>
    </div>
  );
}
