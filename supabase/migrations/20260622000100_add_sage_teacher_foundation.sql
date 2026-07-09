create table public.sage_classroom_settings (
    id uuid primary key default gen_random_uuid(),
    classroom_id uuid not null references public.classrooms (id) on delete cascade,
    sage_chat_enabled boolean not null default true,
    direct_answers_enabled boolean not null default true,
    test_mode_enabled boolean not null default false,
    conversation_review_enabled boolean not null default true,
    updated_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint sage_classroom_settings_classroom_key unique (classroom_id)
);

create table public.sage_conversations (
    id uuid primary key default gen_random_uuid(),
    classroom_id uuid not null references public.classrooms (id) on delete cascade,
    lesson_id uuid references public.lessons (id) on delete set null,
    student_profile_id uuid not null references public.profiles (id) on delete cascade,
    status text not null default 'needs_review',
    started_at timestamptz not null default now(),
    last_message_at timestamptz,
    reviewed_at timestamptz,
    reviewed_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint sage_conversations_status_check
        check (status in ('active', 'needs_review', 'reviewed', 'archived'))
);

create table public.sage_messages (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.sage_conversations (id) on delete cascade,
    sender_type text not null,
    message_text text not null,
    screen_context jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    constraint sage_messages_sender_type_check
        check (sender_type in ('student', 'sage', 'teacher', 'system')),
    constraint sage_messages_text_check
        check (nullif(btrim(message_text), '') is not null),
    constraint sage_messages_screen_context_check
        check (jsonb_typeof(screen_context) = 'object')
);

create table public.sage_conversation_signals (
    id uuid primary key default gen_random_uuid(),
    conversation_id uuid not null references public.sage_conversations (id) on delete cascade,
    signal_type text not null,
    summary text not null,
    severity text not null default 'info',
    teacher_action text not null default 'pending',
    reviewed_at timestamptz,
    reviewed_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint sage_conversation_signals_type_check
        check (signal_type in ('answer_request', 'misconception', 'safety', 'productive_struggle', 'engagement', 'other')),
    constraint sage_conversation_signals_summary_check
        check (nullif(btrim(summary), '') is not null),
    constraint sage_conversation_signals_severity_check
        check (severity in ('info', 'low', 'medium', 'high')),
    constraint sage_conversation_signals_action_check
        check (teacher_action in ('pending', 'reviewed', 'dismissed', 'profile_added'))
);

create table public.sage_student_profile_signals (
    id uuid primary key default gen_random_uuid(),
    student_profile_id uuid not null references public.profiles (id) on delete cascade,
    classroom_id uuid not null references public.classrooms (id) on delete cascade,
    lesson_id uuid references public.lessons (id) on delete set null,
    conversation_id uuid references public.sage_conversations (id) on delete set null,
    signal_id uuid references public.sage_conversation_signals (id) on delete set null,
    signal_type text not null,
    summary text not null,
    evidence text,
    confidence text not null default 'medium',
    source text not null default 'sage_conversation',
    added_by uuid references public.profiles (id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint sage_student_profile_signals_type_check
        check (signal_type in ('answer_request', 'misconception', 'safety', 'productive_struggle', 'engagement', 'strength', 'support_need', 'other')),
    constraint sage_student_profile_signals_summary_check
        check (nullif(btrim(summary), '') is not null),
    constraint sage_student_profile_signals_confidence_check
        check (confidence in ('low', 'medium', 'high')),
    constraint sage_student_profile_signals_source_check
        check (source in ('sage_conversation', 'teacher_note', 'submission', 'lesson_generator'))
);

create index sage_classroom_settings_classroom_id_idx
    on public.sage_classroom_settings (classroom_id);

create index sage_conversations_classroom_id_idx
    on public.sage_conversations (classroom_id);

create index sage_conversations_student_profile_id_idx
    on public.sage_conversations (student_profile_id);

create index sage_conversations_lesson_id_idx
    on public.sage_conversations (lesson_id)
    where lesson_id is not null;

create index sage_messages_conversation_id_created_at_idx
    on public.sage_messages (conversation_id, created_at);

create index sage_conversation_signals_conversation_id_idx
    on public.sage_conversation_signals (conversation_id);

create index sage_conversation_signals_type_action_idx
    on public.sage_conversation_signals (signal_type, teacher_action);

create index sage_student_profile_signals_student_profile_id_idx
    on public.sage_student_profile_signals (student_profile_id, created_at desc);

create index sage_student_profile_signals_classroom_id_idx
    on public.sage_student_profile_signals (classroom_id, created_at desc);

create index sage_student_profile_signals_signal_type_idx
    on public.sage_student_profile_signals (signal_type);

create function public.set_sage_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

create trigger set_sage_classroom_settings_updated_at
    before update on public.sage_classroom_settings
    for each row
    execute function public.set_sage_updated_at();

create trigger set_sage_conversations_updated_at
    before update on public.sage_conversations
    for each row
    execute function public.set_sage_updated_at();

create trigger set_sage_conversation_signals_updated_at
    before update on public.sage_conversation_signals
    for each row
    execute function public.set_sage_updated_at();

create trigger set_sage_student_profile_signals_updated_at
    before update on public.sage_student_profile_signals
    for each row
    execute function public.set_sage_updated_at();

create function public.touch_sage_conversation_from_message()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
    update public.sage_conversations
    set last_message_at = new.created_at
    where id = new.conversation_id;

    return new;
end;
$$;

create trigger touch_sage_conversation_after_message
    after insert on public.sage_messages
    for each row
    execute function public.touch_sage_conversation_from_message();

create function public.mark_sage_conversation_for_signal()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
    if new.teacher_action = 'pending' then
        update public.sage_conversations
        set status = 'needs_review'
        where id = new.conversation_id
            and status <> 'archived';
    end if;

    return new;
end;
$$;

create trigger mark_sage_conversation_after_signal
    after insert on public.sage_conversation_signals
    for each row
    execute function public.mark_sage_conversation_for_signal();

create function public.can_manage_sage_conversation(conversation_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select exists (
        select 1
        from public.sage_conversations as conversation
        where conversation.id = conversation_to_check
            and public.manages_classroom(conversation.classroom_id)
    );
$$;

create function public.owns_sage_conversation(conversation_to_check uuid)
returns boolean
language sql
stable
security definer set search_path = ''
as $$
    select exists (
        select 1
        from public.sage_conversations as conversation
        where conversation.id = conversation_to_check
            and conversation.student_profile_id = public.current_profile_id()
    );
$$;

create function public.add_sage_signal_to_student_profile(signal_to_add uuid)
returns public.sage_student_profile_signals
language plpgsql
security definer set search_path = ''
as $$
declare
    source_signal public.sage_conversation_signals%rowtype;
    source_conversation public.sage_conversations%rowtype;
    latest_student_message text;
    added_signal public.sage_student_profile_signals%rowtype;
begin
    select *
    into source_signal
    from public.sage_conversation_signals
    where id = signal_to_add;

    if source_signal.id is null then
        raise exception 'SAGE signal not found.';
    end if;

    select *
    into source_conversation
    from public.sage_conversations
    where id = source_signal.conversation_id;

    if source_conversation.id is null or not public.manages_classroom(source_conversation.classroom_id) then
        raise exception 'You cannot add this SAGE signal to a student profile.';
    end if;

    select message_text
    into latest_student_message
    from public.sage_messages
    where conversation_id = source_conversation.id
        and sender_type = 'student'
    order by created_at desc
    limit 1;

    insert into public.sage_student_profile_signals (
        student_profile_id,
        classroom_id,
        lesson_id,
        conversation_id,
        signal_id,
        signal_type,
        summary,
        evidence,
        confidence,
        source,
        added_by
    ) values (
        source_conversation.student_profile_id,
        source_conversation.classroom_id,
        source_conversation.lesson_id,
        source_conversation.id,
        source_signal.id,
        source_signal.signal_type,
        source_signal.summary,
        latest_student_message,
        case
            when source_signal.severity in ('high', 'medium') then 'high'
            when source_signal.severity = 'low' then 'low'
            else 'medium'
        end,
        'sage_conversation',
        public.current_profile_id()
    )
    returning * into added_signal;

    update public.sage_conversation_signals
    set teacher_action = 'profile_added',
        reviewed_at = now(),
        reviewed_by = public.current_profile_id()
    where id = source_signal.id;

    update public.sage_conversations
    set status = 'reviewed',
        reviewed_at = now(),
        reviewed_by = public.current_profile_id()
    where id = source_conversation.id
        and status <> 'archived';

    return added_signal;
end;
$$;

revoke all on function public.set_sage_updated_at() from public;
revoke all on function public.touch_sage_conversation_from_message() from public;
revoke all on function public.mark_sage_conversation_for_signal() from public;
revoke all on function public.can_manage_sage_conversation(uuid) from public;
revoke all on function public.owns_sage_conversation(uuid) from public;
revoke all on function public.add_sage_signal_to_student_profile(uuid) from public;

grant execute on function public.can_manage_sage_conversation(uuid) to authenticated;
grant execute on function public.owns_sage_conversation(uuid) to authenticated;
grant execute on function public.add_sage_signal_to_student_profile(uuid) to authenticated;

alter table public.sage_classroom_settings enable row level security;
alter table public.sage_conversations enable row level security;
alter table public.sage_messages enable row level security;
alter table public.sage_conversation_signals enable row level security;
alter table public.sage_student_profile_signals enable row level security;

revoke all on table public.sage_classroom_settings from anon;
revoke all on table public.sage_classroom_settings from authenticated;
revoke all on table public.sage_conversations from anon;
revoke all on table public.sage_conversations from authenticated;
revoke all on table public.sage_messages from anon;
revoke all on table public.sage_messages from authenticated;
revoke all on table public.sage_conversation_signals from anon;
revoke all on table public.sage_conversation_signals from authenticated;
revoke all on table public.sage_student_profile_signals from anon;
revoke all on table public.sage_student_profile_signals from authenticated;

grant select on table public.sage_classroom_settings to authenticated;
grant insert (
    classroom_id,
    sage_chat_enabled,
    direct_answers_enabled,
    test_mode_enabled,
    conversation_review_enabled,
    updated_by
) on table public.sage_classroom_settings to authenticated;
grant update (
    sage_chat_enabled,
    direct_answers_enabled,
    test_mode_enabled,
    conversation_review_enabled,
    updated_by
) on table public.sage_classroom_settings to authenticated;

grant select on table public.sage_conversations to authenticated;
grant insert (
    classroom_id,
    lesson_id,
    student_profile_id,
    status,
    last_message_at
) on table public.sage_conversations to authenticated;
grant update (
    status,
    last_message_at,
    reviewed_at,
    reviewed_by
) on table public.sage_conversations to authenticated;

grant select on table public.sage_messages to authenticated;
grant insert (
    conversation_id,
    sender_type,
    message_text,
    screen_context
) on table public.sage_messages to authenticated;

grant select on table public.sage_conversation_signals to authenticated;
grant insert (
    conversation_id,
    signal_type,
    summary,
    severity,
    teacher_action
) on table public.sage_conversation_signals to authenticated;
grant update (
    teacher_action,
    reviewed_at,
    reviewed_by
) on table public.sage_conversation_signals to authenticated;

grant select on table public.sage_student_profile_signals to authenticated;
grant insert (
    student_profile_id,
    classroom_id,
    lesson_id,
    conversation_id,
    signal_id,
    signal_type,
    summary,
    evidence,
    confidence,
    source,
    added_by
) on table public.sage_student_profile_signals to authenticated;
grant update (
    summary,
    confidence,
    updated_at
) on table public.sage_student_profile_signals to authenticated;

create policy "Classroom managers can view SAGE settings"
    on public.sage_classroom_settings
    for select
    to authenticated
    using (public.manages_classroom(classroom_id));

create policy "Classroom managers can create SAGE settings"
    on public.sage_classroom_settings
    for insert
    to authenticated
    with check (
        updated_by = public.current_profile_id()
        and public.manages_classroom(classroom_id)
    );

create policy "Classroom managers can update SAGE settings"
    on public.sage_classroom_settings
    for update
    to authenticated
    using (public.manages_classroom(classroom_id))
    with check (
        updated_by = public.current_profile_id()
        and public.manages_classroom(classroom_id)
    );

create policy "Teachers can view managed SAGE conversations"
    on public.sage_conversations
    for select
    to authenticated
    using (public.manages_classroom(classroom_id));

create policy "Students can view their own SAGE conversations"
    on public.sage_conversations
    for select
    to authenticated
    using (student_profile_id = public.current_profile_id());

create policy "Students can create their own SAGE conversations"
    on public.sage_conversations
    for insert
    to authenticated
    with check (
        student_profile_id = public.current_profile_id()
        and public.is_enrolled_in_classroom(classroom_id)
    );

create policy "Teachers can review managed SAGE conversations"
    on public.sage_conversations
    for update
    to authenticated
    using (public.manages_classroom(classroom_id))
    with check (public.manages_classroom(classroom_id));

create policy "SAGE participants can view messages"
    on public.sage_messages
    for select
    to authenticated
    using (
        public.can_manage_sage_conversation(conversation_id)
        or public.owns_sage_conversation(conversation_id)
    );

create policy "SAGE participants can add messages"
    on public.sage_messages
    for insert
    to authenticated
    with check (
        public.can_manage_sage_conversation(conversation_id)
        or public.owns_sage_conversation(conversation_id)
    );

create policy "Teachers can view managed SAGE signals"
    on public.sage_conversation_signals
    for select
    to authenticated
    using (public.can_manage_sage_conversation(conversation_id));

create policy "Teachers can create managed SAGE signals"
    on public.sage_conversation_signals
    for insert
    to authenticated
    with check (public.can_manage_sage_conversation(conversation_id));

create policy "Students can create signals on their own SAGE conversations"
    on public.sage_conversation_signals
    for insert
    to authenticated
    with check (public.owns_sage_conversation(conversation_id));

create policy "Teachers can update managed SAGE signals"
    on public.sage_conversation_signals
    for update
    to authenticated
    using (public.can_manage_sage_conversation(conversation_id))
    with check (public.can_manage_sage_conversation(conversation_id));

create policy "Teachers can view managed SAGE profile signals"
    on public.sage_student_profile_signals
    for select
    to authenticated
    using (public.manages_classroom(classroom_id));

create policy "Students can view their own SAGE profile signals"
    on public.sage_student_profile_signals
    for select
    to authenticated
    using (student_profile_id = public.current_profile_id());

create policy "Teachers can add managed SAGE profile signals"
    on public.sage_student_profile_signals
    for insert
    to authenticated
    with check (
        added_by = public.current_profile_id()
        and public.manages_classroom(classroom_id)
    );

create policy "Teachers can refine managed SAGE profile signals"
    on public.sage_student_profile_signals
    for update
    to authenticated
    using (public.manages_classroom(classroom_id))
    with check (public.manages_classroom(classroom_id));
