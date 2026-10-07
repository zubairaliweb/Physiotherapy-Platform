# MoveWell Physiotherapy

A physiotherapy clinic website and management platform for Dr. Kifayat Khan's Islamabad clinic. It includes a public website, appointment requests, clinic content management, staff administration, exercise programs, packages and manual payment records, patient portal, and analytics.

## Project structure

- `frontend/` — React, Vite, React Router, public clinic pages, staff console, and patient portal.
- `backend/` — Express API, MongoDB/Mongoose models, authentication, validation, uploads, and API routes.
- `.env.example` — Root environment configuration template. Keep real credentials in the ignored root `.env` file.

## Requirements and setup

Use Node.js 20 or newer and a reachable MongoDB instance (local or hosted).

1. Copy `.env.example` to `.env`. Configure `MONGODB_URI`, clinic contact settings, and `JWT_SECRET` (at least 32 random characters). `CLINIC_TIME_ZONE` and `VITE_CLINIC_TIME_ZONE` should match the clinic location.
2. Install dependencies from the project root: `npm install`, `npm install --prefix frontend`, and `npm install --prefix backend`.
3. Set `ADMIN_EMAIL` and a unique `ADMIN_PASSWORD` of at least 14 characters in `.env`; start MongoDB and run `npm run create-admin` once. The command refuses to add a second admin. Remove `ADMIN_PASSWORD` from `.env` after setup.
4. Start the app with `npm run dev`. The website is at `http://localhost:5173`, the API at `http://localhost:4000`, and staff sign-in at `http://localhost:5173/admin/login`.
5. For production, serve the frontend and API on one HTTPS site where possible. Set `CLIENT_URL` to the website origin and `VITE_API_URL` to the API base ending in `/api` before building. Deploy `frontend/dist` and the Node backend, and use persistent storage for uploaded files.

## Implemented features

- Public home, services, therapist profile, clinic location/contact, social links, video library, and appointment/contact forms.
- Staff authentication, dashboard, appointment management, patient records, therapist and service management, and clinic settings.
- Exercise program creation/assignment and patient-facing exercise instructions.
- Clinic package catalog, patient package enrollment, session tracking, payment records, and revenue/status analytics. Payments are recorded by clinic staff; no live card checkout is enabled until a gateway and its credentials are configured.
- Patient accounts created through single-use, 48-hour invitation links. The portal provides appointment history, exercise programs, packages, payment records, private documents, notifications, profile contact updates, and secure messages.
- Admin analytics for appointment outcomes, patient counts, services, and recorded revenue.

## Accounts, access, and privacy

There is no public patient registration. An admin adds a patient email, creates an invitation in the staff Portal page, and securely shares the one-time link. Patients choose a password of at least 14 characters. Admin/staff and patient sessions use separate HttpOnly cookies and protected routes. Patient APIs scope records to the signed-in patient's own record. Do not place card data or payment credentials in this application.

Patient documents accept PDF, JPEG, or PNG up to 20 MB and are stored privately in `backend/uploads/patient-documents`; clinic videos accept MP4, WebM, or Ogg up to 100 MB in `backend/uploads/videos`. These directories are not served as public static files. Back them up and attach persistent storage in production because temporary host disks can be cleared on restart or redeploy.

## MongoDB Atlas DNS troubleshooting

If startup reports `querySrv ECONNREFUSED _mongodb._tcp...`, the configured DNS resolver may be refusing Atlas SRV lookups. Try `MONGODB_DNS_SERVERS=8.8.8.8` (or a resolver permitted by your network) in `.env`, then restart the API. Alternatively, copy Atlas's standard `mongodb://` connection string from Connect → Drivers with the SRV option disabled. This override affects only the Node process.

If Express runs behind a reverse proxy, set `TRUST_PROXY_HOPS` to the exact number of trusted proxies. Leave it at `0` for direct connections.
