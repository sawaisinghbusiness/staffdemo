# Codex prompt: Student profile 360 (UI polish)

Paste everything below the line into Codex.

---

You are working in the **staff app** repo (`C:\Users\ADMIN\Desktop\folder for staff app erp project`, Next.js 14, Tailwind). Claude is building a set of new features for the **ERP student profile** (`app/(app)/erp/students/detail/page.tsx`). **Claude owns the functionality** (data, API calls, logic, states). **You own the UI**: layout, spacing, typography, colour, motion and accessibility of these screens. Do not change what the screens do, which API they call, or the data they show.

## Ground rules

1. **Never rewrite Claude's logic.** Only change markup structure, class names and CSS when that does not change behaviour. If something looks functionally wrong, write it in `docs/student-profile-360/UI_NOTES.md` instead of fixing it.
2. **Work only on tabs marked `ready-for-ui`** in `docs/student-profile-360/STATUS.md`. Claude marks a tab ready when its logic is done. When you finish one, change it to `ui-done` in the same file.
3. **Before every edit, run `git diff` on the file.** Claude may have changed it since you last read it. Never undo changes you did not make.
4. **Do not touch:** `lib/api.ts`, `lib/erpMode.ts`, anything under `app/(app)/trip`, `components/driver`, the backend repo, or database files.
5. The website ERP (`f:\folders of web\SMS BARMER`) copies these screens with `scripts/sync-erp-workflows.cjs`. Edit only the staff app source; never edit `components/parity/generated/**` by hand.
6. Keep the existing ERP look: `.erp-interface` tokens in `app/erp-interface.css` (`--erp-brand`, `--erp-canvas`, `--erp-line`, `--erp-muted`, `--erp-pressed`). One colour system: navy/white/grey-blue, colour only for status (green paid, amber due, red overdue/bounced). No gradients, no new fonts.
7. Hindi and English: every visible string goes through `L({ hi, en })`. Hindi text is often 30% longer; test both.
8. Phone first (360px wide), then the website ERP at desktop width.
9. Run `npx tsc --noEmit -p .` before you say a tab is done.
10. **Website ERP student profile: keep its design exactly.** On the website (`components/students/StudentDrawer.tsx`) the profile is the full-width drawer with Edit at the top right, the student card (school, "Active student", photo, admission no., date of birth, family & contact details), then the grey segmented tabs where the picked tab has a white background, then white boxed sections. The owner wants this look kept. The new tabs sit after "Gate passes" in that same segmented strip (it scrolls sideways). Do not move Edit, do not replace the card or the segmented tabs, and do not open the profile as a separate page.

## 1. The scrollable tab strip (start here)

Today the profile has 4 equal-width tabs (`LineTabs` in `components/ui.tsx`: Details, Fees, Gate passes, Documents). It is growing to about 16 tabs, so it must become a **horizontally scrollable strip**:

- Tabs size to their text (no equal widths), with about 20px horizontal padding and at least 44px tall.
- The strip scrolls sideways with a finger or trackpad, with no visible scrollbar, and keeps scroll snapping light (`scroll-snap-type: x proximity`).
- The underline bar slides to the selected tab (measure the selected button's `offsetLeft` and `offsetWidth`; transition `transform` and `width` about 250ms, `cubic-bezier(.32,.72,0,1)`).
- When a tab is selected, scroll it into view, centred if possible (`scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" })`, instant when reduced motion is on).
- A soft fade on the left/right edge only while there is more to scroll that way.
- Keyboard: Left/Right arrows move between tabs (roving `tabIndex`), Home/End jump to the first/last.
- Claude has already added a plain working `ScrollTabs` in `components/ui.tsx` (same props as `LineTabs`) and the profile uses it. Polish that component; keep its props, keyboard handling and `scrollIntoView` behaviour. `LineTabs` stays as it is for the other screens.
- The new tab panels are in `components/erp/StudentProfileTabs.tsx` (Payments, Ledger, Attendance, Results, Siblings, Timetable, SR register). They are written plainly on purpose; making them look right is your job.
- Switching tabs: the panel below cross-fades with a small slide from the side of the tab you moved to (about 220ms). No skeleton flash when data is cached.

## 2. Tab order (Claude decides content, you decide look)

Details · Fees · Ledger · Payments · Wallet · Refunds · Concessions & fines · Attendance · Results · Siblings · Remarks · Discipline · Documents · Gate passes · SR register · Timetable · Edit history

Tabs the signed-in role cannot use are hidden by Claude (for example Wallet and Refunds for teachers).

## 3. What each tab shows (so you know the content shape)

| Tab | Content |
|---|---|
| Fees | Total, paid, due, overdue-till-today, due-this-month cards; progress bar; instalments with paid/due/overdue status; previous-session dues line; buttons: Collect fee, Send payment link, Pay with siblings |
| Ledger | Date-ordered list of every debit and credit (fee charged, concession, fine, payment, refund, wallet in/out, carried-forward dues) with a running balance |
| Payments | Receipts: number, date, amount, mode, cheque status chip (pending / cleared / bounced), cancelled ones struck through, reprint button |
| Wallet | Balance at the top; entries (added from extra payment, used for a fee, refunded); "Use for next fee" action |
| Refunds | List with amount, mode, date, reason, by whom; "Record refund" form |
| Concessions & fines | Current concession type and amount; fines charged, paid and waived (with waive reason) |
| Attendance | Month grid (P/A/L/half day) with month switcher and this-session percentage |
| Results | One card per exam with subject marks, total, percentage, grade; "Open report card" |
| Siblings | Linked brothers/sisters with class and fee due; tap to open their profile |
| Remarks | Follow-up notes (call made, promise to pay on a date) with next follow-up date |
| Discipline | Incidents with date, category, severity, action taken |
| SR register | The student's Scholar Register entry as it prints (admission date, class admitted, date of leaving, TC) and a print button |
| Edit history | Who changed what and when (field, old → new), newest first |

## 4. Other screens Claude is adding (polish when marked ready)

- **Unclear payments**: cheques waiting to clear, with Clear / Bounced actions.
- **Call list**: students with dues, phone button, call outcome and next follow-up.
- **Session close / carry forward**: preview of dues moving to the next session, then confirm.
- **Data check**: students with missing details (no mobile, no DOB, no Aadhaar), grouped by class.
- **Fee challan print** and **SR register print** (A4, black on white).

## 5. Done means

- Both languages, 360px phone and desktop, keyboard and screen-reader labels checked.
- `npx tsc --noEmit -p .` passes.
- `STATUS.md` updated, and anything functional you noticed is written in `UI_NOTES.md`.
