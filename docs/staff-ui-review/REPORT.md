# Staff app UI review and implementation

The approved teacher homepage is the design authority. This pass extends its Plus Jakarta Sans / Noto Sans Devanagari typography, navy actions, neutral ink and light paper surfaces to the app's task screens. The homepage composition was preserved.

## What changed

- Shared controls: one font vocabulary; consistent fields, buttons, tabs, borders, calendar surfaces, save bars and neutral avatar tints. Removed old teal haze, ornamental glass, gradient-green send buttons and unrelated purple assistant treatment. Staff and ERP modes share the flat navy/white navigation.
- Teaching: continuous attendance roster; full-width selectors on narrow phones; homework and teacher-note forms grouped by task; student search context; marks identity stays readable with multipart inputs underneath and invalid-value feedback.
- Personal work: coherent profile groups, salary breakdowns, leave forms/statuses, calendar legends, notice lists, parent enquiries and chat. Failed withdrawal/deletion actions show recovery feedback. Assistant greeting/questions are grouped without a decorative blank area.
- ERP mode: quieter fee summaries, mobile marks register, task-focused payroll/staff rows,44px attendance status targets, collapsed official print preview, explicit ID-card Front/Back controls, readable small-value collection chart, honest unavailable counts and failed-report recovery.
- Shared behavior: sheets/menu trap and restore focus, topmost Escape and nested scroll locks. Floating assistant clears save controls by16px at rest.

## Coverage and evidence

[Open screenshot gallery](gallery.html). [Route-by-route inventory](route-coverage.md) covers88 authenticated app route files, including62 ERP routes and legacy redirects. The inventory distinguishes page-specific edits, shared-system inheritance and preserved role-specific surfaces. It is not a claim that every backend action was tested.

Phone evidence includes16 principal staff screens,10 representative populated ERP screens, narrow360CSSpx teacher checks and Hindi personal-screen checks. Desktop browser emulation at phone CSS widths avoids confusing the existing user-pinned0.88 viewport scale with genuine horizontal overflow. Browser contexts isolate staff demo storage from ERP review storage. One blank cold-load ERP fee capture was rejected and replaced with its populated recapture.

Three subagents reviewed teaching, personal/communication and ERP areas. Independent shared review found an unintended16px gap on full-screen chats; fixed by scoping task-page padding. It then verified real menu and sheet keyboard behavior, plus the marks save-bar/assistant geometry.

## Validation

The final production build ran with NEXT_PUBLIC_DEMO=0 and generated92 pages successfully, including Next's supporting routes. TypeScript checks passed. Mechanical design review returned only a font-popularity warning for Plus Jakarta Sans; this is intentionally retained because the user explicitly requires the approved homepage typography.

## Limits

All visual checks use local demo/synthetic data. They do not certify live payroll posting, leave approval, payment verification, message delivery or GPS operation. Driver trip/map controls and official print documents retain their specialized interfaces. API contracts and role access remain existing behavior. Screenshots should not be treated as production financial records.

This report accompanies the staff-app redesign changes submitted to version control.
