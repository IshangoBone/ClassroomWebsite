alter table public.profiles
    drop constraint profiles_platform_role_check;

alter table public.profiles
    add constraint profiles_platform_role_check
        check (platform_role in ('supreme_admin', 'admin', 'teacher', 'user'));

create or replace function public.moderate_user_platform_role(
    target_user_id_input uuid,
    next_role_input text
)
returns table (
    user_id uuid,
    platform_role text,
    updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    acting_profile_id uuid;
    normalized_role text;
    target_profile public.profiles%rowtype;
begin
    if not public.is_supreme_admin() then
        raise exception 'Only Supreme Admins can change platform roles.';
    end if;

    acting_profile_id := public.current_profile_id();
    normalized_role := btrim(lower(coalesce(next_role_input, '')));

    if normalized_role not in ('admin', 'teacher', 'user') then
        raise exception 'Platform role must be admin, teacher, or user.';
    end if;

    select *
    into target_profile
    from public.profiles as profile
    where profile.id = target_user_id_input;

    if not found then
        raise exception 'User account was not found.';
    end if;

    if target_profile.id = acting_profile_id then
        raise exception 'Supreme Admins cannot change their own role from this control.';
    end if;

    if target_profile.platform_role = 'supreme_admin' then
        raise exception 'Supreme Admin accounts cannot be changed from this control.';
    end if;

    if target_profile.account_status = 'deleted' then
        raise exception 'Deleted accounts cannot receive role changes from this control.';
    end if;

    update public.profiles as profile
    set platform_role = normalized_role
    where profile.id = target_profile.id
    returning profile.id, profile.platform_role, profile.updated_at
    into user_id, platform_role, updated_at;

    return next;
end;
$$;

revoke all on function public.moderate_user_platform_role(uuid, text) from public;
grant execute on function public.moderate_user_platform_role(uuid, text) to authenticated;
