import { supabase } from "../../services/supabase/client.js";
import { loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { notifyStatus } from "../utils/ui-components.js";

const params = new URLSearchParams(window.location.search);
const lessonId = params.get("lesson");
const classroomId = params.get("classroom");
const isTeacherPreview = params.get("preview") === "teacher";
const previewCourseId = params.get("course");
const backLink = qs("[data-lesson-back-link]");
const headingElement = qs("[data-lesson-heading]");
const contextElement = qs("[data-lesson-context]");
const statusElement = qs("[data-lesson-status]");
const shellElement = qs("[data-lesson-shell]");
const objectiveElement = qs("[data-lesson-objective]");
const canvasContextElement = qs("[data-canvas-context]");
const canvasTitleElement = qs("[data-canvas-title]");
const canvasObjectiveElement = qs("[data-canvas-objective]");
const canvasOverviewElement = qs("[data-canvas-overview]");
const canvasDurationElement = qs("[data-canvas-duration]");
const contentRenderer = qs("[data-content-renderer]");
const questionFlow = qs("[data-question-flow]");
const submitPanel = qs("[data-submit-panel]");
const submitPanelHeading = qs("[data-submit-panel-heading]");
const saveStatusElement = qs("[data-save-status]");
const submitStatusElement = qs("[data-submit-status]");
const saveDraftButton = qs("[data-save-draft-button]");
const resetDraftButton = qs("[data-reset-draft-button]");
const turnInButton = qs("[data-turn-in-button]");
const nextLessonLink = qs("[data-next-lesson-link]");
const questionPhases = [
    ["before", "Before lesson"],
    ["during", "During lesson"],
    ["reflection", "Reflection"],
];
const optionQuestionTypes = ["multiple_choice", "select_all_that_apply"];
const responseQuestionTypes = ["short_response", "long_response", "fill_in_the_blank"];
let currentProfileId = "";
let currentLessonContext = null;
let currentSubmission = null;
let loadedQuestions = [];
let questionOptionsByQuestion = new Map();
let answerState = {};
let autoSaveTimer = null;
let isSubmitted = false;
let lastSavedAt = null;
let submittedAt = null;
let currentAvailabilityContext = null;
const lessonResourceBucket = "lesson-resources";

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
    notifyStatus(message, tone);
}

function setAccessStatus(courseId) {
    const courseHref = courseId
        ? `../courses/student.html?course=${encodeURIComponent(courseId)}`
        : "../dashboard/index.html";
    const courseLink = createElement("a", "status-link", "Open course");
    const dashboardLink = createElement("a", "status-link", "Back to dashboard");

    courseLink.href = courseHref;
    dashboardLink.href = "../dashboard/index.html";
    headingElement.textContent = "Lesson unavailable";
    contextElement.textContent = "This lesson needs an active course or classroom enrollment.";
    statusElement.replaceChildren(
        "You are not enrolled in this lesson context. Open the course, join from public discovery, or use a classroom invite from your teacher.",
        " ",
        courseLink,
        " ",
        dashboardLink
    );
    statusElement.dataset.tone = "error";
}

function setLockedLessonStatus(courseId, message) {
    const courseHref = courseId
        ? `../courses/student.html?course=${encodeURIComponent(courseId)}${classroomId ? `&classroom=${encodeURIComponent(classroomId)}` : ""}`
        : "../dashboard/index.html";
    const courseLink = createElement("a", "status-link", "Open course");
    const dashboardLink = createElement("a", "status-link", "Back to dashboard");

    courseLink.href = courseHref;
    dashboardLink.href = "../dashboard/index.html";
    headingElement.textContent = "Lesson locked";
    contextElement.textContent = "This lesson is not available yet.";
    statusElement.replaceChildren(message, " ", courseLink, " ", dashboardLink);
    statusElement.dataset.tone = "error";
}

function setHiddenLessonStatus(courseId) {
    const courseHref = courseId
        ? `../courses/student.html?course=${encodeURIComponent(courseId)}${classroomId ? `&classroom=${encodeURIComponent(classroomId)}` : ""}`
        : "../dashboard/index.html";
    const courseLink = createElement("a", "status-link", "Open course");
    const dashboardLink = createElement("a", "status-link", "Back to dashboard");

    courseLink.href = courseHref;
    dashboardLink.href = "../dashboard/index.html";
    headingElement.textContent = "Lesson hidden";
    contextElement.textContent = "This lesson is not visible to students yet.";
    statusElement.replaceChildren("Your teacher has not made this lesson visible yet.", " ", courseLink, " ", dashboardLink);
    statusElement.dataset.tone = "error";
}

function setSubmitStatus(message, tone = "info") {
    submitStatusElement.textContent = message;
    submitStatusElement.dataset.tone = tone;
    notifyStatus(message, tone);
}

function getSubmissionErrorMessage(error, fallback) {
    const message = error?.message || "";
    const normalized = message.toLowerCase();

    if (normalized.includes("row-level security")) {
        return "This lesson work could not be saved because Supabase is blocking the submission. Check that the student is enrolled and the latest lesson submission migrations have been applied.";
    }

    if (normalized.includes("schema cache") || normalized.includes("column") || normalized.includes("lesson_submissions")) {
        return "This lesson work could not be saved because the live Supabase submission schema is behind the app. Apply the latest migrations, then try again.";
    }

    return message || fallback;
}

function formatSavedTime(date) {
    return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function setSavedStatus(message = "Draft saved.") {
    lastSavedAt = new Date();
    saveStatusElement.textContent = `${message} Last saved at ${formatSavedTime(lastSavedAt)}.`;
}

function getBlockUrl(contentBlock) {
    return contentBlock.file_url || contentBlock.external_url || "";
}

function isExternalUrl(url = "") {
    return /^https?:\/\//i.test(url);
}

function isLessonStoragePath(url = "") {
    return Boolean(url) && !isExternalUrl(url) && !url.startsWith("data:") && !url.startsWith("blob:");
}

async function getDisplayResourceUrl(contentBlock) {
    const url = getBlockUrl(contentBlock);

    if (!isLessonStoragePath(url)) {
        return url;
    }

    const { data, error } = await supabase.storage
        .from(lessonResourceBucket)
        .createSignedUrl(url, 60 * 60);

    if (error) {
        console.warn("Lesson resource signed URL failed", error);
        return "";
    }

    return data?.signedUrl || "";
}

function getQuestionOptions(question) {
    return questionOptionsByQuestion.get(question.id) || [];
}

function getOptionValue(option) {
    return option.option_value || option.id;
}

function getAnswer(questionId) {
    return answerState[questionId];
}

function setAnswer(questionId, value) {
    if (isTeacherPreview) {
        return;
    }

    answerState = {
        ...answerState,
        [questionId]: value,
    };
    clearQuestionHighlights();
    scheduleDraftSave();
}

function getSubmissionFilter(query) {
    let filteredQuery = query
        .eq("student_user_id", currentProfileId)
        .eq("course_id", currentLessonContext.course.id)
        .eq("lesson_id", currentLessonContext.lesson.id);

    filteredQuery = classroomId ? filteredQuery.eq("classroom_id", classroomId) : filteredQuery.is("classroom_id", null);
    return filteredQuery;
}

function getLocalDate(dateLike) {
    if (!dateLike) {
        return null;
    }

    const date = new Date(dateLike);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getPacingStartDate(course, enrollment, classroom) {
    return getLocalDate(course.lesson_release_start_date)
        || getLocalDate(classroom?.start_date)
        || getLocalDate(enrollment?.joined_at)
        || getLocalDate(new Date());
}

function getUnlockedLessonCount(course, enrollment, classroom, totalLessons) {
    if (course.lesson_release_mode !== "daily") {
        return totalLessons;
    }

    const startDate = getPacingStartDate(course, enrollment, classroom);
    const today = getLocalDate(new Date());
    const intervalDays = Math.max(Number(course.lesson_release_interval_days || 1), 1);
    const elapsedDays = Math.floor((today - startDate) / 86400000);

    if (elapsedDays < 0) {
        return 0;
    }

    return Math.min(Math.floor(elapsedDays / intervalDays) + 1, totalLessons);
}

function getLessonViewHref(nextLesson) {
    const nextParams = new URLSearchParams({ lesson: nextLesson.id });

    if (classroomId) {
        nextParams.set("classroom", classroomId);
    }
    if (isTeacherPreview) {
        nextParams.set("preview", "teacher");
    }

    return `view.html?${nextParams.toString()}`;
}

async function loadCurrentProfile() {
    return loadProtectedProfile({ statusElement });
}

function isQuestionAnswered(question) {
    const answer = getAnswer(question.id);

    if (!question.is_required) {
        return true;
    }

    if (Array.isArray(answer)) {
        return answer.length > 0;
    }

    if (answer && typeof answer === "object") {
        const options = getQuestionOptions(question);

        if (!options.length) {
            return Object.values(answer).some((value) => String(value || "").trim());
        }

        return options.every((option) => String(answer[option.id] || "").trim());
    }

    return String(answer || "").trim().length > 0;
}

function getMissingRequiredQuestions() {
    return loadedQuestions.filter((question) => question.is_required && !isQuestionAnswered(question));
}

function setQuestionInputsDisabled(disabled) {
    questionFlow.querySelectorAll("input, textarea, select").forEach((input) => {
        input.disabled = disabled;
    });
}

function setDraftControlsDisabled(disabled) {
    saveDraftButton.disabled = disabled;
    resetDraftButton.disabled = disabled;
}

function clearQuestionHighlights() {
    questionFlow.querySelectorAll(".lesson-flow-question--missing").forEach((item) => {
        item.classList.remove("lesson-flow-question--missing");
    });
    questionFlow.querySelectorAll("[data-required-warning]").forEach((warning) => {
        warning.remove();
    });
}

function highlightMissingQuestions(missingQuestions) {
    clearQuestionHighlights();
    missingQuestions.forEach((question) => {
        const item = qs(`[data-question-id="${question.id}"]`, questionFlow);

        if (!item) {
            return;
        }

        item.classList.add("lesson-flow-question--missing");
        item.append(createElement("p", "lesson-required-warning", "Required before turn-in."));
        item.lastElementChild.dataset.requiredWarning = "true";
    });
}

function formatPoints(value) {
    return Number(value || 0).toLocaleString([], {
        maximumFractionDigits: 1,
    });
}

function getSubmissionPointsMessage(submission) {
    if (!submission || submission.points_possible === undefined || submission.points_earned === undefined) {
        return "Lesson turned in successfully. Your answers are locked.";
    }

    return `Lesson turned in successfully. You earned ${formatPoints(submission.points_earned)} of ${formatPoints(submission.points_possible)} engagement points. Your answers are locked.`;
}

function showCompletionState(date = new Date(), submission = currentSubmission) {
    const submittedDate = date instanceof Date ? date : new Date(date);

    saveStatusElement.textContent = `Submitted ${formatSavedTime(submittedDate)}.`;
    setSubmitStatus(getSubmissionPointsMessage(submission), "success");
    turnInButton.hidden = true;
    setDraftControlsDisabled(true);
    setQuestionInputsDisabled(true);
}

function showTeacherPreviewState() {
    submitPanelHeading.textContent = "Teacher preview";
    saveStatusElement.textContent = "Read-only preview. Student responses are disabled and no draft will be saved.";
    setSubmitStatus("Preview mode is for checking the student experience before assigning the lesson.", "info");
    saveDraftButton.hidden = true;
    resetDraftButton.hidden = true;
    turnInButton.hidden = true;
    nextLessonLink.hidden = true;
    setQuestionInputsDisabled(true);
}

function updateTeacherPreviewBackLink(courseId) {
    const targetCourseId = previewCourseId || courseId;

    if (!targetCourseId) {
        return;
    }

    backLink.href = `../courses/preview.html?course=${encodeURIComponent(targetCourseId)}`;
    backLink.textContent = "Back to course preview";
}

function isAudioUrl(url) {
    return /\.(mp3|m4a|ogg|wav|webm)(\?.*)?$/i.test(url);
}

function isPdfUrl(url) {
    return /\.pdf(\?.*)?$/i.test(url);
}

function getDefaultContentBlockTitle(contentBlock) {
    if (contentBlock.title) {
        return contentBlock.title;
    }

    if (contentBlock.block_type === "text") {
        return "Text content";
    }

    if (contentBlock.block_type === "youtube") {
        return "YouTube video";
    }

    if (contentBlock.block_type === "slides") {
        return "Slides";
    }

    if (contentBlock.block_type === "link") {
        return "External link";
    }

    if (contentBlock.file_type === "image") {
        return "Image resource";
    }

    if (contentBlock.file_type === "audio") {
        return "Audio resource";
    }

    return "File resource";
}

function appendInlineFormattedText(parent, text) {
    const tokenPattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
    let lastIndex = 0;
    let match = tokenPattern.exec(text);

    while (match) {
        if (match.index > lastIndex) {
            parent.append(document.createTextNode(text.slice(lastIndex, match.index)));
        }

        const token = match[0];

        if (token.startsWith("**")) {
            parent.append(createElement("strong", "", token.slice(2, -2)));
        } else {
            const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
            const link = createElement("a", "lesson-inline-link", linkMatch?.[1] || "Link");

            link.href = linkMatch?.[2] || "#";
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            parent.append(link);
        }

        lastIndex = match.index + token.length;
        match = tokenPattern.exec(text);
    }

    if (lastIndex < text.length) {
        parent.append(document.createTextNode(text.slice(lastIndex)));
    }
}

function createFormattedTextContent(text = "") {
    const wrapper = createElement("div", "lesson-render-text lesson-render-rich-text");
    const lines = text.split("\n");
    let activeList = null;

    lines.forEach((rawLine) => {
        const line = rawLine.trimEnd();

        if (!line.trim()) {
            activeList = null;
            return;
        }

        if (line.startsWith("## ")) {
            activeList = null;
            const heading = createElement("h4", "lesson-render-subheading", "");
            appendInlineFormattedText(heading, line.slice(3).trim());
            wrapper.append(heading);
            return;
        }

        if (line.startsWith("# ")) {
            activeList = null;
            const heading = createElement("h4", "lesson-render-subheading", "");
            appendInlineFormattedText(heading, line.slice(2).trim());
            wrapper.append(heading);
            return;
        }

        if (line.startsWith("- ")) {
            if (!activeList) {
                activeList = createElement("ul", "lesson-render-list");
                wrapper.append(activeList);
            }

            const item = createElement("li", "", "");
            appendInlineFormattedText(item, line.slice(2).trim());
            activeList.append(item);
            return;
        }

        activeList = null;
        const paragraph = createElement("p", "", "");
        appendInlineFormattedText(paragraph, line.trim());
        wrapper.append(paragraph);
    });

    if (!wrapper.children.length) {
        wrapper.append(createElement("p", "", "No text content has been added yet."));
    }

    return wrapper;
}

function getYouTubeEmbedUrl(url) {
    try {
        const parsedUrl = new URL(url);

        if (parsedUrl.hostname.includes("youtu.be")) {
            const videoId = parsedUrl.pathname.replace("/", "");
            return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
        }

        if (parsedUrl.hostname.includes("youtube.com")) {
            const videoId = parsedUrl.searchParams.get("v") || parsedUrl.pathname.split("/").pop();
            return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
        }
    } catch {
        return "";
    }

    return "";
}

function getSlidesEmbedUrl(url) {
    try {
        const parsedUrl = new URL(url);

        if (parsedUrl.hostname.includes("docs.google.com") && parsedUrl.pathname.includes("/presentation/")) {
            if (parsedUrl.pathname.includes("/embed")) {
                return url;
            }

            const parts = parsedUrl.pathname.split("/").filter(Boolean);
            const deckIndex = parts.indexOf("d");
            const deckId = deckIndex >= 0 ? parts[deckIndex + 1] : "";

            return deckId
                ? `https://docs.google.com/presentation/d/${deckId}/embed?start=false&loop=false&delayms=3000`
                : "";
        }
    } catch {
        return "";
    }

    return url;
}

function createEmbedFrame(title, src) {
    const wrapper = createElement("div", "lesson-embed-shell");
    const status = createElement("p", "lesson-embed-status", "Loading embedded content...");
    const iframe = document.createElement("iframe");
    const fallback = createElement("p", "lesson-embed-fallback", "If this embed does not load, open it in a new tab.");

    iframe.title = title;
    iframe.src = src;
    iframe.loading = "lazy";
    iframe.allowFullscreen = true;
    iframe.addEventListener("load", () => {
        status.textContent = "Embedded content loaded.";
        status.dataset.state = "loaded";
    });
    iframe.addEventListener("error", () => {
        status.textContent = "Embedded content could not be loaded.";
        status.dataset.state = "error";
    });
    fallback.append(" ", createExternalLink(src, "Open source"));
    wrapper.append(status, iframe, fallback);
    return wrapper;
}

function createExternalLink(url, label = "Open resource") {
    const link = createElement("a", "lesson-resource-link", label);

    link.href = url || "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
}

async function createContentBlock(contentBlock) {
    const article = createElement("article", `lesson-render-block lesson-render-block--${contentBlock.block_type}`);
    const title = createElement("h3", "", getDefaultContentBlockTitle(contentBlock));
    const label = createElement("span", "badge badge--quiet", `Block ${contentBlock.order_index + 1}`);
    const url = await getDisplayResourceUrl(contentBlock);

    article.append(title, label);

    if (contentBlock.block_type === "text") {
        article.append(createFormattedTextContent(contentBlock.body_text || ""));
        return article;
    }

    if (contentBlock.block_type === "youtube") {
        const embedUrl = getYouTubeEmbedUrl(url);
        article.append(embedUrl ? createEmbedFrame(contentBlock.title || "YouTube video", embedUrl) : createExternalLink(url, "Open video"));
        return article;
    }

    if (contentBlock.block_type === "slides") {
        const embedUrl = getSlidesEmbedUrl(url);

        article.append(embedUrl ? createEmbedFrame(contentBlock.title || "Slides", embedUrl) : createExternalLink(url, "Open slides"));
        return article;
    }

    if (contentBlock.block_type === "file" && contentBlock.file_type === "image") {
        const image = createElement("img", "lesson-render-image");

        image.src = url || "";
        image.alt = contentBlock.title || "Lesson image";
        article.append(image, createExternalLink(url, "Open image"));
        return article;
    }

    if (contentBlock.block_type === "file" && contentBlock.file_type === "pdf" && isPdfUrl(url)) {
        article.append(createEmbedFrame(contentBlock.title || "PDF resource", url), createExternalLink(url, "Download PDF"));
        return article;
    }

    if (contentBlock.file_type === "audio" || isAudioUrl(url)) {
        const audio = document.createElement("audio");

        audio.controls = true;
        audio.src = url || "";
        article.append(audio, createExternalLink(url, "Download audio"));
        return article;
    }

    if (contentBlock.block_type === "link") {
        article.append(createElement("p", "lesson-render-text", "Open this external resource in a new tab."), createExternalLink(url));
        return article;
    }

    article.append(
        createElement("p", "lesson-render-text", `${contentBlock.file_type?.toUpperCase() || "File"} resource`),
        createExternalLink(url, "Download resource")
    );
    return article;
}

async function renderContentBlocks(contentBlocks) {
    if (!contentBlocks.length) {
        contentRenderer.replaceChildren(createElement("p", "empty-state", "No visible lesson content is available yet."));
        return;
    }

    const renderedBlocks = await Promise.all(contentBlocks.map(createContentBlock));
    contentRenderer.replaceChildren(...renderedBlocks);
}

function createQuestionOptionControl(question, option, type) {
    const label = createElement("label", "question-preview-option");
    const input = document.createElement("input");
    const answer = getAnswer(question.id);
    const optionValue = getOptionValue(option);

    input.type = type;
    input.name = `question-${question.id}`;
    input.value = optionValue;
    input.checked = Array.isArray(answer) ? answer.includes(optionValue) : answer === optionValue;
    input.addEventListener("change", () => {
        if (type === "checkbox") {
            const selectedValues = Array.from(questionFlow.querySelectorAll(`input[name="question-${question.id}"]:checked`))
                .map((selectedInput) => selectedInput.value);

            setAnswer(question.id, selectedValues);
            return;
        }

        setAnswer(question.id, input.value);
    });
    label.append(input, createElement("span", "", option.option_text));
    return label;
}

function createChoiceControls(question) {
    const options = getQuestionOptions(question);
    const fieldset = createElement("fieldset", "question-preview-options");
    const legend = createElement("legend", "screen-reader-only", "Answer choices");
    const inputType = question.question_type === "select_all_that_apply" ? "checkbox" : "radio";

    fieldset.append(legend);
    if (!options.length) {
        fieldset.append(createElement("p", "empty-state empty-state--compact", "Answer choices are not available yet."));
        return fieldset;
    }

    options.forEach((option) => {
        fieldset.append(createQuestionOptionControl(question, option, inputType));
    });
    return fieldset;
}

function createTrueFalseControls(question) {
    const fieldset = createElement("fieldset", "question-preview-options");
    const legend = createElement("legend", "screen-reader-only", "True or false answer choices");

    fieldset.append(legend);
    ["true", "false"].forEach((value) => {
        const label = createElement("label", "question-preview-option");
        const input = document.createElement("input");

        input.type = "radio";
        input.name = `question-${question.id}`;
        input.value = value;
        input.checked = getAnswer(question.id) === value;
        input.addEventListener("change", () => setAnswer(question.id, value));
        label.append(input, createElement("span", "", value === "true" ? "True" : "False"));
        fieldset.append(label);
    });
    return fieldset;
}

function createRatingControls(question) {
    const fieldset = createElement("fieldset", "question-preview-options question-rating-scale");
    const legend = createElement("legend", "screen-reader-only", "Rating scale choices");

    fieldset.append(legend);
    [1, 2, 3, 4, 5].forEach((rating) => {
        const label = createElement("label", "question-preview-option");
        const input = document.createElement("input");
        const value = String(rating);

        input.type = "radio";
        input.name = `question-${question.id}`;
        input.value = value;
        input.checked = getAnswer(question.id) === value;
        input.addEventListener("change", () => setAnswer(question.id, value));
        label.append(input, createElement("span", "", value));
        fieldset.append(label);
    });
    return fieldset;
}

function createMatchingControls(question) {
    const options = getQuestionOptions(question);
    const wrapper = createElement("div", "lesson-answer-grid");
    const answer = getAnswer(question.id) || {};

    if (!options.length) {
        wrapper.append(createElement("p", "empty-state empty-state--compact", "Matching prompts are not available yet."));
        return wrapper;
    }

    options.forEach((option) => {
        const label = createElement("label", "form-field lesson-answer-field");
        const input = document.createElement("input");

        input.type = "text";
        input.value = answer[option.id] || "";
        input.placeholder = "Type the match";
        input.addEventListener("input", () => {
            setAnswer(question.id, {
                ...(getAnswer(question.id) || {}),
                [option.id]: input.value,
            });
        });
        label.append(createElement("span", "", option.option_text), input);
        wrapper.append(label);
    });
    return wrapper;
}

function createOrderingControls(question) {
    const options = getQuestionOptions(question);
    const wrapper = createElement("div", "lesson-answer-grid");
    const answer = getAnswer(question.id) || {};

    if (!options.length) {
        wrapper.append(createElement("p", "empty-state empty-state--compact", "Sequence items are not available yet."));
        return wrapper;
    }

    options.forEach((option, index) => {
        const label = createElement("label", "form-field lesson-answer-field");
        const input = document.createElement("input");

        input.type = "number";
        input.min = "1";
        input.max = String(options.length);
        input.value = answer[option.id] || "";
        input.placeholder = String(index + 1);
        input.addEventListener("input", () => {
            setAnswer(question.id, {
                ...(getAnswer(question.id) || {}),
                [option.id]: input.value,
            });
        });
        label.append(createElement("span", "", option.option_text), input);
        wrapper.append(label);
    });
    return wrapper;
}

function createTextResponseControl(question) {
    const isBlank = question.question_type === "fill_in_the_blank";
    const response = isBlank ? document.createElement("input") : document.createElement("textarea");

    response.className = isBlank ? "question-preview-blank" : "question-preview-response";
    response.value = getAnswer(question.id) || "";
    response.placeholder = question.hint ? `Hint: ${question.hint}` : "Student response";
    if (!isBlank) {
        response.rows = question.question_type === "long_response" ? 5 : 3;
    }
    response.addEventListener("input", () => setAnswer(question.id, response.value));
    return response;
}

function createQuestionAnswerControl(question) {
    if (optionQuestionTypes.includes(question.question_type)) {
        return createChoiceControls(question);
    }

    if (question.question_type === "true_false") {
        return createTrueFalseControls(question);
    }

    if (question.question_type === "rating_scale") {
        return createRatingControls(question);
    }

    if (question.question_type === "matching") {
        return createMatchingControls(question);
    }

    if (question.question_type === "ordering") {
        return createOrderingControls(question);
    }

    if (responseQuestionTypes.includes(question.question_type)) {
        return createTextResponseControl(question);
    }

    return createTextResponseControl({ ...question, question_type: "short_response" });
}

function renderQuestionFlow(questions) {
    const sections = questionPhases.flatMap(([phase, title]) => {
        const phaseQuestions = questions.filter((question) => question.phase === phase);
        const section = createElement("section", "lesson-flow-card");
        const heading = createElement("h3", "", title);

        if (!phaseQuestions.length) {
            return [];
        }

        section.append(heading);
        const list = createElement("ol", "lesson-flow-question-list");

        phaseQuestions.forEach((question) => {
            const item = createElement("li", "");
            const prompt = createElement("strong", "", question.prompt);
            const instructions = createElement(
                "p",
                "",
                question.student_instructions || (question.is_required ? "Required checkpoint" : "Optional checkpoint")
            );
            const badge = createElement("span", "badge badge--quiet", question.is_required ? "Required" : "Optional");

            item.dataset.questionId = question.id;
            item.append(prompt, badge, instructions, createQuestionAnswerControl(question));
            list.append(item);
        });

        section.append(list);
        return section;
    });

    questionFlow.hidden = !sections.length;
    questionFlow.replaceChildren(
        ...(sections.length
            ? [
                createElement("h3", "", "Student response"),
                createElement("p", "section-copy", "Answer the questions your teacher added for this lesson."),
                ...sections,
            ]
            : [])
    );
    setQuestionInputsDisabled(isSubmitted || isTeacherPreview);
}

async function loadLessonContext() {
    if (!lessonId) {
        headingElement.textContent = "Lesson unavailable";
        setStatus("Open a lesson from a course before viewing lesson content.", "error");
        return null;
    }

    const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select("id, module_id, title, objective, summary, estimated_time, order_index, is_locked, is_visible")
        .eq("id", lessonId)
        .is("archived_at", null)
        .single();

    if (lessonError) {
        console.error("Lesson lookup failed", lessonError);
        headingElement.textContent = "Lesson unavailable";
        setStatus("This lesson could not be loaded. Check that the lesson link is correct and your account has access.", "error");
        return null;
    }

    const { data: module, error: moduleError } = await supabase
        .from("modules")
        .select("id, course_id, title, order_index")
        .eq("id", lesson.module_id)
        .is("archived_at", null)
        .single();

    if (moduleError) {
        console.error("Module lookup failed", moduleError);
        headingElement.textContent = "Lesson unavailable";
        setStatus("The module for this lesson could not be loaded. Check that your account can access this course.", "error");
        return null;
    }

    const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id, title, lesson_release_mode, lesson_release_start_date, lesson_release_interval_days")
        .eq("id", module.course_id)
        .single();

    if (courseError) {
        console.error("Course lookup failed", courseError);
        headingElement.textContent = "Lesson unavailable";
        setStatus("The course for this lesson could not be loaded. Check that your account can access this course.", "error");
        return null;
    }

    return { lesson, module, course };
}

async function canAccessLessonContext(context) {
    const { data, error } = await supabase.rpc("can_submit_draft_for_context", {
        course_to_check: context.course.id,
        classroom_to_check: classroomId || null,
    });

    if (error) {
        setStatus(error.message || "Lesson access could not be checked.", "error");
        return false;
    }

    if (!data) {
        setAccessStatus(context.course.id);
        return false;
    }

    return true;
}

async function loadStudentLessonAvailability(context) {
    let enrollmentQuery = supabase
        .from("enrollments")
        .select("id, course_id, classroom_id, enrollment_type, enrollment_status, joined_at")
        .eq("user_id", currentProfileId)
        .eq("course_id", context.course.id)
        .neq("enrollment_status", "removed");

    enrollmentQuery = classroomId ? enrollmentQuery.eq("classroom_id", classroomId) : enrollmentQuery;

    const { data: enrollments, error: enrollmentError } = await enrollmentQuery;

    if (enrollmentError) {
        setStatus("Lesson availability could not be checked.", "error");
        return false;
    }

    const enrollment = classroomId
        ? enrollments?.[0]
        : enrollments?.find((row) => row.enrollment_type === "course" && !row.classroom_id) || enrollments?.[0];

    if (!enrollment) {
        setAccessStatus(context.course.id);
        return false;
    }

    const { data: classroom, error: classroomError } = enrollment.classroom_id
        ? await supabase
            .from("classrooms")
            .select("id, start_date")
            .eq("id", enrollment.classroom_id)
            .maybeSingle()
        : { data: null, error: null };

    if (classroomError) {
        setStatus("Classroom pacing details could not be checked.", "error");
        return false;
    }

    const { data: modules, error: modulesError } = await supabase
        .from("modules")
        .select("id, order_index")
        .eq("course_id", context.course.id)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (modulesError) {
        setStatus("Course pacing details could not be loaded.", "error");
        return false;
    }

    const { data: lessons, error: lessonsError } = modules.length
        ? await supabase
            .from("lessons")
            .select("id, module_id, title, order_index, is_locked")
            .in("module_id", modules.map((module) => module.id))
            .is("archived_at", null)
            .order("order_index", { ascending: true })
        : { data: [], error: null };

    if (lessonsError) {
        setStatus("Lesson pacing details could not be loaded.", "error");
        return false;
    }

    const orderedLessons = modules.flatMap((module) => {
        return lessons
            .filter((lesson) => lesson.module_id === module.id)
            .sort((first, second) => first.order_index - second.order_index);
    });
    const currentLessonIndex = orderedLessons.findIndex((lesson) => lesson.id === context.lesson.id);
    const unlockedLessonCount = getUnlockedLessonCount(context.course, enrollment, classroom, orderedLessons.length);

    currentAvailabilityContext = {
        classroom,
        enrollment,
        orderedLessons,
        unlockedLessonCount,
    };

    if (context.lesson.is_locked) {
        setLockedLessonStatus(context.course.id, "Your teacher has locked this lesson for now.");
        return false;
    }

    if (currentLessonIndex >= unlockedLessonCount) {
        setLockedLessonStatus(context.course.id, `This lesson is scheduled to unlock later. ${unlockedLessonCount || 0} lesson${unlockedLessonCount === 1 ? "" : "s"} currently available.`);
        return false;
    }

    return true;
}

async function loadContentBlocks() {
    const { data, error } = await supabase
        .from("lesson_content_blocks")
        .select("id, block_type, title, body_text, external_url, file_url, file_type, order_index")
        .eq("lesson_id", lessonId)
        .eq("is_visible", true)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        contentRenderer.replaceChildren(createElement("p", "empty-state", "Lesson content could not be loaded."));
        setStatus("Lesson content could not be loaded.", "error");
        return false;
    }

    await renderContentBlocks(data);
    return true;
}

async function loadQuestionOptions(questions) {
    const questionIds = questions.map((question) => question.id);

    questionOptionsByQuestion = new Map();
    if (!questionIds.length) {
        return true;
    }

    let { data, error } = await supabase
        .from("student_visible_question_options")
        .select("id, question_id, option_text, option_value, order_index")
        .in("question_id", questionIds)
        .order("order_index", { ascending: true });

    if (error) {
        console.warn("Student question options view unavailable, falling back to manager-readable options", error);
        const fallbackResult = await supabase
            .from("question_options")
            .select("id, question_id, option_text, option_value, order_index")
            .in("question_id", questionIds)
            .order("order_index", { ascending: true });

        data = fallbackResult.data;
        error = fallbackResult.error;
    }

    if (error) {
        setSubmitStatus("Answer choices could not be loaded. If you are testing as a student, apply the latest Supabase migration first.", "error");
        return false;
    }

    data.forEach((option) => {
        const options = questionOptionsByQuestion.get(option.question_id) || [];

        options.push(option);
        questionOptionsByQuestion.set(option.question_id, options);
    });
    return true;
}

async function loadQuestionFlow() {
    let { data, error } = await supabase
        .from("student_visible_questions")
        .select("id, phase, question_type, prompt, student_instructions, hint, points, is_required, order_index")
        .eq("lesson_id", lessonId)
        .order("order_index", { ascending: true });

    if (error) {
        console.warn("Student questions view unavailable, falling back to manager-readable questions", error);
        const fallbackResult = await supabase
            .from("questions")
            .select("id, phase, question_type, prompt, student_instructions, hint, points, is_required, order_index")
            .eq("lesson_id", lessonId)
            .eq("is_visible", true)
            .is("archived_at", null)
            .order("order_index", { ascending: true });

        data = fallbackResult.data;
        error = fallbackResult.error;
    }

    if (error) {
        loadedQuestions = [];
        renderQuestionFlow([]);
        setSubmitStatus("Lesson questions could not be loaded. If you are testing as a student, apply the latest Supabase migration first.", "error");
        return false;
    }

    loadedQuestions = data;
    if (!(await loadQuestionOptions(loadedQuestions))) {
        loadedQuestions = [];
        renderQuestionFlow([]);
        return false;
    }

    renderQuestionFlow(loadedQuestions);
    return true;
}

async function loadSubmissionDraft() {
    const { data, error } = await getSubmissionFilter(
        supabase
            .from("lesson_submissions")
            .select("id, answers_json, status, submitted_at, updated_at, points_earned, points_possible")
    ).maybeSingle();

    if (error) {
        setSubmitStatus(getSubmissionErrorMessage(error, "Your draft could not be loaded."), "error");
        return false;
    }

    currentSubmission = data;
    answerState = data?.answers_json || {};
    isSubmitted = data?.status === "submitted";
    submittedAt = data?.submitted_at ? new Date(data.submitted_at) : null;
    if (data?.updated_at && !isSubmitted) {
        lastSavedAt = new Date(data.updated_at);
        saveStatusElement.textContent = `Draft restored. Last saved at ${formatSavedTime(lastSavedAt)}.`;
    }
    return true;
}

async function createSubmissionDraft() {
    const { data, error } = await supabase
        .from("lesson_submissions")
        .insert({
            student_user_id: currentProfileId,
            course_id: currentLessonContext.course.id,
            classroom_id: classroomId || null,
            lesson_id: currentLessonContext.lesson.id,
            answers_json: answerState,
        })
        .select("id, answers_json, status, submitted_at, updated_at, points_earned, points_possible")
        .single();

    if (error) {
        throw error;
    }

    currentSubmission = data;
    return data;
}

async function saveDraftAnswers() {
    if (isTeacherPreview || isSubmitted) {
        return true;
    }

    saveStatusElement.textContent = "Saving draft...";

    try {
        if (!currentSubmission) {
            await createSubmissionDraft();
        } else {
            const { data, error } = await supabase
                .from("lesson_submissions")
                .update({ answers_json: answerState })
                .eq("id", currentSubmission.id)
                .select("id, answers_json, status, submitted_at, updated_at, points_earned, points_possible")
                .single();

            if (error) {
                throw error;
            }

            currentSubmission = data;
        }

        setSavedStatus();
        setSubmitStatus("");
        return true;
    } catch (error) {
        saveStatusElement.textContent = "Draft was not saved.";
        setSubmitStatus(getSubmissionErrorMessage(error, "Draft answers could not be saved."), "error");
        return false;
    }
}

function scheduleDraftSave() {
    if (isTeacherPreview || isSubmitted) {
        return;
    }

    window.clearTimeout(autoSaveTimer);
    saveStatusElement.textContent = "Unsaved changes...";
    autoSaveTimer = window.setTimeout(saveDraftAnswers, 600);
}

async function manuallySaveDraft() {
    if (isTeacherPreview) {
        return;
    }

    window.clearTimeout(autoSaveTimer);
    saveDraftButton.disabled = true;
    await saveDraftAnswers();
    saveDraftButton.disabled = isSubmitted;
}

async function resetDraft() {
    if (isTeacherPreview || isSubmitted) {
        return;
    }

    const confirmed = window.confirm("Reset this draft? This clears all saved answers for this lesson.");

    if (!confirmed) {
        return;
    }

    window.clearTimeout(autoSaveTimer);
    answerState = {};
    setDraftControlsDisabled(true);
    saveStatusElement.textContent = "Resetting draft...";
    const { data, error } = currentSubmission
        ? await supabase
            .from("lesson_submissions")
            .update({ answers_json: {} })
            .eq("id", currentSubmission.id)
            .select("id, answers_json, status, submitted_at, updated_at")
            .single()
        : { error: null };

    setDraftControlsDisabled(false);

    if (error) {
        saveStatusElement.textContent = "Draft was not reset.";
        setSubmitStatus(getSubmissionErrorMessage(error, "Draft answers could not be reset."), "error");
        return;
    }

    if (data) {
        currentSubmission = data;
    }

    renderQuestionFlow(loadedQuestions);
    setSavedStatus("Draft reset.");
    setSubmitStatus("");
}

async function loadNextLesson() {
    const { lesson } = currentLessonContext;

    if (currentAvailabilityContext) {
        const currentIndex = currentAvailabilityContext.orderedLessons.findIndex((currentLesson) => currentLesson.id === lesson.id);
        const nextAvailableLesson = currentAvailabilityContext.orderedLessons.find((candidate, index) => {
            return index > currentIndex
                && index < currentAvailabilityContext.unlockedLessonCount
                && !candidate.is_locked;
        });

        if (nextAvailableLesson) {
            nextLessonLink.href = getLessonViewHref(nextAvailableLesson);
            nextLessonLink.textContent = `Next lesson: ${nextAvailableLesson.title || "Continue"}`;
        } else {
            nextLessonLink.href = `../courses/student.html?course=${encodeURIComponent(currentLessonContext.course.id)}${classroomId ? `&classroom=${encodeURIComponent(classroomId)}` : ""}`;
            nextLessonLink.textContent = "Back to course";
        }
        nextLessonLink.hidden = false;
        return;
    }

    const { data, error } = await supabase
        .from("lessons")
        .select("id, title")
        .eq("module_id", lesson.module_id)
        .gt("order_index", lesson.order_index)
        .is("archived_at", null)
        .order("order_index", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (error || !data) {
        nextLessonLink.href = "../dashboard/index.html";
        nextLessonLink.textContent = "Back to dashboard";
        nextLessonLink.hidden = false;
        return;
    }

    nextLessonLink.href = getLessonViewHref(data);
    nextLessonLink.textContent = `Next lesson: ${data.title || "Continue"}`;
    nextLessonLink.hidden = false;
}

async function turnInLesson() {
    if (isTeacherPreview) {
        return;
    }

    const missingRequiredQuestions = getMissingRequiredQuestions();

    if (missingRequiredQuestions.length) {
        const questionText = missingRequiredQuestions.length === 1 ? "1 required question" : `${missingRequiredQuestions.length} required questions`;

        highlightMissingQuestions(missingRequiredQuestions);
        setSubmitStatus(`Answer ${questionText} before turning in this lesson.`, "error");
        return;
    }

    const confirmed = window.confirm("Turn in this lesson? After submission, you will not be able to edit your answers.");

    if (!confirmed) {
        return;
    }

    window.clearTimeout(autoSaveTimer);
    turnInButton.disabled = true;
    setSubmitStatus("Turning in lesson...", "info");

    if (!(await saveDraftAnswers())) {
        turnInButton.disabled = false;
        return;
    }

    const submittedAtValue = new Date().toISOString();
    const { data, error } = await supabase
        .from("lesson_submissions")
        .update({
            answers_json: answerState,
            status: "submitted",
            submitted_at: submittedAtValue,
        })
        .eq("id", currentSubmission.id)
        .select("id, answers_json, status, submitted_at, updated_at, points_earned, points_possible")
        .single();

    if (error) {
        turnInButton.disabled = false;
        setSubmitStatus(getSubmissionErrorMessage(error, "This lesson could not be turned in."), "error");
        return;
    }

    currentSubmission = data;
    isSubmitted = true;
    submittedAt = new Date(data?.submitted_at || submittedAtValue);
    showCompletionState(submittedAt, currentSubmission);
    await loadNextLesson();
}

async function initializePage() {
    const profile = await loadCurrentProfile();

    if (!profile) {
        return;
    }

    currentProfileId = profile.id;
    const context = await loadLessonContext();

    if (!context) {
        return;
    }

    const { lesson, module, course } = context;

    currentLessonContext = context;
    if (isTeacherPreview) {
        updateTeacherPreviewBackLink(course.id);
    } else if (!(await canAccessLessonContext(context))) {
        return;
    } else if (!lesson.is_visible) {
        setHiddenLessonStatus(course.id);
        return;
    } else if (!(await loadStudentLessonAvailability(context))) {
        return;
    }
    headingElement.textContent = lesson.title || "Untitled lesson";
    contextElement.textContent = isTeacherPreview
        ? `Teacher preview / ${course.title || "Untitled course"} / ${module.title || "Untitled module"}`
        : `${course.title || "Untitled course"} / ${module.title || "Untitled module"}`;
    if (objectiveElement) {
        objectiveElement.textContent = lesson.objective || lesson.summary || "No objective has been added for this lesson yet.";
    }
    if (canvasContextElement) {
        canvasContextElement.textContent = contextElement.textContent;
    }
    if (canvasTitleElement) {
        canvasTitleElement.textContent = lesson.title || "Untitled lesson";
    }
    if (canvasObjectiveElement) {
        canvasObjectiveElement.textContent = lesson.objective || "No objective has been added for this lesson yet.";
    }
    if (canvasOverviewElement) {
        canvasOverviewElement.textContent = lesson.summary || "No overview has been added for this lesson yet.";
    }
    if (canvasDurationElement) {
        canvasDurationElement.textContent = lesson.estimated_time || "Not set";
    }
    shellElement.hidden = false;
    submitPanel.hidden = false;

    if (isTeacherPreview) {
        await loadQuestionFlow();
        showTeacherPreviewState();
        if (await loadContentBlocks()) {
            setStatus("");
        }
        return;
    }

    await loadSubmissionDraft();
    await loadQuestionFlow();

    if (isSubmitted) {
        showCompletionState(submittedAt || new Date());
        await loadNextLesson();
    }

    if (await loadContentBlocks()) {
        setStatus("");
    }
}

turnInButton.addEventListener("click", turnInLesson);
saveDraftButton.addEventListener("click", manuallySaveDraft);
resetDraftButton.addEventListener("click", resetDraft);

await initializePage();
