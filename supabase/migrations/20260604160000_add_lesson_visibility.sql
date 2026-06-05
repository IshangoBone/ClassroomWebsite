alter table public.lessons
    add column if not exists is_visible boolean not null default false;

update public.lessons as lesson
set is_visible = true
where exists (
    select 1
    from public.lesson_content_blocks as block
    where block.lesson_id = lesson.id
      and block.is_visible = true
      and block.archived_at is null
)
or exists (
    select 1
    from public.questions as question
    where question.lesson_id = lesson.id
      and question.is_visible = true
      and question.archived_at is null
);

grant update (is_visible) on table public.lessons to authenticated;
