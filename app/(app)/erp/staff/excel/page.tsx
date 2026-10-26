"use client";

import { useApi } from "@/lib/api";
import { dmy } from "@/lib/csv";
import type { StaffList } from "@/lib/erpStaff";
import { ExcelRoundTrip } from "@/components/erp/ExcelRoundTrip";
import { ErrorCard, ListSkeleton } from "@/components/ui";

/*
 * ERP login → Staff → Excel (2026-10-26): the staff list as a sheet, filled in Excel and uploaded back.
 * POST /api/staff/import (admin): a known employee code updates that person, a blank or new code adds someone,
 * with the add-staff form's own checks. Salary is not in the sheet; it stays in Payroll.
 */

const HEADER = ["Emp Code", "Name", "Type (Teaching/Non-teaching)", "Designation", "Department", "Mobile", "Other Mobile", "Email", "Qualification", "Joining (DD-MM-YYYY)", "Gender", "DOB (DD-MM-YYYY)", "Address", "Experience (years)"];
const KEYS = ["empCode", "name", "staffType", "designation", "department", "mobile", "altMobile", "email", "qualification", "joiningDate", "gender", "dob", "address", "experienceYears"];

export default function ErpStaffExcelPage() {
  const { data, error, reload } = useApi<StaffList>("/erp/staff");
  if (!data) return error && error.status !== 401 ? <ErrorCard offline={error.status === 0} onRetry={reload} /> : <ListSkeleton rows={4} />;
  const active = data.data.filter((m) => m.status !== "Relieved");
  return (
    <ExcelRoundTrip
      header={HEADER}
      keys={KEYS}
      dateKeys={["joiningDate", "dob"]}
      fileName="staff.csv"
      endpoint="/erp/staff/import"
      onDone={reload}
      intro={{
        hi: `सभी ${active.length} स्टाफ़ भरे हुए आएँगे। सुधारें, या नीचे नई लाइन में नया स्टाफ़ जोड़ें (Emp Code खाली छोड़ें तो अपने आप बनेगा)।`,
        en: `All ${active.length} staff come filled in. Correct them, or add new staff on new lines (leave Emp Code empty and one is made).`,
      }}
      rule={{ hi: "सैलरी इस फ़ाइल में नहीं है, वह सैलरी पेज से। खाली खाना पुरानी जानकारी नहीं मिटाता।", en: "Salary is not in this file; it stays on the Payroll page. An empty cell keeps what is saved." }}
      download={() =>
        active.map((m) => [m.empCode, m.name, m.staffType === "non_teaching" ? "Non-teaching" : "Teaching", m.designation, m.department, m.mobile, m.altMobile, m.email, m.qualification, dmy(m.joiningDate), m.gender, dmy(m.dob), m.address, m.experienceYears ?? ""])
      }
      toPreview={(r) => ({
        newCount: r.newCount,
        changedCount: r.changedCount,
        unchanged: r.unchanged,
        errorCount: r.errorCount,
        newItems: (r.newStaff || []).map((n: any) => ({ key: `${n.row}`, title: n.name, sub: n.code })),
        changes: (r.changes || []).map((c: any) => ({ key: c.code, title: `${c.name} · ${c.code}`, lines: c.fields })),
        errors: r.errors || [],
      })}
    />
  );
}
