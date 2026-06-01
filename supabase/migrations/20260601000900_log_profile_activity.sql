create function public.log_profile_activity_from_trigger()
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
            'profile_completed', new.profile_completed
        )
    );

    return new;
end;
$$;

create trigger log_profile_activity
    after insert or update on public.profiles
    for each row
    execute function public.log_profile_activity_from_trigger();
