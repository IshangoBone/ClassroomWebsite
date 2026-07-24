alter table public.lesson_discussion_posts
    add column if not exists parent_post_id uuid references public.lesson_discussion_posts (id) on delete cascade;

create index if not exists lesson_discussion_posts_parent_idx
    on public.lesson_discussion_posts (parent_post_id, created_at)
    where archived_at is null;

grant insert (
    lesson_id,
    content_block_id,
    parent_post_id,
    author_user_id,
    body_text
) on table public.lesson_discussion_posts to authenticated;

drop policy if exists "Students can view discussion posts for visible lesson blocks"
    on public.lesson_discussion_posts;

drop policy if exists "Students can create their own discussion posts"
    on public.lesson_discussion_posts;

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
                and (
                    content_block.block_type = 'discussion'
                    or (
                        content_block.block_type = 'text'
                        and left(content_block.body_text, length('__ctc_lesson_layout_v1__')) = '__ctc_lesson_layout_v1__'
                        and content_block.body_text like '%"type":"discussion"%'
                    )
                )
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
                and (
                    content_block.block_type = 'discussion'
                    or (
                        content_block.block_type = 'text'
                        and left(content_block.body_text, length('__ctc_lesson_layout_v1__')) = '__ctc_lesson_layout_v1__'
                        and content_block.body_text like '%"type":"discussion"%'
                    )
                )
                and content_block.is_visible
                and content_block.archived_at is null
        )
        and (
            lesson_discussion_posts.parent_post_id is null
            or exists (
                select 1
                from public.lesson_discussion_posts as parent_post
                where parent_post.id = lesson_discussion_posts.parent_post_id
                    and parent_post.lesson_id = lesson_discussion_posts.lesson_id
                    and parent_post.content_block_id = lesson_discussion_posts.content_block_id
                    and parent_post.archived_at is null
            )
        )
    );
