create table public.lesson_content_blocks (
    id uuid primary key default gen_random_uuid(),
    lesson_id uuid not null references public.lessons (id) on delete restrict,
    block_type text not null,
    title text,
    body_text text,
    external_url text,
    file_url text,
    file_type text,
    order_index integer not null,
    is_visible boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz,
    constraint lesson_content_blocks_type_check
        check (block_type in ('youtube', 'slides', 'text', 'file', 'link')),
    constraint lesson_content_blocks_order_index_check
        check (order_index >= 0),
    constraint lesson_content_blocks_file_type_check
        check (
            file_type is null
            or file_type in ('pdf', 'image', 'docx', 'pptx', 'zip')
        )
);

create index lesson_content_blocks_lesson_id_order_idx
    on public.lesson_content_blocks (lesson_id, order_index);

create trigger set_lesson_content_blocks_updated_at
    before update on public.lesson_content_blocks
    for each row
    execute function public.set_learning_content_updated_at();

alter table public.lesson_content_blocks enable row level security;

revoke all on table public.lesson_content_blocks from anon;
revoke all on table public.lesson_content_blocks from authenticated;

grant select on table public.lesson_content_blocks to authenticated;
grant insert (
    lesson_id,
    block_type,
    title,
    body_text,
    external_url,
    file_url,
    file_type,
    order_index,
    is_visible
) on table public.lesson_content_blocks to authenticated;
grant update (
    block_type,
    title,
    body_text,
    external_url,
    file_url,
    file_type,
    order_index,
    is_visible,
    archived_at
) on table public.lesson_content_blocks to authenticated;

create policy "Authorized users can view visible lesson content blocks"
    on public.lesson_content_blocks
    for select
    to authenticated
    using (
        public.can_manage_course(public.course_id_for_lesson(lesson_id))
        or (
            is_visible
            and archived_at is null
            and public.lesson_is_available(lesson_id)
            and public.can_view_course_content(public.course_id_for_lesson(lesson_id))
        )
    );

create policy "Course managers can create lesson content blocks"
    on public.lesson_content_blocks
    for insert
    to authenticated
    with check (public.can_manage_course(public.course_id_for_lesson(lesson_id)));

create policy "Course managers can update lesson content blocks"
    on public.lesson_content_blocks
    for update
    to authenticated
    using (public.can_manage_course(public.course_id_for_lesson(lesson_id)))
    with check (public.can_manage_course(public.course_id_for_lesson(lesson_id)));
