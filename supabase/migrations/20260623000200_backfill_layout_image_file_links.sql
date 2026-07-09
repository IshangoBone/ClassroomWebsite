insert into public.content_file_links (
    file_id,
    lesson_content_block_id,
    lesson_id,
    course_id,
    classroom_id
)
select distinct
    file.id,
    block.id,
    block.lesson_id,
    module.course_id,
    null::uuid
from public.lesson_content_blocks as block
join public.lessons as lesson
    on lesson.id = block.lesson_id
join public.modules as module
    on module.id = lesson.module_id
join public.files as file
    on file.storage_bucket = 'lesson-resources'
    and file.status = 'active'
    and file.storage_path is not null
    and block.body_text like '%' || file.storage_path || '%'
where block.archived_at is null
    and block.body_text like '__ctc_lesson_layout_v1__%'
on conflict do nothing;
