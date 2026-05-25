create table public.lesson_submissions (
    id uuid primary key default gen_random_uuid(),
    student_user_id uuid not null references public.profiles (id) on delete restrict,
    course_id uuid not null references public.courses (id) on delete restrict,
    classroom_id uuid,
    lesson_id uuid not null references public.lessons (id) on delete restrict,
    answers_json jsonb not null default '{}'::jsonb,
    total_questions integer not null default 0,
    points_possible numeric not null default 0,
    points_earned numeric not null default 0,
    status text not null default 'draft',
    submitted_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint lesson_submissions_classroom_course_fk
        foreign key (classroom_id, course_id)
        references public.classrooms (id, course_id)
        on delete restrict,
    constraint lesson_submissions_answers_check
        check (jsonb_typeof(answers_json) = 'object'),
    constraint lesson_submissions_questions_check
        check (total_questions >= 0),
    constraint lesson_submissions_points_possible_check
        check (points_possible >= 0),
    constraint lesson_submissions_points_earned_check
        check (points_earned >= 0 and points_earned <= points_possible),
    constraint lesson_submissions_status_check
        check (status in ('draft', 'submitted')),
    constraint lesson_submissions_submitted_at_check
        check (
            (status = 'draft' and submitted_at is null)
            or (status = 'submitted' and submitted_at is not null)
        )
);

create unique index lesson_submissions_student_context_key
    on public.lesson_submissions (
        student_user_id,
        course_id,
        lesson_id,
        coalesce(classroom_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

create index lesson_submissions_course_lesson_idx
    on public.lesson_submissions (course_id, lesson_id);

create index lesson_submissions_classroom_lesson_idx
    on public.lesson_submissions (classroom_id, lesson_id)
    where classroom_id is not null;

create table public.course_progress (
    id uuid primary key default gen_random_uuid(),
    student_user_id uuid not null references public.profiles (id) on delete restrict,
    course_id uuid not null references public.courses (id) on delete restrict,
    classroom_id uuid,
    lessons_started integer not null default 0,
    lessons_completed integer not null default 0,
    total_lessons integer not null default 0,
    progress_percent numeric not null default 0,
    total_points_possible numeric not null default 0,
    total_points_earned numeric not null default 0,
    last_activity_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint course_progress_classroom_course_fk
        foreign key (classroom_id, course_id)
        references public.classrooms (id, course_id)
        on delete restrict,
    constraint course_progress_lessons_started_check
        check (lessons_started >= 0 and lessons_started <= total_lessons),
    constraint course_progress_lessons_completed_check
        check (lessons_completed >= 0 and lessons_completed <= lessons_started),
    constraint course_progress_total_lessons_check
        check (total_lessons >= 0 and lessons_completed <= total_lessons),
    constraint course_progress_percent_check
        check (progress_percent >= 0 and progress_percent <= 100),
    constraint course_progress_points_possible_check
        check (total_points_possible >= 0),
    constraint course_progress_points_earned_check
        check (total_points_earned >= 0 and total_points_earned <= total_points_possible)
);

create unique index course_progress_student_context_key
    on public.course_progress (
        student_user_id,
        course_id,
        coalesce(classroom_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

create index course_progress_course_id_idx
    on public.course_progress (course_id);

create index course_progress_classroom_id_idx
    on public.course_progress (classroom_id)
    where classroom_id is not null;

create trigger set_lesson_submissions_updated_at
    before update on public.lesson_submissions
    for each row
    execute function public.set_learning_content_updated_at();

create trigger set_course_progress_updated_at
    before update on public.course_progress
    for each row
    execute function public.set_learning_content_updated_at();

create function public.lesson_belongs_to_course(lesson_to_check uuid, course_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select public.course_id_for_lesson(lesson_to_check) = course_to_check;
$$;

alter table public.lesson_submissions
    add constraint lesson_submissions_lesson_course_check
    check (public.lesson_belongs_to_course(lesson_id, course_id));

create function public.can_submit_draft_for_context(
    course_to_check uuid,
    classroom_to_check uuid
)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select exists (
        select 1
        from public.enrollments as enrollment
        where enrollment.user_id = public.current_profile_id()
            and enrollment.course_id = course_to_check
            and enrollment.enrollment_status = 'active'
            and (
                (
                    classroom_to_check is null
                    and enrollment.enrollment_type = 'course'
                    and enrollment.classroom_id is null
                )
                or (
                    classroom_to_check is not null
                    and enrollment.enrollment_type = 'classroom'
                    and enrollment.classroom_id = classroom_to_check
                )
            )
    );
$$;

create function public.can_review_student_context(
    course_to_check uuid,
    classroom_to_check uuid
)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select
        (
            classroom_to_check is null
            and public.can_manage_course(course_to_check)
        )
        or (
            classroom_to_check is not null
            and public.manages_classroom(classroom_to_check)
        );
$$;

revoke all on function public.lesson_belongs_to_course(uuid, uuid) from public;
revoke all on function public.can_submit_draft_for_context(uuid, uuid) from public;
revoke all on function public.can_review_student_context(uuid, uuid) from public;

grant execute on function public.lesson_belongs_to_course(uuid, uuid) to authenticated;
grant execute on function public.can_submit_draft_for_context(uuid, uuid) to authenticated;
grant execute on function public.can_review_student_context(uuid, uuid) to authenticated;

alter table public.lesson_submissions enable row level security;
alter table public.course_progress enable row level security;

revoke all on table public.lesson_submissions from anon;
revoke all on table public.lesson_submissions from authenticated;
revoke all on table public.course_progress from anon;
revoke all on table public.course_progress from authenticated;

grant select on table public.lesson_submissions to authenticated;
grant insert (
    student_user_id,
    course_id,
    classroom_id,
    lesson_id,
    answers_json
) on table public.lesson_submissions to authenticated;
grant update (answers_json) on table public.lesson_submissions to authenticated;

grant select on table public.course_progress to authenticated;

create policy "Students can view their own submissions"
    on public.lesson_submissions
    for select
    to authenticated
    using (student_user_id = public.current_profile_id());

create policy "Teachers can view managed student submissions"
    on public.lesson_submissions
    for select
    to authenticated
    using (public.can_review_student_context(course_id, classroom_id));

create policy "Students can create their own submission drafts"
    on public.lesson_submissions
    for insert
    to authenticated
    with check (
        student_user_id = public.current_profile_id()
        and status = 'draft'
        and public.lesson_belongs_to_course(lesson_id, course_id)
        and public.can_submit_draft_for_context(course_id, classroom_id)
    );

create policy "Students can update their own submission drafts"
    on public.lesson_submissions
    for update
    to authenticated
    using (
        student_user_id = public.current_profile_id()
        and status = 'draft'
        and public.can_submit_draft_for_context(course_id, classroom_id)
    )
    with check (
        student_user_id = public.current_profile_id()
        and status = 'draft'
        and public.lesson_belongs_to_course(lesson_id, course_id)
        and public.can_submit_draft_for_context(course_id, classroom_id)
    );

create policy "Students can view their own progress"
    on public.course_progress
    for select
    to authenticated
    using (student_user_id = public.current_profile_id());

create policy "Teachers can view managed student progress"
    on public.course_progress
    for select
    to authenticated
    using (public.can_review_student_context(course_id, classroom_id));
