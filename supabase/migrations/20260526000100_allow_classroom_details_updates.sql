grant update (
    name,
    period_block,
    school_year
) on table public.classrooms to authenticated;

create policy "Classroom managers can update classroom details"
    on public.classrooms
    for update
    to authenticated
    using (public.manages_classroom(id))
    with check (public.manages_classroom(id));
