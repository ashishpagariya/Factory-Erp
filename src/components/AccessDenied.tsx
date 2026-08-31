import Link from "next/link";
import type { Role } from "@/lib/types";
import { Callout } from "@/components/ui/primitives";

export function AccessDenied({ role }: { role: Role }) {
  return (
    <div className="max-w-lg mx-auto mt-10">
      <Callout kind="block">
        Your role (<b>{role}</b>) doesn&apos;t have access to this screen.{" "}
        <Link href="/" className="underline">
          Back to Home
        </Link>
      </Callout>
    </div>
  );
}
