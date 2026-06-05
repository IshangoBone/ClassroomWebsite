create function public.get_admin_record_detail(record_type_input text, record_id_input uuid)
returns table (
    record_type text,
    record_id uuid,
    primary_label text,
    secondary_label text,
    status_label text,
    detail_json jsonb,
    activity_count bigint,
    created_at timestamptz,
    updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    with normalized as (
        select btrim(lower(coalesce(record_type_input, ''))) as record_type
    ),
    user_detail as (
        select
            'user'::text as record_type,
            profile.id as record_id,
            coalesce(
                nullif(btrim(concat_ws(' ', profile.legal_first_name, profile.legal_last_name)), ''),
                profile.username,
                profile.email,
                profile.id::text
            )::text as primary_label,
            concat_ws(
                ' | ',
                nullif(profile.email, ''),
                nullif(profile.username, ''),
                profile.platform_role
            )::text as secondary_label,
            profile.account_status::text as status_label,
            jsonb_build_object(
                'email', profile.email,
                'username', profile.username,
                'platform_role', profile.platform_role,
                'account_status', profile.account_status,
                'profile_completed', profile.profile_completed,
                'auth_provider', profile.auth_provider,
                'last_login_at', profile.last_login_at
            ) as detail_json,
            (
                select count(*)
                from public.activity_logs as activity
                where activity.actor_user_id = profile.id
                    or (
                        activity.target_type = 'user'
                        and activity.target_id = profile.id
                    )
            ) as activity_count,
            profile.created_at,
            profile.updated_at
        from public.profiles as profile
        cross join normalized
        where normalized.record_type = 'user'
            and profile.id = record_id_input
    ),
    course_detail as (
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
            jsonb_build_object(
                'title', course.title,
                'subject_area', course.subject_area,
                'estimated_length', course.estimated_length,
                'owner_email', owner.email,
                'owner_user_id', course.owner_user_id,
                'is_platform_template', course.is_platform_template,
                'description', course.description
            ) as detail_json,
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
        cross join normalized
        where normalized.record_type = 'course'
            and course.id = record_id_input
    ),
    classroom_detail as (
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
            jsonb_build_object(
                'name', classroom.name,
                'period_block', classroom.period_block,
                'school_year', classroom.school_year,
                'school_organization', classroom.school_organization,
                'course_title', course.title,
                'course_id', classroom.course_id,
                'owner_email', owner.email,
                'owner_teacher_id', classroom.owner_teacher_id
            ) as detail_json,
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
        cross join normalized
        where normalized.record_type = 'classroom'
            and classroom.id = record_id_input
    )
    select *
    from (
        select * from user_detail
        union all
        select * from course_detail
        union all
        select * from classroom_detail
    ) as detail
    where public.is_platform_admin();
$$;

revoke all on function public.get_admin_record_detail(text, uuid) from public;
grant execute on function public.get_admin_record_detail(text, uuid) to authenticated;
