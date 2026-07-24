alter table public.lesson_content_blocks
    drop constraint if exists lesson_content_blocks_type_check;

alter table public.lesson_content_blocks
    add constraint lesson_content_blocks_type_check
        check (block_type in ('youtube', 'slides', 'text', 'file', 'link', 'discussion'));

create table public.lesson_discussion_posts (
    id uuid primary key default gen_random_uuid(),
    lesson_id uuid not null references public.lessons (id) on delete restrict,
    content_block_id uuid not null references public.lesson_content_blocks (id) on delete cascade,
    author_user_id uuid not null references public.profiles (id) on delete restrict,
    body_text text not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz,
    constraint lesson_discussion_posts_body_check
        check (nullif(btrim(body_text), '') is not null)
);

create index lesson_discussion_posts_block_created_idx
    on public.lesson_discussion_posts (content_block_id, created_at)
    where archived_at is null;

create index lesson_discussion_posts_lesson_idx
    on public.lesson_discussion_posts (lesson_id, created_at)
    where archived_at is null;

create trigger set_lesson_discussion_posts_updated_at
    before update on public.lesson_discussion_posts
    for each row
    execute function public.set_learning_content_updated_at();

alter table public.lesson_discussion_posts enable row level security;

revoke all on table public.lesson_discussion_posts from anon;
revoke all on table public.lesson_discussion_posts from authenticated;

grant select on table public.lesson_discussion_posts to authenticated;
grant insert (
    lesson_id,
    content_block_id,
    author_user_id,
    body_text
) on table public.lesson_discussion_posts to authenticated;
grant update (
    body_text,
    archived_at
) on table public.lesson_discussion_posts to authenticated;

create policy "Course managers can view discussion posts"
    on public.lesson_discussion_posts
    for select
    to authenticated
    using (
        lesson_discussion_posts.archived_at is null
        and public.can_manage_course(public.course_id_for_lesson(lesson_discussion_posts.lesson_id))
    );

create policy "Students can view discussion posts for visible lesson blocks"
    on public.lesson_discussion_posts
    for select
    to authenticated
    using (
        lesson_discussion_posts.archived_at is null
        and public.can_view_course_content(public.course_id_for_lesson(lesson_discussion_posts.lesson_id))
        and exists (
            select 1
            from public.lesson_content_blocks as content_block
            where content_block.id = lesson_discussion_posts.content_block_id
                and content_block.lesson_id = lesson_discussion_posts.lesson_id
                and content_block.block_type = 'discussion'
                and content_block.is_visible
                and content_block.archived_at is null
        )
    );

create policy "Students can create their own discussion posts"
    on public.lesson_discussion_posts
    for insert
    to authenticated
    with check (
        lesson_discussion_posts.author_user_id = public.current_profile_id()
        and public.can_view_course_content(public.course_id_for_lesson(lesson_discussion_posts.lesson_id))
        and exists (
            select 1
            from public.lesson_content_blocks as content_block
            where content_block.id = lesson_discussion_posts.content_block_id
                and content_block.lesson_id = lesson_discussion_posts.lesson_id
                and content_block.block_type = 'discussion'
                and content_block.is_visible
                and content_block.archived_at is null
        )
    );

create policy "Students can update their own discussion posts"
    on public.lesson_discussion_posts
    for update
    to authenticated
    using (
        lesson_discussion_posts.archived_at is null
        and lesson_discussion_posts.author_user_id = public.current_profile_id()
    )
    with check (
        lesson_discussion_posts.author_user_id = public.current_profile_id()
    );
