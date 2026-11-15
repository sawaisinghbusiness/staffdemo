# Student profile 360: status

Claude builds the logic, then marks a row `ready-for-ui`. Codex polishes it and marks it `ui-done`.

| Part | Needs database change | Status |
|---|---|---|
| Scrollable tab strip (`ScrollTabs` in `components/ui.tsx`, plain working version) | no | ready-for-ui |
| Details, Fees, Documents, Gate passes (existing) | no | existing |
| Payments (`PaymentsTab`) | no | ready-for-ui |
| Attendance (`AttendanceTab`) | no | ready-for-ui |
| Results (`ResultsTab`) | no | ready-for-ui |
| Siblings (`SiblingsTab`) | no | ready-for-ui |
| Timetable (`TimetableTab`) | no | ready-for-ui |
| Ledger (`LedgerTab`) | no (later shows refunds/wallet) | ready-for-ui |
| SR register (`SrRegisterTab`, with print) | no | ready-for-ui |

The new tabs live in `components/erp/StudentProfileTabs.tsx`. Their data comes from the backend's new
`/api/student-profile/:id/{attendance,results,timetable,ledger,siblings}` (backend repo, not yet deployed).
| Remarks / follow-up (`RemarksTab kind="followup"`) | yes: `student_remarks` | ready-for-ui |
| Discipline (`RemarksTab kind="discipline"`) | yes: `student_remarks` | ready-for-ui |
| Edit history (`HistoryTab`) | yes: `audit_log` | ready-for-ui |
| Previous dues carry forward (`/erp/fees/carry-forward/`) | yes: `fee_ledger.opening_due` | ready-for-ui |
| Wallet / advance (`WalletTab`) | yes: `wallet_entries` | ready-for-ui |
| Refunds (`RefundsTab`) | yes: `fee_refunds` | ready-for-ui |
| Cheque clear / bounce (`/erp/fees/cheques/`) | yes: `fee_transactions.cheque_status` | ready-for-ui |

Database tabs live in `components/erp/StudentProfileOfficeTabs.tsx`. Until the SQL
(`sms backend/supabase/migrations/20261115_student_profile_360.sql`) is run they show a "needs database update" line.
The website ERP now opens the full profile page instead of the half-screen drawer.
| Pay with siblings | no | todo |
| Send payment link (WhatsApp) | no | todo |
| Call list | uses existing `call_logs` | todo |
| Data check | no | todo |
| Fee challan print | no | todo |

Not now (upcoming): Hostel, Inventory, Doubt timetable.
