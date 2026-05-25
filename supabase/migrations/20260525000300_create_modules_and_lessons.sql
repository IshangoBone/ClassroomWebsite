create table public.modules (
    id uuid primary key default gen_random_uuid(),
    course_id uuid not null references public.courses (id) on delete restrict,
    title text not null,
    description text,
    order_index integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz,
    constraint modules_title_check
        check (nullif(btrim(title), '') is not null),
    constraint modules_order_index_check
        check (order_index >= 0)
);

create index modules_course_id_order_idx
    on public.modules (course_id, order_index);

create table public.lessons (
    id uuid primary key default gen_random_uuid(),
    module_id uuid not null references public.modules (id) on delete restrict,
    title text not null,
    objective text,
    summary text,
    estimated_time text,
    order_index integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz,
    constraint lessons_title_check
        check (nullif(btrim(title), '') is not null),
    constraint lessons_estimated_time_check
        check (estimated_time is null or nullif(btrim(estimated_time), '') is not null),
    constraint lessons_order_index_check
        check (order_index >= 0)
);

create index lessons_module_id_order_idx
    on public.lessons (module_id, order_index);

create function public.set_learning_content_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_modules_updated_at
    before update on public.modules
    for each row
    execute function public.set_learning_content_updated_at();

create trigger set_lessons_updated_at
    before update on public.lessons
    for each row
    execute function public.set_learning_content_updated_at();

create function public.course_id_for_module(module_to_check uuid)
returns uuid
language sql
stable
security definer set search_path = ''
as $$
    select module.course_id
    from public.modules as module
    where module.id = module_to_check;
$$;

create function public.course_id_for_lesson(lesson_to_check uuid)
returns uuid
language sql
stable
security definer set search_path = ''
as $$
    select module.course_id
    from public.lessons as lesson
    join public.modules as module
        on module.id = lesson.module_id
    where lesson.id = lesson_to_check;
$$;

create function public.can_view_course_content(course_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select
        public.can_view_course(course_to_check)
        or public.is_enrolled_in_course(course_to_check);
$$;

create function public.module_is_available(module_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select exists (
        select 1
        from public.modules as module
        where module.id = module_to_check
            and module.archived_at is null
    );
$$;

create function public.lesson_is_available(lesson_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select exists (
        select 1
        from public.lessons as lesson
        join public.modules as module
            on module.id = lesson.module_id
        where lesson.id = lesson_to_check
            and lesson.archived_at is null
            and module.archived_at is null
    );
$$;

revoke all on function public.course_id_for_module(uuid) from public;
revoke all on function public.course_id_for_lesson(uuid) from public;
revoke all on function public.can_view_course_content(uuid) from public;
revoke all on function public.module_is_available(uuid) from public;
revoke all on function public.lesson_is_available(uuid) from public;

grant execute on function public.course_id_for_module(uuid) to authenticated;
grant execute on function public.course_id_for_lesson(uuid) to authenticated;
grant execute on function public.can_view_course_content(uuid) to authenticated;
grant execute on function public.module_is_available(uuid) to authenticated;
grant execute on function public.lesson_is_available(uuid) to authenticated;

alter table public.modules enable row level security;
alter table public.lessons enable row level security;

revoke all on table public.modules from anon;
revoke all on table public.modules from authenticated;
revoke all on table public.lessons from anon;
revoke all on table public.lessons from authenticated;

grant select on table public.modules to authenticated;
grant insert (
    course_id,
    title,
    description,
    order_index
) on table public.modules to authenticated;
grant update (
    title,
    description,
    order_index,
    archived_at
) on table public.modules to authenticated;

grant select on table public.lessons to authenticated;
grant insert (
    module_id,
    title,
    objective,
    summary,
    estimated_time,
    order_index
) on table public.lessons to authenticated;
grant update (
    title,
    objective,
    summary,
    estimated_time,
    order_index,
    archived_at
) on table public.lessons to authenticated;

create policy "Authorized users can view modules"
    on public.modules
    for select
    to authenticated
    using (
        public.can_manage_course(course_id)
        or (
            archived_at is null
            and public.can_view_course_content(course_id)
        )
    );

create policy "Course managers can create modules"
    on public.modules
    for insert
    to authenticated
    with check (public.can_manage_course(course_id));

create policy "Course managers can update modules"
    on public.modules
    for update
    to authenticated
    using (public.can_manage_course(course_id))
    with check (public.can_manage_course(course_id));

create policy "Authorized users can view lessons"
    on public.lessons
    for select
    to authenticated
    using (
        public.can_manage_course(public.course_id_for_module(module_id))
        or (
            archived_at is null
            and public.module_is_available(module_id)
            and public.can_view_course_content(public.course_id_for_module(module_id))
        )
    );

create policy "Course managers can create lessons"
    on public.lessons
    for insert
    to authenticated
    with check (public.can_manage_course(public.course_id_for_module(module_id)));

create policy "Course managers can update lessons"
    on public.lessons
    for update
    to authenticated
    using (public.can_manage_course(public.course_id_for_module(module_id)))
    with check (public.can_manage_course(public.course_id_for_module(module_id)));
