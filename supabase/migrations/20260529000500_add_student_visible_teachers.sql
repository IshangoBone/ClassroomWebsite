create function public.student_visible_teachers()
returns table (
    course_id uuid,
    classroom_id uuid,
    teacher_id uuid,
    username text,
    legal_first_name text,
    legal_last_name text
)
language sql
stable
security definer set search_path = ''
as $$
    select distinct
        enrollment.course_id,
        classroom.id as classroom_id,
        teacher.id as teacher_id,
        teacher.username,
        teacher.legal_first_name,
        teacher.legal_last_name
    from public.enrollments as enrollment
    left join public.classrooms as classroom
        on classroom.id = enrollment.classroom_id
    join public.courses as course
        on course.id = enrollment.course_id
    join public.profiles as teacher
        on teacher.id = coalesce(classroom.owner_teacher_id, course.owner_user_id)
    where enrollment.user_id = public.current_profile_id()
        and enrollment.enrollment_status = 'active';
$$;

revoke all on function public.student_visible_teachers() from public;
grant execute on function public.student_visible_teachers() to authenticated;
