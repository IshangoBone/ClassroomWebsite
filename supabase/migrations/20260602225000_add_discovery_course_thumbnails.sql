drop function if exists public.discover_public_courses(text);

create function public.discover_public_courses(search_text text default null)
returns table (
    course_id uuid,
    title text,
    description text,
    subject_area text,
    tags text[],
    estimated_length text,
    thumbnail_url text,
    thumbnail_type text,
    teacher_name text,
    lesson_count bigint,
    already_enrolled boolean,
    has_classroom_access boolean
)
language sql
stable
security definer set search_path = ''
as $$
    with visible_lessons as (
        select
            module.course_id,
            count(lesson.id) as lesson_count
        from public.modules as module
        join public.lessons as lesson
            on lesson.module_id = module.id
        where module.archived_at is null
            and lesson.archived_at is null
        group by module.course_id
    )
    select
        course.id as course_id,
        course.title,
        course.description,
        course.subject_area,
        course.tags,
        course.estimated_length,
        course.thumbnail_url,
        course.thumbnail_type,
        coalesce(
            nullif(btrim(concat_ws(' ', owner.legal_first_name, owner.legal_last_name)), ''),
            owner.username,
            'Teacher'
        ) as teacher_name,
        coalesce(visible_lessons.lesson_count, 0) as lesson_count,
        exists (
            select 1
            from public.enrollments as enrollment
            where enrollment.user_id = public.current_profile_id()
                and enrollment.course_id = course.id
                and enrollment.enrollment_type = 'course'
                and enrollment.classroom_id is null
                and enrollment.enrollment_status <> 'removed'
        ) as already_enrolled,
        exists (
            select 1
            from public.enrollments as enrollment
            where enrollment.user_id = public.current_profile_id()
                and enrollment.course_id = course.id
                and enrollment.enrollment_type = 'classroom'
                and enrollment.classroom_id is not null
                and enrollment.enrollment_status <> 'removed'
        ) as has_classroom_access
    from public.courses as course
    join public.profiles as owner
        on owner.id = course.owner_user_id
    left join visible_lessons
        on visible_lessons.course_id = course.id
    where course.status = 'published'
        and course.is_publicly_discoverable
        and (
            nullif(btrim(coalesce(search_text, '')), '') is null
            or course.title ilike '%' || btrim(search_text) || '%'
            or course.description ilike '%' || btrim(search_text) || '%'
            or course.subject_area ilike '%' || btrim(search_text) || '%'
            or array_to_string(course.tags, ' ') ilike '%' || btrim(search_text) || '%'
        )
    order by course.updated_at desc;
$$;

revoke all on function public.discover_public_courses(text) from public;
grant execute on function public.discover_public_courses(text) to authenticated;
