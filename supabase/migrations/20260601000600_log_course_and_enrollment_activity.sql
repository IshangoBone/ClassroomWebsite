create function public.log_course_activity_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    activity_action text;
begin
    if TG_OP = 'INSERT' then
        activity_action := 'course_created';
    elsif TG_OP = 'UPDATE' then
        if (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at') then
            return new;
        end if;

        activity_action := case
            when new.status is distinct from old.status and new.status = 'published' then 'course_published'
            when new.status is distinct from old.status and new.status = 'private' then 'course_made_private'
            when new.status is distinct from old.status and new.status = 'archived' then 'course_archived'
            when new.status is distinct from old.status and new.status = 'deleted' then 'course_deleted'
            else 'course_updated'
        end;
    else
        return null;
    end if;

    insert into public.activity_logs (
        actor_user_id,
        action_type,
        target_type,
        target_id,
        course_id,
        old_value_json,
        new_value_json,
        metadata_json
    )
    values (
        public.current_profile_id(),
        activity_action,
        'course',
        new.id,
        new.id,
        case when TG_OP = 'UPDATE' then to_jsonb(old) else null end,
        to_jsonb(new),
        jsonb_build_object(
            'source', 'courses_trigger',
            'operation', TG_OP,
            'status', new.status
        )
    );

    return new;
end;
$$;

create trigger log_course_activity
    after insert or update on public.courses
    for each row
    execute function public.log_course_activity_from_trigger();

create function public.log_enrollment_activity_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    activity_action text;
    should_log boolean := false;
begin
    if TG_OP = 'INSERT' and new.enrollment_status = 'active' then
        activity_action := case
            when new.enrollment_type = 'classroom' then 'student_joined_classroom'
            else 'student_joined_course'
        end;
        should_log := true;
    elsif TG_OP = 'UPDATE' and new.enrollment_status is distinct from old.enrollment_status then
        if new.enrollment_status = 'active' then
            activity_action := case
                when new.enrollment_type = 'classroom' then 'student_joined_classroom'
                else 'student_joined_course'
            end;
            should_log := true;
        elsif new.enrollment_status = 'removed' then
            activity_action := case
                when new.enrollment_type = 'classroom' then 'student_removed_from_classroom'
                else 'student_removed_from_course'
            end;
            should_log := true;
        end if;
    end if;

    if not should_log then
        return new;
    end if;

    insert into public.activity_logs (
        actor_user_id,
        action_type,
        target_type,
        target_id,
        course_id,
        classroom_id,
        old_value_json,
        new_value_json,
        metadata_json
    )
    values (
        public.current_profile_id(),
        activity_action,
        'enrollment',
        new.id,
        new.course_id,
        new.classroom_id,
        case when TG_OP = 'UPDATE' then to_jsonb(old) else null end,
        to_jsonb(new),
        jsonb_build_object(
            'source', 'enrollments_trigger',
            'operation', TG_OP,
            'enrollment_type', new.enrollment_type,
            'enrollment_status', new.enrollment_status,
            'student_user_id', new.user_id
        )
    );

    return new;
end;
$$;

create trigger log_enrollment_activity
    after insert or update on public.enrollments
    for each row
    execute function public.log_enrollment_activity_from_trigger();
