insert into storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
values
    (
        'profile-photos',
        'profile-photos',
        false,
        10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    ),
    (
        'course-public-assets',
        'course-public-assets',
        true,
        10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    ),
    (
        'lesson-resources',
        'lesson-resources',
        false,
        52428800,
        array[
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/zip',
            'audio/mpeg',
            'audio/mp4',
            'audio/webm',
            'video/mp4',
            'video/webm'
        ]
    ),
    (
        'submission-uploads',
        'submission-uploads',
        false,
        52428800,
        array[
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'application/zip',
            'audio/mpeg',
            'audio/mp4',
            'audio/webm',
            'video/mp4',
            'video/webm',
            'text/plain'
        ]
    )
on conflict (id) do update
set
    name = excluded.name,
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.storage_object_path_owner(object_name text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
    select case
        when split_part(object_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            then split_part(object_name, '/', 1)::uuid
        else null::uuid
    end;
$$;

create or replace function public.can_insert_storage_object(
    bucket_to_check text,
    object_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select
        bucket_to_check in (
            'profile-photos',
            'course-public-assets',
            'lesson-resources',
            'submission-uploads'
        )
        and public.current_profile_id() is not null
        and public.storage_object_path_owner(object_name) = public.current_profile_id();
$$;

create or replace function public.can_read_storage_object(
    bucket_to_check text,
    object_name text
)
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
            from public.files as file
            where file.storage_bucket = bucket_to_check
                and file.storage_path = object_name
                and file.status = 'active'
                and (
                    file.owner_user_id = public.current_profile_id()
                    or file.visibility = 'public'
                    or public.can_view_referenced_file(file.id)
                )
        );
$$;

create or replace function public.can_update_storage_object(
    bucket_to_check text,
    object_name text
)
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
            from public.files as file
            where file.storage_bucket = bucket_to_check
                and file.storage_path = object_name
                and file.owner_user_id = public.current_profile_id()
                and file.status = 'active'
        );
$$;

create or replace function public.can_delete_storage_object(
    bucket_to_check text,
    object_name text
)
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
            from public.files as file
            where file.storage_bucket = bucket_to_check
                and file.storage_path = object_name
                and file.owner_user_id = public.current_profile_id()
        )
        or (
            public.current_profile_id() is not null
            and public.storage_object_path_owner(object_name) = public.current_profile_id()
        );
$$;

revoke all on function public.storage_object_path_owner(text) from public;
revoke all on function public.can_insert_storage_object(text, text) from public;
revoke all on function public.can_read_storage_object(text, text) from public;
revoke all on function public.can_update_storage_object(text, text) from public;
revoke all on function public.can_delete_storage_object(text, text) from public;

grant execute on function public.storage_object_path_owner(text) to authenticated;
grant execute on function public.can_insert_storage_object(text, text) to authenticated;
grant execute on function public.can_read_storage_object(text, text) to authenticated;
grant execute on function public.can_update_storage_object(text, text) to authenticated;
grant execute on function public.can_delete_storage_object(text, text) to authenticated;

drop policy if exists "Authenticated users can upload to owned file folders" on storage.objects;
create policy "Authenticated users can upload to owned file folders"
    on storage.objects
    for insert
    to authenticated
    with check (public.can_insert_storage_object(bucket_id, name));

drop policy if exists "Authenticated users can read authorized private files" on storage.objects;
create policy "Authenticated users can read authorized private files"
    on storage.objects
    for select
    to authenticated
    using (
        bucket_id = 'course-public-assets'
        or public.can_read_storage_object(bucket_id, name)
    );

drop policy if exists "File owners can update active storage objects" on storage.objects;
create policy "File owners can update active storage objects"
    on storage.objects
    for update
    to authenticated
    using (public.can_update_storage_object(bucket_id, name))
    with check (public.can_update_storage_object(bucket_id, name));

drop policy if exists "File owners can delete storage objects" on storage.objects;
create policy "File owners can delete storage objects"
    on storage.objects
    for delete
    to authenticated
    using (public.can_delete_storage_object(bucket_id, name));
