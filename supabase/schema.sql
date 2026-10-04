-- Run ONCE in a new Supabase project's SQL Editor as postgres.
-- All instants are timestamptz. Business dates are explicitly Asia/Riyadh.
begin;
set timezone = 'Asia/Riyadh';
alter database postgres set timezone to 'Asia/Riyadh';

create type public.app_role as enum ('admin','manager','employee');
create table public.departments (
 id uuid primary key default gen_random_uuid(),
 name text not null unique check(length(trim(name)) between 1 and 100),
 created_at timestamptz not null default now()
);
create table public.members (
 id uuid primary key default gen_random_uuid(),
 auth_user_id uuid unique references auth.users(id) on delete set null,
 username text not null unique check(username ~ '^[a-z0-9_.-]{3,64}$'),
 employee_code text not null unique check(length(trim(employee_code)) between 1 and 50),
 full_name text not null check(length(trim(full_name)) between 1 and 150),
 role public.app_role not null default 'employee',
 is_active boolean not null default false,
 department_id uuid references public.departments(id) on delete set null,
 shift_note text not null default '' check(length(shift_note)<=300),
 deleted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 check(deleted_at is null or is_active=false)
);
create index members_department on public.members(department_id);
create table public.attendance (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.members(id) on delete restrict,
 department_id uuid references public.departments(id) on delete set null,
 name_snapshot text not null, code_snapshot text not null, department_snapshot text not null default '',
 check_in timestamptz not null default clock_timestamp(),
 check_out timestamptz,
 work_date date not null default (clock_timestamp() at time zone 'Asia/Riyadh')::date,
 check(check_out is null or check_out>=check_in)
);
create unique index one_open_session on public.attendance(member_id) where check_out is null;
create index attendance_date on public.attendance(work_date desc,member_id);
create table public.excuses (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.members(id) on delete restrict,
 name_snapshot text not null, code_snapshot text not null,
 work_date date not null,
 reason text not null check(length(trim(reason)) between 1 and 1000),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 reviewed_by uuid references public.members(id), reviewed_at timestamptz,
 created_at timestamptz not null default now(), unique(member_id,work_date)
);
create table public.absences (
 id uuid primary key default gen_random_uuid(),
 member_id uuid not null references public.members(id) on delete restrict,
 work_date date not null, name_snapshot text not null, code_snapshot text not null,
 penalty bigint not null default 1000000 check(penalty in (0,1000000)),
 approved_by uuid not null references public.members(id),
 cancelled_at timestamptz, created_at timestamptz not null default now(),
 check((cancelled_at is null and penalty=1000000) or (cancelled_at is not null and penalty=0))
);
create unique index one_active_absence on public.absences(member_id,work_date) where cancelled_at is null;
create table public.audit_log (
 id bigint generated always as identity primary key,
 actor_id uuid, action text not null, entity_id uuid,
 before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
create table public.login_limits (
 key text primary key, window_start timestamptz not null, attempts int not null
);

create function public.current_member() returns uuid language sql stable security definer set search_path='' as $$
 select id from public.members where auth_user_id=auth.uid() and is_active and deleted_at is null
$$;
create function public.current_role() returns public.app_role language sql stable security definer set search_path='' as $$
 select role from public.members where id=public.current_member()
$$;
create function public.can_read_member(target uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.members me join public.members other on other.id=target
 where me.id=public.current_member() and (me.role='admin' or me.id=other.id or
 (me.role='manager' and me.department_id is not null and me.department_id=other.department_id)))
$$;
create function public.assert_admin() returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=public.current_member();
 if actor is null or public.current_role()<>'admin' then raise exception 'FORBIDDEN'; end if;
 return actor;
end $$;

-- Never copy a role or activation flag from user-editable auth metadata.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.members(auth_user_id,username,employee_code,full_name)
 values(new.id,'u_'||replace(new.id::text,'-',''),'EMP-'||new.id::text,
 left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),'New member'),150));
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create function public.audit_changes() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_log(actor_id,action,entity_id,before_data,after_data)
 values(public.current_member(),tg_table_name||'.'||tg_op,coalesce(new.id,old.id),
 case when tg_op<>'INSERT' then to_jsonb(old) end, case when tg_op<>'DELETE' then to_jsonb(new) end);
 return coalesce(new,old);
end $$;
create trigger audit_members after insert or update or delete on public.members for each row execute function public.audit_changes();
create trigger audit_departments after insert or update or delete on public.departments for each row execute function public.audit_changes();
create trigger audit_attendance after insert or update on public.attendance for each row execute function public.audit_changes();
create trigger audit_excuses after insert or update on public.excuses for each row execute function public.audit_changes();
create trigger audit_absences after insert or update on public.absences for each row execute function public.audit_changes();

create function public.admin_save_member(p_id uuid,p_name text,p_code text,p_username text,
 p_role public.app_role,p_active boolean,p_department uuid,p_shift text default '') returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 perform pg_advisory_xact_lock(101);
 actor:=public.assert_admin();
 if p_id=actor and (not p_active or p_role<>'admin') then raise exception 'SELF_LOCKOUT'; end if;
 if not exists(select 1 from public.members where id=p_id and deleted_at is null) then raise exception 'NOT_FOUND'; end if;
 update public.members set full_name=trim(p_name),employee_code=trim(p_code),username=lower(trim(p_username)),
 role=p_role,is_active=p_active,department_id=p_department,shift_note=trim(p_shift),updated_at=now() where id=p_id;
end $$;
create function public.admin_archive_member(p_id uuid,p_restore boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 perform pg_advisory_xact_lock(101);actor:=public.assert_admin();
 if p_id=actor then raise exception 'SELF_LOCKOUT'; end if;
 update public.members set is_active=false,deleted_at=case when p_restore then null else now() end,updated_at=now() where id=p_id;
 if not found then raise exception 'NOT_FOUND'; end if;
end $$;
create function public.admin_save_department(p_id uuid,p_name text) returns uuid
language plpgsql security definer set search_path='' as $$
declare result uuid;
begin
 perform public.assert_admin();
 if p_id is null then insert into public.departments(name) values(trim(p_name)) returning id into result;
 else update public.departments set name=trim(p_name) where id=p_id returning id into result; end if;
 if result is null then raise exception 'NOT_FOUND'; end if;
 return result;
end $$;
create function public.admin_delete_department(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin perform public.assert_admin();delete from public.departments where id=p_id;
 if not found then raise exception 'NOT_FOUND'; end if;
end $$;

create function public.clock_in() returns uuid language plpgsql security definer set search_path='' as $$
declare m public.members; result uuid; today date:=(clock_timestamp() at time zone 'Asia/Riyadh')::date;
begin
 select * into m from public.members where id=public.current_member() for update;
 if m.id is null then raise exception 'INACTIVE'; end if;
 if exists(select 1 from public.attendance where member_id=m.id and check_out is null) then raise exception 'ALREADY_IN'; end if;
 if exists(select 1 from public.excuses where member_id=m.id and work_date=today and status<>'rejected')
 or exists(select 1 from public.absences where member_id=m.id and work_date=today and cancelled_at is null) then raise exception 'DAY_CONFLICT'; end if;
 insert into public.attendance(member_id,department_id,name_snapshot,code_snapshot,department_snapshot,work_date)
 values(m.id,m.department_id,m.full_name,m.employee_code,coalesce((select name from public.departments where id=m.department_id),''),today)
 returning id into result;return result;
end $$;
create function public.clock_out() returns uuid language plpgsql security definer set search_path='' as $$
declare actor uuid; result uuid;
begin
 select id into actor from public.members where id=public.current_member() for update;
 if actor is null then raise exception 'INACTIVE'; end if;
 update public.attendance set check_out=clock_timestamp() where member_id=actor and check_out is null returning id into result;
 if result is null then raise exception 'NOT_CLOCKED_IN'; end if; return result;
end $$;
create function public.submit_excuse(p_date date,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; m public.members;
begin
 select * into m from public.members where id=public.current_member() for update;actor:=m.id;
 if actor is null then raise exception 'INACTIVE'; end if;
 if p_date<(now() at time zone 'Asia/Riyadh')::date then raise exception 'INVALID_DATE'; end if;
 if exists(select 1 from public.attendance where member_id=actor and work_date=p_date)
 or exists(select 1 from public.absences where member_id=actor and work_date=p_date and cancelled_at is null) then raise exception 'DAY_CONFLICT'; end if;
 insert into public.excuses(member_id,work_date,reason,name_snapshot,code_snapshot) values(actor,p_date,trim(p_reason),m.full_name,m.employee_code);
end $$;
create function public.review_excuse(p_id uuid,p_approve boolean) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; e public.excuses;
begin
 actor:=public.assert_admin();select * into e from public.excuses where id=p_id;
 if e.id is null then raise exception 'NOT_FOUND'; end if;
 perform 1 from public.members where id=e.member_id for update;
 if p_approve and (exists(select 1 from public.attendance where member_id=e.member_id and work_date=e.work_date)
 or exists(select 1 from public.absences where member_id=e.member_id and work_date=e.work_date and cancelled_at is null)) then raise exception 'DAY_CONFLICT'; end if;
 update public.excuses set status=case when p_approve then 'approved' else 'rejected' end,reviewed_by=actor,reviewed_at=now() where id=p_id;
end $$;
create function public.approve_absence(p_member uuid,p_date date) returns void language plpgsql security definer set search_path='' as $$
declare actor uuid; m public.members;
begin
 actor:=public.assert_admin();select * into m from public.members where id=p_member and deleted_at is null for update;
 if m.id is null then raise exception 'NOT_FOUND'; end if;
 if p_date>(now() at time zone 'Asia/Riyadh')::date then raise exception 'INVALID_DATE'; end if;
 if exists(select 1 from public.attendance where member_id=p_member and work_date=p_date)
 or exists(select 1 from public.excuses where member_id=p_member and work_date=p_date and status<>'rejected') then raise exception 'DAY_CONFLICT'; end if;
 insert into public.absences(member_id,work_date,name_snapshot,code_snapshot,approved_by) values(p_member,p_date,m.full_name,m.employee_code,actor);
end $$;
create function public.cancel_absence(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin perform public.assert_admin();update public.absences set cancelled_at=now(),penalty=0 where id=p_id and cancelled_at is null;
 if not found then raise exception 'NOT_FOUND'; end if;
end $$;

-- Server-only throttle; identifiers are HMAC hashes, never raw email/IP.
create function public.consume_login_attempt(p_key text) returns boolean language plpgsql security definer set search_path='' as $$
declare total int;
begin
 insert into public.login_limits(key,window_start,attempts) values(p_key,now(),1)
 on conflict(key) do update set attempts=case when public.login_limits.window_start<now()-interval '15 minutes' then 1 else public.login_limits.attempts+1 end,
 window_start=case when public.login_limits.window_start<now()-interval '15 minutes' then now() else public.login_limits.window_start end
 returning attempts into total;
 delete from public.login_limits where window_start<now()-interval '2 days';
 return total<=15;
end $$;

alter table public.members enable row level security;
alter table public.departments enable row level security;
alter table public.attendance enable row level security;
alter table public.excuses enable row level security;
alter table public.absences enable row level security;
alter table public.audit_log enable row level security;
alter table public.login_limits enable row level security;
create policy members_read on public.members for select to authenticated using (auth_user_id=auth.uid() or public.can_read_member(id));
create policy departments_read on public.departments for select to authenticated using(public.current_member() is not null);
create policy attendance_read on public.attendance for select to authenticated using(public.can_read_member(member_id));
create policy excuses_read on public.excuses for select to authenticated using(public.can_read_member(member_id));
create policy absences_read on public.absences for select to authenticated using(public.can_read_member(member_id));
create policy audit_admin_read on public.audit_log for select to authenticated using(public.current_role()='admin');
-- No client write policies. All writes use checked, atomic RPCs.
revoke all on public.members,public.departments,public.attendance,public.excuses,public.absences,public.audit_log,public.login_limits from anon,authenticated;
grant select on public.members,public.departments,public.attendance,public.excuses,public.absences,public.audit_log to authenticated;
grant all on public.members,public.departments,public.attendance,public.excuses,public.absences,public.audit_log,public.login_limits to service_role;
grant usage,select on sequence public.audit_log_id_seq to service_role;
revoke execute on function public.current_member(),public.current_role(),public.can_read_member(uuid),public.assert_admin(),public.handle_new_user(),public.audit_changes(),
public.admin_save_member(uuid,text,text,text,public.app_role,boolean,uuid,text),public.admin_archive_member(uuid,boolean),public.admin_save_department(uuid,text),public.admin_delete_department(uuid),
public.clock_in(),public.clock_out(),public.submit_excuse(date,text),public.review_excuse(uuid,boolean),public.approve_absence(uuid,date),public.cancel_absence(uuid),public.consume_login_attempt(text) from public,anon,authenticated;
grant execute on function public.current_member(),public.current_role(),public.can_read_member(uuid),
public.admin_save_member(uuid,text,text,text,public.app_role,boolean,uuid,text),public.admin_archive_member(uuid,boolean),public.admin_save_department(uuid,text),public.admin_delete_department(uuid),
public.clock_in(),public.clock_out(),public.submit_excuse(date,text),public.review_excuse(uuid,boolean),public.approve_absence(uuid,date),public.cancel_absence(uuid) to authenticated;
grant execute on function public.consume_login_attempt(text) to service_role;
commit;
