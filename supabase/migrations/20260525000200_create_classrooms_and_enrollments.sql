create table public.classrooms (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses (id) on delete restrict,
    owner_teacher_id uuid not null references public.profiles (id) on delete restrict,
    name text not null,
    join_code text,
    invite_token text,
    period_block text,
    school_year text,
    school_organization text,
    start_date date,
    end_date date,
    status text not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint classrooms_id_course_key unique (id, course_id),
    constraint classrooms_name_check
        check (nullif(btrim(name), '') is not null),
    constraint classrooms_join_code_check
        check (join_code is null or nullif(btrim(join_code), '') is not null),
    constraint classrooms_invite_token_check
        check (invite_token is null or nullif(btrim(invite_token), '') is not null),
    constraint classrooms_dates_check
        check (end_date is null or start_date is null or end_date >= start_date),
    constraint classrooms_status_check
        check (status in ('active', 'archived', 'deleted'))
);

create unique index classrooms_join_code_key
    on public.classrooms (upper(join_code))
    where join_code is not null;

create unique index classrooms_invite_token_key
    on public.classrooms (invite_token)
    where invite_token is not null;

create index classrooms_course_id_idx
    on public.classrooms (course_id);

create index classrooms_owner_teacher_id_idx
    on public.classrooms (owner_teacher_id);

create table public.enrollments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles (id) on delete restrict,
    course_id uuid not null references public.courses (id) on delete restrict,
    classroom_id uuid,
    enrollment_type text not null,
    enrollment_status text not null default 'active',
    joined_at timestamptz not null default now(),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint enrollments_classroom_course_fk
        foreign key (classroom_id, course_id)
        references public.classrooms (id, course_id)
        on delete restrict,
    constraint enrollments_type_check
        check (enrollment_type in ('course', 'classroom')),
    constraint enrollments_target_check
        check (
            (enrollment_type = 'course' and classroom_id is null)
            or (enrollment_type = 'classroom' and classroom_id is not null)
        ),
    constraint enrollments_status_check
        check (enrollment_status in ('active', 'removed', 'completed', 'dropped'))
);

create unique index enrollments_course_user_key
    on public.enrollments (course_id, user_id)
    where enrollment_type = 'course';

create unique index enrollments_classroom_user_key
    on public.enrollments (classroom_id, user_id)
    where enrollment_type = 'classroom';

create index enrollments_user_id_idx
    on public.enrollments (user_id);

create table public.classroom_teachers (
    id uuid primary key default gen_random_uuid(),
    classroom_id uuid not null references public.classrooms (id) on delete restrict,
    user_id uuid not null references public.profiles (id) on delete restrict,
    role text not null,
    added_by uuid not null references public.profiles (id) on delete restrict,
    created_at timestamptz not null default now(),
    constraint classroom_teachers_classroom_user_key unique (classroom_id, user_id),
    constraint classroom_teachers_role_check
        check (role in ('teacher', 'co_teacher'))
);

create index classroom_teachers_user_id_idx
    on public.classroom_teachers (user_id);

create function public.set_classroom_data_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_classrooms_updated_at
    before update on public.classrooms
    for each row
    execute function public.set_classroom_data_updated_at();

create trigger set_enrollments_updated_at
    before update on public.enrollments
    for each row
    execute function public.set_classroom_data_updated_at();

create function public.owns_classroom(classroom_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select exists (
        select 1
        from public.classrooms as classroom
        where classroom.id = classroom_to_check
            and classroom.owner_teacher_id = public.current_profile_id()
    );
$$;

create function public.manages_classroom(classroom_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select
        public.owns_classroom(classroom_to_check)
        or exists (
            select 1
            from public.classroom_teachers as teacher
            where teacher.classroom_id = classroom_to_check
                and teacher.user_id = public.current_profile_id()
        );
$$;

create function public.is_enrolled_in_course(course_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select exists (
        select 1
        from public.enrollments as enrollment
        where enrollment.course_id = course_to_check
            and enrollment.user_id = public.current_profile_id()
            and enrollment.enrollment_status <> 'removed'
    );
$$;

create function public.is_enrolled_in_classroom(classroom_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select exists (
        select 1
        from public.enrollments as enrollment
        where enrollment.classroom_id = classroom_to_check
            and enrollment.user_id = public.current_profile_id()
            and enrollment.enrollment_status <> 'removed'
    );
$$;

create function public.can_view_classroom(classroom_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select
        public.manages_classroom(classroom_to_check)
        or public.is_enrolled_in_classroom(classroom_to_check);
$$;

revoke all on function public.owns_classroom(uuid) from public;
revoke all on function public.manages_classroom(uuid) from public;
revoke all on function public.is_enrolled_in_course(uuid) from public;
revoke all on function public.is_enrolled_in_classroom(uuid) from public;
revoke all on function public.can_view_classroom(uuid) from public;

grant execute on function public.owns_classroom(uuid) to authenticated;
grant execute on function public.manages_classroom(uuid) to authenticated;
grant execute on function public.is_enrolled_in_course(uuid) to authenticated;
grant execute on function public.is_enrolled_in_classroom(uuid) to authenticated;
grant execute on function public.can_view_classroom(uuid) to authenticated;

alter table public.classrooms enable row level security;
alter table public.enrollments enable row level security;
alter table public.classroom_teachers enable row level security;

revoke all on table public.classrooms from anon;
revoke all on table public.classrooms from authenticated;
revoke all on table public.enrollments from anon;
revoke all on table public.enrollments from authenticated;
revoke all on table public.classroom_teachers from anon;
revoke all on table public.classroom_teachers from authenticated;

grant select on table public.classrooms to authenticated;
grant insert (
    course_id,
    owner_teacher_id,
    name,
    join_code,
    invite_token,
    period_block,
    school_year,
    school_organization,
    start_date,
    end_date
) on table public.classrooms to authenticated;

grant select on table public.enrollments to authenticated;

grant select on table public.classroom_teachers to authenticated;
grant insert (
    classroom_id,
    user_id,
    role,
    added_by
) on table public.classroom_teachers to authenticated;
grant update (role) on table public.classroom_teachers to authenticated;
grant delete on table public.classroom_teachers to authenticated;

create policy "Enrolled users can view their courses"
    on public.courses
    for select
    to authenticated
    using (public.is_enrolled_in_course(id));

create policy "Course managers can create classrooms"
    on public.classrooms
    for insert
    to authenticated
    with check (
        owner_teacher_id = public.current_profile_id()
        and public.can_manage_course(course_id)
    );

create policy "Classroom participants can view their classrooms"
    on public.classrooms
    for select
    to authenticated
    using (public.can_view_classroom(id));

create policy "Users and classroom managers can view enrollments"
    on public.enrollments
    for select
    to authenticated
    using (
        user_id = public.current_profile_id()
        or (
            classroom_id is null
            and public.can_manage_course(course_id)
        )
        or (
            classroom_id is not null
            and public.manages_classroom(classroom_id)
        )
    );

create policy "Classroom participants can view teachers"
    on public.classroom_teachers
    for select
    to authenticated
    using (public.can_view_classroom(classroom_id));

create policy "Classroom owners can add teachers"
    on public.classroom_teachers
    for insert
    to authenticated
    with check (
        public.owns_classroom(classroom_id)
        and added_by = public.current_profile_id()
    );

create policy "Classroom owners can update teachers"
    on public.classroom_teachers
    for update
    to authenticated
    using (public.owns_classroom(classroom_id))
    with check (public.owns_classroom(classroom_id));

create policy "Classroom owners can remove teachers"
    on public.classroom_teachers
    for delete
    to authenticated
    using (public.owns_classroom(classroom_id));
