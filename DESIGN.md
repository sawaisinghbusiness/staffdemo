# Staff app interface

The approved teacher homepage in components/StaffHome.tsx is the visual authority. Extend its identity to operating screens; preserve its composition.

- Plus Jakarta Sans Variable for Latin, Noto Sans Devanagari Variable for Hindi. One family vocabulary across headings, forms, tables and chat; no separate display font for names or send controls.
- Ink #242628, secondary #666A6E, navy action #0D2A5E, divider #DCE4ED, page #F7F9FC, white work surfaces. Brand colour identifies actions and selection; green/red/amber carry actual states.
- Compact centered18px page title;17px section title;14-16px body/control scale. Keep readable Hindi line height.
- Task surfaces use14px corners and1px dividers; fields/buttons10px corners. No ornamental glass, teal haze, gradient send buttons or arbitrary rainbow panels. The approved home photo and illustrations remain context-specific.
- Flat white bottom navigation and navy current-state line for staff and ERP modes. Driver live-trip interface keeps its existing safety-oriented treatment.
- Forms group related fields on one surface; narrow-phone selectors stack. Attendance and marks use continuous registers, stable identity and reachable actions. Numeric values align and use tabular numerals.
- Sheets and side menu trap/restore focus, handle topmost Escape and keep nested scroll locks. Save bars sit above the actual64px navigation.
- Errors stop loading and offer recovery; never replace a failed count with zero or hide failed saves. Retain bilingual content and permission behavior.
- Printed ID cards, certificates and official school documents retain their own typography/layout.

Operate mode: teachers use the app between classes, often on a small phone in bright ambient light. Light surfaces, clear contrast and task-specific hierarchy serve that setting. Existing viewport scale is user-pinned and preserved.

Verification uses strict CSS-width browser captures plus the existing opt-in demo mode, isolated from live backend writes. Synthetic evidence lives in docs/staff-ui-review. The mechanical detector's Plus Jakarta warning is accepted because the user explicitly requires the approved homepage typography.
