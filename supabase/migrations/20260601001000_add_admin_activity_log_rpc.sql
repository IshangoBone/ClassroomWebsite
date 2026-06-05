create function public.get_admin_activity_logs(limit_input integer default 200)
returns table (
    id uuid,
    actor_user_id uuid,
    actor_display_name text,
    action_type text,
    target_type text,
    target_id uuid,
    target_display_name text,
    course_id uuid,
    course_title text,
    classroom_id uuid,
    classroom_label text,
    old_value_json jsonb,
    new_value_json jsonb,
    metadata_json jsonb,
    created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        activity.id,
        activity.actor_user_id,
        nullif(
            btrim(concat_ws(' ', actor.legal_first_name, actor.legal_last_name)),
            ''
        )::text as actor_display_name,
        activity.action_type,
        activity.target_type,
        activity.target_id,
        case activity.target_type
            when 'user' then coalesce(
                nullif(btrim(concat_ws(' ', target_profile.legal_first_name, target_profile.legal_last_name)), ''),
                target_profile.username,
                target_profile.email
            )
            when 'course' then target_course.title
            when 'classroom' then concat_ws(
                ' - ',
                target_classroom.name,
                nullif(target_classroom.period_block, '')
            )
            else null
        end::text as target_display_name,
        activity.course_id,
        course.title as course_title,
        activity.classroom_id,
        concat_ws(
            ' - ',
            classroom.name,
            nullif(classroom.period_block, '')
        )::text as classroom_label,
        activity.old_value_json,
        activity.new_value_json,
        activity.metadata_json,
        activity.created_at
    from public.activity_logs as activity
    left join public.profiles as actor
        on actor.id = activity.actor_user_id
    left join public.profiles as target_profile
        on target_profile.id = activity.target_id
        and activity.target_type = 'user'
    left join public.courses as target_course
        on target_course.id = activity.target_id
        and activity.target_type = 'course'
    left join public.classrooms as target_classroom
        on target_classroom.id = activity.target_id
        and activity.target_type = 'classroom'
    left join public.courses as course
        on course.id = activity.course_id
    left join public.classrooms as classroom
        on classroom.id = activity.classroom_id
    where public.is_platform_admin()
    order by activity.created_at desc
    limit least(greatest(coalesce(limit_input, 200), 1), 500);
$$;

revoke all on function public.get_admin_activity_logs(integer) from public;
grant execute on function public.get_admin_activity_logs(integer) to authenticated;
