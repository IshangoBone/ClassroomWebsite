create function public.search_admin_records(search_input text, limit_input integer default 20)
returns table (
    record_type text,
    record_id uuid,
    primary_label text,
    secondary_label text,
    status_label text,
    created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
    with normalized as (
        select nullif(btrim(coalesce(search_input, '')), '') as term
    ),
    user_results as (
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
            profile.created_at
        from public.profiles as profile
        cross join normalized
        where normalized.term is not null
            and (
                profile.email ilike '%' || normalized.term || '%'
                or profile.username ilike '%' || normalized.term || '%'
                or profile.legal_first_name ilike '%' || normalized.term || '%'
                or profile.legal_last_name ilike '%' || normalized.term || '%'
                or profile.id::text ilike '%' || normalized.term || '%'
            )
    ),
    course_results as (
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
            course.created_at
        from public.courses as course
        left join public.profiles as owner
            on owner.id = course.owner_user_id
        cross join normalized
        where normalized.term is not null
            and course.status <> 'deleted'
            and (
                course.title ilike '%' || normalized.term || '%'
                or course.subject_area ilike '%' || normalized.term || '%'
                or course.description ilike '%' || normalized.term || '%'
                or course.id::text ilike '%' || normalized.term || '%'
                or owner.email ilike '%' || normalized.term || '%'
            )
    ),
    classroom_results as (
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
            classroom.created_at
        from public.classrooms as classroom
        left join public.courses as course
            on course.id = classroom.course_id
        left join public.profiles as owner
            on owner.id = classroom.owner_teacher_id
        cross join normalized
        where normalized.term is not null
            and classroom.status <> 'deleted'
            and (
                classroom.name ilike '%' || normalized.term || '%'
                or classroom.period_block ilike '%' || normalized.term || '%'
                or classroom.school_year ilike '%' || normalized.term || '%'
                or classroom.school_organization ilike '%' || normalized.term || '%'
                or classroom.id::text ilike '%' || normalized.term || '%'
                or course.title ilike '%' || normalized.term || '%'
                or owner.email ilike '%' || normalized.term || '%'
            )
    )
    select *
    from (
        select * from user_results
        union all
        select * from course_results
        union all
        select * from classroom_results
    ) as results
    where public.is_platform_admin()
    order by created_at desc
    limit least(greatest(coalesce(limit_input, 20), 1), 50);
$$;

revoke all on function public.search_admin_records(text, integer) from public;
grant execute on function public.search_admin_records(text, integer) to authenticated;
