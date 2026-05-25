create table public.questions (
    id uuid primary key default gen_random_uuid(),
    lesson_id uuid not null references public.lessons (id) on delete restrict,
    phase text not null,
    question_type text not null,
    prompt text not null,
    student_instructions text,
    hint text,
    correct_answer jsonb,
    points numeric not null default 1,
    is_required boolean not null default false,
    is_visible boolean not null default true,
    order_index integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    archived_at timestamptz,
    constraint questions_phase_check
        check (phase in ('before', 'during', 'reflection')),
    constraint questions_type_check
        check (
            question_type in (
                'multiple_choice',
                'true_false',
                'short_response',
                'long_response',
                'rating_scale',
                'select_all_that_apply',
                'matching',
                'ordering',
                'fill_in_the_blank'
            )
        ),
    constraint questions_prompt_check
        check (nullif(btrim(prompt), '') is not null),
    constraint questions_points_check
        check (points >= 0),
    constraint questions_order_index_check
        check (order_index >= 0)
);

create index questions_lesson_phase_order_idx
    on public.questions (lesson_id, phase, order_index);

create table public.question_options (
    id uuid primary key default gen_random_uuid(),
    question_id uuid not null references public.questions (id) on delete restrict,
    option_text text not null,
    option_value text,
    is_correct boolean not null default false,
    match_group text,
    order_index integer not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint question_options_text_check
        check (nullif(btrim(option_text), '') is not null),
    constraint question_options_order_index_check
        check (order_index >= 0)
);

create index question_options_question_id_order_idx
    on public.question_options (question_id, order_index);

create trigger set_questions_updated_at
    before update on public.questions
    for each row
    execute function public.set_learning_content_updated_at();

create trigger set_question_options_updated_at
    before update on public.question_options
    for each row
    execute function public.set_learning_content_updated_at();

create function public.lesson_id_for_question(question_to_check uuid)
returns uuid
language sql
stable
security definer set search_path = ''
as $$
    select question.lesson_id
    from public.questions as question
    where question.id = question_to_check;
$$;

revoke all on function public.lesson_id_for_question(uuid) from public;
grant execute on function public.lesson_id_for_question(uuid) to authenticated;

alter table public.questions enable row level security;
alter table public.question_options enable row level security;

revoke all on table public.questions from anon;
revoke all on table public.questions from authenticated;
revoke all on table public.question_options from anon;
revoke all on table public.question_options from authenticated;

grant select on table public.questions to authenticated;
grant insert (
    lesson_id,
    phase,
    question_type,
    prompt,
    student_instructions,
    hint,
    correct_answer,
    points,
    is_required,
    is_visible,
    order_index
) on table public.questions to authenticated;
grant update (
    phase,
    question_type,
    prompt,
    student_instructions,
    hint,
    correct_answer,
    points,
    is_required,
    is_visible,
    order_index,
    archived_at
) on table public.questions to authenticated;

grant select on table public.question_options to authenticated;
grant insert (
    question_id,
    option_text,
    option_value,
    is_correct,
    match_group,
    order_index
) on table public.question_options to authenticated;
grant update (
    option_text,
    option_value,
    is_correct,
    match_group,
    order_index
) on table public.question_options to authenticated;

create policy "Course managers can view questions"
    on public.questions
    for select
    to authenticated
    using (public.can_manage_course(public.course_id_for_lesson(lesson_id)));

create policy "Course managers can create questions"
    on public.questions
    for insert
    to authenticated
    with check (public.can_manage_course(public.course_id_for_lesson(lesson_id)));

create policy "Course managers can update questions"
    on public.questions
    for update
    to authenticated
    using (public.can_manage_course(public.course_id_for_lesson(lesson_id)))
    with check (public.can_manage_course(public.course_id_for_lesson(lesson_id)));

create policy "Course managers can view question options"
    on public.question_options
    for select
    to authenticated
    using (
        public.can_manage_course(
            public.course_id_for_lesson(public.lesson_id_for_question(question_id))
        )
    );

create policy "Course managers can create question options"
    on public.question_options
    for insert
    to authenticated
    with check (
        public.can_manage_course(
            public.course_id_for_lesson(public.lesson_id_for_question(question_id))
        )
    );

create policy "Course managers can update question options"
    on public.question_options
    for update
    to authenticated
    using (
        public.can_manage_course(
            public.course_id_for_lesson(public.lesson_id_for_question(question_id))
        )
    )
    with check (
        public.can_manage_course(
            public.course_id_for_lesson(public.lesson_id_for_question(question_id))
        )
    );
