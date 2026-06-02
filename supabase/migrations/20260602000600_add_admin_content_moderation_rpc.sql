create function public.get_admin_content_moderation_records(
    record_type_filter text default '',
    status_filter text default '',
    search_input text default '',
    limit_input integer default 100
)
returns table (
    record_type text,
    record_id uuid,
    primary_label text,
    secondary_label text,
    status_label text,
    owner_user_id uuid,
    owner_email text,
    course_id uuid,
    course_title text,
    classroom_count bigint,
    enrollment_count bigint,
    submission_count bigint,
    activity_count bigint,
    created_at timestamptz,
    updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    with filters as (
        select
            nullif(btrim(lower(coalesce(record_type_filter, ''))), '') as record_type_value,
            nullif(btrim(lower(coalesce(status_filter, ''))), '') as status_value,
            nullif(btrim(lower(coalesce(search_input, ''))), '') as search_value
    ),
    course_records as (
        select
            'course'::text as record_type,
            course.id as record_id,
            coalesce(course.title, course.id::text)::text as primary_label,
            concat_ws(
                ' | ',
                nullif(course.subject_area, ''),
                nullif(course.estimated_length, ''),
                owner.email
            )::text as secondary_label,
            course.status::text as status_label,
            course.owner_user_id,
            owner.email as owner_email,
            course.id as course_id,
            course.title as course_title,
            (
                select count(*)
                from public.classrooms as classroom
                where classroom.course_id = course.id
            ) as classroom_count,
            (
                select count(*)
                from public.enrollments as enrollment
                where enrollment.course_id = course.id
                    and enrollment.enrollment_status <> 'removed'
            ) as enrollment_count,
            (
                select count(*)
                from public.lesson_submissions as submission
                where submission.course_id = course.id
            ) as submission_count,
            (
                select count(*)
                from public.activity_logs as activity
                where activity.course_id = course.id
                    or (
                        activity.target_type = 'course'
                        and activity.target_id = course.id
                    )
            ) as activity_count,
            course.created_at,
            course.updated_at
        from public.courses as course
        left join public.profiles as owner
            on owner.id = course.owner_user_id
    ),
    classroom_records as (
        select
            'classroom'::text as record_type,
            classroom.id as record_id,
            concat_ws(
                ' - ',
                classroom.name,
                nullif(classroom.period_block, '')
            )::text as primary_label,
            concat_ws(
                ' | ',
                course.title,
                nullif(classroom.school_year, ''),
                owner.email
            )::text as secondary_label,
            classroom.status::text as status_label,
            classroom.owner_teacher_id as owner_user_id,
            owner.email as owner_email,
            classroom.course_id,
            course.title as course_title,
            0::bigint as classroom_count,
            (
                select count(*)
                from public.enrollments as enrollment
                where enrollment.classroom_id = classroom.id
                    and enrollment.enrollment_status <> 'removed'
            ) as enrollment_count,
            (
                select count(*)
                from public.lesson_submissions as submission
                where submission.classroom_id = classroom.id
            ) as submission_count,
            (
                select count(*)
                from public.activity_logs as activity
                where activity.classroom_id = classroom.id
                    or (
                        activity.target_type = 'classroom'
                        and activity.target_id = classroom.id
                    )
            ) as activity_count,
            classroom.created_at,
            classroom.updated_at
        from public.classrooms as classroom
        left join public.courses as course
            on course.id = classroom.course_id
        left join public.profiles as owner
            on owner.id = classroom.owner_teacher_id
    )
    select records.*
    from (
        select * from course_records
        union all
        select * from classroom_records
    ) as records
    cross join filters
    where public.is_platform_admin()
        and (
            filters.record_type_value is null
            or records.record_type = filters.record_type_value
        )
        and (
            filters.status_value is null
            or records.status_label = filters.status_value
        )
        and (
            filters.search_value is null
            or records.primary_label ilike '%' || filters.search_value || '%'
            or records.secondary_label ilike '%' || filters.search_value || '%'
            or records.owner_email ilike '%' || filters.search_value || '%'
            or records.course_title ilike '%' || filters.search_value || '%'
            or records.record_id::text ilike '%' || filters.search_value || '%'
        )
    order by
        case records.status_label
            when 'deleted' then 0
            when 'archived' then 1
            when 'draft' then 2
            else 3
        end,
        records.updated_at desc
    limit least(greatest(coalesce(limit_input, 100), 1), 200);
$$;

revoke all on function public.get_admin_content_moderation_records(text, text, text, integer) from public;
grant execute on function public.get_admin_content_moderation_records(text, text, text, integer) to authenticated;
