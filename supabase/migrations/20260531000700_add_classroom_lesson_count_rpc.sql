create or replace function public.classroom_course_lesson_count(classroom_to_check uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
    select count(lesson.id)::integer
    from public.classrooms as classroom
    join public.modules as module
        on module.course_id = classroom.course_id
        and module.archived_at is null
    join public.lessons as lesson
        on lesson.module_id = module.id
        and lesson.archived_at is null
    where classroom.id = classroom_to_check
        and public.manages_classroom(classroom.id);
$$;

revoke all on function public.classroom_course_lesson_count(uuid) from public;
grant execute on function public.classroom_course_lesson_count(uuid) to authenticated;
