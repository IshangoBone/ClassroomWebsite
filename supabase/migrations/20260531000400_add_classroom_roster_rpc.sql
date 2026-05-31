create or replace function public.classroom_roster(classroom_to_check uuid)
returns table (
    enrollment_id uuid,
    student_user_id uuid,
    username text,
    legal_first_name text,
    legal_last_name text,
    email text,
    enrollment_status text,
    joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        enrollment.id as enrollment_id,
        profile.id as student_user_id,
        profile.username,
        profile.legal_first_name,
        profile.legal_last_name,
        profile.email,
        enrollment.enrollment_status,
        enrollment.joined_at
    from public.enrollments as enrollment
    join public.profiles as profile
        on profile.id = enrollment.user_id
    where enrollment.classroom_id = classroom_to_check
        and enrollment.enrollment_type = 'classroom'
        and public.manages_classroom(enrollment.classroom_id)
    order by
        profile.legal_last_name nulls last,
        profile.legal_first_name nulls last,
        profile.username nulls last,
        enrollment.joined_at asc;
$$;

revoke all on function public.classroom_roster(uuid) from public;
grant execute on function public.classroom_roster(uuid) to authenticated;
