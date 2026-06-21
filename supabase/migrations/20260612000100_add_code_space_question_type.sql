alter table public.questions
    drop constraint if exists questions_type_check;

alter table public.questions
    add constraint questions_type_check
        check (
            question_type in (
                'multiple_choice',
                'true_false',
                'short_response',
                'long_response',
                'rating_scale',
                'select_all_that_apply',
                'matching',
                'ordering',
                'fill_in_the_blank',
                'code_space'
            )
        );
