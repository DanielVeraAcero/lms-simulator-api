create extension if not exists pgcrypto;

drop table if exists email_events;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists lms_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  first_name text not null,
  last_name text not null,
  external_contact_id text,
  contact_type text not null default 'student' check (contact_type in ('student', 'marketing', 'staff')),
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lms_courses (
  id uuid primary key default gen_random_uuid(),
  course_code text not null unique,
  title text not null,
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists lms_enrollments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references lms_users(id),
  course_id uuid not null references lms_courses(id),
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  enrolled_at timestamptz not null default now(),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  level text not null default 'info' check (level in ('info', 'warning', 'error')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

drop trigger if exists lms_users_set_updated_at on lms_users;
create trigger lms_users_set_updated_at
before update on lms_users
for each row
execute procedure set_updated_at();

drop trigger if exists lms_courses_set_updated_at on lms_courses;
create trigger lms_courses_set_updated_at
before update on lms_courses
for each row
execute procedure set_updated_at();

drop trigger if exists lms_enrollments_set_updated_at on lms_enrollments;
create trigger lms_enrollments_set_updated_at
before update on lms_enrollments
for each row
execute procedure set_updated_at();
