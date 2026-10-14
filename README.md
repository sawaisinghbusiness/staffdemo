# Staff app

Phone app for school staff: teachers mark attendance, give homework and enter marks;
every staff member (teacher, driver, attendant) sees their own attendance, salary slips and leave.

It runs on the real backend (`/api/staff-app/*`), so everything it saves is the same data the ERP
shows: class attendance, marks, homework, student leave, staff leave, salary slips and the timetable.
Staff sign in with the mobile number on their ERP staff record and a WhatsApp code. A teacher sees
only the classes given to them in ERP Staff → Assignments.

## Run

```
npm install
npm run dev        # http://localhost:3300 (calls the backend at http://localhost:4000)
```

For local testing, start the backend with `STAFF_DEMO_LOGIN=1`: every staff number then signs in
with `123456` (never in real use).

## Deploy (Vercel)

Set `BACKEND_URL=<backend address>` in Vercel's environment variables (without it the built-in live
backend is used) and add the site's address to the backend's `CORS_ORIGINS`.

**Demo mode** (sample data kept in the browser, no backend, any number + `123456`, a role picker on
the sign-in screen): set `NEXT_PUBLIC_DEMO=1` and redeploy.
