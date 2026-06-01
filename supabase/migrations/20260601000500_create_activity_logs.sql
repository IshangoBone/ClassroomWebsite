create table public.activity_logs (
    id uuid primary key default gen_random_uuid(),
    actor_user_id uuid references public.profiles (id) on delete set null,
    action_type text not null,
    target_type text not null,
    target_id uuid,
    course_id uuid references public.courses (id) on delete set null,
    classroom_id uuid references public.classrooms (id) on delete set null,
    old_value_json jsonb,
    new_value_json jsonb,
    metadata_json jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint activity_logs_action_type_check
        check (nullif(btrim(action_type), '') is not null),
    constraint activity_logs_target_type_check
        check (nullif(btrim(target_type), '') is not null),
    constraint activity_logs_metadata_object_check
        check (jsonb_typeof(metadata_json) = 'object')
);

create index activity_logs_actor_user_id_idx
    on public.activity_logs (actor_user_id);

create index activity_logs_action_type_idx
    on public.activity_logs (action_type);

create index activity_logs_target_idx
    on public.activity_logs (target_type, target_id);

create index activity_logs_course_id_idx
    on public.activity_logs (course_id);

create index activity_logs_classroom_id_idx
    on public.activity_logs (classroom_id);

create index activity_logs_created_at_idx
    on public.activity_logs (created_at desc);

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles as profile
        where profile.id = public.current_profile_id()
            and profile.platform_role = 'admin'
            and profile.account_status = 'active'
    );
$$;

create function public.log_activity(
    action_type_input text,
    target_type_input text,
    target_id_input uuid default null,
    course_id_input uuid default null,
    classroom_id_input uuid default null,
    old_value_json_input jsonb default null,
    new_value_json_input jsonb default null,
    metadata_json_input jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    activity_log_id uuid;
begin
    if nullif(btrim(coalesce(action_type_input, '')), '') is null then
        raise exception 'Activity action type is required.';
    end if;

    if nullif(btrim(coalesce(target_type_input, '')), '') is null then
        raise exception 'Activity target type is required.';
    end if;

    if metadata_json_input is not null and jsonb_typeof(metadata_json_input) <> 'object' then
        raise exception 'Activity metadata must be a JSON object.';
    end if;

    insert into public.activity_logs (
        actor_user_id,
        action_type,
        target_type,
        target_id,
        course_id,
        classroom_id,
        old_value_json,
        new_value_json,
        metadata_json
    )
    values (
        public.current_profile_id(),
        btrim(action_type_input),
        btrim(target_type_input),
        target_id_input,
        course_id_input,
        classroom_id_input,
        old_value_json_input,
        new_value_json_input,
        coalesce(metadata_json_input, '{}'::jsonb)
    )
    returning id into activity_log_id;

    return activity_log_id;
end;
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.log_activity(text, text, uuid, uuid, uuid, jsonb, jsonb, jsonb) from public;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.log_activity(text, text, uuid, uuid, uuid, jsonb, jsonb, jsonb) to authenticated;

alter table public.activity_logs enable row level security;

revoke all on table public.activity_logs from anon;
revoke all on table public.activity_logs from authenticated;

grant select on table public.activity_logs to authenticated;

create policy "Platform admins can view activity logs"
    on public.activity_logs
    for select
    to authenticated
    using (public.is_platform_admin());
