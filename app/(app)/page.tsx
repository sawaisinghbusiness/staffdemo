"use client";

import { isErpMode } from "@/lib/erpMode";
import { useStaff } from "@/lib/staff";
import { Skeleton } from "@/components/ui";
import { DriverHome } from "@/components/driver/DriverHome";
import { StaffHome } from "@/components/StaffHome";
import { ErpHome } from "@/components/ErpHome";

/**
 * Home, by who is signed in: drivers get today's route and trip; the ERP login gets the ERP Home
 * (banner, search, eight module tiles, today at school; approved 2026-11-15); teachers and other staff
 * get the parent app's Home design (2026-11-13).
 */
export default function HomePage() {
  const { me } = useStaff();

  // Until we know who it is, only a plain loading screen, so no one sees another role's Home flash first.
  if (!me)
    return (
      <div className="space-y-4 px-4 pt-6" aria-busy="true">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-36 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  if (me.role === "driver") return <DriverHome />;
  if (isErpMode()) return <ErpHome />;
  return <StaffHome />;
}
