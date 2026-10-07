# Staff app (demo)

Phone app for school staff: teachers mark attendance, give homework and enter marks;
every staff member (teacher, driver, attendant) sees their own attendance, salary slips and leave.

**Demo mode is on.** No backend is needed: it runs on sample data kept in the browser.
Sign in with any 10-digit mobile number and the code `123456`, and pick a role on the sign-in screen.

## Run

```
npm install
npm run dev        # http://localhost:3300
```

## Deploy (Vercel)

Import the repo; no settings are needed for the demo.

To switch to the real backend later, set `NEXT_PUBLIC_DEMO=0` and `BACKEND_URL=<backend address>`
in Vercel's environment variables and redeploy. The app then calls `/api/staff-app/*`, which is
forwarded to the backend (those routes are not written yet).
