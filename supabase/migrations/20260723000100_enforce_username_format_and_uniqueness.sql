create unique index if not exists profiles_username_lower_key
    on public.profiles (lower(username))
    where username is not null;

alter table public.profiles
    drop constraint if exists profiles_username_format_check;

alter table public.profiles
    add constraint profiles_username_format_check
    check (username is null or username ~ '^[A-Za-z0-9]{3,40}$')
    not valid;
