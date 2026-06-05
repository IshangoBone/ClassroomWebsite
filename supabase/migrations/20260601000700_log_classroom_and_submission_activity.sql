create function public.log_classroom_activity_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    activity_action text;
begin
    if TG_OP = 'INSERT' then
        activity_action := 'classroom_created';
    elsif TG_OP = 'UPDATE' then
        if (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at') then
            return new;
        end if;

        activity_action := case
            when new.status is distinct from old.status and new.status = 'archived' then 'classroom_archived'
            when new.status is distinct from old.status and new.status = 'deleted' then 'classroom_deleted'
            else 'classroom_updated'
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
        classroom_id,
        old_value_json,
        new_value_json,
        metadata_json
    )
    values (
        public.current_profile_id(),
        activity_action,
        'classroom',
        new.id,
        new.course_id,
        new.id,
        case when TG_OP = 'UPDATE' then to_jsonb(old) else null end,
        to_jsonb(new),
        jsonb_build_object(
            'source', 'classrooms_trigger',
            'operation', TG_OP,
            'status', new.status
        )
    );

    return new;
end;
$$;

create trigger log_classroom_activity
    after insert or update on public.classrooms
    for each row
    execute function public.log_classroom_activity_from_trigger();

create function public.log_lesson_submission_activity_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    activity_action text;
    should_log boolean := false;
begin
    if TG_OP = 'INSERT' then
        activity_action := case
            when new.status = 'submitted' then 'lesson_submitted'
            else 'lesson_draft_started'
        end;
        should_log := true;
    elsif TG_OP = 'UPDATE' then
        if new.status is distinct from old.status and new.status = 'submitted' then
            activity_action := 'lesson_submitted';
            should_log := true;
        elsif new.status = 'draft'
            and old.status = 'draft'
            and new.answers_json is distinct from old.answers_json then
            activity_action := 'lesson_draft_updated';
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
        'submission',
        new.id,
        new.course_id,
        new.classroom_id,
        case when TG_OP = 'UPDATE' then to_jsonb(old) else null end,
        to_jsonb(new),
        jsonb_build_object(
            'source', 'lesson_submissions_trigger',
            'operation', TG_OP,
            'lesson_id', new.lesson_id,
            'student_user_id', new.student_user_id,
            'status', new.status
        )
    );

    return new;
end;
$$;

create trigger log_lesson_submission_activity
    after insert or update on public.lesson_submissions
    for each row
    execute function public.log_lesson_submission_activity_from_trigger();
