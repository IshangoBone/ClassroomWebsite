alter table public.lessons
    add column if not exists is_locked boolean not null default false;

alter table public.courses
    add column if not exists lesson_release_mode text not null default 'all_available',
    add column if not exists lesson_release_start_date date,
    add column if not exists lesson_release_interval_days integer not null default 1;

alter table public.courses
    drop constraint if exists courses_lesson_release_mode_check,
    add constraint courses_lesson_release_mode_check
        check (lesson_release_mode in ('all_available', 'daily'));

alter table public.courses
    drop constraint if exists courses_lesson_release_interval_days_check,
    add constraint courses_lesson_release_interval_days_check
        check (lesson_release_interval_days between 1 and 30);

grant update (
    lesson_release_mode,
    lesson_release_start_date,
    lesson_release_interval_days
) on table public.courses to authenticated;

grant update (is_locked) on table public.lessons to authenticated;

create or replace function public.lesson_is_available(lesson_to_check uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.lessons as lesson
        join public.modules as module
            on module.id = lesson.module_id
        where lesson.id = lesson_to_check
            and not lesson.is_locked
            and lesson.archived_at is null
            and module.archived_at is null
    );
$$;
