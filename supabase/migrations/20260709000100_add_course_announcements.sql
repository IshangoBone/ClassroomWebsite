create table public.course_announcements (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses (id) on delete restrict,
    author_user_id uuid not null references public.profiles (id) on delete restrict,
    title text not null,
    message text not null,
    status text not null default 'published',
    published_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz,
    constraint course_announcements_title_check
        check (nullif(btrim(title), '') is not null),
    constraint course_announcements_message_check
        check (nullif(btrim(message), '') is not null),
    constraint course_announcements_status_check
        check (status in ('draft', 'published', 'archived'))
);

create index course_announcements_course_status_idx
    on public.course_announcements (course_id, status, published_at desc, created_at desc)
    where archived_at is null;

create trigger set_course_announcements_updated_at
    before update on public.course_announcements
    for each row
    execute function public.set_learning_content_updated_at();

alter table public.course_announcements enable row level security;

revoke all on table public.course_announcements from anon;
revoke all on table public.course_announcements from authenticated;

grant select on table public.course_announcements to authenticated;
grant insert (
    course_id,
    author_user_id,
    title,
    message,
    status,
    published_at
) on table public.course_announcements to authenticated;
grant update (
    title,
    message,
    status,
    published_at,
    archived_at
) on table public.course_announcements to authenticated;

create policy "Course managers can create announcements"
    on public.course_announcements
    for insert
    to authenticated
    with check (
        public.can_manage_course(course_id)
        and author_user_id = public.current_profile_id()
    );

create policy "Course managers can update announcements"
    on public.course_announcements
    for update
    to authenticated
    using (public.can_manage_course(course_id))
    with check (public.can_manage_course(course_id));

create policy "Course managers can view all announcements"
    on public.course_announcements
    for select
    to authenticated
    using (
        archived_at is null
        and public.can_manage_course(course_id)
    );

create policy "Enrolled students can view published announcements"
    on public.course_announcements
    for select
    to authenticated
    using (
        archived_at is null
        and status = 'published'
        and public.is_enrolled_in_course(course_id)
    );
