# Staff personal and communication screens

Reviewed profile, own attendance, salary, leave/application, notices, parent enquiries/chat, assistant, six me/* redirect routes and driver trip/history. The new StaffHome is visual authority.

## Changes

- Neutral bordered message rows, navy class filters with44px touch targets, lighter timestamps and longer useful message previews. Chat bubbles no longer have heavy black outlines.
- Salary slips use consistent type weight, quiet ruled breakdowns and tabular amounts.
- Profile groups use natural-case14px headings, consistent border/corner tokens and navy avatar tint.
- Leave application has a visible textarea label, date-presence validation and a continuous form surface. Withdrawal failures are recoverable instead of silently swallowed; duplicate taps are blocked while withdrawing.
- Attendance calendar legend wraps; joined white totals use semantic text. Leave fill is dark enough for white day numbers.
- Assistant uses the same navy/neutral palette. Purple radial decorations and shimmering gradient text were removed. Questions sit near the greeting rather than below a decorative blank area. Owl identity remains small beside the greeting. Hindi greeting and existing Hindi copy remain supported.
- Driver live map/trip controls were inspected and preserved as a specialized safety surface. Legacy me/* routes continue redirecting to canonical screens.

## Visual evidence

All captures use the app's local demo mode, not live school data. personal-review contains8routes; personal-final contains5routes after shared styles; personal-hindi contains3Hindi routes; all recorded zero document overflow at390px. personal-assistant-final supersedes earlier assistant spacing. Images were visually inspected for the calendar, messages, salary, profile, form and assistant.

These checks do not certify production salary data, message delivery, GPS routing or leave approvals against a live backend. Root integration owns full TypeScript/build and shared navigation checks.
