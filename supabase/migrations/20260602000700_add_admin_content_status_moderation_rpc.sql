create function public.moderate_content_record_status(
    record_type_input text,
    record_id_input uuid,
    next_status_input text
)
returns table (
    record_type text,
    record_id uuid,
    status_label text,
    updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    normalized_type text;
    normalized_status text;
    current_status text;
begin
    if not public.is_platform_admin() then
        raise exception 'Only active platform admins can moderate content records.';
    end if;

    normalized_type := btrim(lower(coalesce(record_type_input, '')));
    normalized_status := btrim(lower(coalesce(next_status_input, '')));

    if normalized_type not in ('course', 'classroom') then
        raise exception 'Record type must be course or classroom.';
    end if;

    if normalized_status not in ('archived', 'deleted') then
        raise exception 'Content status must be archived or deleted.';
    end if;

    if normalized_type = 'course' then
        select course.status
        into current_status
        from public.courses as course
        where course.id = record_id_input;

        if not found then
            raise exception 'Course was not found.';
        end if;

        if current_status = 'deleted' and normalized_status <> 'deleted' then
            raise exception 'Deleted courses cannot be archived from this moderation control.';
        end if;

        update public.courses as course
        set status = normalized_status
        where course.id = record_id_input
        returning 'course'::text, course.id, course.status, course.updated_at
        into record_type, record_id, status_label, updated_at;

        return next;
    end if;

    select classroom.status
    into current_status
    from public.classrooms as classroom
    where classroom.id = record_id_input;

    if not found then
        raise exception 'Classroom was not found.';
    end if;

    if current_status = 'deleted' and normalized_status <> 'deleted' then
        raise exception 'Deleted classrooms cannot be archived from this moderation control.';
    end if;

    update public.classrooms as classroom
    set
        status = normalized_status,
        join_enabled = false
    where classroom.id = record_id_input
    returning 'classroom'::text, classroom.id, classroom.status, classroom.updated_at
    into record_type, record_id, status_label, updated_at;

    return next;
end;
$$;

revoke all on function public.moderate_content_record_status(text, uuid, text) from public;
grant execute on function public.moderate_content_record_status(text, uuid, text) to authenticated;
