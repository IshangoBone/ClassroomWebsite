create table public.files (
    id uuid primary key default gen_random_uuid(),
    owner_user_id uuid not null references public.profiles (id) on delete restrict,
    original_file_name text,
    display_name text,
    file_type text not null,
    mime_type text,
    file_extension text,
    file_size bigint,
    storage_bucket text,
    storage_path text,
    public_url text,
    visibility text not null default 'private',
    status text not null default 'active',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    constraint files_type_check
        check (
            file_type in (
                'profile_photo',
                'avatar',
                'course_thumbnail',
                'lesson_resource',
                'submission_attachment',
                'audio',
                'document',
                'image',
                'archive',
                'external_link',
                'video_link',
                'slides_embed',
                'form_link'
            )
        ),
    constraint files_size_check
        check (file_size is null or file_size >= 0),
    constraint files_visibility_check
        check (visibility in ('private', 'course', 'classroom', 'public')),
    constraint files_status_check
        check (status in ('active', 'deleted')),
    constraint files_deleted_at_check
        check (
            (status = 'active' and deleted_at is null)
            or (status = 'deleted' and deleted_at is not null)
        )
);

create unique index files_storage_location_key
    on public.files (storage_bucket, storage_path)
    where storage_bucket is not null and storage_path is not null;

create index files_owner_user_id_idx
    on public.files (owner_user_id);

create table public.content_file_links (
    id uuid primary key default gen_random_uuid(),
    file_id uuid not null references public.files (id) on delete restrict,
    lesson_content_block_id uuid not null references public.lesson_content_blocks (id) on delete restrict,
    lesson_id uuid not null references public.lessons (id) on delete restrict,
    course_id uuid not null references public.courses (id) on delete restrict,
    classroom_id uuid,
    created_at timestamptz not null default now(),
    constraint content_file_links_classroom_course_fk
        foreign key (classroom_id, course_id)
        references public.classrooms (id, course_id)
        on delete restrict
);

create unique index content_file_links_file_block_context_key
    on public.content_file_links (
        file_id,
        lesson_content_block_id,
        coalesce(classroom_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );

create index content_file_links_course_id_idx
    on public.content_file_links (course_id);

create index content_file_links_lesson_id_idx
    on public.content_file_links (lesson_id);

create table public.submission_file_links (
    id uuid primary key default gen_random_uuid(),
    file_id uuid not null references public.files (id) on delete restrict,
    lesson_submission_id uuid not null references public.lesson_submissions (id) on delete restrict,
    created_at timestamptz not null default now(),
    constraint submission_file_links_file_submission_key unique (file_id, lesson_submission_id)
);

create index submission_file_links_submission_id_idx
    on public.submission_file_links (lesson_submission_id);

create trigger set_files_updated_at
    before update on public.files
    for each row
    execute function public.set_learning_content_updated_at();

create function public.owns_file(file_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select exists (
        select 1
        from public.files as file
        where file.id = file_to_check
            and file.owner_user_id = public.current_profile_id()
    );
$$;

create function public.owns_active_file(file_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select exists (
        select 1
        from public.files as file
        where file.id = file_to_check
            and file.owner_user_id = public.current_profile_id()
            and file.status = 'active'
    );
$$;

create function public.content_file_link_matches_context(
    content_block_to_check uuid,
    lesson_to_check uuid,
    course_to_check uuid,
    classroom_to_check uuid
)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select exists (
        select 1
        from public.lesson_content_blocks as content_block
        join public.lessons as lesson
            on lesson.id = content_block.lesson_id
        join public.modules as module
            on module.id = lesson.module_id
        where content_block.id = content_block_to_check
            and content_block.lesson_id = lesson_to_check
            and module.course_id = course_to_check
            and (
                classroom_to_check is null
                or exists (
                    select 1
                    from public.classrooms as classroom
                    where classroom.id = classroom_to_check
                        and classroom.course_id = course_to_check
                )
            )
    );
$$;

create function public.can_view_content_file_link(
    content_block_to_check uuid,
    course_to_check uuid,
    classroom_to_check uuid
)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select
        public.can_manage_course(course_to_check)
        or exists (
            select 1
            from public.lesson_content_blocks as content_block
            where content_block.id = content_block_to_check
                and content_block.is_visible
                and content_block.archived_at is null
                and public.lesson_is_available(content_block.lesson_id)
                and (
                    (
                        classroom_to_check is null
                        and public.can_view_course_content(course_to_check)
                    )
                    or (
                        classroom_to_check is not null
                        and public.can_view_classroom(classroom_to_check)
                    )
                )
        );
$$;

alter table public.content_file_links
    add constraint content_file_links_context_check
    check (
        public.content_file_link_matches_context(
            lesson_content_block_id,
            lesson_id,
            course_id,
            classroom_id
        )
    );

create function public.can_access_submission(submission_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select exists (
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

create function public.can_edit_submission_draft(submission_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select exists (
        select 1
        from public.lesson_submissions as submission
        where submission.id = submission_to_check
            and submission.student_user_id = public.current_profile_id()
            and submission.status = 'draft'
            and public.can_submit_draft_for_context(
                submission.course_id,
                submission.classroom_id
            )
    );
$$;

create function public.can_view_referenced_file(file_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select
        exists (
            select 1
            from public.content_file_links as content_link
            where content_link.file_id = file_to_check
                and public.can_view_content_file_link(
                    content_link.lesson_content_block_id,
                    content_link.course_id,
                    content_link.classroom_id
                )
        )
        or exists (
            select 1
            from public.submission_file_links as submission_link
            where submission_link.file_id = file_to_check
                and public.can_access_submission(submission_link.lesson_submission_id)
        );
$$;

revoke all on function public.owns_file(uuid) from public;
revoke all on function public.owns_active_file(uuid) from public;
revoke all on function public.content_file_link_matches_context(uuid, uuid, uuid, uuid) from public;
revoke all on function public.can_view_content_file_link(uuid, uuid, uuid) from public;
revoke all on function public.can_access_submission(uuid) from public;
revoke all on function public.can_edit_submission_draft(uuid) from public;
revoke all on function public.can_view_referenced_file(uuid) from public;

grant execute on function public.owns_file(uuid) to authenticated;
grant execute on function public.owns_active_file(uuid) to authenticated;
grant execute on function public.content_file_link_matches_context(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.can_view_content_file_link(uuid, uuid, uuid) to authenticated;
grant execute on function public.can_access_submission(uuid) to authenticated;
grant execute on function public.can_edit_submission_draft(uuid) to authenticated;
grant execute on function public.can_view_referenced_file(uuid) to authenticated;

alter table public.files enable row level security;
alter table public.content_file_links enable row level security;
alter table public.submission_file_links enable row level security;

revoke all on table public.files from anon;
revoke all on table public.files from authenticated;
revoke all on table public.content_file_links from anon;
revoke all on table public.content_file_links from authenticated;
revoke all on table public.submission_file_links from anon;
revoke all on table public.submission_file_links from authenticated;

grant select on table public.files to authenticated;
grant insert (
    owner_user_id,
    original_file_name,
    display_name,
    file_type,
    mime_type,
    file_extension,
    file_size,
    storage_bucket,
    storage_path,
    public_url
) on table public.files to authenticated;
grant update (
    display_name,
    status,
    deleted_at
) on table public.files to authenticated;

grant select on table public.content_file_links to authenticated;
grant insert (
    file_id,
    lesson_content_block_id,
    lesson_id,
    course_id,
    classroom_id
) on table public.content_file_links to authenticated;
grant delete on table public.content_file_links to authenticated;

grant select on table public.submission_file_links to authenticated;
grant insert (
    file_id,
    lesson_submission_id
) on table public.submission_file_links to authenticated;
grant delete on table public.submission_file_links to authenticated;

create policy "Users can register their own private files"
    on public.files
    for insert
    to authenticated
    with check (
        owner_user_id = public.current_profile_id()
        and visibility = 'private'
        and status = 'active'
    );

create policy "Users can view authorized files"
    on public.files
    for select
    to authenticated
    using (
        public.owns_file(id)
        or (
            status = 'active'
            and public.can_view_referenced_file(id)
        )
    );

create policy "Users can manage their own file metadata"
    on public.files
    for update
    to authenticated
    using (public.owns_file(id))
    with check (public.owns_file(id));

create policy "Authorized users can view content file links"
    on public.content_file_links
    for select
    to authenticated
    using (
        public.can_view_content_file_link(
            lesson_content_block_id,
            course_id,
            classroom_id
        )
    );

create policy "Course managers can attach their files to content"
    on public.content_file_links
    for insert
    to authenticated
    with check (
        public.owns_active_file(file_id)
        and public.can_manage_course(course_id)
        and public.content_file_link_matches_context(
            lesson_content_block_id,
            lesson_id,
            course_id,
            classroom_id
        )
    );

create policy "Course managers can remove content file links"
    on public.content_file_links
    for delete
    to authenticated
    using (public.can_manage_course(course_id));

create policy "Authorized users can view submission file links"
    on public.submission_file_links
    for select
    to authenticated
    using (public.can_access_submission(lesson_submission_id));

create policy "Students can attach their files to their drafts"
    on public.submission_file_links
    for insert
    to authenticated
    with check (
        public.owns_active_file(file_id)
        and public.can_edit_submission_draft(lesson_submission_id)
    );

create policy "Students can remove files from their drafts"
    on public.submission_file_links
    for delete
    to authenticated
    using (public.can_edit_submission_draft(lesson_submission_id));
