"use client";

import { StaffProvider } from "@/lib/staff";
import { AppShell } from "@/components/AppShell";
import { SignInGate } from "@/components/SignInGate";

export default function SignedInLayout({ children }: { children: React.ReactNode }) {
  return (
    <SignInGate>
      <StaffProvider>
        <AppShell>{children}</AppShell>
      </StaffProvider>
    </SignInGate>
  );
}
