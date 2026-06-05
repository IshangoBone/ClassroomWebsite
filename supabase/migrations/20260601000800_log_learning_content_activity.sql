create function public.log_module_activity_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    activity_action text;
begin
    if TG_OP = 'INSERT' then
        activity_action := 'module_created';
    elsif TG_OP = 'UPDATE' then
        if (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at') then
            return new;
        end if;

        activity_action := case
            when new.archived_at is not null and old.archived_at is null then 'module_deleted'
            else 'module_updated'
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
        'module',
        new.id,
        new.course_id,
        case when TG_OP = 'UPDATE' then to_jsonb(old) else null end,
        to_jsonb(new),
        jsonb_build_object('source', 'modules_trigger', 'operation', TG_OP)
    );

    return new;
end;
$$;

create trigger log_module_activity
    after insert or update on public.modules
    for each row
    execute function public.log_module_activity_from_trigger();

create function public.log_lesson_activity_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    activity_action text;
    target_course_id uuid;
begin
    target_course_id := public.course_id_for_module(new.module_id);

    if TG_OP = 'INSERT' then
        activity_action := 'lesson_created';
    elsif TG_OP = 'UPDATE' then
        if (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at') then
            return new;
        end if;

        activity_action := case
            when new.archived_at is not null and old.archived_at is null then 'lesson_deleted'
            else 'lesson_updated'
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
        'lesson',
        new.id,
        target_course_id,
        case when TG_OP = 'UPDATE' then to_jsonb(old) else null end,
        to_jsonb(new),
        jsonb_build_object(
            'source', 'lessons_trigger',
            'operation', TG_OP,
            'module_id', new.module_id
        )
    );

    return new;
end;
$$;

create trigger log_lesson_activity
    after insert or update on public.lessons
    for each row
    execute function public.log_lesson_activity_from_trigger();

create function public.log_lesson_content_block_activity_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    activity_action text;
    target_course_id uuid;
begin
    target_course_id := public.course_id_for_lesson(new.lesson_id);

    if TG_OP = 'INSERT' then
        activity_action := 'lesson_content_created';
    elsif TG_OP = 'UPDATE' then
        if (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at') then
            return new;
        end if;

        activity_action := case
            when new.archived_at is not null and old.archived_at is null then 'lesson_content_deleted'
            else 'lesson_content_updated'
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
        'lesson_content_block',
        new.id,
        target_course_id,
        case when TG_OP = 'UPDATE' then to_jsonb(old) else null end,
        to_jsonb(new),
        jsonb_build_object(
            'source', 'lesson_content_blocks_trigger',
            'operation', TG_OP,
            'lesson_id', new.lesson_id,
            'block_type', new.block_type
        )
    );

    return new;
end;
$$;

create trigger log_lesson_content_block_activity
    after insert or update on public.lesson_content_blocks
    for each row
    execute function public.log_lesson_content_block_activity_from_trigger();

create function public.log_question_activity_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    activity_action text;
    target_course_id uuid;
begin
    target_course_id := public.course_id_for_lesson(new.lesson_id);

    if TG_OP = 'INSERT' then
        activity_action := 'question_created';
    elsif TG_OP = 'UPDATE' then
        if (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at') then
            return new;
        end if;

        activity_action := case
            when new.archived_at is not null and old.archived_at is null then 'question_deleted'
            else 'question_updated'
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
        'question',
        new.id,
        target_course_id,
        case when TG_OP = 'UPDATE' then to_jsonb(old) else null end,
        to_jsonb(new),
        jsonb_build_object(
            'source', 'questions_trigger',
            'operation', TG_OP,
            'lesson_id', new.lesson_id,
            'question_type', new.question_type
        )
    );

    return new;
end;
$$;

create trigger log_question_activity
    after insert or update on public.questions
    for each row
    execute function public.log_question_activity_from_trigger();

create function public.log_question_option_activity_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    target_lesson_id uuid;
    target_course_id uuid;
begin
    if TG_OP = 'UPDATE'
        and (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at') then
        return new;
    end if;

    target_lesson_id := public.lesson_id_for_question(new.question_id);
    target_course_id := public.course_id_for_lesson(target_lesson_id);

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
        case when TG_OP = 'INSERT' then 'question_option_created' else 'question_option_updated' end,
        'question_option',
        new.id,
        target_course_id,
        case when TG_OP = 'UPDATE' then to_jsonb(old) else null end,
        to_jsonb(new),
        jsonb_build_object(
            'source', 'question_options_trigger',
            'operation', TG_OP,
            'question_id', new.question_id,
            'lesson_id', target_lesson_id
        )
    );

    return new;
end;
$$;

create trigger log_question_option_activity
    after insert or update on public.question_options
    for each row
    execute function public.log_question_option_activity_from_trigger();

create function public.log_file_activity_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    activity_action text;
begin
    if TG_OP = 'INSERT' then
        activity_action := 'file_uploaded';
    elsif TG_OP = 'UPDATE' then
        if (to_jsonb(new) - 'updated_at') is not distinct from (to_jsonb(old) - 'updated_at') then
            return new;
        end if;

        activity_action := case
            when new.status = 'deleted' and old.status <> 'deleted' then 'file_deleted'
            else 'file_updated'
        end;
    else
        return null;
    end if;

    insert into public.activity_logs (
        actor_user_id,
        action_type,
        target_type,
        target_id,
        old_value_json,
        new_value_json,
        metadata_json
    )
    values (
        public.current_profile_id(),
        activity_action,
        'file',
        new.id,
        case when TG_OP = 'UPDATE' then to_jsonb(old) else null end,
        to_jsonb(new),
        jsonb_build_object(
            'source', 'files_trigger',
            'operation', TG_OP,
            'file_type', new.file_type,
            'visibility', new.visibility,
            'status', new.status
        )
    );

    return new;
end;
$$;

create trigger log_file_activity
    after insert or update on public.files
    for each row
    execute function public.log_file_activity_from_trigger();
