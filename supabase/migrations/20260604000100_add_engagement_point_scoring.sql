create or replace function public.lesson_answer_has_value(
    answers jsonb,
    question_id uuid
)
returns boolean
language sql
immutable
as $$
    select case
        when answers is null or jsonb_typeof(answers) <> 'object' then false
        when not (answers ? question_id::text) then false
        when answers -> question_id::text is null then false
        when jsonb_typeof(answers -> question_id::text) = 'null' then false
        when jsonb_typeof(answers -> question_id::text) = 'string' then
            length(btrim(answers ->> question_id::text)) > 0
        when jsonb_typeof(answers -> question_id::text) = 'array' then
            jsonb_array_length(answers -> question_id::text) > 0
        when jsonb_typeof(answers -> question_id::text) = 'object' then
            exists (
                select 1
                from jsonb_each_text(answers -> question_id::text) as answer_value(key, value)
                where length(btrim(coalesce(answer_value.value, ''))) > 0
            )
        else true
    end;
$$;

create or replace function public.set_lesson_submission_engagement_points()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
    question_totals record;
begin
    if new.status <> 'submitted' then
        new.points_possible := 0;
        new.points_earned := 0;
        return new;
    end if;

    select
        count(*)::integer as total_questions,
        coalesce(
            sum(
                case
                    when question.is_required or question.points > 0
                        then greatest(question.points, 0)
                    else 0
                end
            ),
            0
        ) as points_possible,
        coalesce(
            sum(
                case
                    when (question.is_required or question.points > 0)
                        and public.lesson_answer_has_value(new.answers_json, question.id)
                        then greatest(question.points, 0)
                    else 0
                end
            ),
            0
        ) as points_earned
    into question_totals
    from public.questions as question
    where question.lesson_id = new.lesson_id
        and question.is_visible
        and question.archived_at is null;

    new.total_questions := question_totals.total_questions;
    new.points_possible := question_totals.points_possible;
    new.points_earned := question_totals.points_earned;

    return new;
end;
$$;

drop trigger if exists score_lesson_submission_engagement_points on public.lesson_submissions;

create trigger score_lesson_submission_engagement_points
    before insert or update of answers_json, status, lesson_id on public.lesson_submissions
    for each row
    execute function public.set_lesson_submission_engagement_points();

update public.lesson_submissions
set answers_json = answers_json
where status = 'submitted'
    and points_possible = 0
    and points_earned = 0;

revoke all on function public.lesson_answer_has_value(jsonb, uuid) from public;
revoke all on function public.set_lesson_submission_engagement_points() from public;
