# MediConnect — Healthcare Appointment & Follow-up Manager

An end-to-end clinic platform with three portals — **Patient**, **Doctor**, and **Admin** — that handles booking, AI-generated pre/post-visit summaries, medication reminders, and synchronized notifications via **Email** and **Google Calendar**.

> Patients share symptoms before the visit, doctors get an AI-generated urgency brief instead of a blank form, and both sides get calendar events and emails that stay in sync through reschedules, cancellations, and doctor leave.

---

## ✨ Key Features

| Area | Capability |
|---|---|
| **Admin** | Create/manage doctor profiles — specialisation, working hours, slot duration, leave calendar |
| **Patient** | Register/login, search doctors by specialisation, book a slot, fill a pre-visit symptom form, view AI summary, view post-visit summary, get medication reminders |
| **Doctor** | View daily schedule, see AI pre-visit summary (urgency + chief complaint + suggested questions) before each visit, submit post-visit notes & prescription |
| **Scheduling** | Race-condition-safe slot booking, automatic conflict prevention, leave-day conflict detection with patient notification |
| **AI (LLM)** | Pre-visit symptom triage summary; post-visit clinical-notes-to-patient-friendly summary; graceful degradation on LLM failure |
| **Notifications** | Email (booking confirmation, reminder, cancellation, leave-conflict) + Google Calendar event create/update/delete, with retry queue |
| **Reminders** | Background job computes medication schedule from prescription frequency and sends timed reminders |

---

## 🏗️ Architecture

```
┌────────────┐     ┌────────────┐     ┌────────────┐
│  Patient   │     │   Doctor   │     │   Admin    │
│  Portal    │     │   Portal   │     │   Portal   │
│ (React)    │     │ (React)    │     │ (React)    │
└─────┬──────┘     └─────┬──────┘     └─────┬──────┘
      │                  │                  │
      └────────────┬─────┴─────┬────────────┘
                    │  REST API │
              ┌─────▼───────────▼─────┐
              │   Node.js / Express    │
              │  Role-based Auth (JWT) │
              └──┬───────┬───────┬─────┘
                 │       │       │
        ┌────────▼─┐ ┌───▼────┐ ┌▼─────────────┐
        │ PostgreSQL│ │  LLM   │ │ Job Queue     │
        │  (Prisma) │ │  API   │ │ (BullMQ/Redis)│
        └───────────┘ └────────┘ └──┬────────┬───┘
                                    │        │
                          ┌─────────▼──┐ ┌───▼───────────┐
                          │ Email (SMTP│ │ Google Calendar│
                          │ /SendGrid) │ │  API (OAuth2)  │
                          └────────────┘ └────────────────┘
```

**Stack**
- **Frontend:** React + Vite, React Router, TanStack Query, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **DB:** PostgreSQL + Prisma ORM
- **Auth:** JWT with role claims (`patient` / `doctor` / `admin`), bcrypt password hashing
- **Queue:** Redis + BullMQ for reminders, email retries, calendar sync retries
- **LLM:** Provider-agnostic client (Claude/OpenAI compatible) with prompt templates in `/server/llm/prompts`
- **Email:** Nodemailer (SMTP) — swappable adapter for SendGrid/Mailgun
- **Calendar:** Google Calendar API v3, OAuth 2.0 (offline access + refresh tokens)
- **Deployment:** Frontend on Vercel, Backend + Worker on Render/Railway, DB on Supabase/Neon, Redis on Upstash

---

## 🗄️ Database Schema (core tables)

```
User            (id, role[patient|doctor|admin], name, email, password_hash, phone, created_at)
DoctorProfile   (id, user_id → User, specialisation, slot_duration_min, working_hours_json, created_at)
DoctorLeave     (id, doctor_id → DoctorProfile, date, reason)
Appointment     (id, patient_id → User, doctor_id → DoctorProfile, slot_start, slot_end,
                 status[held|confirmed|cancelled|completed|leave_conflict],
                 google_event_id_patient, google_event_id_doctor, created_at)
SlotHold        (id, doctor_id, slot_start, slot_end, patient_id, expires_at)  -- short-lived lock
SymptomForm     (id, appointment_id → Appointment, symptoms_text, submitted_at)
PreVisitSummary (id, appointment_id → Appointment, urgency[Low|Medium|High], chief_complaint,
                 suggested_questions_json, raw_llm_response, generated_at)
VisitNote       (id, appointment_id → Appointment, clinical_notes, prescription_json, created_at)
PostVisitSummary(id, appointment_id → Appointment, summary_text, medication_schedule_json, generated_at)
MedicationReminder (id, appointment_id, medication_name, scheduled_at, sent, sent_at)
NotificationLog (id, appointment_id, channel[email|calendar], type, status[pending|sent|failed],
                 retry_count, last_error, updated_at)
GoogleOAuthToken(id, user_id → User, access_token, refresh_token, expiry)
```

Full DDL and Prisma schema: [`/server/prisma/schema.prisma`](./server/prisma/schema.prisma)

---

## 🔌 API Overview

```
Auth
POST   /api/auth/register              patient/doctor/admin signup
POST   /api/auth/login
POST   /api/auth/google/callback       OAuth2 redirect handler

Admin
POST   /api/admin/doctors              create doctor profile
PATCH  /api/admin/doctors/:id          update working hours / slot duration
POST   /api/admin/doctors/:id/leave    mark leave day → triggers conflict check

Patient
GET    /api/doctors?specialisation=    search doctors
GET    /api/doctors/:id/slots?date=    available slots (excludes held/booked/leave)
POST   /api/appointments/hold          place short-lived hold on a slot
POST   /api/appointments/confirm       confirm hold → booking + calendar + email
POST   /api/appointments/:id/symptoms  submit symptom form → triggers pre-visit LLM job
POST   /api/appointments/:id/cancel
GET    /api/appointments/:id/summary   post-visit summary (patient view)

Doctor
GET    /api/doctor/schedule?date=
GET    /api/appointments/:id/pre-visit-summary
POST   /api/appointments/:id/notes     clinical notes + prescription → triggers post-visit LLM job

Webhooks/Jobs (internal)
POST   /api/jobs/reminders/run         (cron trigger, also runs on schedule)
```

Full request/response contracts: [`/docs/API.md`](./docs/API.md)

---

## 🤖 LLM Prompts

**Pre-visit summary** (triggered on symptom form submit):
```
System: You are a clinical triage assistant. Be concise and never diagnose.
User: Analyse these symptoms and return JSON with: urgency level (Low / Medium / High),
chief complaint, and three suggested questions for the doctor. Symptoms: {symptoms_text}
```

**Post-visit summary** (triggered on doctor notes submit):
```
System: You are a patient-communication assistant. Use plain, reassuring language, 8th-grade reading level.
User: Convert these clinical notes into a patient-friendly summary with medication schedule
and follow-up steps: {clinical_notes} + {prescription_json}
```

**Failure handling:** every LLM call is wrapped with timeout (10s) + 2 retries (exponential backoff) + JSON-schema validation. On final failure the job marks the summary `status: failed`, the appointment proceeds normally, the doctor/patient sees a fallback message ("AI summary unavailable — please review symptoms/notes directly"), and an alert is logged to `NotificationLog` for ops visibility. **The booking flow never blocks on LLM availability.**

---

## ⚙️ Setup Guide

```bash
git clone https://github.com/<you>/mediconnect.git
cd mediconnect

# Backend
cd server && cp .env.example .env   # fill in secrets
npm install
npx prisma migrate dev
npm run dev

# Worker (reminders, email retries, calendar sync)
npm run worker

# Frontend
cd ../client && cp .env.example .env
npm install
npm run dev
```

### `.env.example` (server)
```
DATABASE_URL=postgresql://user:pass@localhost:5432/mediconnect
REDIS_URL=redis://localhost:6379
JWT_SECRET=change_me
LLM_API_KEY=
LLM_MODEL=claude-sonnet-5
EMAIL_PROVIDER=smtp
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:4000/api/auth/google/callback
APP_BASE_URL=http://localhost:5173
```

### Google Calendar Setup
1. Create a project in [Google Cloud Console](https://console.cloud.google.com/)
2. Enable **Google Calendar API**
3. Configure OAuth consent screen (external, add test users while unpublished)
4. Create OAuth 2.0 Client ID (Web application), add `GOOGLE_REDIRECT_URI` as an authorized redirect
5. On first login, patients/doctors are prompted to connect Google Calendar (`access_type=offline`, `prompt=consent` to guarantee a refresh token)
6. Store `refresh_token` encrypted in `GoogleOAuthToken`; use it to mint short-lived access tokens for event create/update/delete

---

## 📐 System Design Write-Up (≤800 words)

**Double-booking prevention.** Booking is a two-phase process: `hold → confirm`. When a patient selects a slot, the API attempts to insert a row into `SlotHold` with a unique constraint on `(doctor_id, slot_start)` and a 5-minute `expires_at`. Because the constraint is enforced at the database level (not in application code), two simultaneous requests for the same slot cannot both succeed — the second insert fails with a unique-violation and the API returns "slot no longer available" instantly. The hold is created inside a serializable transaction that also re-checks the slot isn't already `confirmed` or on a `DoctorLeave` day, closing the gap between check and insert. On successful hold, the client has 5 minutes to call `/confirm`, which atomically converts the hold into a `confirmed` Appointment and deletes the hold row in the same transaction. A background sweeper deletes expired, unconfirmed holds every minute, releasing the slot. This makes correctness independent of application-server concurrency — even multiple server instances behind a load balancer are safe, because the guarantee lives in Postgres, not in memory.

**Slot hold mechanism.** The hold is intentionally short (5 minutes, configurable) to prevent slot squatting while giving patients enough time to fill the symptom form before final confirmation. If a patient abandons the flow, the slot self-releases without any manual cleanup. The hold table is separate from the appointment table so that "tentative" state never pollutes doctor schedules or search results — `GET /doctors/:id/slots` excludes any slot with a live hold, a confirmed appointment, or a leave day, computed via one indexed query rather than three round trips.

**Doctor leave conflict handling.** When an admin marks a `DoctorLeave` row for a date, the API synchronously queries all `confirmed` appointments for that doctor on that date. For each affected appointment: (1) status is set to `leave_conflict`, (2) a rebooking token is generated so the patient can pick a new slot with one click, (3) an email is queued immediately (not batched) explaining the conflict and linking to rebooking, and (4) the corresponding Google Calendar events (both patient's and doctor's) are queued for deletion. This is done inside the same transaction that inserts the leave row, so a doctor can never end up "on leave" with silently-orphaned bookings — the conflict resolution is atomic with the leave creation, not a best-effort background sweep. If the notification step fails (email/calendar), the appointment status change still commits; the failure is captured in `NotificationLog` and retried by the worker, so patients are never left in limbo waiting on a notification service that might be down.

**Notification failure handling.** All outbound side effects (email send, calendar create/update/delete) are modeled as jobs in `NotificationLog` with `status: pending`, not as direct synchronous calls inside the request path. The API request that triggers a notification (booking confirm, cancel, leave conflict, reminder) only needs to enqueue the job — the user-facing response returns immediately regardless of whether the email/calendar provider is currently reachable. A BullMQ worker consumes the queue with exponential backoff (1m, 5m, 30m, 2h, capped at 5 attempts), and each attempt updates `retry_count` and `last_error`. After exhausting retries, the job is marked `status: failed` and surfaced on the Admin dashboard's "Notification Failures" panel so staff can manually follow up (e.g., call the patient) rather than the failure disappearing silently. Idempotency keys (appointment ID + notification type) prevent duplicate emails or duplicate calendar events on retry. Google Calendar events store the returned `event_id` on the Appointment row so subsequent update/delete calls target the exact event rather than re-searching, and if a calendar write fails after an email succeeded (or vice versa), each channel retries independently — the two are not coupled into one all-or-nothing operation.

**LLM resilience.** Both LLM calls (pre-visit, post-visit) run as background jobs, never inline with the user-facing request that triggers them (symptom submit, notes submit). This means a slow or down LLM provider never blocks the doctor from seeing the patient's raw symptoms, or the patient from seeing raw clinical notes — the AI summary simply appears asynchronously once ready, with a "generating…" or "unavailable" state in the UI, keeping the core clinical workflow independent of a third-party AI dependency.

---

## 📦 Deliverables Checklist

- [x] Source code (`/client`, `/server`, `/worker`)
- [x] README with setup, `.env.example`, API docs, DB schema, LLM prompts, Google Calendar setup
- [ ] Hosted URL (deploy target: Vercel + Render/Railway + Neon + Upstash)
- [x] System design write-up (above)

---

## 📄 License
MIT