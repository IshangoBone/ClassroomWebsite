create or replace function public.restore_student_to_classroom(
    classroom_to_check uuid,
    enrollment_to_restore uuid
)
returns table (
    enrollment_id uuid,
    student_user_id uuid,
    enrollment_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    updated_enrollment record;
begin
    if not public.manages_classroom(classroom_to_check) then
        raise exception 'You do not have permission to manage this classroom roster.';
    end if;

    update public.enrollments as enrollment
    set enrollment_status = 'active'
    where enrollment.id = enrollment_to_restore
        and enrollment.classroom_id = classroom_to_check
        and enrollment.enrollment_type = 'classroom'
    returning
        enrollment.id,
        enrollment.user_id,
        enrollment.enrollment_status
    into updated_enrollment;

    if updated_enrollment.id is null then
        raise exception 'That student enrollment was not found.';
    end if;

    return query select
        updated_enrollment.id,
        updated_enrollment.user_id,
        updated_enrollment.enrollment_status;
end;
$$;

revoke all on function public.restore_student_to_classroom(uuid, uuid) from public;
grant execute on function public.restore_student_to_classroom(uuid, uuid) to authenticated;
