-- CoreForge Portal — Incremental Migration v2
-- Run this in Supabase Dashboard -> SQL Editor if you already ran schema.sql earlier.
-- Adds: draft visibility columns & RLS, creator-only edit RLS for developers,
-- stage-move RPC, and Admin user management RPCs (create, change password, delete).

create extension if not exists pgcrypto;

alter table public.requirements add column if not exists is_draft boolean not null default false;
alter table public.requirements add column if not exists draft_step text not null default 'package';

drop policy if exists "members read clients" on public.clients;
create policy "members read clients" on public.clients for select
using (
  company_id = public.current_company_id()
  and (
    created_by = auth.uid()
    or exists (
      select 1 from public.requirements r
      where r.client_id = clients.id and r.is_draft = false
    )
  )
);

drop policy if exists "members update clients" on public.clients;
create policy "members update clients" on public.clients for update
using (company_id = public.current_company_id() and (public.is_company_admin() or created_by = auth.uid()))
with check (company_id = public.current_company_id() and (public.is_company_admin() or created_by = auth.uid()));

drop policy if exists "admins delete clients" on public.clients;
drop policy if exists "admins or draft creators delete clients" on public.clients;
create policy "admins or draft creators delete clients" on public.clients for delete
using (
  company_id = public.current_company_id()
  and (
    public.is_company_admin()
    or (
      created_by = auth.uid()
      and exists (
        select 1 from public.requirements r
        where r.client_id = clients.id and r.is_draft = true
      )
    )
  )
);

drop policy if exists "members read requirements" on public.requirements;
create policy "members read requirements" on public.requirements for select
using (
  company_id = public.current_company_id()
  and (is_draft = false or created_by = auth.uid())
);

drop policy if exists "members update requirements" on public.requirements;
create policy "members update requirements" on public.requirements for update
using (company_id = public.current_company_id() and (public.is_company_admin() or created_by = auth.uid()))
with check (company_id = public.current_company_id() and (public.is_company_admin() or created_by = auth.uid()));

drop policy if exists "admins delete requirements" on public.requirements;
drop policy if exists "admins or draft creators delete requirements" on public.requirements;
create policy "admins or draft creators delete requirements" on public.requirements for delete
using (
  company_id = public.current_company_id()
  and (public.is_company_admin() or (created_by = auth.uid() and is_draft = true))
);

create or replace function public.admin_create_user(
  p_full_name text,
  p_email text,
  p_password text,
  p_role public.member_role default 'developer'
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_company_id uuid;
  v_user_id uuid;
  v_clean_email text;
  v_clean_name text;
begin
  if not public.is_company_admin() then
    raise exception 'Only admins can create user accounts.';
  end if;
  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'Active company workspace not found.';
  end if;

  v_clean_email := lower(trim(coalesce(p_email, '')));
  v_clean_name := trim(coalesce(p_full_name, ''));
  if v_clean_name = '' or v_clean_email = '' then
    raise exception 'Full name and email are required.';
  end if;
  if length(coalesce(p_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;
  if exists (select 1 from auth.users where lower(email) = v_clean_email) then
    raise exception 'A user with this email already exists.';
  end if;

  v_user_id := gen_random_uuid();
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change,
    email_change_token_new, recovery_token
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_clean_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', v_clean_name),
    now(), now(), '', '', '', ''
  );

  insert into auth.identities (
    id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(),
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email),
    'email',
    v_user_id::text,
    now(), now(), now()
  );

  insert into public.profiles (id, company_id, full_name, email, role, is_active, created_by)
  values (v_user_id, v_company_id, v_clean_name, v_clean_email, p_role, true, auth.uid());

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, summary)
  values (v_company_id, auth.uid(), 'member_invited', 'profile', v_clean_email, 'created user account for');

  return v_user_id;
end;
$$;

create or replace function public.admin_update_user_password(
  p_user_id uuid,
  p_new_password text
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_company_id uuid;
  v_target_email text;
begin
  if not public.is_company_admin() then
    raise exception 'Only admins can change user passwords.';
  end if;
  v_company_id := public.current_company_id();
  if length(coalesce(p_new_password, '')) < 6 then
    raise exception 'Password must be at least 6 characters.';
  end if;

  select email into v_target_email
  from public.profiles
  where id = p_user_id and company_id = v_company_id;

  if v_target_email is null then
    raise exception 'User not found in your company workspace.';
  end if;

  update auth.users
  set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
      updated_at = now()
  where id = p_user_id;

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, summary)
  values (v_company_id, auth.uid(), 'password_reset_requested', 'profile', v_target_email, 'changed password for');
end;
$$;

create or replace function public.admin_delete_user(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_company_id uuid;
  v_target_email text;
begin
  if not public.is_company_admin() then
    raise exception 'Only admins can delete user accounts.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot delete your own active admin account.';
  end if;
  v_company_id := public.current_company_id();

  select email into v_target_email
  from public.profiles
  where id = p_user_id and company_id = v_company_id;

  if v_target_email is null then
    raise exception 'User not found in your company workspace.';
  end if;

  update public.clients set created_by = auth.uid() where company_id = v_company_id and created_by = p_user_id;
  update public.clients set updated_by = auth.uid() where company_id = v_company_id and updated_by = p_user_id;
  update public.requirements set created_by = auth.uid() where company_id = v_company_id and created_by = p_user_id;
  update public.requirements set updated_by = auth.uid() where company_id = v_company_id and updated_by = p_user_id;
  update public.requirements set assigned_to = null where company_id = v_company_id and assigned_to = p_user_id;
  update public.requirements set tagged_member_ids = array_remove(tagged_member_ids, p_user_id)
    where company_id = v_company_id and p_user_id = any(tagged_member_ids);
  update public.package_settings set updated_by = auth.uid() where company_id = v_company_id and updated_by = p_user_id;
  update public.coupons set created_by = auth.uid() where company_id = v_company_id and created_by = p_user_id;
  update public.coupon_redemptions set redeemed_by = auth.uid() where redeemed_by = p_user_id;
  update public.project_files set uploaded_by = auth.uid() where company_id = v_company_id and uploaded_by = p_user_id;
  update public.profiles set created_by = null where company_id = v_company_id and created_by = p_user_id;

  insert into public.activity_logs (company_id, actor_id, action, entity_type, entity_id, summary)
  values (v_company_id, auth.uid(), 'member_deactivated', 'profile', v_target_email, 'deleted user account for');

  delete from auth.users where id = p_user_id;
end;
$$;

create or replace function public.update_project_stage(
  p_requirement_id uuid,
  p_stage public.project_stage,
  p_progress smallint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company_id uuid;
  v_req record;
begin
  v_company_id := public.current_company_id();
  if v_company_id is null then
    raise exception 'Unauthorized.';
  end if;

  select id, is_draft, created_by into v_req
  from public.requirements
  where id = p_requirement_id and company_id = v_company_id;

  if v_req.id is null then
    raise exception 'Requirement not found.';
  end if;
  if v_req.is_draft and v_req.created_by <> auth.uid() then
    raise exception 'Cannot update an unpublished draft.';
  end if;
  if not public.is_company_admin() and p_stage = 'completed' then
    raise exception 'Only admins can move a project to Completed.';
  end if;

  update public.requirements
  set stage = p_stage,
      progress = p_progress,
      completed_at = case when p_stage = 'completed' then now() else null end,
      updated_by = auth.uid()
  where id = p_requirement_id and company_id = v_company_id;
end;
$$;

revoke all on function public.admin_create_user(text, text, text, public.member_role) from public;
grant execute on function public.admin_create_user(text, text, text, public.member_role) to authenticated;

revoke all on function public.admin_update_user_password(uuid, text) from public;
grant execute on function public.admin_update_user_password(uuid, text) to authenticated;

revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_delete_user(uuid) to authenticated;

revoke all on function public.update_project_stage(uuid, public.project_stage, smallint) from public;
grant execute on function public.update_project_stage(uuid, public.project_stage, smallint) to authenticated;

