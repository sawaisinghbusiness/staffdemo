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


## Driver working interface

Driver is scoped by .drv and .driver-shell; app/driver-interface.css owns warm canvas #F5F6F2, border #D8DED7, green #0C7158, secondary text #59665E, yellow #FFCB00 start and black task controls. Keep Inter/Noto, 16px gutters, 14px surfaces and 48-52px task controls. Personal salary/attendance/leave/notices inherit driver tokens; other roles stay unchanged. Trip owns its viewport: no general header or bottom navigation above task controls. Identity must resolve from server before role chrome; active trip state must not hydrate from persisted cache. See web docs/driver-review-2026-11-15/REPORT.md for research, implemented flow fixes, screenshots and verification limits. No assistant changes.

### Driver detail refinement — Charles review

Driver Home keeps its departure sheet and existing green/yellow identity. Language, notifications and profile use 44px touch areas; map controls use 48px. One destination is visually current in driver navigation. Caption/support/body/section tokens are 12/14/16/20px; route titles and journey times keep their approved emphasis. Type overrides are scoped to .drv.

Use one history date-content transition rather than nested record entrances or a route entrance on every driver page. Press/disclosure/page/settling motion has named tokens; reduced motion covers driver chrome too. A stop-alert ripple runs once; automatic/manual closing stays user-controlled. Swipe invokes the action promptly, delays pending indication by 300ms and shows acceptance only after the callback succeeds. Preserve the local hold and feedback implementation. Long origin/destination names wrap in trip details; recovery instructions distinguish unavailable phone location from failed delivery to school. No assistant changes.

Evidence and implementation details: web repository docs/driver-charles-audit-2026-11-15/IMPLEMENTATION.md.


## Operating-screen review — Charles skills, 15 November 2026

Preserve the approved homepage composition and assistant visuals. Continue evergreen ordinary actions, navy navigation, white work surfaces, dark text and outlined status labels with a trailing semantic dot. Fee allocation has a separate outline; it must not look like a paid receipt.

Shared selectors support keyboard focus and wrap long values. Keep persistent form labels, 44px targeted actions and reachable save controls. Bottom-navigation text can wrap; do not force enlarged labels into a fixed-height row. Personal leave belongs to Profile; student leave requests belong to Home. Planned modules follow working modules.

Failures must not masquerade as empty results, zero balances or offline diagnosis. Show when a saved resource could not refresh, await real retry promises and update manual message status only after the operator confirms and the API accepts it. Editors prompt before discarding changes; marks have memory-only recovery across soft navigation, cleared on sign-out. These guards are not a persistent-draft backend.

Evidence: desktop repo docs/apps-charles-audit-2026-11-15/IMPLEMENTATION.md and implementation-browser/. All review API traffic is synthetic.



## Current approved ERP colour authority — Ink + Oxide (16 November 2026)
This section supersedes earlier neutral/evergreen/Petrol colour instructions. app/erp-colours.css is the shared ERP-only role authority. Canvas #EEF1F5, paper #FFFFFF, ink #202938, support #536071, divider #D6DDE6, field boundary #7B8C99. Navigation #242D3C with #F1F4F8 text; selected white row, dark label, oxide icon. Primary #A43F20, hover #87341B, pressed #6D2916; ordinary headings and links stay dark. Collected #15803D and due #B42332 retain financial meaning. Status badges remain white, dark labels, outlined, trailing semantic dot. Keep existing typography and workflow compositions. Excludes assistant, personal staff, parents, driver and official print surfaces.
ERP-app fee instalments show a horizontally sliding deck with the next card visibly peeking at the right, native horizontal snap/swipe, arrow/keyboard navigation and position. Initial card is first outstanding instalment; browsing never changes payment allocation. Honour reduced motion and mark the carousel data-swipe to exclude sidebar gestures.
