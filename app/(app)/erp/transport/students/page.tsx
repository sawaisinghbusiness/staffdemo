"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ListSkeleton } from "@/components/ui";

/** ERP login → Transport → Bus students. As in the ERP (/transport/students), the students live inside each route. */
export default function ErpTransportStudentsPage() {
  const router = useRouter();
  useEffect(() => router.replace("/erp/transport/"), [router]);
  return <ListSkeleton rows={4} />;
}
