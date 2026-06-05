alter table public.profiles
    drop constraint profiles_platform_role_check;

alter table public.profiles
    add constraint profiles_platform_role_check
        check (platform_role in ('supreme_admin', 'admin', 'user'));

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles as profile
        where profile.id = public.current_profile_id()
            and profile.platform_role in ('admin', 'supreme_admin')
            and profile.account_status = 'active'
    );
$$;

create function public.is_supreme_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.profiles as profile
        where profile.id = public.current_profile_id()
            and profile.platform_role = 'supreme_admin'
            and profile.account_status = 'active'
    );
$$;

create or replace function public.log_profile_activity_from_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    activity_action text;
begin
    if TG_OP = 'INSERT' then
        activity_action := 'user_created';
    elsif TG_OP = 'UPDATE' then
        if (to_jsonb(new) - 'updated_at' - 'last_login_at') is not distinct from
            (to_jsonb(old) - 'updated_at' - 'last_login_at') then
            return new;
        end if;

        activity_action := case
            when new.account_status is distinct from old.account_status
                and new.account_status = 'suspended' then 'account_suspended'
            when new.account_status is distinct from old.account_status
                and new.account_status = 'active' then 'account_reactivated'
            when new.account_status is distinct from old.account_status
                and new.account_status = 'deleted' then 'account_deleted'
            when new.platform_role is distinct from old.platform_role then 'platform_role_changed'
            when new.profile_completed is distinct from old.profile_completed
                and new.profile_completed then 'profile_completed'
            else 'profile_updated'
        end;
    else
        return null;
    end if;

    insert into public.activity_logs (
        actor_user_id,
        action_type,
        target_type,
        target_id,
        old_value_json,
        new_value_json,
        metadata_json
    )
    values (
        public.current_profile_id(),
        activity_action,
        'user',
        new.id,
        case when TG_OP = 'UPDATE' then to_jsonb(old) else null end,
        to_jsonb(new),
        jsonb_build_object(
            'source', 'profiles_trigger',
            'operation', TG_OP,
            'account_status', new.account_status,
            'platform_role', new.platform_role,
            'profile_completed', new.profile_completed
        )
    );

    return new;
end;
$$;

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
    acting_is_supreme_admin boolean;
    normalized_status text;
    target_profile public.profiles%rowtype;
begin
    if not public.is_platform_admin() then
        raise exception 'Only active platform admins can moderate user accounts.';
    end if;

    acting_profile_id := public.current_profile_id();
    acting_is_supreme_admin := public.is_supreme_admin();
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

    if target_profile.platform_role = 'supreme_admin' then
        raise exception 'Supreme Admin accounts cannot be moderated from this control.';
    end if;

    if target_profile.platform_role = 'admin' and not acting_is_supreme_admin then
        raise exception 'Admin account moderation requires Supreme Admin controls.';
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

create function public.moderate_user_platform_role(
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

    if normalized_role not in ('admin', 'user') then
        raise exception 'Platform role must be admin or user.';
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

revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_supreme_admin() from public;
revoke all on function public.moderate_user_account_status(uuid, text) from public;
revoke all on function public.moderate_user_platform_role(uuid, text) from public;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.is_supreme_admin() to authenticated;
grant execute on function public.moderate_user_account_status(uuid, text) to authenticated;
grant execute on function public.moderate_user_platform_role(uuid, text) to authenticated;
