create function public.get_admin_platform_analytics_drilldown(
    metric_input text,
    limit_input integer default 50,
    range_days_input integer default 7
)
returns table (
    metric_key text,
    record_type text,
    record_id uuid,
    primary_label text,
    secondary_label text,
    status_label text,
    metric_value numeric,
    created_at timestamptz,
    updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    normalized_metric text := nullif(btrim(lower(coalesce(metric_input, ''))), '');
    normalized_limit integer := least(greatest(coalesce(limit_input, 50), 1), 100);
    normalized_days integer := case
        when range_days_input in (7, 30, 90) then range_days_input
        else 7
    end;
begin
    if normalized_metric = 'new_users' then
        return query
        select
            'new_users'::text as metric_key,
            'user'::text as record_type,
            profile.id as record_id,
            coalesce(
                nullif(btrim(concat_ws(' ', profile.legal_first_name, profile.legal_last_name)), ''),
                profile.username,
                profile.email,
                profile.id::text
            )::text as primary_label,
            concat_ws(' | ', nullif(profile.email, ''), nullif(profile.username, ''), profile.platform_role)::text as secondary_label,
            profile.account_status::text as status_label,
            (
                select count(*)
                from public.activity_logs as activity
                where activity.actor_user_id = profile.id
                    or (
                        activity.target_type = 'user'
                        and activity.target_id = profile.id
                    )
            )::numeric as metric_value,
            profile.created_at,
            profile.updated_at
        from public.profiles as profile
        where public.is_platform_admin()
            and profile.created_at >= now() - (normalized_days * interval '1 day')
        order by profile.created_at desc
        limit normalized_limit;
        return;
    end if;

    if normalized_metric = 'new_courses' then
        return query
        select
            'new_courses'::text as metric_key,
            'course'::text as record_type,
            course.id as record_id,
            coalesce(course.title, course.id::text)::text as primary_label,
            concat_ws(' | ', nullif(course.subject_area, ''), nullif(course.estimated_length, ''), owner.email)::text as secondary_label,
            course.status::text as status_label,
            (
                select count(*)
                from public.lesson_submissions as submission
                where submission.course_id = course.id
                    and submission.status = 'submitted'
            )::numeric as metric_value,
            course.created_at,
            course.updated_at
        from public.courses as course
        left join public.profiles as owner
            on owner.id = course.owner_user_id
        where public.is_platform_admin()
            and course.status <> 'deleted'
            and course.created_at >= now() - (normalized_days * interval '1 day')
        order by course.created_at desc
        limit normalized_limit;
        return;
    end if;

    if normalized_metric = 'new_classrooms' then
        return query
        select
            'new_classrooms'::text as metric_key,
            'classroom'::text as record_type,
            classroom.id as record_id,
            concat_ws(' - ', classroom.name, nullif(classroom.period_block, ''))::text as primary_label,
            concat_ws(' | ', course.title, nullif(classroom.school_year, ''), owner.email)::text as secondary_label,
            classroom.status::text as status_label,
            (
                select count(*)
                from public.enrollments as enrollment
                where enrollment.classroom_id = classroom.id
                    and enrollment.enrollment_status <> 'removed'
            )::numeric as metric_value,
            classroom.created_at,
            classroom.updated_at
        from public.classrooms as classroom
        left join public.courses as course
            on course.id = classroom.course_id
        left join public.profiles as owner
            on owner.id = classroom.owner_teacher_id
        where public.is_platform_admin()
            and classroom.status <> 'deleted'
            and classroom.created_at >= now() - (normalized_days * interval '1 day')
        order by classroom.created_at desc
        limit normalized_limit;
        return;
    end if;

    return query
    select *
    from public.get_admin_platform_analytics_drilldown(normalized_metric, normalized_limit);
end;
$$;

revoke all on function public.get_admin_platform_analytics_drilldown(text, integer, integer) from public;
grant execute on function public.get_admin_platform_analytics_drilldown(text, integer, integer) to authenticated;
