import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const params = new URLSearchParams(window.location.search);
const submissionId = params.get("submission");
const returnTo = params.get("returnTo");
const headingElement = qs("[data-submission-heading]");
const contextElement = qs("[data-submission-context]");
const statusElement = qs("[data-submission-status]");
const backLink = qs("[data-submission-back-link]");
const shellElements = [...document.querySelectorAll("[data-submission-shell]")];
const summaryElement = qs("[data-submission-summary]");
const answerListElement = qs("[data-answer-list]");
const feedbackPanel = qs("[data-feedback-panel]");
const questionPhases = [
    ["before", "Before lesson"],
    ["during", "During lesson"],
    ["reflection", "Reflection"],
];
let currentSubmission = null;
let currentSubmissionContext = null;
let currentProfileId = "";
let canReviewSubmission = false;
let feedbackSchemaAvailable = true;

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function getFeedbackErrorMessage(error) {
    const message = error?.message || "";
    const normalized = message.toLowerCase();

    if (normalized.includes("schema cache") || normalized.includes("column")) {
        return "Feedback could not be saved because feedback fields are not enabled in Supabase yet. Apply the latest feedback migration, then try again.";
    }

    if (normalized.includes("row-level security")) {
        return "Feedback could not be saved because Supabase is blocking review updates. Check that your account can review this classroom and that the latest feedback policy migration has been applied.";
    }

    return message || "Feedback could not be saved.";
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

function formatShortId(id) {
    return id ? id.slice(0, 8) : "unknown";
}

function formatStudentName(profile) {
    if (!profile) {
        return "Unknown student";
    }

    const fullName = [profile.legal_first_name, profile.legal_last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || profile.username || profile.email || `Student ${formatShortId(profile.id)}`;
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

function createFeedbackMeta(submission) {
    const updatedAt = submission.feedback_updated_at
        ? `Last updated ${formatDate(submission.feedback_updated_at)}.`
        : "No teacher feedback has been saved yet.";

    return createElement("p", "course-muted", updatedAt);
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

    let { data, error } = await supabase
        .from("lesson_submissions")
        .select("id, student_user_id, course_id, classroom_id, lesson_id, answers_json, total_questions, points_possible, points_earned, status, submitted_at, updated_at, teacher_feedback, feedback_updated_by, feedback_updated_at")
        .eq("id", submissionId)
        .single();

    if (error) {
        const fallbackResult = await supabase
            .from("lesson_submissions")
            .select("id, student_user_id, course_id, classroom_id, lesson_id, answers_json, total_questions, points_possible, points_earned, status, submitted_at, updated_at")
            .eq("id", submissionId)
            .single();

        data = fallbackResult.data;
        error = fallbackResult.error;
        feedbackSchemaAvailable = false;
    }

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

    const contextRequests = [loadStudentProfile(submission.student_user_id)];

    if (submission.classroom_id) {
        contextRequests.push(
            supabase
                .from("classrooms")
                .select("id, name, period_block")
                .eq("id", submission.classroom_id)
                .single()
        );
    }

    const [student, classroomResult] = await Promise.all(contextRequests);

    if (classroomResult && !classroomResult.error) {
        classroom = classroomResult.data;
    }

    return { course, lesson, classroom, student };
}

async function loadStudentProfile(studentId) {
    const { data: reviewableProfiles } = await supabase.rpc("reviewable_student_profiles");
    const reviewableProfile = (reviewableProfiles || []).find((profile) => profile.id === studentId);

    if (reviewableProfile) {
        return reviewableProfile;
    }

    const { data, error } = await supabase
        .from("profiles")
        .select("id, username, legal_first_name, legal_last_name, email")
        .eq("id", studentId)
        .maybeSingle();

    return error ? null : data;
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

async function loadReviewPermission(submission) {
    const { data, error } = await supabase.rpc("can_review_student_context", {
        course_to_check: submission.course_id,
        classroom_to_check: submission.classroom_id,
    });

    if (error) {
        return false;
    }

    return Boolean(data);
}

function renderSummary(submission, context) {
    const classroomName = context.classroom
        ? `${context.classroom.name}${context.classroom.period_block ? ` - ${context.classroom.period_block}` : ""}`
        : "No classroom";

    summaryElement.replaceChildren(
        createSummaryCard("Status", formatStatus(submission.status)),
        createSummaryCard("Submitted", formatDate(submission.submitted_at)),
        createSummaryCard("Student", formatStudentName(context.student)),
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

function renderFeedback(submission) {
    if (!feedbackSchemaAvailable) {
        feedbackPanel.replaceChildren(createElement("p", "empty-state", "Teacher feedback will appear here after feedback fields are enabled in Supabase."));
        return;
    }

    if (!canReviewSubmission) {
        const feedback = submission.teacher_feedback
            ? createElement("p", "submission-answer-text", submission.teacher_feedback)
            : createElement("p", "empty-state", "Teacher feedback has not been added yet.");

        feedbackPanel.replaceChildren(feedback, createFeedbackMeta(submission));
        return;
    }

    const form = createElement("form", "submission-feedback-form");
    const pointsLabel = createElement("label", "form-field");
    const pointsInput = document.createElement("input");
    const feedbackLabel = createElement("label", "form-field");
    const feedbackInput = document.createElement("textarea");
    const actions = createElement("div", "course-form-actions");
    const saveButton = createElement("button", "primary-button", "Save feedback");

    pointsInput.type = "number";
    pointsInput.name = "points-earned";
    pointsInput.min = "0";
    pointsInput.max = String(submission.points_possible || 0);
    pointsInput.step = "0.5";
    pointsInput.value = String(submission.points_earned || 0);
    feedbackInput.name = "teacher-feedback";
    feedbackInput.rows = 5;
    feedbackInput.maxLength = 2000;
    feedbackInput.value = submission.teacher_feedback || "";
    saveButton.type = "submit";
    pointsLabel.append(createElement("span", "", "Points earned"), pointsInput);
    feedbackLabel.append(createElement("span", "", "Feedback"), feedbackInput);
    actions.append(saveButton);
    form.append(pointsLabel, feedbackLabel, actions, createFeedbackMeta(submission));
    form.addEventListener("submit", saveFeedback);
    feedbackPanel.replaceChildren(form);
}

async function saveFeedback(event) {
    event.preventDefault();

    const form = event.currentTarget;
    const formData = new FormData(form);
    const pointsEarned = Number(formData.get("points-earned") || 0);
    const teacherFeedback = String(formData.get("teacher-feedback") || "").trim();
    const saveButton = form.querySelector("button[type='submit']");

    if (!Number.isFinite(pointsEarned) || pointsEarned < 0 || pointsEarned > Number(currentSubmission.points_possible || 0)) {
        setStatus("Enter points within the possible score range.", "error");
        return;
    }

    saveButton.disabled = true;
    setStatus("Saving feedback...");

    const { data, error } = await supabase
        .from("lesson_submissions")
        .update({
            points_earned: pointsEarned,
            teacher_feedback: teacherFeedback || null,
            feedback_updated_by: currentProfileId,
            feedback_updated_at: new Date().toISOString(),
        })
        .eq("id", currentSubmission.id)
        .select("id, student_user_id, course_id, classroom_id, lesson_id, answers_json, total_questions, points_possible, points_earned, status, submitted_at, updated_at, teacher_feedback, feedback_updated_by, feedback_updated_at")
        .single();

    saveButton.disabled = false;

    if (error) {
        setStatus(getFeedbackErrorMessage(error), "error");
        return;
    }

    currentSubmission = data;
    renderSummary(currentSubmission, currentSubmissionContext);
    renderFeedback(currentSubmission);
    setStatus("Feedback saved.", "success");
}

async function initializePage() {
    backLink.href = returnTo && returnTo.startsWith("/pages/submissions/")
        ? returnTo
        : "index.html";

    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
        window.location.href = "../auth/login.html";
        return;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();

    if (profileError || !profile) {
        setStatus("Your profile could not be loaded. Please sign in again.", "error");
        return;
    }

    currentProfileId = profile.id;
    const submission = await loadSubmission();

    if (!submission) {
        return;
    }

    currentSubmission = submission;
    const context = await loadContext(submission);

    if (!context) {
        return;
    }

    currentSubmissionContext = context;
    canReviewSubmission = await loadReviewPermission(submission);
    const questions = await loadQuestions(submission.lesson_id);
    const optionLabels = await loadOptionLabels(questions.map((question) => question.id));

    headingElement.textContent = `${formatStudentName(context.student)} - ${context.lesson.title || "Submitted lesson"}`;
    contextElement.textContent = `${context.course.title || "Untitled course"} submission`;
    renderSummary(submission, context);
    renderAnswers(questions, submission.answers_json || {}, optionLabels);
    renderFeedback(submission);
    showShell();
    setStatus("");
}

await initializePage();
