create or replace function public.moderate_user_account_status(
    target_user_id_input uuid,
    next_status_input text
)
returns table (
    user_id uuid,
    account_status text,
    updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
    acting_profile_id uuid;
    normalized_status text;
    target_profile public.profiles%rowtype;
begin
    if not public.is_platform_admin() then
        raise exception 'Only active platform admins can moderate user accounts.';
    end if;

    acting_profile_id := public.current_profile_id();
    normalized_status := btrim(lower(coalesce(next_status_input, '')));

    if normalized_status not in ('active', 'suspended', 'deleted') then
        raise exception 'Account status must be active, suspended, or deleted.';
    end if;

    select *
    into target_profile
    from public.profiles as profile
    where profile.id = target_user_id_input;

    if not found then
        raise exception 'User account was not found.';
    end if;

    if target_profile.id = acting_profile_id then
        raise exception 'Admins cannot moderate their own account.';
    end if;

    if target_profile.platform_role = 'admin' then
        raise exception 'Admin role moderation requires Supreme Admin controls.';
    end if;

    if target_profile.account_status = 'deleted' and normalized_status <> 'deleted' then
        raise exception 'Deleted accounts cannot be reactivated from this moderation control.';
    end if;

    update public.profiles as profile
    set account_status = normalized_status
    where profile.id = target_profile.id
    returning profile.id, profile.account_status, profile.updated_at
    into user_id, account_status, updated_at;

    return next;
end;
$$;

revoke all on function public.moderate_user_account_status(uuid, text) from public;
grant execute on function public.moderate_user_account_status(uuid, text) to authenticated;
