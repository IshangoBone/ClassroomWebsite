alter table public.classrooms
    add column display_order integer not null default 0;

with ordered_classrooms as (
    select
        id,
        (row_number() over (
            partition by course_id
            order by created_at desc, id
        ) - 1)::integer as display_order
    from public.classrooms
)
update public.classrooms as classroom
set display_order = ordered.display_order
from ordered_classrooms as ordered
where classroom.id = ordered.id;

alter table public.classrooms
    add constraint classrooms_display_order_check
        check (display_order >= 0);

create index classrooms_course_display_order_idx
    on public.classrooms (course_id, display_order, created_at);

grant insert (display_order) on table public.classrooms to authenticated;
grant update (display_order) on table public.classrooms to authenticated;
