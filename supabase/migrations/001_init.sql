-- Kipu: schema mínimo hackathon
create type user_role as enum('teacher','director','ugel');
create type artifact_type as enum('DAILY_SESSION','MONTHLY_UNIT','BIMONTHLY_GRADES','ANNUAL_GRADE_SUMMARY');
create type artifact_status as enum('PROCESSING','APPROVED','NEEDS_REVISION','MANUAL_REVIEW','PROCESSING_ERROR');
create type alert_severity as enum('LOW','MEDIUM','HIGH','CRITICAL');
create type alert_status as enum('NEW','UNDER_REVIEW','DISMISSED','ESCALATED','RESOLVED');

create table institutions (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null
);

create table profiles (
  id uuid primary key references auth.users(id),
  full_name text not null,
  role user_role not null,
  institution_id uuid references institutions(id)
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id),
  name text not null
);

create table student_groups (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references institutions(id),
  grade text not null,
  name text not null
);

create table class_schedules (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id),
  subject_id uuid not null references subjects(id),
  group_id uuid not null references student_groups(id),
  weekday int not null, -- 0=domingo
  start_time time not null,
  end_time time not null
);

create table artifacts (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references profiles(id),
  institution_id uuid not null references institutions(id),
  subject_id uuid references subjects(id),
  group_id uuid references student_groups(id),
  type artifact_type not null,
  status artifact_status not null default 'PROCESSING',
  current_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references artifacts(id),
  version int not null,
  original_filename text not null,
  storage_path text not null,
  sha256 text not null,
  markdown text,
  status artifact_status not null default 'PROCESSING',
  created_at timestamptz not null default now(),
  unique(artifact_id, version)
);

create table evaluations (
  id uuid primary key default gen_random_uuid(),
  artifact_version_id uuid not null references artifact_versions(id),
  model_name text not null,
  prompt_version text not null default 'v1',
  rubric_version text not null default 'daily-session.v1',
  decision artifact_status not null,
  overall_score int not null,
  confidence numeric not null,
  summary text not null,
  strengths jsonb not null default '[]',
  improvements jsonb not null default '[]',
  criteria jsonb not null default '[]',
  critical_flags jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table grade_records (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references student_groups(id),
  period text not null,
  student_code text not null,
  score int not null
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  severity alert_severity not null,
  status alert_status not null default 'NEW',
  institution_id uuid references institutions(id),
  title text not null,
  summary text not null,
  suggested_action text not null,
  evidence jsonb not null default '{}',
  history jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- helpers
create function my_role() returns user_role language sql stable security definer
  as $$ select role from profiles where id = auth.uid() $$;
create function my_institution() returns uuid language sql stable security definer
  as $$ select institution_id from profiles where id = auth.uid() $$;

-- trigger de auditoría en cambios de alertas (escrituras del frontend)
create function log_alert_change() returns trigger language plpgsql security definer as $$
begin
  insert into audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'ALERT_STATUS_CHANGE', 'alert', new.id, jsonb_build_object('from', old.status, 'to', new.status));
  return new;
end $$;
create trigger alerts_audit after update on alerts for each row execute function log_alert_change();

-- RLS
alter table institutions enable row level security;
alter table profiles enable row level security;
alter table subjects enable row level security;
alter table student_groups enable row level security;
alter table class_schedules enable row level security;
alter table artifacts enable row level security;
alter table artifact_versions enable row level security;
alter table evaluations enable row level security;
alter table grade_records enable row level security;
alter table alerts enable row level security;
alter table audit_logs enable row level security; -- sin policies: solo service role

create policy inst_read on institutions for select to authenticated using (true);
create policy prof_read on profiles for select to authenticated
  using (id = auth.uid() or my_role() = 'ugel' or (my_role() = 'director' and institution_id = my_institution()));
create policy subj_read on subjects for select to authenticated
  using (my_role() = 'ugel' or institution_id = my_institution());
create policy grp_read on student_groups for select to authenticated
  using (my_role() = 'ugel' or institution_id = my_institution());
create policy sched_read on class_schedules for select to authenticated
  using (teacher_id = auth.uid() or my_role() = 'ugel'
    or (my_role() = 'director' and exists (select 1 from student_groups g where g.id = group_id and g.institution_id = my_institution())));
create policy art_read on artifacts for select to authenticated
  using (teacher_id = auth.uid() or my_role() = 'ugel' or (my_role() = 'director' and institution_id = my_institution()));
create policy ver_read on artifact_versions for select to authenticated
  using (exists (select 1 from artifacts a where a.id = artifact_id
    and (a.teacher_id = auth.uid() or my_role() = 'ugel' or (my_role() = 'director' and a.institution_id = my_institution()))));
create policy eval_read on evaluations for select to authenticated
  using (exists (select 1 from artifact_versions v join artifacts a on a.id = v.artifact_id where v.id = artifact_version_id
    and (a.teacher_id = auth.uid() or my_role() = 'ugel' or (my_role() = 'director' and a.institution_id = my_institution()))));
create policy grades_read on grade_records for select to authenticated
  using (my_role() = 'ugel' or (my_role() = 'director' and exists (select 1 from student_groups g where g.id = group_id and g.institution_id = my_institution())));
create policy alerts_read on alerts for select to authenticated
  using (my_role() = 'ugel' or (my_role() = 'director' and institution_id = my_institution()));
create policy alerts_update on alerts for update to authenticated
  using (my_role() = 'ugel' or (my_role() = 'director' and institution_id = my_institution()));
