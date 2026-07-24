grant delete on table public.course_announcements to authenticated;

create policy "Course managers can delete announcements"
    on public.course_announcements
    for delete
    to authenticated
    using (public.can_manage_course(course_id));
