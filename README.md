# Obsidian Tint Studio — Car Window Tint Shop Platform

A full-stack website and business system for an automotive window tint shop: a premium marketing site, instant quote calculator, live online booking, Stripe checkout with deposits, customer accounts, and an admin dashboard for running the shop.

> “Obsidian Tint Studio” and everything created by the seed script (customers, appointments, reviews, gallery photos in `public/images/demo`) is **demo content**. Change the business details in **Admin → Settings** and replace the content from the admin dashboard before launch.

---

## Contents

- [Features](#features)
- [Technology stack](#technology-stack)
- [Quick start (local development)](#quick-start-local-development)
- [Environment variables](#environment-variables)
- [Database, migrations and seed data](#database-migrations-and-seed-data)
- [Demo accounts](#demo-accounts)
- [Authentication setup (incl. Google)](#authentication-setup)
- [Stripe setup](#stripe-setup)
- [Email setup (Resend)](#email-setup-resend)
- [SMS (optional, Twilio)](#sms-optional-twilio)
- [Image storage setup](#image-storage-setup)
- [Production deployment (Vercel + Neon/Supabase)](#production-deployment)
- [Admin account setup in production](#admin-account-setup-in-production)
- [Project structure](#project-structure)
- [How pricing works](#how-pricing-works)
- [How booking availability works](#how-booking-availability-works)
- [Homepage film](#homepage-film)
- [Security notes](#security-notes)
- [Scripts](#scripts)

---

## Features

**Public website**
- Homepage with hero, services, “why choose us”, draggable before/after slider, interactive tint-percentage comparison (5–70%), packages, gallery, reviews, FAQ and final CTA
- Services list and a detail page per service (benefits, film types, price table, install time, warranty, FAQ, structured data)
- Window Tint education page, Pricing page, Gallery with category filters and full-screen viewer, About, Reviews (with “Leave a review”), FAQ, Contact (form, map, hours), legal pages
- Sticky header, mobile menu and a sticky mobile “Book Now” bar

**Conversion flows**
- **Quote calculator** (8 steps): vehicle type → size → service/coverage → film → shade → live estimate (+ add-ons) → contact details → request quote / book / pay deposit
- **Booking wizard**: service → vehicle → options → live availability (business hours, holidays, breaks, buffers, technicians, minimum notice) → details → review & pay (deposit, full or pay at shop)
- **Checkout**: order summary with subtotal, discount, tax, deposit and total; promo codes validated on the server; Stripe Checkout (or a clearly-labelled demo gateway in development)
- Confirmation page, `.ics` calendar download, guest “manage booking” link (reschedule, cancel with automatic refunds, pay balance, leave review)

**Customer dashboard** — overview, upcoming/past appointments, quotes, payments & printable receipts, saved vehicles, profile & notification preferences, notifications

**Admin dashboard** (role-based)
- KPIs (today, upcoming, revenue, pending quotes, new customers, completed/cancelled, recent payments) and charts (revenue, appointments, popular services, customer growth)
- Appointments: list + **day / week / month calendar**, create, edit, reschedule, assign technician, status changes (confirm, in progress, complete, no-show, cancel + refund), internal notes, manual payments
- Quotes (statuses, notes, send response, convert to appointment), customers (search, history, notes, guest bookings), contact messages, payments
- Services (CRUD, options/add-ons, FAQs, images), **pricing** (price grid by vehicle × film, sizes, films, packages, advanced rules), gallery (upload, before/after, categories, featured, reorder), reviews (approve/reject/edit/feature/delete), coupons, technicians (skills, hours, time off), business hours/holidays/breaks/booking rules, settings, staff accounts

**Platform** — Email + in-app notifications (SMS-ready), hourly reminder cron, SEO (metadata, canonical URLs, Open Graph image, LocalBusiness/Service/FAQ/Breadcrumb schema, sitemap, robots), PWA (manifest, icons, service worker, offline page), analytics events, loading/empty/error states.

## Technology stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Components, Server Actions, Turbopack), React 19, TypeScript (strict) |
| UI | Tailwind CSS 4, Radix UI primitives (shadcn/ui-style components in `src/components/ui`), Lucide icons, CSS + IntersectionObserver animations (no animation runtime shipped), Sonner toasts, Recharts |
| Forms | React Hook Form + Zod (the same schemas validate again on the server) |
| Database | PostgreSQL + Prisma 7 (`@prisma/adapter-pg`) |
| Auth | Auth.js v5 (email/password with bcrypt, optional Google), JWT sessions, roles `CUSTOMER`, `STAFF`, `ADMIN`, `SUPER_ADMIN` |
| Payments | Stripe Checkout + signed webhooks |
| Email | Resend HTTP API |
| Storage | Local (dev), Cloudinary or any S3-compatible bucket |
| SMS | Twilio (optional) |
| Hosting | Vercel + Neon/Supabase |

## Quick start (local development)

Requirements: **Node.js 20.9+** and PostgreSQL (Docker *or* the bundled embedded Postgres).

```bash
# 1. Install dependencies
npm install

# 2. Create your env file
cp .env.example .env
#    then set NEXTAUTH_SECRET:   openssl rand -base64 32
#    and the SEED_* demo passwords

# 3. Start PostgreSQL — choose ONE:
docker compose up -d          # Docker, port 5432 (matches .env.example)
npm run db:local              # no Docker: embedded Postgres on port 5433, data in ./.pgdata
                              #   → set DATABASE_URL to ...@localhost:5433/... and keep this terminal open

# 4. Create the tables and load demo data
npx prisma migrate deploy     # or: npm run db:migrate (dev, creates new migrations when the schema changes)
npm run db:seed

# 5. Run the app
npm run dev                   # http://localhost:3000
```

Without Stripe keys and with `ALLOW_DEMO_PAYMENTS="true"`, checkout uses a **demo gateway** (development only) so you can test the whole booking → payment → confirmation flow. Without an email key, emails are recorded as “skipped” in **Admin → Notifications → Email & SMS log** instead of being sent.

## Environment variables

All variables are documented in [`.env.example`](.env.example). Only `NEXT_PUBLIC_*` variables reach the browser.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string (Neon/Supabase: pooled URL) |
| `SHADOW_DATABASE_URL` | – | Only if your host needs a shadow DB for `prisma migrate dev` |
| `NEXTAUTH_SECRET` | ✅ | Signs session tokens (`openssl rand -base64 32`). `AUTH_SECRET` also works |
| `NEXTAUTH_URL` | ✅ | Public base URL, e.g. `https://yourdomain.com` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | – | Enables “Continue with Google” (button hidden when unset) |
| `STRIPE_SECRET_KEY` | prod | Server-side Stripe key |
| `STRIPE_PUBLISHABLE_KEY` | – | Reserved for client-side Stripe features (Checkout doesn’t need it) |
| `STRIPE_WEBHOOK_SECRET` | prod | Verifies webhook signatures |
| `ALLOW_DEMO_PAYMENTS` | dev | `"true"` enables the simulated gateway when Stripe isn’t configured. Ignored in production |
| `EMAIL_API_KEY` / `EMAIL_FROM` | prod | Resend API key and verified sender, e.g. `Your Shop <bookings@yourdomain.com>` |
| `ADMIN_NOTIFICATION_EMAIL` | – | Where admin alerts go (defaults to the business email in settings) |
| `STORAGE_PROVIDER` | prod | `local` (dev only), `cloudinary` or `s3` |
| `STORAGE_API_KEY` / `STORAGE_SECRET` / `STORAGE_BUCKET` | prod | Cloudinary: API key / API secret / cloud name. S3: access key / secret / bucket |
| `STORAGE_ENDPOINT` / `STORAGE_REGION` / `STORAGE_PUBLIC_URL` | S3 | S3-compatible endpoint (R2/B2/…), region and the public URL of the bucket/CDN |
| `SMS_PROVIDER`, `TWILIO_*` | – | `twilio` + credentials to send SMS to customers who opted in |
| `CRON_SECRET` | prod | Protects `/api/cron/reminders` (Vercel Cron sends it automatically) |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Canonical site URL for links, sitemap and Open Graph |
| `NEXT_PUBLIC_ANALYTICS_ID` | – | Google Analytics 4 measurement ID (`G-…`) |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | dev | Demo admin account created by the seed |
| `SEED_CUSTOMER_EMAIL` / `SEED_CUSTOMER_PASSWORD` | dev | Demo customer account created by the seed |

**Integration status** is visible (without secrets) in **Admin → Settings → Integrations**.

## Database, migrations and seed data

```bash
npm run db:migrate     # prisma migrate dev — create/apply migrations while developing
npm run db:deploy      # prisma migrate deploy — apply migrations in production/CI
npm run db:seed        # full DEMO dataset (WIPES existing data; refuses to run in production)
SEED_MODE=catalog npm run db:seed   # only settings, services, films, prices, hours, FAQs, legal pages (safe upserts, no demo people)
npm run db:reset       # drop, re-migrate and re-seed (development)
npm run db:studio      # browse the data in Prisma Studio
```

The demo seed creates services, films, the full price list, packages, three technicians with schedules, business hours/holidays, ~25 customers with vehicles, ~110 appointments over the last 4 months and next 3 weeks with payments, quotes, contact messages, reviews, gallery photos, coupons (`WELCOME10`, `SAVE50`, `CERAMIC15`) and notifications. Demo users have `isDemo = true` and `@example.com` emails.

## Demo accounts

Created by `npm run db:seed` (development only):

| Role | Email | Password |
| --- | --- | --- |
| Super admin | `admin@example.com` (or `SEED_ADMIN_EMAIL`) | `SEED_ADMIN_PASSWORD` from `.env` |
| Admin | `manager@example.com` | `SEED_ADMIN_PASSWORD` |
| Staff | `staff@example.com` | `SEED_ADMIN_PASSWORD` |
| Customer | `customer@example.com` (or `SEED_CUSTOMER_EMAIL`) | `SEED_CUSTOMER_PASSWORD` |

**Changing the demo credentials:** edit the `SEED_*` values in `.env` and run `npm run db:seed` again, or sign in and change the password under **My account → Profile**. Passwords are never hard-coded; the seed refuses to create demo accounts when `NODE_ENV=production`.

## Authentication setup

- Email/password works out of the box (bcrypt hashes, rate-limited sign-in, password reset by email).
- **Google sign-in:** in Google Cloud Console create an OAuth client (type *Web application*), add the redirect URI `https://YOUR_DOMAIN/api/auth/callback/google` (and `http://localhost:3000/api/auth/callback/google` for development), then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
- Roles & permissions live in `src/lib/auth/roles.ts`. `/admin` and `/dashboard` are protected by `src/proxy.ts`, and every page and server action re-checks the user and permission against the database.
- In development, the password-reset link is printed to the server console when email isn’t configured.

## Stripe setup

1. Create a Stripe account and copy the **secret key** into `STRIPE_SECRET_KEY` (use `sk_test_…` while testing).
2. Add a webhook endpoint at `https://YOUR_DOMAIN/api/stripe/webhook` listening to:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
   Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
3. Local testing with the Stripe CLI:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook   # prints a whsec_… secret for .env
   ```
4. Deposit %, minimum deposit, tax rate, “require deposit” and “allow pay in full” are set in **Admin → Settings → Payments & policies** (super admin). Services can override the deposit with a fixed amount.

Payment status is **never** taken from the browser: the webhook and the success page both re-read the Checkout Session from Stripe’s API, processing is idempotent, and webhook events are de-duplicated. Cancelling inside the policy window refunds online payments automatically.

## Email setup (Resend)

1. Create a [Resend](https://resend.com) account, verify your sending domain, and create an API key.
2. Set `EMAIL_API_KEY` and `EMAIL_FROM` (an address on the verified domain).
3. Optional: `ADMIN_NOTIFICATION_EMAIL` for staff alerts.

Emails sent: booking received/confirmed, reminder (cron), rescheduled, cancelled, completed (with review link), payment receipt, quote received, quote response, contact auto-reply, password reset, and admin alerts for new bookings, quotes, messages, payments and reviews. Every send is logged in the `MessageLog` table.

## SMS (optional, Twilio)

Set `SMS_PROVIDER="twilio"`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`. Customers who enable “Text message reminders” in their profile receive confirmation, reminder, reschedule and cancellation texts. To add another provider, implement `SmsProvider` in `src/lib/sms/index.ts`.

## Image storage setup

Uploads (service images, gallery, logo, technician photos) go through `/api/upload`, which checks the user’s permission and validates the **actual file contents** (JPEG/PNG/WebP/AVIF, ≤ 8 MB).

- **Local** (`STORAGE_PROVIDER="local"`): files are written to `public/uploads`. Development only — serverless hosts don’t keep files.
- **Cloudinary**: `STORAGE_PROVIDER="cloudinary"`, `STORAGE_BUCKET` = cloud name, `STORAGE_API_KEY`, `STORAGE_SECRET`.
- **S3-compatible** (AWS S3, Cloudflare R2, Backblaze B2): `STORAGE_PROVIDER="s3"`, `STORAGE_API_KEY`, `STORAGE_SECRET`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ENDPOINT` (for R2/B2), and `STORAGE_PUBLIC_URL` (public bucket or CDN URL). The host of `STORAGE_PUBLIC_URL` is automatically allowed for Next.js image optimisation.

## Production deployment

**Database (Neon or Supabase)**
1. Create a Postgres database and copy the pooled connection string into `DATABASE_URL`.
2. Apply the schema: `DATABASE_URL="…" npx prisma migrate deploy`
3. Load the catalog (no demo people): `DATABASE_URL="…" SEED_MODE=catalog npm run db:seed`

**Vercel**
1. Import the repository in Vercel (framework preset: Next.js). The build command is `npm run build` (runs `prisma generate`).
2. Add the environment variables above for Production (and Preview). Set `NEXTAUTH_URL` and `NEXT_PUBLIC_SITE_URL` to your domain and do **not** set `ALLOW_DEMO_PAYMENTS`.
3. `vercel.json` schedules `/api/cron/reminders` once a day at 15:00 UTC (sends reminders and releases unpaid holds), the most the Vercel Hobby plan allows. That covers every appointment with the default 24-hour reminder window; on Vercel Pro you can switch to hourly (`0 * * * *`) for shorter windows. Set `CRON_SECRET`; Vercel sends it as a Bearer token.
4. Configure the Stripe webhook and Resend domain for the production URL.
5. Use Cloudinary or S3 storage (local uploads don’t persist on Vercel).

## Admin account setup in production

The demo seed never runs in production, so create the first super admin once:

1. Visit `/register` on the live site and create an account with the owner’s email.
2. Promote it in the database (Neon/Supabase SQL editor or `npm run db:studio`):
   ```sql
   UPDATE "User" SET role = 'SUPER_ADMIN' WHERE email = 'owner@yourdomain.com';
   ```
3. Sign in — you’ll land in `/admin`. Add further staff under **Admin → Staff accounts** (super admin only): enter a new email to create an account, or an existing customer’s email to promote them.

| Role | Can access |
| --- | --- |
| `STAFF` | Appointments, quotes, messages, customers (view), gallery |
| `ADMIN` | Everything staff can, plus services, pricing, coupons, reviews, technicians, hours, payments, reports, business settings |
| `SUPER_ADMIN` | Everything, plus tax/deposit/policy settings, legal pages and staff accounts |

The full permission matrix is shown on the Staff accounts page.

## Project structure

```
prisma/
  schema.prisma            data model (35 models)
  migrations/              SQL migrations
  seed.ts                  demo + catalog seed
scripts/dev-db.mjs         embedded Postgres for machines without Docker
public/
  images/demo/             demo photography (replace for launch)
  sw.js                    service worker (offline support)
src/
  app/
    (public)/              marketing site, quote, booking, checkout, manage, legal
    (auth)/                login, register, forgot/reset password
    dashboard/             customer account
    admin/                 admin dashboard
    api/                   auth, availability, Stripe webhook, cron, uploads, .ics
    sitemap.ts robots.ts manifest.ts opengraph-image.tsx icon.tsx …
  components/
    ui/ layout/ home/ booking/ quote/ checkout/ gallery/ dashboard/ admin/ forms/ seo/ pwa/ analytics/
  lib/
    auth/ db/ stripe/ email/ sms/ storage/ validation/ pricing/   (pricing engine is pure & shared)
  server/
    appointments/ payments/ quotes/ customers/ admin/ auth/ notifications/ …   (server-only logic & actions)
  hooks/ types/
```

## How pricing works

Prices are never hard-coded in components. `src/lib/pricing/engine.ts` (shared by the browser for instant estimates and by the server for authoritative totals) picks the **most specific matching `PricingRule`** for the selection:

- dimensions: service (or its parent for variants like “Ceramic Window Tint”), coverage option, film, vehicle type, vehicle size;
- empty dimensions are wildcards; more specific rules win, `priority` breaks ties;
- `price + pricePerWindow × window count`; vehicle-size % adjustments apply when the rule isn’t size-specific; add-ons are priced by their own rules or fallback prices;
- tax, coupons and deposits are applied by `calculateTotals`.

Edit prices in **Admin → Pricing** (price grid per coverage option by vehicle type × film). Marketing “from $X” prices on the website are calculated from the same rules.

## How booking availability works

`src/server/appointments/availability.ts` builds open slots from business hours (or a holiday’s special hours), subtracts breaks, existing bookings (plus buffer time), technician schedules, skills and time off, and enforces minimum notice and the maximum booking window. Without technicians, “parallel bays” limits concurrent jobs. When a booking is created the slot is re-checked inside a transaction with a per-day Postgres advisory lock, so two customers can’t take the same capacity. Unpaid online bookings hold the slot for the configured hold time; the hourly cron releases expired holds.

## Homepage film

The homepage is one scroll-driven film (`src/components/scroll-video`): scroll position maps straight to a video frame, chapters pin the key scenes, and `story.ts` holds the timings, scene cuts and stills. Phones get `public/video/story-720-v3.mp4`, larger screens `story-900-v3.mp4`; visitors with reduced motion or data saver only get the stills.

How the frame keeps up with the scroll (`film.ts`): the film is downloaded once, demuxed in the browser (`mp4.ts`) and decoded with **WebCodecs** onto a canvas. Frames around the scroll position, and the ones the current scroll speed will reach next, are decoded ahead, so the frame for each animation frame is normally drawn in the same frame as the scroll. Seeking a `<video>` can't do that: every `currentTime` change shows up a frame or more later, and only ~25–30 times a second. That path remains as the fallback for browsers without WebCodecs. To compare the two, check the stage's `data-engine` attribute (`decoded` or `video`).

Smooth scrubbing depends on the encode: **every frame must be a keyframe** (`-g 1`) with no B-frames, so any frame decodes on its own (`mp4.ts` rejects anything else and the stage falls back to the `<video>`). To replace the footage, re-encode it like this and save under a new file name (the files are cached for 30 days), then update `sources`, `duration`, `cuts` and the chapter times in `story.ts`:

```bash
X264="-c:v libx264 -preset slow -profile:v high -g 1 -bf 0 -sc_threshold 0 -x264-params aq-mode=3 \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -movflags +faststart -an -map_metadata -1"
ffmpeg -i source.mp4 -filter_complex \
  "[0:v]fps=25,split=2[a][b];[a]scale=1600:900:flags=lanczos,format=yuv420p[hd];[b]scale=1280:720:flags=lanczos,format=yuv420p[sd]" \
  -map "[hd]" $X264 -level 4.0 -crf 30 public/video/story-900-v4.mp4 \
  -map "[sd]" $X264 -level 3.1 -crf 31 public/video/story-720-v4.mp4
```

## Security notes

- Zod validation on every server action and route handler; React escapes all output; legal pages use a safe Markdown subset (no raw HTML)
- Role-based authorization re-checked server-side on every page and mutation; `/admin` and `/dashboard` also gated in `src/proxy.ts`
- Rate limiting backed by Postgres (sign-in, sign-up, quotes, bookings, contact, reviews, coupons, uploads, availability)
- Honeypot fields on public forms; CSRF protection from Server Actions’ origin checks and same-origin checks on JSON uploads
- Auth.js secure, HTTP-only cookies; bcrypt password hashes; timing-safe token comparison for guest links
- Stripe webhook signature verification and idempotent processing; amounts always computed on the server
- Security headers (HSTS in production, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`)
- Server Action argument logging is disabled in `next.config.ts` so passwords never appear in dev logs

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (`tsc --noEmit`) |
| `npm run db:local` | Embedded PostgreSQL on port 5433 (no Docker needed) |
| `npm run db:migrate` / `db:deploy` / `db:seed` / `db:reset` / `db:studio` | Prisma helpers |
