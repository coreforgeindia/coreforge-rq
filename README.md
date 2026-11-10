# CoreForge Client & Project Portal

A Next.js 15 + TypeScript frontend starter for CoreForge LLP's internal project workspace. It is designed around a shared company workspace, a single requirement record per client, two roles (Admin and Developer), a three-stage delivery workflow, and an auditable activity history.

> **Current delivery scope:** frontend UI starter + Supabase SQL schema + implementation guide. The included UI uses sample in-memory data so it can be previewed without a Supabase project. It is not yet a production-connected application. Authentication, database persistence, server-side coupon validation, file uploads, invitations, password resets and immutable audit events must be connected using the backend setup prompt.

## Product decisions captured

- Company workspace: CoreForge LLP.
- Roles: `Admin`, `Developer`.
- Workflow: `Requirements` → `Building` → `Completed`.
- One requirement per client (enforced by a unique client relationship in SQL).
- Admin creates employee accounts; no public employee sign-up.
- Only Admin can delete clients/requirements, manage members, pricing and coupons.
- Activity log target: everything material, including authentication events, create/update/delete, stage changes, coupon and settings changes, file actions and exports.
- Hosting is included in package pricing. Do **not** add hosting again as a second client payable line item.
- Preferred stack: Next.js + Supabase (PostgreSQL, Auth, Storage, Edge Functions).

## Features represented in the frontend

- Company-branded workspace navigation.
- Overview dashboard with project counts, recent work, activity feed and team workload.
- Requirements list with search and stage filter.
- Project board with three columns and stage changes.
- Create requirement modal and project detail modal.
- Team directory with Admin / Developer role presentation.
- Activity log view and CSV export.
- Package and coupon summary, including `OFFPLUS2` concept.
- Admin control centre, account/security guidance and help documentation.\n- Dedicated `/admin` entry route (authentication requires Supabase integration).
- Responsive desktop, tablet and mobile layouts.
- Role-preview switch to inspect how navigation differs; it is a UI preview only, not authorization.

## Project structure

```text
coreforge-portal/
├── app/
│   ├── admin/              # reserved route for dedicated admin page
│   ├── globals.css         # responsive design system
│   ├── layout.tsx          # root layout + metadata
│   └── page.tsx            # interactive frontend workspace preview
├── docs/
│   └── BACKEND_SETUP_PROMPT.md
├── supabase/
│   └── schema.sql          # PostgreSQL tables, indexes, triggers and RLS starter
├── .env.example
├── next.config.ts
├── package.json
└── tsconfig.json
```

## Requirements

- Node.js 20.9+ (recommended for Next.js 15)
- npm
- A Supabase project for production integration

## Run locally

1. Extract the ZIP.
2. Open a terminal in the project folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

Build check:

```bash
npm run build
```

## Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor**.
3. Run `supabase/schema.sql`.
4. Create a private Storage bucket named `project-assets`.
5. Configure the Storage policies for authenticated members belonging to the same company.
6. Copy the project URL and anon/public key into `.env.local` using `.env.example`.
7. Configure Auth email delivery and password reset redirect URLs.
8. Deploy the required Edge Functions described in `docs/BACKEND_SETUP_PROMPT.md`.
9. Bootstrap the company and first administrator using a one-time trusted server-side script or Edge Function.
10. Disable public sign-ups after the first admin is provisioned.

### Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Only the Supabase anon/publishable key belongs in browser-exposed variables. Never add `SUPABASE_SERVICE_ROLE_KEY` to a `NEXT_PUBLIC_` variable or commit it to source control. Store the service-role key only in server/Edge Function secrets.

## Initial administrator

Requested bootstrap identity:

- Email: `admin@coreforgeindia.com`
- Temporary password requested: `12345678`

This credential is **not** embedded in the frontend or SQL. Create the Auth user through a trusted admin-only provisioning script/Edge Function, assign the `admin` profile role server-side, require a password change/reset at first sign-in, and enable MFA for production administrators. Do not use the temporary password in production.

## Hosting pricing rule

Client quotation logic must treat hosting as **included in the package price**. Example:

- Launch website package: ₹20,000
- Hosting: Included
- Client payable total before applicable configured taxes: ₹20,000

If the company wants internal hosting cost/profitability reporting, store the cost in `hosting_internal_cost` and display it only to authorized Admin users. Do not add it to the client total a second time.

## Roles and permissions

| Capability | Admin | Developer |
|---|---:|---:|
| View company projects | Yes | Yes (or assigned only if stricter policy is selected) |
| Create requirement | Yes | Yes |
| Edit requirement | Yes | Yes |
| Move project stages | Yes | Yes, subject to transition policy |
| Delete client/requirement | Yes | No |
| Create/invite employee accounts | Yes | No |
| Reset employee password | Yes | No |
| Change roles / deactivate users | Yes | No |
| Manage package prices | Yes | No |
| Create/edit/disable coupons | Yes | No |
| View company activity logs | Yes | Yes (company-wide by default; restrict if required) |
| Export activity logs | Yes | Policy-configurable |

The current SQL uses company-scoped RLS and admin-only deletion. Review the notes in `schema.sql` before production, especially whether Developers should see every company project or only assigned projects.

## Database model

- `companies`: tenant/company boundary.
- `profiles`: one profile per Supabase Auth user; role and company membership.
- `clients`: client identity and business profile.
- `requirements`: one-to-one client requirement record, package, sitemap, questionnaire JSON, assignment and stage.
- `package_settings`: company package prices, page allowance and internal hosting costs.
- `coupons`: page bonus or monetary coupon configuration.
- `coupon_redemptions`: prevents duplicate redemption for a requirement.
- `project_files`: metadata for private Supabase Storage objects.
- `activity_logs`: append-only audit event records.

## Important security model

- Supabase Auth verifies identity; never implement password verification in browser JavaScript.
- RLS is mandatory on every tenant-owned table.
- Role assignment must happen on the server using a trusted function. Never accept `role: "admin"` from a browser form.
- Admin invitation, password reset and deactivation use Supabase Auth Admin APIs from a server/Edge Function only.
- Coupon validation and usage count changes must be atomic server-side operations.
- Audit events must be generated server-side or by database triggers; do not trust browser-supplied actor IDs.
- Storage bucket must be private; authorize object paths by company and requirement.
- Do not hard-delete audit records. For business records, consider archive/soft-delete and keep the admin-only delete operation audited.
- Add rate limits, input validation, CSRF-safe cookie handling, secure headers and MFA before production.
- Never log passwords, access tokens, service-role keys or sensitive form secrets.

## Frontend status and limitations

The supplied UI is a frontend prototype using sample data and React state. A refresh resets the sample dataset. The sign-in preview and role switch are not authentication or authorization. The project list and activity actions are demonstrations. The SQL schema is a starting point and must be reviewed and tested with Supabase's RLS policy simulator before production.

## Recommended next implementation sequence

1. Connect Supabase SSR client and middleware/session refresh.
2. Build sign-in/sign-out and password reset screens.
3. Add server-side admin bootstrap and employee invitation functions.
4. Replace sample project data with RLS-protected queries.
5. Build the full requirement editor and client-facing requirement form.
6. Implement atomic coupon validation and package configuration.
7. Add private Storage upload/download.
8. Add server-side audit logging and CSV/PDF generation.
9. Add integration tests for Admin/Developer access and cross-company isolation.
10. Deploy to Vercel and configure production environment variables.

See `docs/BACKEND_SETUP_PROMPT.md` for the detailed implementation brief.
