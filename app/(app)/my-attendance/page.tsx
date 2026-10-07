"use client";

import { MyMonth } from "@/components/MyMonth";

/** Own attendance for every role (teachers also see it as the Attendance tab's second tab). */
export default function MyAttendancePage() {
  return (
    <div className="animate-rise">
      <MyMonth />
    </div>
  );
}
