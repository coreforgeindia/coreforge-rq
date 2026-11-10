# Backend implementation prompt — CoreForge Portal

Use this as the implementation brief for the next engineering phase. Build the backend for the existing Next.js 15 + TypeScript frontend using Supabase (PostgreSQL, Auth, Storage and Edge Functions).

## Goal

Turn the CoreForge frontend starter into a secure multi-user company project portal. All CoreForge employees log in to the same company workspace. Admin creates Developer accounts. Each client has exactly one active requirement record. Projects move through `Requirements`, `Building`, and `Completed`.

## Non-negotiable business rules

1. Tenant/company is CoreForge LLP. Every business row is scoped to `company_id`.
2. Roles are only `admin` and `developer`.
3. Admin creates users; there is no public self-registration.
4. Only Admin can delete a client or requirement, manage accounts, pricing and coupons.
5. Developers can create and edit requirements and update permitted project fields/stages.
6. One requirement per client. Enforce this in the database, not just UI.
7. Every meaningful action must create an audit log with actor, event, entity, timestamp and relevant before/after data.
8. Hosting is included in package price. It must not be double-counted in the client-facing estimate. Internal hosting costs are Admin-only.
9. Coupon `OFFPLUS2` grants two extra pages and is a page allowance benefit, not a monetary discount.
10. Launch starts with five included pages. Growth and Scale allowances are configurable by Admin.
11. Additional page price is configurable; if not configured, show “Pending agency configuration” rather than inventing a price.
12. Taxes must not be calculated unless the company explicitly configures the applicable tax settings.
13. Client approval should record the typed approver name and server timestamp. Do not represent a typed name as a legally verified digital signature.

## Supabase schema

Use `supabase/schema.sql` as the baseline. Review all policies and strengthen them before launch. Required entities: companies, profiles, clients, requirements, package_settings, coupons, coupon_redemptions, project_files and activity_logs.

## Authentication and account provisioning

- Use Supabase Auth with secure cookie-based SSR integration (`@supabase/ssr`).
- Implement `/login`, `/auth/callback`, `/forgot-password`, `/reset-password`.
- Disable public sign-ups.
- Add an admin-only Edge Function or server route `admin-create-user`.
- The function must verify the caller's Supabase JWT and `profiles.role = 'admin'` in the active company before using the Supabase service-role client.
- Create the Auth user with email invite or a temporary random password; never accept or return a shared permanent default password.
- Insert the profile with `role='developer'` by default. Only an existing admin may create another admin, if that capability is explicitly enabled.
- Implement `admin-reset-password` and `admin-deactivate-user` through trusted server code. Do not expose service-role credentials to the browser.
- Require a password reset on first sign-in and recommend MFA for admins.
- The initial requested admin email is `admin@coreforgeindia.com`. Provision it through a one-time trusted bootstrap process and force a reset. Do not hardcode the requested temporary password in source code.

## Company and RLS model

- Create one company row for CoreForge LLP.
- Attach the initial Admin profile to that company.
- All client and requirement queries must be company-scoped.
- RLS must prevent a member of another company from reading, writing or inferring CoreForge data.
- Never trust a client-supplied `company_id`, `actor_id`, `role`, `created_by` or `updated_by`. Derive identity and tenant from the verified session.
- Review whether Developer access is company-wide or assignment-only. The current product brief expects a common team workspace, so company-wide read access is acceptable unless the owner changes this.
- Only Admin can delete clients and requirements. Prefer soft-delete/archive and retain the audit trail.
- Make activity logs append-only. No client-side update/delete policy.
- Audit log reads are company-scoped. Do not log passwords, tokens, secrets or raw authentication credentials.

## Required server endpoints / Edge Functions

Implement secure equivalents of:

- `POST /api/admin/users` — create/invite a team member.
- `POST /api/admin/users/:id/reset-password` — trigger password reset.
- `PATCH /api/admin/users/:id` — update name, role or active status (admin only).
- `GET /api/projects` — list and filter company projects.
- `POST /api/clients` — create client and initial requirement in one transaction.
- `GET /api/clients/:id/requirement` — fetch the one requirement.
- `PATCH /api/requirements/:id` — update details, answers, pages, package, assignment.
- `DELETE /api/requirements/:id` — Admin only; write audit event before deletion or use archive.
- `PATCH /api/requirements/:id/stage` — validate stage and permitted transitions; update completion timestamp.
- `POST /api/coupons/validate` — validate coupon and package restrictions.
- `POST /api/coupons/redeem` — atomically redeem coupon once per requirement and update bonus pages/usage.
- `POST /api/admin/coupons` and `PATCH /api/admin/coupons/:id` — Admin-only coupon management.
- `POST /api/admin/package-settings` — Admin-only pricing/page/hosting configuration.
- `POST /api/files/sign-upload` — issue signed upload for private project-assets bucket.
- `POST /api/documents/requirements` — generate/export requirement document using server-verified data.
- `GET /api/activity` — filter audit events by actor, event, project and date.
- `POST /api/activity/export` — generate CSV export.

Use Zod or equivalent schema validation for every input. Apply rate limits to authentication-adjacent and coupon endpoints. Use transactions/RPC functions for client+requirement creation, coupon redemption and audit-critical mutations.

## Activity log requirements

Record:
- login success/failure where safely observable; logout;
- user invite/create, role change, deactivate/reactivate, password reset request;
- client/requirement create, update, archive/delete;
- page add/remove, custom page changes, package changes, coupon applied/removed;
- stage changes, assignment changes, internal note changes;
- file upload/delete, document generate/export;
- coupon create/update/disable and package/hosting settings changes.

Each event should include `company_id`, `actor_id`, action enum, entity type/id, summary, timestamp, and safe before/after JSON. Capture IP/user agent only if needed and disclosed in the privacy notice. Audit events must be server-generated and immutable.

## Requirements form

Build a complete client requirement editor using the sections from the supplied requirement specification:
- Five mandatory business questions: company name, what the business does, website purpose, existing website, target audience.
- Business type: Service-based, Product-based, Both.
- If website purpose is Other, reveal a required “Please specify” field.
- Package selection: Launch ₹20,000 / 5 pages; Growth ₹40,000 / configurable pages; Scale ₹60,000 / configurable pages.
- Page selection categories and custom pages.
- Coupon input; `OFFPLUS2` adds two page slots, once per requirement.
- Conditional package feature requirements for Launch, Growth and Scale.
- Design/branding, functionality, SEO, content, hosting/technical, integrations, legal, maintenance and timeline.
- Client contact, decision-maker, content provider, design approver and final approver.
- Agency-only fields must only be visible to authorized team members.
- Save drafts incrementally and show a last-saved timestamp.

## Hosting and quotation

Client-facing quotation:
- Website package price.
- Hosting: “Included in package” (₹0 additional payable).
- Additional pages: configured amount, or pending approval/configuration.
- Optional services and configured taxes as separate line items.
- Total must never add the internal hosting cost a second time.
Admin-only internal margin view may show hosting cost separately.

## Project board and dashboard

- Kanban columns exactly: Requirements, Building, Completed.
- Drag-and-drop and select-based stage changes must call the server endpoint.
- Show client/company, project ID, assigned developer, requirement owner, updated time, package and progress.
- Dashboard metrics: total clients/projects, requirements stage count, building count, completed count, created by current user, created by other team members, overdue/pending items, recent activity and team workload.
- Filters: stage, assigned developer, created by, package and date.
- One client should not have duplicate active requirement records.

## Documents and exports

- Requirement document should contain client details, package, page selections, coupon, quotation, hosting-included note, all requirement answers, integrations, responsibilities, timeline and client acknowledgement.
- Provide Print / Save as PDF using browser print or a server-generated PDF. Provide a separate Download PDF action if server generation is implemented.
- Provide JSON project export and CSV activity export.
- Ensure exports respect RLS and role permissions.

## UI and quality

- Keep the existing minimal black/white CoreForge UI.
- Fix responsive navigation/sidebar overlap; desktop should have a true two-column app shell (sidebar + content) with no floating/overlapping price panel. Mobile should use compact horizontal navigation or a drawer.
- Keep spacing, typography, table overflow and mobile controls consistent.
- Add loading, empty, error and success states.
- Avoid fake security controls. UI role hiding is not authorization; RLS and server checks are mandatory.
- Add tests for Admin/Developer permissions, cross-company isolation, one-requirement-per-client constraint, coupon double redemption, stage updates and audit immutability.

## Acceptance criteria

1. A Developer cannot create an Admin, delete a requirement, edit package pricing or manage coupons.
2. An Admin can create a Developer, reset their password and deactivate their account.
3. Company members see only company data.
4. A client has no more than one requirement record.
5. Coupon bonus is granted once and is validated server-side.
6. Hosting is displayed as included and does not increase the payable total.
7. Every relevant mutation produces an immutable audit event.
8. Project board reflects database state after refresh and across team accounts.
9. All five mandatory questions validate; Other purpose reveals a required text field.
10. Document export contains saved server-side data, not only browser state.
11. Mobile and desktop layouts do not overlap.
12. No secrets or service-role credentials are exposed in the browser bundle.
