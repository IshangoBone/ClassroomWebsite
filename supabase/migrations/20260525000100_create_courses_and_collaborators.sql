create table public.courses (
    id uuid primary key default gen_random_uuid(),
    owner_user_id uuid not null references public.profiles (id) on delete restrict,
    title text,
    description text,
    subject_area text not null,
    tags text[] not null default '{}',
    estimated_length text not null,
    status text not null default 'draft',
    thumbnail_url text,
    thumbnail_type text,
    is_platform_template boolean not null default false,
    source_course_id uuid references public.courses (id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint courses_subject_area_check
        check (nullif(btrim(subject_area), '') is not null),
    constraint courses_estimated_length_check
        check (nullif(btrim(estimated_length), '') is not null),
    constraint courses_status_check
        check (status in ('draft', 'published', 'private', 'archived', 'deleted')),
    constraint courses_thumbnail_type_check
        check (thumbnail_type is null or thumbnail_type in ('uploaded', 'default')),
    constraint courses_source_check
        check (source_course_id is null or source_course_id <> id)
);

create table public.course_collaborators (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses (id) on delete restrict,
    user_id uuid not null references public.profiles (id) on delete restrict,
    permission_level text not null,
    added_by uuid not null references public.profiles (id) on delete restrict,
    created_at timestamptz not null default now(),
    constraint course_collaborators_course_user_key unique (course_id, user_id),
    constraint course_collaborators_permission_level_check
        check (permission_level in ('viewer', 'teacher', 'editor', 'co_owner'))
);

create index courses_owner_user_id_idx
    on public.courses (owner_user_id);

create index course_collaborators_user_id_idx
    on public.course_collaborators (user_id);

create function public.set_courses_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_courses_updated_at
    before update on public.courses
    for each row
    execute function public.set_courses_updated_at();

create function public.current_profile_id()
returns uuid
language sql
stable
security definer set search_path = ''
as $$
    select profile.id
    from public.profiles as profile
    where profile.auth_user_id = (select auth.uid());
$$;

create function public.owns_course(course_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select exists (
        select 1
        from public.courses as course
        where course.id = course_to_check
            and course.owner_user_id = public.current_profile_id()
    );
$$;

create function public.can_view_course(course_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select
        public.owns_course(course_to_check)
        or exists (
            select 1
            from public.course_collaborators as collaborator
            where collaborator.course_id = course_to_check
                and collaborator.user_id = public.current_profile_id()
        );
$$;

create function public.can_manage_course(course_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select
        public.owns_course(course_to_check)
        or exists (
            select 1
            from public.course_collaborators as collaborator
            where collaborator.course_id = course_to_check
                and collaborator.user_id = public.current_profile_id()
                and collaborator.permission_level in ('teacher', 'editor', 'co_owner')
        );
$$;

revoke all on function public.current_profile_id() from public;
revoke all on function public.owns_course(uuid) from public;
revoke all on function public.can_view_course(uuid) from public;
revoke all on function public.can_manage_course(uuid) from public;

grant execute on function public.current_profile_id() to authenticated;
grant execute on function public.owns_course(uuid) to authenticated;
grant execute on function public.can_view_course(uuid) to authenticated;
grant execute on function public.can_manage_course(uuid) to authenticated;

alter table public.courses enable row level security;
alter table public.course_collaborators enable row level security;

revoke all on table public.courses from anon;
revoke all on table public.courses from authenticated;
revoke all on table public.course_collaborators from anon;
revoke all on table public.course_collaborators from authenticated;

grant select on table public.courses to authenticated;
grant insert (
    owner_user_id,
    title,
    description,
    subject_area,
    tags,
    estimated_length,
    thumbnail_url,
    thumbnail_type
) on table public.courses to authenticated;
grant update (
    title,
    description,
    subject_area,
    tags,
    estimated_length,
    thumbnail_url,
    thumbnail_type
) on table public.courses to authenticated;

grant select on table public.course_collaborators to authenticated;
grant insert (
    course_id,
    user_id,
    permission_level,
    added_by
) on table public.course_collaborators to authenticated;
grant update (permission_level) on table public.course_collaborators to authenticated;
grant delete on table public.course_collaborators to authenticated;

create policy "Users can create their own courses"
    on public.courses
    for insert
    to authenticated
    with check (
        owner_user_id = public.current_profile_id()
        and not is_platform_template
    );

create policy "Course members can view their courses"
    on public.courses
    for select
    to authenticated
    using (public.can_view_course(id));

create policy "Course managers can update their courses"
    on public.courses
    for update
    to authenticated
    using (public.can_manage_course(id))
    with check (public.can_manage_course(id));

create policy "Course members can view collaborators"
    on public.course_collaborators
    for select
    to authenticated
    using (public.can_view_course(course_id));

create policy "Course owners can add collaborators"
    on public.course_collaborators
    for insert
    to authenticated
    with check (
        public.owns_course(course_id)
        and added_by = public.current_profile_id()
    );

create policy "Course owners can update collaborators"
    on public.course_collaborators
    for update
    to authenticated
    using (public.owns_course(course_id))
    with check (public.owns_course(course_id));

create policy "Course owners can remove collaborators"
    on public.course_collaborators
    for delete
    to authenticated
    using (public.owns_course(course_id));
