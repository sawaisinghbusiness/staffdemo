"use client";

import { StaffProvider } from "@/lib/staff";
import { AppShell } from "@/components/AppShell";

export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return (
    <StaffProvider>
      <AppShell>{children}</AppShell>
    </StaffProvider>
  );
}
