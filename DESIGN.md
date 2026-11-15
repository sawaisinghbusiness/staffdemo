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


## ERP mode refinement - 15 November 2026

ERP mode now has a deliberately scoped .erp-interface system. Teacher personal screens retain the palette above; shared React appearance context carries ERP tokens through Sheet and StickyBar portals. Driver and official print documents remain separate.

- Solid mineral canvas #ECEEEB, white work surfaces, quiet shortcut fill #F8F8F5, navy #0D2A5E brand/action/focus, ink #242628, supporting #5E666D, divider #D5DAD5. Status and labelled chart category colours retain their meanings.
- ERP home uses one navy greeting masthead and a white continuous Today register. Task headers stay white with navy titles; this distinguishes orientation from dense operational work without introducing another brand.
- Page gutter16px, task top20px, content groups16px with20-24px between distinct sections. Surface radius14px, controls10px,44px minimum touch targets,48px ordinary field rows,16px inputs. Section titles17px and task titles18px; Plus Jakarta/Noto retained.
- Long labels/names wrap; compact status grids and multipart marks entries keep identity visible. Charts keep labelled categories; official prints keep document typography.
- Do not recolour .staff-home or .staff-workspace globally; the ERP context is the boundary. No repeated tile entrances are used on ERP home.


### Teacher task refinements

Teacher personal screens keep the approved cool canvas and homepage composition. Shared field entries use16px text and readable persistent labels; roll-call identity wraps alongside44px status targets, multipart marks labels wrap above flexible fields, homework deletion uses a44px hit area, and leave dates stack below400px. These are task usability corrections, not adoption of the ERP mineral theme.


## Operational primary-action refinement

Filled Save/Submit/Pay actions use shared evergreen #294E43; hover #203F36; pressed #18332B; disabled #D7DFD8/#43564C. Navy remains navigation/selection identity. ActionPalette React context scopes ordinary routes and portals; AI assistant and driver opt out. No global brand replacement. See the web repo docs/action-colour-2026-11-15/REPORT.md for comparison and verification.
