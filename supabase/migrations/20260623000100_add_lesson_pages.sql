create table public.lesson_pages (
    id uuid primary key default gen_random_uuid(),
    lesson_id uuid not null references public.lessons (id) on delete restrict,
    title text not null default 'Lesson page',
    page_type text not null default 'lesson',
    order_index integer not null,
    is_visible boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz,
    constraint lesson_pages_title_check
        check (nullif(btrim(title), '') is not null),
    constraint lesson_pages_type_check
        check (page_type in ('lesson', 'coding', 'vocab', 'article', 'reflection', 'practice')),
    constraint lesson_pages_order_index_check
        check (order_index >= 0)
);

create index lesson_pages_lesson_id_order_idx
    on public.lesson_pages (lesson_id, order_index)
    where archived_at is null;

create trigger set_lesson_pages_updated_at
    before update on public.lesson_pages
    for each row
    execute function public.set_learning_content_updated_at();

alter table public.lesson_content_blocks
    add column lesson_page_id uuid references public.lesson_pages (id) on delete set null;

alter table public.questions
    add column lesson_page_id uuid references public.lesson_pages (id) on delete set null;

create index lesson_content_blocks_page_order_idx
    on public.lesson_content_blocks (lesson_page_id, order_index)
    where archived_at is null;

create index questions_page_phase_order_idx
    on public.questions (lesson_page_id, phase, order_index)
    where archived_at is null;

insert into public.lesson_pages (lesson_id, title, page_type, order_index, is_visible)
select
    lesson.id,
    'Page 1',
    'lesson',
    0,
    lesson.is_visible
from public.lessons as lesson
where lesson.archived_at is null
    and (
        exists (
            select 1
            from public.lesson_content_blocks as block
            where block.lesson_id = lesson.id
        )
        or exists (
            select 1
            from public.questions as question
            where question.lesson_id = lesson.id
        )
    )
    and not exists (
        select 1
        from public.lesson_pages as page
        where page.lesson_id = lesson.id
            and page.archived_at is null
    );

update public.lesson_content_blocks as block
set lesson_page_id = page.id
from public.lesson_pages as page
where block.lesson_id = page.lesson_id
    and block.lesson_page_id is null
    and page.order_index = 0
    and page.archived_at is null;

update public.questions as question
set lesson_page_id = page.id
from public.lesson_pages as page
where question.lesson_id = page.lesson_id
    and question.lesson_page_id is null
    and page.order_index = 0
    and page.archived_at is null;

alter table public.lesson_pages enable row level security;

revoke all on table public.lesson_pages from anon;
revoke all on table public.lesson_pages from authenticated;

grant select on table public.lesson_pages to authenticated;
grant insert (
    lesson_id,
    title,
    page_type,
    order_index,
    is_visible
) on table public.lesson_pages to authenticated;
grant update (
    title,
    page_type,
    order_index,
    is_visible,
    archived_at
) on table public.lesson_pages to authenticated;

grant insert (
    lesson_page_id
) on table public.lesson_content_blocks to authenticated;
grant update (
    lesson_page_id
) on table public.lesson_content_blocks to authenticated;

grant insert (
    lesson_page_id
) on table public.questions to authenticated;
grant update (
    lesson_page_id
) on table public.questions to authenticated;

create policy "Authorized users can view lesson pages"
    on public.lesson_pages
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

create policy "Course managers can create lesson pages"
    on public.lesson_pages
    for insert
    to authenticated
    with check (public.can_manage_course(public.course_id_for_lesson(lesson_id)));

create policy "Course managers can update lesson pages"
    on public.lesson_pages
    for update
    to authenticated
    using (public.can_manage_course(public.course_id_for_lesson(lesson_id)))
    with check (public.can_manage_course(public.course_id_for_lesson(lesson_id)));

drop view if exists public.student_visible_question_options;
drop view if exists public.student_visible_questions;

create view public.student_visible_questions as
select
    question.id,
    question.lesson_id,
    question.lesson_page_id,
    question.phase,
    question.question_type,
    question.prompt,
    question.student_instructions,
    question.hint,
    question.points,
    question.is_required,
    question.order_index
from public.questions as question
where question.is_visible = true
    and question.archived_at is null
    and public.lesson_is_available(question.lesson_id)
    and public.can_view_course_content(public.course_id_for_lesson(question.lesson_id));

create view public.student_visible_question_options as
select
    question_option.id,
    question_option.question_id,
    question_option.option_text,
    question_option.option_value,
    question_option.order_index
from public.question_options as question_option
join public.questions as question
    on question.id = question_option.question_id
where question.is_visible = true
    and question.archived_at is null
    and public.lesson_is_available(question.lesson_id)
    and public.can_view_course_content(public.course_id_for_lesson(question.lesson_id));

revoke all on table public.student_visible_questions from anon;
revoke all on table public.student_visible_questions from authenticated;
revoke all on table public.student_visible_question_options from anon;
revoke all on table public.student_visible_question_options from authenticated;

grant select on table public.student_visible_questions to authenticated;
grant select on table public.student_visible_question_options to authenticated;
