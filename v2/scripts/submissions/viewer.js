import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const params = new URLSearchParams(window.location.search);
const submissionId = params.get("submission");
const headingElement = qs("[data-submission-heading]");
const contextElement = qs("[data-submission-context]");
const statusElement = qs("[data-submission-status]");
const shellElements = [...document.querySelectorAll("[data-submission-shell]")];
const summaryElement = qs("[data-submission-summary]");
const answerListElement = qs("[data-answer-list]");
const questionPhases = [
    ["before", "Before lesson"],
    ["during", "During lesson"],
    ["reflection", "Reflection"],
];

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function formatStatus(status = "draft") {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value) {
    if (!value) {
        return "Not submitted";
    }

    return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function showShell() {
    shellElements.forEach((element) => {
        element.hidden = false;
    });
}

function createSummaryCard(label, value) {
    const card = createElement("article", "summary-card");

    card.append(createElement("span", "summary-label", label), createElement("strong", "summary-value summary-value--small", value));
    return card;
}

function getAnswerValue(question, answers, optionLabels) {
    const rawAnswer = answers?.[question.id];

    if (rawAnswer === undefined || rawAnswer === null || rawAnswer === "") {
        return "No answer saved.";
    }

    if (Array.isArray(rawAnswer)) {
        return rawAnswer.map((answer) => optionLabels.get(answer) || answer).join(", ") || "No answer saved.";
    }

    if (typeof rawAnswer === "object") {
        return Object.entries(rawAnswer)
            .map(([key, value]) => `${optionLabels.get(key) || key}: ${value || "No answer saved"}`)
            .join("\n");
    }

    return optionLabels.get(rawAnswer) || String(rawAnswer);
}

async function loadSubmission() {
    if (!submissionId) {
        headingElement.textContent = "Submission unavailable";
        setStatus("Open a submission from the dashboard before reviewing work.", "error");
        return null;
    }

    const { data, error } = await supabase
        .from("lesson_submissions")
        .select("id, student_user_id, course_id, classroom_id, lesson_id, answers_json, total_questions, points_possible, points_earned, status, submitted_at, updated_at")
        .eq("id", submissionId)
        .single();

    if (error) {
        headingElement.textContent = "Submission unavailable";
        setStatus("This submission could not be loaded. Check that your account has access.", "error");
        return null;
    }

    return data;
}

async function loadContext(submission) {
    const [{ data: course, error: courseError }, { data: lesson, error: lessonError }] = await Promise.all([
        supabase.from("courses").select("id, title").eq("id", submission.course_id).single(),
        supabase.from("lessons").select("id, title").eq("id", submission.lesson_id).single(),
    ]);

    if (courseError || lessonError) {
        setStatus("Submission context could not be loaded.", "error");
        return null;
    }

    let classroom = null;

    if (submission.classroom_id) {
        const { data, error } = await supabase
            .from("classrooms")
            .select("id, name, period_block")
            .eq("id", submission.classroom_id)
            .single();

        if (!error) {
            classroom = data;
        }
    }

    return { course, lesson, classroom };
}

async function loadQuestions(lessonId) {
    let { data, error } = await supabase
        .from("student_visible_questions")
        .select("id, phase, question_type, prompt, points, order_index")
        .eq("lesson_id", lessonId)
        .order("order_index", { ascending: true });

    if (error) {
        const fallbackResult = await supabase
            .from("questions")
            .select("id, phase, question_type, prompt, points, order_index")
            .eq("lesson_id", lessonId)
            .eq("is_visible", true)
            .is("archived_at", null)
            .order("order_index", { ascending: true });

        data = fallbackResult.data;
        error = fallbackResult.error;
    }

    if (error) {
        setStatus("Submission questions could not be loaded.", "error");
        return [];
    }

    return data;
}

async function loadOptionLabels(questionIds) {
    const labels = new Map();

    if (!questionIds.length) {
        return labels;
    }

    let { data, error } = await supabase
        .from("student_visible_question_options")
        .select("id, question_id, option_text, option_value")
        .in("question_id", questionIds);

    if (error) {
        const fallbackResult = await supabase
            .from("question_options")
            .select("id, question_id, option_text, option_value")
            .in("question_id", questionIds);

        data = fallbackResult.data;
        error = fallbackResult.error;
    }

    if (error) {
        return labels;
    }

    data.forEach((option) => {
        labels.set(option.id, option.option_text);
        if (option.option_value) {
            labels.set(option.option_value, option.option_text);
        }
    });
    return labels;
}

function renderSummary(submission, context) {
    const classroomName = context.classroom
        ? `${context.classroom.name}${context.classroom.period_block ? ` - ${context.classroom.period_block}` : ""}`
        : "No classroom";

    summaryElement.replaceChildren(
        createSummaryCard("Status", formatStatus(submission.status)),
        createSummaryCard("Submitted", formatDate(submission.submitted_at)),
        createSummaryCard("Course", context.course.title || "Untitled course"),
        createSummaryCard("Lesson", context.lesson.title || "Untitled lesson"),
        createSummaryCard("Classroom", classroomName),
        createSummaryCard("Points", `${submission.points_earned || 0} / ${submission.points_possible || 0}`)
    );
}

function renderAnswers(questions, answers, optionLabels) {
    if (!questions.length) {
        answerListElement.replaceChildren(createElement("p", "empty-state", "No visible questions are attached to this submission."));
        return;
    }

    const sections = questionPhases.map(([phase, title]) => {
        const sectionQuestions = questions.filter((question) => question.phase === phase);
        const section = createElement("section", "submission-answer-section");

        section.append(createElement("h3", "", title));

        if (!sectionQuestions.length) {
            section.append(createElement("p", "empty-state empty-state--compact", "No submitted answers in this section."));
            return section;
        }

        sectionQuestions.forEach((question) => {
            const card = createElement("article", "submission-answer-card");
            const meta = createElement("div", "badge-row");

            meta.append(
                createElement("span", "badge badge--quiet", formatStatus(question.question_type.replaceAll("_", " "))),
                createElement("span", "badge badge--quiet", `${question.points || 0} pts`)
            );
            card.append(
                createElement("h4", "", question.prompt),
                meta,
                createElement("p", "submission-answer-text", getAnswerValue(question, answers, optionLabels))
            );
            section.append(card);
        });

        return section;
    });

    answerListElement.replaceChildren(...sections);
}

async function initializePage() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
        window.location.href = "../auth/login.html";
        return;
    }

    const submission = await loadSubmission();

    if (!submission) {
        return;
    }

    const context = await loadContext(submission);

    if (!context) {
        return;
    }

    const questions = await loadQuestions(submission.lesson_id);
    const optionLabels = await loadOptionLabels(questions.map((question) => question.id));

    headingElement.textContent = context.lesson.title || "Submitted lesson";
    contextElement.textContent = `${context.course.title || "Untitled course"} submission`;
    renderSummary(submission, context);
    renderAnswers(questions, submission.answers_json || {}, optionLabels);
    showShell();
    setStatus("");
}

await initializePage();
