alter table public.lesson_content_blocks
    drop constraint lesson_content_blocks_file_type_check;

alter table public.lesson_content_blocks
    add constraint lesson_content_blocks_file_type_check
        check (
            file_type is null
            or file_type in ('pdf', 'image', 'docx', 'pptx', 'zip', 'audio')
        );
