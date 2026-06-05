create table public.profiles (
    id uuid primary key default gen_random_uuid(),
    auth_user_id uuid not null unique references auth.users (id) on delete restrict,
    legal_first_name text,
    legal_last_name text,
    email text,
    username text,
    date_of_birth date,
    profile_photo_url text,
    avatar_type text,
    avatar_key text,
    platform_role text not null default 'user',
    account_status text not null default 'active',
    profile_completed boolean not null default false,
    auth_provider text,
    last_login_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint profiles_avatar_type_check
        check (avatar_type is null or avatar_type in ('uploaded', 'default')),
    constraint profiles_username_check
        check (
            username is null
            or (
                username = btrim(username)
                and char_length(username) between 3 and 40
            )
        ),
    constraint profiles_platform_role_check
        check (platform_role in ('admin', 'user')),
    constraint profiles_account_status_check
        check (account_status in ('active', 'suspended', 'deleted')),
    constraint profiles_completed_fields_check
        check (
            not profile_completed
            or (
                nullif(btrim(legal_first_name), '') is not null
                and nullif(btrim(legal_last_name), '') is not null
                and username is not null
                and date_of_birth is not null
                and avatar_type is not null
                and avatar_key is not null
            )
        )
);

create unique index profiles_username_lower_key
    on public.profiles (lower(username))
    where username is not null;

create function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_profiles_updated_at
    before update on public.profiles
    for each row
    execute function public.set_profiles_updated_at();

create function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
    insert into public.profiles (auth_user_id, email, auth_provider)
    values (new.id, new.email, new.raw_app_meta_data ->> 'provider');
    return new;
end;
$$;

create trigger on_auth_user_created_create_profile
    after insert on auth.users
    for each row
    execute function public.handle_new_user_profile();

insert into public.profiles (
    auth_user_id,
    email,
    auth_provider,
    created_at,
    updated_at
)
select
    auth_user.id,
    auth_user.email,
    auth_user.raw_app_meta_data ->> 'provider',
    auth_user.created_at,
    auth_user.created_at
from auth.users as auth_user
on conflict (auth_user_id) do nothing;

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;

grant select on table public.profiles to authenticated;
grant update (
    legal_first_name,
    legal_last_name,
    username,
    date_of_birth,
    profile_photo_url,
    avatar_type,
    avatar_key,
    profile_completed
) on table public.profiles to authenticated;

create policy "Users can view their own profile"
    on public.profiles
    for select
    to authenticated
    using ((select auth.uid()) = auth_user_id);

create policy "Users can update their own profile"
    on public.profiles
    for update
    to authenticated
    using ((select auth.uid()) = auth_user_id)
    with check ((select auth.uid()) = auth_user_id);
