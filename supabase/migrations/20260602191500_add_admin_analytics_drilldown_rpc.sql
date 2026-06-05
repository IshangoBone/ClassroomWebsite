create function public.get_admin_platform_analytics_drilldown(
    metric_input text,
    limit_input integer default 50
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
language sql
stable
security definer
set search_path = ''
as $$
    with normalized as (
        select
            nullif(btrim(lower(coalesce(metric_input, ''))), '') as metric_key,
            least(greatest(coalesce(limit_input, 50), 1), 100) as row_limit
    ),
    teacher_profiles as (
        select owner_user_id as profile_id
        from public.courses
        union
        select owner_teacher_id as profile_id
        from public.classrooms
        union
        select user_id as profile_id
        from public.course_collaborators
        where permission_level in ('teacher', 'editor', 'co_owner')
        union
        select user_id as profile_id
        from public.classroom_teachers
    ),
    student_profiles as (
        select user_id as profile_id
        from public.enrollments
        where enrollment_status <> 'removed'
    ),
    user_records as (
        select
            'users'::text as metric_key,
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
    ),
    active_user_records as (
        select *
        from user_records
        where status_label = 'active'
    ),
    teacher_records as (
        select user_records.*
        from user_records
        where user_records.record_id in (select profile_id from teacher_profiles)
    ),
    student_records as (
        select user_records.*
        from user_records
        where user_records.record_id in (select profile_id from student_profiles)
    ),
    new_user_records as (
        select *
        from user_records
        where created_at >= now() - interval '7 days'
    ),
    suspended_user_records as (
        select *
        from user_records
        where status_label = 'suspended'
    ),
    course_records as (
        select
            'courses'::text as metric_key,
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
        where course.status <> 'deleted'
    ),
    published_course_records as (
        select *
        from course_records
        where status_label = 'published'
    ),
    new_course_records as (
        select *
        from course_records
        where created_at >= now() - interval '30 days'
    ),
    classroom_records as (
        select
            'classrooms'::text as metric_key,
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
        where classroom.status <> 'deleted'
    ),
    active_classroom_records as (
        select *
        from classroom_records
        where status_label = 'active'
    ),
    new_classroom_records as (
        select *
        from classroom_records
        where created_at >= now() - interval '30 days'
    ),
    enrollment_records as (
        select
            'enrollments'::text as metric_key,
            'enrollment'::text as record_type,
            enrollment.id as record_id,
            coalesce(student.email, student.username, enrollment.user_id::text)::text as primary_label,
            concat_ws(' | ', course.title, classroom.name, enrollment.enrollment_type)::text as secondary_label,
            enrollment.enrollment_status::text as status_label,
            1::numeric as metric_value,
            enrollment.created_at,
            enrollment.updated_at
        from public.enrollments as enrollment
        left join public.profiles as student
            on student.id = enrollment.user_id
        left join public.courses as course
            on course.id = enrollment.course_id
        left join public.classrooms as classroom
            on classroom.id = enrollment.classroom_id
        where enrollment.enrollment_status <> 'removed'
    ),
    submission_records as (
        select
            'submissions'::text as metric_key,
            'submission'::text as record_type,
            submission.id as record_id,
            coalesce(student.email, student.username, submission.student_user_id::text)::text as primary_label,
            concat_ws(' | ', course.title, lesson.title, classroom.name)::text as secondary_label,
            submission.status::text as status_label,
            submission.points_earned as metric_value,
            submission.created_at,
            submission.updated_at
        from public.lesson_submissions as submission
        left join public.profiles as student
            on student.id = submission.student_user_id
        left join public.courses as course
            on course.id = submission.course_id
        left join public.classrooms as classroom
            on classroom.id = submission.classroom_id
        left join public.lessons as lesson
            on lesson.id = submission.lesson_id
    ),
    archived_content_records as (
        select * from course_records where status_label = 'archived'
        union all
        select * from classroom_records where status_label = 'archived'
    ),
    deleted_content_records as (
        select
            'deleted_content'::text as metric_key,
            'course'::text as record_type,
            course.id as record_id,
            coalesce(course.title, course.id::text)::text as primary_label,
            concat_ws(' | ', nullif(course.subject_area, ''), nullif(course.estimated_length, ''), owner.email)::text as secondary_label,
            course.status::text as status_label,
            0::numeric as metric_value,
            course.created_at,
            course.updated_at
        from public.courses as course
        left join public.profiles as owner
            on owner.id = course.owner_user_id
        where course.status = 'deleted'
        union all
        select
            'deleted_content'::text as metric_key,
            'classroom'::text as record_type,
            classroom.id as record_id,
            concat_ws(' - ', classroom.name, nullif(classroom.period_block, ''))::text as primary_label,
            concat_ws(' | ', course.title, nullif(classroom.school_year, ''), owner.email)::text as secondary_label,
            classroom.status::text as status_label,
            0::numeric as metric_value,
            classroom.created_at,
            classroom.updated_at
        from public.classrooms as classroom
        left join public.courses as course
            on course.id = classroom.course_id
        left join public.profiles as owner
            on owner.id = classroom.owner_teacher_id
        where classroom.status = 'deleted'
    ),
    all_records as (
        select 'users'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from user_records
        union all
        select 'active_users'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from active_user_records
        union all
        select 'teachers'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from teacher_records
        union all
        select 'students'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from student_records
        union all
        select 'new_users'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from new_user_records
        union all
        select 'suspended_users'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from suspended_user_records
        union all
        select 'courses'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from course_records
        union all
        select 'published_courses'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from published_course_records
        union all
        select 'new_courses'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from new_course_records
        union all
        select 'classrooms'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from classroom_records
        union all
        select 'active_classrooms'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from active_classroom_records
        union all
        select 'new_classrooms'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from new_classroom_records
        union all
        select 'enrollments'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from enrollment_records
        union all
        select 'submissions'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from submission_records
        union all
        select 'archived_content'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from archived_content_records
        union all
        select 'deleted_content'::text as metric_key, record_type, record_id, primary_label, secondary_label, status_label, metric_value, created_at, updated_at from deleted_content_records
    )
    select
        all_records.metric_key,
        all_records.record_type,
        all_records.record_id,
        all_records.primary_label,
        all_records.secondary_label,
        all_records.status_label,
        all_records.metric_value,
        all_records.created_at,
        all_records.updated_at
    from all_records
    cross join normalized
    where public.is_platform_admin()
        and normalized.metric_key is not null
        and all_records.metric_key = normalized.metric_key
    order by
        all_records.metric_value desc,
        coalesce(all_records.updated_at, all_records.created_at) desc
    limit (select row_limit from normalized);
$$;

revoke all on function public.get_admin_platform_analytics_drilldown(text, integer) from public;
grant execute on function public.get_admin_platform_analytics_drilldown(text, integer) to authenticated;
