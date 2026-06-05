create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select profile.id
    from public.profiles as profile
    where profile.auth_user_id = (select auth.uid())
        and profile.account_status = 'active';
$$;

create or replace function public.is_public_course_content_visible(course_to_check uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.courses as course
        where course.id = course_to_check
            and course.status = 'published'
            and course.is_publicly_discoverable
    );
$$;

create or replace function public.can_view_course(course_to_check uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.is_platform_admin()
        or public.owns_course(course_to_check)
        or exists (
            select 1
            from public.course_collaborators as collaborator
            where collaborator.course_id = course_to_check
                and collaborator.user_id = public.current_profile_id()
        );
$$;

create or replace function public.can_manage_course(course_to_check uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.is_platform_admin()
        or public.owns_course(course_to_check)
        or exists (
            select 1
            from public.course_collaborators as collaborator
            where collaborator.course_id = course_to_check
                and collaborator.user_id = public.current_profile_id()
                and collaborator.permission_level in ('teacher', 'editor', 'co_owner')
        );
$$;

create or replace function public.is_enrolled_in_course(course_to_check uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.enrollments as enrollment
        join public.courses as course
            on course.id = enrollment.course_id
        where enrollment.course_id = course_to_check
            and enrollment.user_id = public.current_profile_id()
            and enrollment.enrollment_status <> 'removed'
            and course.status <> 'deleted'
    );
$$;

create or replace function public.is_enrolled_in_classroom(classroom_to_check uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.enrollments as enrollment
        join public.classrooms as classroom
            on classroom.id = enrollment.classroom_id
        join public.courses as course
            on course.id = enrollment.course_id
        where enrollment.classroom_id = classroom_to_check
            and enrollment.user_id = public.current_profile_id()
            and enrollment.enrollment_status <> 'removed'
            and classroom.status <> 'deleted'
            and course.status <> 'deleted'
    );
$$;

create or replace function public.manages_classroom(classroom_to_check uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.is_platform_admin()
        or public.owns_classroom(classroom_to_check)
        or exists (
            select 1
            from public.classroom_teachers as teacher
            where teacher.classroom_id = classroom_to_check
                and teacher.user_id = public.current_profile_id()
        );
$$;

create or replace function public.can_view_classroom(classroom_to_check uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.manages_classroom(classroom_to_check)
        or public.is_enrolled_in_classroom(classroom_to_check);
$$;

create or replace function public.can_view_course_content(course_to_check uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.can_view_course(course_to_check)
        or public.is_enrolled_in_course(course_to_check)
        or public.is_public_course_content_visible(course_to_check);
$$;

create or replace function public.can_review_student_context(
    course_to_check uuid,
    classroom_to_check uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.is_platform_admin()
        or (
            classroom_to_check is null
            and public.can_manage_course(course_to_check)
        )
        or (
            classroom_to_check is not null
            and public.manages_classroom(classroom_to_check)
        );
$$;

create or replace function public.can_access_submission(submission_to_check uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        public.is_platform_admin()
        or exists (
            select 1
            from public.lesson_submissions as submission
            where submission.id = submission_to_check
                and (
                    submission.student_user_id = public.current_profile_id()
                    or public.can_review_student_context(
                        submission.course_id,
                        submission.classroom_id
                    )
                )
        );
$$;

revoke all on function public.is_public_course_content_visible(uuid) from public;
grant execute on function public.is_public_course_content_visible(uuid) to authenticated;

drop policy if exists "Platform admins can view all profiles" on public.profiles;
create policy "Platform admins can view all profiles"
    on public.profiles
    for select
    to authenticated
    using (public.is_platform_admin());

drop policy if exists "Platform admins can update profile details" on public.profiles;
create policy "Platform admins can update profile details"
    on public.profiles
    for update
    to authenticated
    using (public.is_platform_admin())
    with check (public.is_platform_admin());

drop policy if exists "Authenticated users can view public published courses" on public.courses;
create policy "Authenticated users can view public published courses"
    on public.courses
    for select
    to authenticated
    using (public.is_public_course_content_visible(id));

drop policy if exists "Platform admins can view all files" on public.files;
create policy "Platform admins can view all files"
    on public.files
    for select
    to authenticated
    using (public.is_platform_admin());

drop policy if exists "Platform admins can manage file metadata" on public.files;
create policy "Platform admins can manage file metadata"
    on public.files
    for update
    to authenticated
    using (public.is_platform_admin())
    with check (public.is_platform_admin());
