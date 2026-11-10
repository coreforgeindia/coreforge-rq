-- CoreForge Portal — Complete Supabase PostgreSQL Schema & Clean Bootstrap Seed
-- Paste this entire file into Supabase Dashboard -> SQL Editor -> Run.
-- Creates tables, triggers, RLS policies, Realtime notifications, package pricing,
-- coupons (OFFPLUS2, OFF10, OFF25, OFF50), CoreForge LLP workspace, and ONLY two users:
--   1) admin@coreforgeindia.com (Admin, password: 12345678)
--   2) gagan@coreforgeindia.com (Developer, password: 12345678)
-- Zero dummy clients or dummy projects are seeded.

create extension if not exists pgcrypto;
set search_path to public, extensions;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'member_role') then
    create type public.member_role as enum ('admin', 'developer');
  end if;
  if not exists (select 1 from pg_type where typname = 'project_stage') then
    create type public.project_stage as enum ('requirements', 'building', 'completed');
  end if;
  if not exists (select 1 from pg_type where typname = 'activity_action') then
    create type public.activity_action as enum (
      'login','logout','requirement_created','requirement_updated','requirement_deleted',
      'stage_changed','member_invited','member_updated','member_deactivated',
      'password_reset_requested','coupon_created','coupon_updated','settings_updated',
      'document_generated','document_exported','file_uploaded','file_deleted','mention_tagged'
    );
  end if;
end $$;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  full_name text not null,
  email text not null,
  role public.member_role not null default 'developer',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, email)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  client_name text not null,
  business_name text not null,
  email text,
  phone text,
  business_type text not null default 'unset' check (business_type in ('service','product','both','unset')),
  business_description text,
  website_url text,
  target_audience text,
  website_purpose text,
  website_purpose_other text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  unique(company_id, business_name)
);

create table if not exists public.requirements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete restrict,
  client_id uuid not null unique references public.clients(id) on delete cascade,
  project_code text not null unique,
  package_name text check (package_name in ('Launch','Growth','Scale')),
  package_price numeric(12,2) not null default 0 check (package_price >= 0),
  included_pages integer not null default 5 check (included_pages >= 0),
  coupon_id uuid,
  coupon_code text,
  coupon_bonus_pages integer not null default 0 check (coupon_bonus_pages >= 0),
  selected_pages jsonb not null default '[]'::jsonb,
  custom_pages jsonb not null default '[]'::jsonb,
  additional_pages_requested integer not null default 0 check (additional_pages_requested >= 0),
  additional_pages_status text not null default 'not_requested'
    check (additional_pages_status in ('not_requested','pending','approved','rejected')),
  hosting_included boolean not null default true,
  hosting_internal_cost numeric(12,2),
  hosting_plan text,
  hosting_frequency text,
  has_existing_website text default '',
  answers jsonb not null default '{}'::jsonb,
  feature_choices jsonb not null default '{}'::jsonb,
  feature_details jsonb not null default '{}'::jsonb,
  client_team jsonb not null default '{}'::jsonb,
  drive_link text default '',
  files_meta jsonb not null default '[]'::jsonb,
  agency_internal_notes text default '',
  custom_price_override numeric(12,2) check (custom_price_override >= 0),
  custom_extra_page_price_override numeric(12,2) check (custom_extra_page_price_override >= 0),
  pricing_adjustment_note text default '',
  tagged_member_ids uuid[] not null default array[]::uuid[],
  assigned_to uuid references public.profiles(id) on delete set null,
  stage public.project_stage not null default 'requirements',
  progress smallint not null default 0 check (progress between 0 and 100),
  client_confirmed boolean not null default false,
  client_approved_name text default '',
  client_approved_at timestamptz,
  submitted_at_label text default '',
  document_path text,
  created_by uuid not null references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.package_settings (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  package_name text not null check (package_name in ('Launch','Growth','Scale')),
  price numeric(12,2) not null check (price >= 0),
  included_pages integer not null check (included_pages >= 0),
  description text not null default '',
  best_for text not null default '',
  features jsonb not null default '[]'::jsonb,
  hosting_included boolean not null default true,
  hosting_internal_cost numeric(12,2),
  hosting_frequency text default 'To be confirmed',
  additional_page_price numeric(12,2),
  is_active boolean not null default true,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now(),
  unique(company_id, package_name)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null,
  benefit_type text not null check (benefit_type in ('bonus_pages','percentage_discount','fixed_discount')),
  bonus_pages integer not null default 0 check (bonus_pages >= 0),
  discount_percent numeric(5,2) default 0 check (discount_percent between 0 and 100),
  discount_amount numeric(12,2) default 0 check (discount_amount >= 0),
  allowed_packages text[] not null default array['Launch','Growth','Scale'],
  description text not null default '',
  starts_at timestamptz,
  expires_at timestamptz,
  max_uses integer check (max_uses is null or max_uses > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  is_active boolean not null default true,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(company_id, code)
);

do $$ begin
  if not exists (
    select 1 from pg_constraint where conname = 'requirements_coupon_fk'
  ) then
    alter table public.requirements add constraint requirements_coupon_fk
      foreign key (coupon_id) references public.coupons(id) on delete set null;
  end if;
end $$;

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  requirement_id uuid not null references public.requirements(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete cascade,
  redeemed_by uuid not null references public.profiles(id),
  redeemed_at timestamptz not null default now(),
  unique(coupon_id, requirement_id)
);

create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  requirement_id uuid not null references public.requirements(id) on delete cascade,
  storage_path text not null,
  original_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action public.activity_action not null,
  entity_type text not null,
  entity_id text,
  summary text not null,
  before_data jsonb,
  after_data jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.requirement_comments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  requirement_id uuid not null references public.requirements(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  step text not null,
  section text,
  body text not null,
  tagged_member_ids uuid[] not null default array[]::uuid[],
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  requirement_id uuid references public.requirements(id) on delete cascade,
  project_code text,
  project_company text,
  step text not null default 'overview',
  section text,
  kind text not null check (kind in ('mention','tag','stage','assignment','approval','pricing')),
  title text not null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists requirements_company_stage_idx on public.requirements(company_id, stage);
create index if not exists requirements_assigned_idx on public.requirements(assigned_to);
create index if not exists activity_company_created_idx on public.activity_logs(company_id, created_at desc);
create index if not exists clients_company_idx on public.clients(company_id);
create index if not exists profiles_company_role_idx on public.profiles(company_id, role);
create index if not exists notifications_recipient_read_idx on public.notifications(recipient_id, is_read, created_at desc);
create index if not exists requirement_comments_req_idx on public.requirement_comments(requirement_id, created_at desc);

create or replace function public.current_company_id()
returns uuid language sql stable security definer set search_path = public
as $$ select company_id from public.profiles where id = auth.uid() and is_active = true $$;

create or replace function public.current_member_role()
returns public.member_role language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() and is_active = true $$;

create or replace function public.is_company_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_member_role() = 'admin', false) $$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists companies_updated_at on public.companies;
create trigger companies_updated_at before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists clients_updated_at on public.clients;
create trigger clients_updated_at before update on public.clients
for each row execute function public.set_updated_at();

drop trigger if exists requirements_updated_at on public.requirements;
create trigger requirements_updated_at before update on public.requirements
for each row execute function public.set_updated_at();

drop trigger if exists package_settings_updated_at on public.package_settings;
create trigger package_settings_updated_at before update on public.package_settings
for each row execute function public.set_updated_at();

drop trigger if exists coupons_updated_at on public.coupons;
create trigger coupons_updated_at before update on public.coupons
for each row execute function public.set_updated_at();

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.requirements enable row level security;
alter table public.package_settings enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.project_files enable row level security;
alter table public.activity_logs enable row level security;
alter table public.requirement_comments enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "members read own company" on public.companies;
create policy "members read own company" on public.companies for select
using (id = public.current_company_id());

drop policy if exists "members read company profiles" on public.profiles;
create policy "members read company profiles" on public.profiles for select
using (company_id = public.current_company_id());

drop policy if exists "admins manage profiles" on public.profiles;
create policy "admins manage profiles" on public.profiles for all
using (company_id = public.current_company_id() and public.is_company_admin())
with check (company_id = public.current_company_id() and public.is_company_admin());

drop policy if exists "members read clients" on public.clients;
create policy "members read clients" on public.clients for select
using (company_id = public.current_company_id());

drop policy if exists "members create clients" on public.clients;
create policy "members create clients" on public.clients for insert
with check (company_id = public.current_company_id() and created_by = auth.uid());

drop policy if exists "members update clients" on public.clients;
create policy "members update clients" on public.clients for update
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists "admins delete clients" on public.clients;
create policy "admins delete clients" on public.clients for delete
using (company_id = public.current_company_id() and public.is_company_admin());

drop policy if exists "members read requirements" on public.requirements;
create policy "members read requirements" on public.requirements for select
using (company_id = public.current_company_id());

drop policy if exists "members create requirements" on public.requirements;
create policy "members create requirements" on public.requirements for insert
with check (company_id = public.current_company_id() and created_by = auth.uid());

drop policy if exists "members update requirements" on public.requirements;
create policy "members update requirements" on public.requirements for update
using (company_id = public.current_company_id())
with check (company_id = public.current_company_id());

drop policy if exists "admins delete requirements" on public.requirements;
create policy "admins delete requirements" on public.requirements for delete
using (company_id = public.current_company_id() and public.is_company_admin());

drop policy if exists "members read package settings" on public.package_settings;
create policy "members read package settings" on public.package_settings for select
using (company_id = public.current_company_id());

drop policy if exists "admins manage package settings" on public.package_settings;
create policy "admins manage package settings" on public.package_settings for all
using (company_id = public.current_company_id() and public.is_company_admin())
with check (company_id = public.current_company_id() and public.is_company_admin());

drop policy if exists "members read active coupons" on public.coupons;
create policy "members read active coupons" on public.coupons for select
using (company_id = public.current_company_id() and (is_active = true or public.is_company_admin()));

drop policy if exists "admins manage coupons" on public.coupons;
create policy "admins manage coupons" on public.coupons for all
using (company_id = public.current_company_id() and public.is_company_admin())
with check (company_id = public.current_company_id() and public.is_company_admin());

drop policy if exists "members read redemptions" on public.coupon_redemptions;
create policy "members read redemptions" on public.coupon_redemptions for select
using (exists (select 1 from public.requirements r where r.id = requirement_id and r.company_id = public.current_company_id()));

drop policy if exists "members redeem coupons" on public.coupon_redemptions;
create policy "members redeem coupons" on public.coupon_redemptions for insert
with check (redeemed_by = auth.uid() and exists (select 1 from public.requirements r where r.id = requirement_id and r.company_id = public.current_company_id()));

drop policy if exists "members read files" on public.project_files;
create policy "members read files" on public.project_files for select
using (company_id = public.current_company_id());

drop policy if exists "members upload files" on public.project_files;
create policy "members upload files" on public.project_files for insert
with check (company_id = public.current_company_id() and uploaded_by = auth.uid());

drop policy if exists "admins delete files" on public.project_files;
create policy "admins delete files" on public.project_files for delete
using (company_id = public.current_company_id() and public.is_company_admin());

drop policy if exists "members read activity" on public.activity_logs;
create policy "members read activity" on public.activity_logs for select
using (company_id = public.current_company_id());

drop policy if exists "members append activity" on public.activity_logs;
create policy "members append activity" on public.activity_logs for insert
with check (company_id = public.current_company_id() and actor_id = auth.uid());
-- No UPDATE or DELETE policy on activity_logs: audit events are append-only.

drop policy if exists "members read requirement comments" on public.requirement_comments;
create policy "members read requirement comments" on public.requirement_comments for select
using (company_id = public.current_company_id());

drop policy if exists "members create requirement comments" on public.requirement_comments;
create policy "members create requirement comments" on public.requirement_comments for insert
with check (company_id = public.current_company_id() and author_id = auth.uid());

drop policy if exists "members read company notifications" on public.notifications;
create policy "members read company notifications" on public.notifications for select
using (company_id = public.current_company_id() and (recipient_id = auth.uid() or public.is_company_admin()));

drop policy if exists "members create notifications" on public.notifications;
create policy "members create notifications" on public.notifications for insert
with check (company_id = public.current_company_id() and actor_id = auth.uid());

drop policy if exists "members update own notifications" on public.notifications;
create policy "members update own notifications" on public.notifications for update
using (company_id = public.current_company_id() and recipient_id = auth.uid())
with check (company_id = public.current_company_id() and recipient_id = auth.uid());

-- Enable Realtime on notifications & requirements
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'requirements'
  ) then
    alter publication supabase_realtime add table public.requirements;
  end if;
end $$;

-- ============================================================================
-- CLEAN WORKSPACE BOOTSTRAP SEED (ZERO DUMMY CLIENTS / PROJECTS)
-- Provisions CoreForge LLP, package pricing, 10%/25%/50% + OFFPLUS2 coupons,
-- and ONLY admin@coreforgeindia.com (Admin) + gagan@coreforgeindia.com (Developer)
-- ============================================================================
do $$
declare
  v_company_id uuid;
  v_admin_id uuid;
  v_gagan_id uuid;
begin
  -- 1. Company
  insert into public.companies (name, slug)
  values ('CoreForge LLP', 'coreforge-llp')
  on conflict (slug) do update set name = excluded.name
  returning id into v_company_id;

  -- 2. Admin Auth User (admin@coreforgeindia.com / 12345678)
  select id into v_admin_id from auth.users where email = 'admin@coreforgeindia.com';
  if v_admin_id is null then
    v_admin_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_admin_id,
      'authenticated',
      'authenticated',
      'admin@coreforgeindia.com',
      crypt('12345678', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Admin"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_admin_id,
      jsonb_build_object('sub', v_admin_id::text, 'email', 'admin@coreforgeindia.com'),
      'email',
      v_admin_id::text,
      now(), now(), now()
    );
  end if;

  insert into public.profiles (id, company_id, full_name, email, role, is_active)
  values (v_admin_id, v_company_id, 'Admin', 'admin@coreforgeindia.com', 'admin', true)
  on conflict (id) do update
    set company_id = excluded.company_id,
        full_name = excluded.full_name,
        email = excluded.email,
        role = 'admin',
        is_active = true;

  -- 3. Gagan Developer Auth User (gagan@coreforgeindia.com / 12345678)
  select id into v_gagan_id from auth.users where email = 'gagan@coreforgeindia.com';
  if v_gagan_id is null then
    v_gagan_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_gagan_id,
      'authenticated',
      'authenticated',
      'gagan@coreforgeindia.com',
      crypt('12345678', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Gagan"}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_gagan_id,
      jsonb_build_object('sub', v_gagan_id::text, 'email', 'gagan@coreforgeindia.com'),
      'email',
      v_gagan_id::text,
      now(), now(), now()
    );
  end if;

  insert into public.profiles (id, company_id, full_name, email, role, is_active, created_by)
  values (v_gagan_id, v_company_id, 'Gagan', 'gagan@coreforgeindia.com', 'developer', true, v_admin_id)
  on conflict (id) do update
    set company_id = excluded.company_id,
        full_name = excluded.full_name,
        email = excluded.email,
        role = 'developer',
        is_active = true;

  -- 4. Default Package Pricing Settings
  insert into public.package_settings (
    company_id, package_name, price, included_pages, description, best_for, features,
    hosting_included, hosting_internal_cost, hosting_frequency, additional_page_price, updated_by
  ) values
    (
      v_company_id, 'Launch', 20000, 5,
      'Professional digital presence for startups and small businesses.',
      'New businesses and individuals',
      '["Responsive website","Essential business pages","Contact and enquiry essentials","Basic SEO foundation"]'::jsonb,
      true, 5000, 'To be confirmed', null, v_admin_id
    ),
    (
      v_company_id, 'Growth', 40000, 10,
      'Conversion-focused website designed to generate enquiries and support business growth.',
      'Growing businesses',
      '["Everything in Launch","CMS and admin dashboard","Advanced enquiry workflows","SEO and lead generation"]'::jsonb,
      true, 10000, 'To be confirmed', null, v_admin_id
    ),
    (
      v_company_id, 'Scale', 60000, 15,
      'Complete digital platform with e-commerce, integrations and customer features.',
      'Established and growth-focused businesses',
      '["Everything in Growth","E-commerce capabilities","Customer accounts and workflows","Advanced integrations"]'::jsonb,
      true, null, 'To be confirmed', null, v_admin_id
    )
  on conflict (company_id, package_name) do nothing;

  -- 5. Default Coupons: OFFPLUS2, OFF10 (10% off), OFF25 (25% off), OFF50 (50% off)
  insert into public.coupons (
    company_id, code, benefit_type, bonus_pages, discount_percent, discount_amount,
    allowed_packages, description, is_active, created_by
  ) values
    (
      v_company_id, 'OFFPLUS2', 'bonus_pages', 2, 0, 0,
      array['Launch','Growth','Scale'], '+2 additional page slots in sitemap', true, v_admin_id
    ),
    (
      v_company_id, 'OFF10', 'percentage_discount', 0, 10, 0,
      array['Launch','Growth','Scale'], '10% off package & additional page subtotal', true, v_admin_id
    ),
    (
      v_company_id, 'OFF25', 'percentage_discount', 0, 25, 0,
      array['Launch','Growth','Scale'], '25% off package & additional page subtotal', true, v_admin_id
    ),
    (
      v_company_id, 'OFF50', 'percentage_discount', 0, 50, 0,
      array['Launch','Growth','Scale'], '50% off package & additional page subtotal', true, v_admin_id
    )
  on conflict (company_id, code) do nothing;
end $$;
