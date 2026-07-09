import { supabase } from "../../services/supabase/client.js";
import { loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { notifyStatus } from "../utils/ui-components.js";

const params = new URLSearchParams(window.location.search);
const lessonId = params.get("lesson");
const classroomId = params.get("classroom");
const isTeacherPreview = params.get("preview") === "teacher";
const backLink = qs("[data-lesson-back-link]");
const teacherPreviewBanner = qs("[data-teacher-preview-banner]");
const previewBuilderLink = qs("[data-preview-builder-link]");
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
const studentPageControls = qs("[data-student-page-controls]");
const pageCounterElement = qs("[data-page-counter]");
const previousPageButton = qs("[data-previous-page]");
const nextPageButton = qs("[data-next-page]");
const lessonPageSheet = qs(".lesson-page-sheet");
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
const defaultCodeSpaceCode = [
    "public class Main {",
    "    public static void main(String[] args) {",
    "        System.out.println(\"Hello, BrainKernl!\");",
    "    }",
    "}",
].join("\n");
const codeSpaceIndent = "    ";
const codeSpaceJavaKeywords = new Set([
    "abstract",
    "assert",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "do",
    "else",
    "enum",
    "extends",
    "final",
    "finally",
    "for",
    "goto",
    "if",
    "implements",
    "import",
    "instanceof",
    "interface",
    "native",
    "new",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "sealed",
    "static",
    "strictfp",
    "super",
    "switch",
    "synchronized",
    "this",
    "throw",
    "throws",
    "transient",
    "try",
    "var",
    "void",
    "volatile",
    "while",
]);
const codeSpaceJavaTypes = new Set([
    "boolean",
    "byte",
    "char",
    "double",
    "float",
    "int",
    "long",
    "short",
    "Boolean",
    "Character",
    "Double",
    "Integer",
    "Long",
    "Math",
    "Object",
    "String",
    "System",
]);
const lessonLayoutMarker = "__ctc_lesson_layout_v1__";
let currentProfileId = "";
let currentLessonContext = null;
let currentSubmission = null;
let loadedLessonPages = [];
let loadedContentBlocks = [];
let loadedQuestions = [];
let questionOptionsByQuestion = new Map();
let answerState = {};
let autoSaveTimer = null;
let isSubmitted = false;
let lastSavedAt = null;
let submittedAt = null;
let currentAvailabilityContext = null;
let activeLessonPageId = "";
const lessonResourceBucket = "lesson-resources";

function isLessonPageSchemaError(error) {
    const message = String(error?.message || "").toLowerCase();

    return message.includes("lesson_page_id")
        || message.includes("lesson_pages")
        || message.includes("schema cache");
}

function decodeLessonLayout(bodyText = "") {
    if (!bodyText.startsWith(lessonLayoutMarker)) {
        return null;
    }

    try {
        return JSON.parse(bodyText.slice(lessonLayoutMarker.length).trim());
    } catch {
        return null;
    }
}

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

function setInlineSubmitStatus(message, tone = "info") {
    submitStatusElement.textContent = message;
    submitStatusElement.dataset.tone = tone;
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

function normalizeLessonStoragePath(url = "") {
    return url.replace(new RegExp(`^${lessonResourceBucket}/`), "");
}

async function getDisplayResourceUrl(contentBlock) {
    const url = getBlockUrl(contentBlock);

    if (!isLessonStoragePath(url)) {
        return url;
    }

    const { data, error } = await supabase.storage
        .from(lessonResourceBucket)
        .createSignedUrl(normalizeLessonStoragePath(url), 60 * 60);

    if (error) {
        console.warn("Lesson resource signed URL failed", error);
        return "";
    }

    return data?.signedUrl || "";
}

function isImageContentBlock(contentBlock) {
    return contentBlock.file_type === "image" || contentBlock.block_type === "image";
}

function createUnavailableResourceMessage(contentBlock, resourceType = "resource") {
    const message = createElement(
        "p",
        "empty-state empty-state--compact lesson-resource-warning",
        `${contentBlock.title || "This resource"} could not be loaded.`
    );

    message.dataset.resourceType = resourceType;
    return message;
}

function createLessonImageElement(contentBlock, url) {
    if (!url) {
        return createUnavailableResourceMessage(contentBlock, "image");
    }

    const image = createElement("img", "lesson-render-image");

    image.src = url;
    image.alt = contentBlock.title || "Lesson image";
    image.loading = "lazy";
    image.addEventListener("error", () => {
        image.replaceWith(createUnavailableResourceMessage(contentBlock, "image"));
    }, { once: true });
    return image;
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
    updateSubmitPanelState();
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

function getSortedLessonPages() {
    return [...loadedLessonPages].sort((first, second) => first.order_index - second.order_index);
}

function getActiveLessonPage() {
    return getSortedLessonPages().find((page) => page.id === activeLessonPageId) || getSortedLessonPages()[0] || null;
}

function getActiveLessonPageIndex() {
    const pages = getSortedLessonPages();
    const index = pages.findIndex((page) => page.id === activeLessonPageId);

    return index === -1 ? 0 : index;
}

function isOnLastLessonPage() {
    const pages = getSortedLessonPages();

    return !pages.length || getActiveLessonPageIndex() >= pages.length - 1;
}

function getActiveContentBlocks() {
    return loadedContentBlocks
        .filter((contentBlock) => {
            return activeLessonPageId
                ? contentBlock.lesson_page_id === activeLessonPageId || (!contentBlock.lesson_page_id && getActiveLessonPageIndex() === 0)
                : true;
        })
        .sort((first, second) => first.order_index - second.order_index);
}

function getActiveQuestions() {
    return loadedQuestions
        .filter((question) => {
            return activeLessonPageId
                ? question.lesson_page_id === activeLessonPageId || (!question.lesson_page_id && getActiveLessonPageIndex() === 0)
                : true;
        })
        .sort((first, second) => first.order_index - second.order_index);
}

async function renderActiveLessonPage() {
    const pages = getSortedLessonPages();
    const activePage = getActiveLessonPage();
    const activeIndex = getActiveLessonPageIndex();
    const hasMultiplePages = pages.length > 1;
    const isCoverPage = activeIndex === 0;

    lessonPageSheet?.classList.toggle("lesson-page-sheet--cover", isCoverPage);
    lessonPageSheet?.classList.toggle("lesson-page-sheet--compact", !isCoverPage);

    if (studentPageControls) {
        studentPageControls.hidden = !hasMultiplePages;
    }
    if (pageCounterElement) {
        pageCounterElement.textContent = pages.length ? `Page ${activeIndex + 1} of ${pages.length}` : "Page 1 of 1";
    }
    if (previousPageButton) {
        previousPageButton.disabled = !hasMultiplePages || activeIndex === 0;
    }
    if (nextPageButton) {
        nextPageButton.disabled = !hasMultiplePages || activeIndex >= pages.length - 1;
    }
    if (canvasTitleElement && activePage) {
        canvasTitleElement.textContent = currentLessonContext?.lesson?.title || "Untitled lesson";
    }

    await renderContentBlocks(getActiveContentBlocks());
    renderQuestionFlow(getActiveQuestions());
    updateSubmitPanelState();
}

function setActiveLessonPageByOffset(offset) {
    const pages = getSortedLessonPages();
    const nextPage = pages[getActiveLessonPageIndex() + offset];

    if (!nextPage) {
        return;
    }

    activeLessonPageId = nextPage.id;
    renderActiveLessonPage();
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
    questionFlow.querySelectorAll("input, textarea, select, button").forEach((input) => {
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

function updateSubmitPanelState() {
    if (!submitPanel || isTeacherPreview || isSubmitted) {
        return;
    }

    const pages = getSortedLessonPages();
    const activeIndex = getActiveLessonPageIndex();
    const finalPageNumber = pages.length || 1;
    const onLastPage = isOnLastLessonPage();
    const missingRequiredQuestions = getMissingRequiredQuestions();

    submitPanelHeading.textContent = onLastPage ? "Turn in lesson" : "Keep going";
    turnInButton.hidden = !onLastPage;
    turnInButton.disabled = false;
    nextLessonLink.hidden = true;

    if (!onLastPage) {
        const nextPageNumber = Math.min(activeIndex + 2, finalPageNumber);

        setInlineSubmitStatus(`Turn-in opens on page ${finalPageNumber}. Continue to page ${nextPageNumber} when you are ready.`, "info");
        return;
    }

    if (missingRequiredQuestions.length) {
        const questionText = missingRequiredQuestions.length === 1
            ? "1 required question"
            : `${missingRequiredQuestions.length} required questions`;

        setInlineSubmitStatus(`Complete ${questionText} before turning in this lesson.`, "info");
        return;
    }

    setInlineSubmitStatus("Everything required is complete. You can turn in this lesson when you are ready.", "success");
}

function updateTeacherPreviewBackLink() {
    if (!lessonId) {
        return;
    }

    const builderHref = `builder.html?lesson=${encodeURIComponent(lessonId)}`;

    backLink.href = builderHref;
    backLink.textContent = "Back to lesson builder";
    if (previewBuilderLink) {
        previewBuilderLink.href = builderHref;
    }
    if (teacherPreviewBanner) {
        teacherPreviewBanner.hidden = false;
    }
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

function createFlashcardSet(layout) {
    const cards = (layout.cards || []).filter((card) => card.term || card.definition || card.image?.url);
    const wrapper = createElement("section", "lesson-flashcards");
    const viewport = createElement("div", "lesson-flashcard-viewport");
    const previousButton = createElement("button", "lesson-flashcard-arrow", "‹");
    const nextButton = createElement("button", "lesson-flashcard-arrow", "›");
    const cardButton = createElement("button", "lesson-flashcard-card", "");
    const counter = createElement("span", "lesson-flashcard-count", "");
    let index = 0;
    let isRevealed = false;

    previousButton.type = "button";
    nextButton.type = "button";
    cardButton.type = "button";
    previousButton.setAttribute("aria-label", "Previous flashcard");
    nextButton.setAttribute("aria-label", "Next flashcard");

    function renderCard() {
        const current = cards[index] || {};
        const face = createElement("div", "lesson-flashcard-face");

        cardButton.classList.toggle("lesson-flashcard-card--revealed", isRevealed);
        if (current.image?.displayUrl || current.image?.url) {
            const image = createLessonImageElement(
                { title: current.image.title || current.term || "Flashcard image" },
                current.image.displayUrl || current.image.url || ""
            );

            image.classList.add("lesson-flashcard-image");
            face.append(image);
        }
        face.append(createElement("span", "lesson-flashcard-kicker", isRevealed ? "Definition" : "Term"));
        face.append(createElement("strong", "lesson-flashcard-text", isRevealed ? current.definition || "No definition added yet." : current.term || "No term added yet."));
        face.append(createElement("small", "lesson-flashcard-hint", "Click to flip"));
        cardButton.replaceChildren(face);
        counter.textContent = `${index + 1} / ${cards.length || 1}`;
        previousButton.disabled = cards.length <= 1;
        nextButton.disabled = cards.length <= 1;
    }

    previousButton.addEventListener("click", () => {
        index = (index - 1 + cards.length) % cards.length;
        isRevealed = false;
        renderCard();
    });
    nextButton.addEventListener("click", () => {
        index = (index + 1) % cards.length;
        isRevealed = false;
        renderCard();
    });
    cardButton.addEventListener("click", () => {
        isRevealed = !isRevealed;
        cardButton.classList.remove("lesson-flashcard-card--flipping");
        void cardButton.offsetWidth;
        cardButton.classList.add("lesson-flashcard-card--flipping");
        renderCard();
    });

    if (!cards.length) {
        wrapper.append(createElement("p", "course-muted", "No flashcards have been added yet."));
        return wrapper;
    }

    renderCard();
    viewport.append(previousButton, cardButton, nextButton);
    wrapper.append(viewport, counter);
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

function hasImageCopy(contentBlock) {
    return Boolean((contentBlock.title || "").trim() || (contentBlock.body_text || "").trim());
}

async function createLessonLayoutContent(layout) {
    if (layout?.type === "text" || layout?.type === "wide") {
        const wrapper = createElement("div", `lesson-layout-text-preview lesson-layout-text-preview--${layout.type}`);

        if (layout.title) {
            wrapper.append(createElement("h3", "", layout.title));
        }
        if (layout.body) {
            wrapper.append(createFormattedTextContent(layout.body));
        }

        return wrapper;
    }

    if (layout?.type === "imageText") {
        const wrapper = createElement("div", "lesson-render-media-text");
        const media = createElement("div", "lesson-render-media-frame");
        const copy = createElement("div", "lesson-render-media-copy");
        const imageUrl = await getDisplayResourceUrl({ file_url: layout.image?.url || "" });
        const image = createLessonImageElement(
            { title: layout.image?.title || layout.title || "Lesson image" },
            imageUrl || layout.image?.url || ""
        );

        media.append(image);
        if (layout.title) {
            copy.append(createElement("h3", "", layout.title));
        }
        if (layout.body) {
            copy.append(createFormattedTextContent(layout.body));
        }
        wrapper.append(media, copy);
        return wrapper;
    }

    if (layout?.type === "featureImage") {
        const wrapper = createElement("div", "lesson-layout-feature-preview");
        const imageUrl = await getDisplayResourceUrl({ file_url: layout.image?.url || "" });
        const image = createLessonImageElement(
            { title: layout.image?.title || "Feature image" },
            imageUrl || layout.image?.url || ""
        );

        wrapper.append(image);
        return wrapper;
    }

    if (layout?.type === "columns") {
        const wrapper = createElement("div", "lesson-layout-columns-preview");

        (layout.columns || []).forEach((column) => {
            const item = createElement("article", "lesson-layout-column");

            if (column.title) {
                item.append(createElement("h3", "", column.title));
            }
            if (column.body) {
                item.append(createElement("p", "", column.body));
            }
            wrapper.append(item);
        });

        return wrapper;
    }

    if (layout?.type === "gallery") {
        const wrapper = createElement("div", "lesson-layout-gallery-preview");
        const images = await Promise.all((layout.images || []).map(async (image) => ({
            ...image,
            displayUrl: await getDisplayResourceUrl({ file_url: image.url }),
        })));

        images.forEach((image) => {
            wrapper.append(createLessonImageElement(
                { title: image.title || "Gallery image" },
                image.displayUrl || image.url || ""
            ));
        });

        return wrapper;
    }

    if (layout?.type === "flashcards") {
        const cards = await Promise.all((layout.cards || []).map(async (card) => ({
            ...card,
            image: card.image?.url
                ? {
                    ...card.image,
                    displayUrl: await getDisplayResourceUrl({ file_url: card.image.url }),
                }
                : null,
        })));

        return createFlashcardSet({ ...layout, cards });
    }

    if (layout?.type === "divider") {
        return createElement("hr", "lesson-inline-divider");
    }

    if (layout?.type === "spacer") {
        return createElement("div", "lesson-inline-spacer");
    }

    return createElement("p", "lesson-render-text", "");
}

async function createContentBlock(contentBlock) {
    const article = createElement("article", `lesson-render-block lesson-render-block--${contentBlock.block_type}`);
    const title = createElement("h3", "", getDefaultContentBlockTitle(contentBlock));
    const label = createElement("span", "badge badge--quiet", `Block ${contentBlock.order_index + 1}`);
    const url = await getDisplayResourceUrl(contentBlock);
    const layout = decodeLessonLayout(contentBlock.body_text || "");

    if (layout) {
        article.classList.add("lesson-render-block--layout");
        article.append(await createLessonLayoutContent(layout));
        return article;
    }

    if (isImageContentBlock(contentBlock) && hasImageCopy(contentBlock)) {
        const shell = createElement("div", "lesson-render-media-text");
        const media = createElement("div", "lesson-render-media-frame");
        const copy = createElement("div", "lesson-render-media-copy");
        const image = createLessonImageElement(contentBlock, url);

        media.append(image);
        copy.append(title);
        if (contentBlock.body_text) {
            copy.append(createFormattedTextContent(contentBlock.body_text || ""));
        }
        if (url) {
            copy.append(createExternalLink(url, "Open image"));
        }
        shell.append(media, copy);
        article.classList.add("lesson-render-block--media-text");
        article.append(label, shell);
        return article;
    }

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

    if (isImageContentBlock(contentBlock)) {
        const image = createLessonImageElement(contentBlock, url);

        article.append(image);
        if (url) {
            article.append(createExternalLink(url, "Open image"));
        }
        return article;
    }

    if (contentBlock.block_type === "file" && contentBlock.file_type === "pdf" && isPdfUrl(url)) {
        article.append(createEmbedFrame(contentBlock.title || "PDF resource", url), createExternalLink(url, "Download PDF"));
        return article;
    }

    if (contentBlock.file_type === "audio" || contentBlock.block_type === "audio" || isAudioUrl(url)) {
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
        url ? createExternalLink(url, "Download resource") : createUnavailableResourceMessage(contentBlock)
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

function findLessonCodeMatchingDelimiter(source, openIndex, openChar, closeChar) {
    let depth = 0;
    let quote = "";
    let isEscaped = false;

    for (let index = openIndex; index < source.length; index += 1) {
        const char = source[index];

        if (quote) {
            if (isEscaped) {
                isEscaped = false;
            } else if (char === "\\") {
                isEscaped = true;
            } else if (char === quote) {
                quote = "";
            }
            continue;
        }

        if (char === "\"" || char === "'") {
            quote = char;
            continue;
        }

        if (char === openChar) {
            depth += 1;
        }

        if (char === closeChar) {
            depth -= 1;

            if (depth === 0) {
                return index;
            }
        }
    }

    return -1;
}

function extractLessonCodeMainBody(source) {
    const mainMatch = source.match(/public\s+static\s+void\s+main\s*\(\s*String\s*\[\]\s+\w+\s*\)\s*\{/);

    if (!mainMatch || typeof mainMatch.index !== "number") {
        throw new Error("Add public static void main(String[] args) before running.");
    }

    const openIndex = mainMatch.index + mainMatch[0].lastIndexOf("{");
    const closeIndex = findLessonCodeMatchingDelimiter(source, openIndex, "{", "}");

    if (closeIndex === -1) {
        throw new Error("Missing closing brace for main method.");
    }

    return source.slice(openIndex + 1, closeIndex);
}

function transformLessonJavaOutput(source) {
    const callPattern = /System\.out\.(println|printf|print)\s*\(/g;
    const outputCalls = { print: "__print", printf: "__printf", println: "__println" };
    let transformed = "";
    let cursor = 0;
    let match = callPattern.exec(source);

    while (match) {
        const openIndex = callPattern.lastIndex - 1;
        const closeIndex = findLessonCodeMatchingDelimiter(source, openIndex, "(", ")");

        if (closeIndex === -1) {
            throw new Error(`Missing closing parenthesis for System.out.${match[1]}.`);
        }

        let statementEnd = closeIndex + 1;

        while (/\s/.test(source[statementEnd] || "")) {
            statementEnd += 1;
        }

        if (source[statementEnd] !== ";") {
            throw new Error(`Missing semicolon after System.out.${match[1]}.`);
        }

        transformed += source.slice(cursor, match.index);
        transformed += `${outputCalls[match[1]]}(${source.slice(openIndex + 1, closeIndex)});`;
        cursor = statementEnd + 1;
        callPattern.lastIndex = cursor;
        match = callPattern.exec(source);
    }

    return `${transformed}${source.slice(cursor)}`;
}

function createLessonJavaScriptFromJava(source) {
    if (/\b(import|package)\b/.test(source)) {
        throw new Error("Imports and packages are not available in this classroom runner yet.");
    }

    if (/\bScanner\b|System\.in|java\.io|java\.nio|Thread|Runtime|ProcessBuilder|System\.exit/.test(source)) {
        throw new Error("This runner supports output, variables, loops, conditionals, and Math. Input and file access are not available.");
    }

    const mainBody = extractLessonCodeMainBody(source);
    const withoutComments = mainBody
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    const withOutput = transformLessonJavaOutput(withoutComments);

    return withOutput
        .replace(/\b(final\s+)?(byte|short|int|long|float|double|boolean|char|String)\s+([A-Za-z_$][\w$]*)\s*=/g, "let $3 =")
        .replace(/\b(final\s+)?(byte|short|int|long|float|double|boolean|char|String)\s+([A-Za-z_$][\w$]*)\s*;/g, "let $3;")
        .replace(/\b(for\s*\(\s*)(byte|short|int|long|float|double|boolean|char|String)\s+([A-Za-z_$][\w$]*)\s*=/g, "$1let $3 =")
        .replace(/([A-Za-z_$][\w$]*)\.equals\s*\(([^)]+)\)/g, "($1 === $2)")
        .replace(/([A-Za-z_$][\w$]*)\.length\s*\(\s*\)/g, "$1.length");
}

function renderCodeLineNumbers(code, lineNumbers) {
    const lineCount = Math.max(1, code.split("\n").length);

    lineNumbers.textContent = Array.from({ length: lineCount }, (_, index) => String(index + 1)).join("\n");
}

function escapeCodeSpaceHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function wrapCodeSpaceToken(className, value) {
    return `<span class="${className}">${escapeCodeSpaceHtml(value)}</span>`;
}

function readCodeSpaceQuotedToken(source, startIndex, quote) {
    let index = startIndex + 1;
    let isEscaped = false;

    while (index < source.length) {
        const char = source[index];

        if (isEscaped) {
            isEscaped = false;
        } else if (char === "\\") {
            isEscaped = true;
        } else if (char === quote) {
            index += 1;
            break;
        }

        index += 1;
    }

    return source.slice(startIndex, index);
}

function getNextCodeSpaceNonSpace(source, index) {
    let cursor = index;

    while (/\s/.test(source[cursor] || "")) {
        cursor += 1;
    }

    return source[cursor] || "";
}

function highlightCodeSpaceJava(source) {
    let highlighted = "";
    let index = 0;

    while (index < source.length) {
        const char = source[index];
        const nextChar = source[index + 1] || "";

        if (char === "/" && nextChar === "/") {
            const endIndex = source.indexOf("\n", index);
            const comment = endIndex === -1 ? source.slice(index) : source.slice(index, endIndex);

            highlighted += wrapCodeSpaceToken("code-token-comment", comment);
            index += comment.length;
            continue;
        }

        if (char === "/" && nextChar === "*") {
            const endIndex = source.indexOf("*/", index + 2);
            const comment = endIndex === -1 ? source.slice(index) : source.slice(index, endIndex + 2);

            highlighted += wrapCodeSpaceToken("code-token-comment", comment);
            index += comment.length;
            continue;
        }

        if (char === "\"" || char === "'") {
            const value = readCodeSpaceQuotedToken(source, index, char);

            highlighted += wrapCodeSpaceToken("code-token-string", value);
            index += value.length;
            continue;
        }

        if (/\d/.test(char)) {
            const match = source.slice(index).match(/^\d+(?:\.\d+)?(?:[fFdDlL])?/);
            const number = match?.[0] || char;

            highlighted += wrapCodeSpaceToken("code-token-number", number);
            index += number.length;
            continue;
        }

        if (/[A-Za-z_$]/.test(char)) {
            const match = source.slice(index).match(/^[A-Za-z_$][\w$]*/);
            const identifier = match?.[0] || char;
            const nextToken = getNextCodeSpaceNonSpace(source, index + identifier.length);

            if (codeSpaceJavaKeywords.has(identifier) || identifier === "true" || identifier === "false" || identifier === "null") {
                highlighted += wrapCodeSpaceToken("code-token-keyword", identifier);
            } else if (codeSpaceJavaTypes.has(identifier) || /^[A-Z]/.test(identifier)) {
                highlighted += wrapCodeSpaceToken("code-token-type", identifier);
            } else if (nextToken === "(") {
                highlighted += wrapCodeSpaceToken("code-token-function", identifier);
            } else {
                highlighted += escapeCodeSpaceHtml(identifier);
            }

            index += identifier.length;
            continue;
        }

        highlighted += escapeCodeSpaceHtml(char);
        index += 1;
    }

    return highlighted || " ";
}

function createCodeSpaceControl(question) {
    const answer = getAnswer(question.id);
    const savedCode = typeof answer === "object" ? answer.code : answer;
    let projectFiles = normalizeCodeSpaceFiles(answer, savedCode);
    let activeFileName = typeof answer?.activeFileName === "string"
        ? answer.activeFileName
        : projectFiles[0].name;
    const workspace = createElement("div", "lesson-code-space");
    const files = createElement("aside", "lesson-code-files");
    const filesHeader = createElement("div", "lesson-code-files-header");
    const fileList = createElement("div", "lesson-code-file-list");
    const newFileButton = createElement("button", "lesson-code-file-add", "+ New file");
    const main = createElement("div", "lesson-code-main");
    const toolbar = createElement("div", "lesson-code-toolbar");
    const title = createElement("strong", "", "Java workspace");
    const runButton = createElement("button", "lesson-code-run", "");
    const editorShell = createElement("div", "lesson-code-editor-shell");
    const lineNumbers = createElement("pre", "lesson-code-lines", "1");
    const editorLayer = createElement("div", "lesson-code-editor-layer");
    const highlight = createElement("pre", "lesson-code-highlight", "");
    const editor = document.createElement("textarea");
    const consoleOutput = createElement("pre", "lesson-code-console", "");

    editor.className = "lesson-code-editor";
    editor.spellcheck = false;
    editor.setAttribute("aria-label", `${question.prompt} Java code`);
    newFileButton.type = "button";
    newFileButton.setAttribute("aria-label", "Create file");
    runButton.type = "button";
    runButton.setAttribute("aria-label", "Run code");
    consoleOutput.textContent = "Run your code to see output here.";

    function getLanguageForCodeFile(fileName = "") {
        if (fileName.endsWith(".java")) {
            return "Java";
        }

        if (fileName.endsWith(".txt")) {
            return "Text";
        }

        return "File";
    }

    function getActiveFile() {
        return projectFiles.find((file) => file.name === activeFileName) || projectFiles[0];
    }

    function getStarterCodeForFile(fileName) {
        if (!fileName.endsWith(".java")) {
            return "";
        }

        const className = fileName.replace(/\.java$/i, "").replace(/[^\w$]/g, "") || "Exercise";

        return [
            `public class ${className} {`,
            "    public static void main(String[] args) {",
            "        System.out.println(\"New Java file ready.\");",
            "    }",
            "}",
        ].join("\n");
    }

    function normalizeNewFileName(value) {
        const cleaned = String(value || "")
            .trim()
            .replace(/[\\/]/g, "")
            .replace(/\s+/g, "");

        if (!cleaned) {
            return "";
        }

        return /\.[A-Za-z0-9]+$/.test(cleaned) ? cleaned : `${cleaned}.java`;
    }

    function getNextFileName() {
        let index = projectFiles.length + 1;
        let nextName = `Exercise${index}.java`;

        while (projectFiles.some((file) => file.name === nextName)) {
            index += 1;
            nextName = `Exercise${index}.java`;
        }

        return nextName;
    }

    function persistCodeProject() {
        const activeFile = getActiveFile();

        if (activeFile) {
            activeFile.content = editor.value;
        }

        const mainFile = projectFiles.find((file) => file.name === "Main.java") || activeFile;

        setAnswer(question.id, {
            code: mainFile?.content || "",
            activeFileName,
            files: projectFiles.map((file) => ({ ...file })),
        });
    }

    function renderFiles() {
        fileList.replaceChildren(...projectFiles.map((projectFile) => {
            const row = createElement("div", "lesson-code-file-row");
            const fileButton = createElement("button", "lesson-code-file", projectFile.name);
            const meta = createElement("span", "lesson-code-file-meta", getLanguageForCodeFile(projectFile.name));
            const deleteButton = createElement("button", "lesson-code-file-delete", "×");

            fileButton.type = "button";
            fileButton.classList.toggle("lesson-code-file--active", projectFile.name === activeFileName);
            fileButton.setAttribute("aria-label", `Open ${projectFile.name}`);
            fileButton.addEventListener("click", () => {
                const currentFile = getActiveFile();

                if (currentFile) {
                    currentFile.content = editor.value;
                }

                activeFileName = projectFile.name;
                renderFiles();
                renderEditor();
                persistCodeProject();
            });
            deleteButton.type = "button";
            deleteButton.disabled = projectFiles.length <= 1;
            deleteButton.setAttribute("aria-label", `Delete ${projectFile.name}`);
            deleteButton.addEventListener("click", (event) => {
                event.stopPropagation();

                if (projectFiles.length <= 1) {
                    notifyStatus("Code space needs at least one file.", "error");
                    return;
                }

                if (!window.confirm(`Delete ${projectFile.name}?`)) {
                    return;
                }

                projectFiles = projectFiles.filter((file) => file.name !== projectFile.name);

                if (activeFileName === projectFile.name) {
                    activeFileName = projectFiles[0].name;
                }

                renderFiles();
                renderEditor();
                persistCodeProject();
            });
            fileButton.append(meta);
            row.append(fileButton, deleteButton);

            return row;
        }));
    }

    function renderEditor() {
        const activeFile = getActiveFile();

        if (!activeFile) {
            return;
        }

        activeFileName = activeFile.name;
        title.textContent = `${getLanguageForCodeFile(activeFile.name)} workspace`;
        editor.value = activeFile.content;
        renderCodeLineNumbers(editor.value, lineNumbers);
        renderSyntaxHighlight();
    }

    function syncEditorScroll() {
        lineNumbers.scrollTop = editor.scrollTop;
        highlight.scrollTop = editor.scrollTop;
        highlight.scrollLeft = editor.scrollLeft;
    }

    function renderSyntaxHighlight() {
        const activeFile = getActiveFile();

        if (activeFile?.name.endsWith(".java")) {
            highlight.innerHTML = `${highlightCodeSpaceJava(editor.value)}\n`;
        } else {
            highlight.textContent = `${editor.value || " "}\n`;
        }

        syncEditorScroll();
    }

    function insertEditorText(text, selectionOffset = text.length) {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;

        editor.value = `${editor.value.slice(0, start)}${text}${editor.value.slice(end)}`;
        editor.selectionStart = start + selectionOffset;
        editor.selectionEnd = start + selectionOffset;
        handleEditorInput();
    }

    function getCurrentLineIndent(cursorPosition) {
        const lineStart = editor.value.lastIndexOf("\n", cursorPosition - 1) + 1;
        const line = editor.value.slice(lineStart, cursorPosition);
        const match = line.match(/^\s*/);

        return match ? match[0] : "";
    }

    function outdentSelectedLines() {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
        const lineEnd = end === start ? editor.value.indexOf("\n", end) : editor.value.indexOf("\n", end - 1);
        const rangeEnd = lineEnd === -1 ? editor.value.length : lineEnd;
        const before = editor.value.slice(0, lineStart);
        const selected = editor.value.slice(lineStart, rangeEnd);
        const after = editor.value.slice(rangeEnd);
        let removedBeforeStart = 0;
        const updated = selected
            .split("\n")
            .map((line, index) => {
                if (line.startsWith(codeSpaceIndent)) {
                    if (index === 0) {
                        removedBeforeStart = Math.min(codeSpaceIndent.length, start - lineStart);
                    }

                    return line.slice(codeSpaceIndent.length);
                }

                if (line.startsWith("\t")) {
                    if (index === 0) {
                        removedBeforeStart = Math.min(1, start - lineStart);
                    }

                    return line.slice(1);
                }

                return line;
            })
            .join("\n");

        editor.value = `${before}${updated}${after}`;
        editor.selectionStart = Math.max(lineStart, start - removedBeforeStart);
        editor.selectionEnd = Math.max(editor.selectionStart, end - (selected.length - updated.length));
        handleEditorInput();
    }

    function indentSelectedLines() {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
        const lineEnd = end === start ? editor.value.indexOf("\n", end) : editor.value.indexOf("\n", end - 1);
        const rangeEnd = lineEnd === -1 ? editor.value.length : lineEnd;
        const before = editor.value.slice(0, lineStart);
        const selected = editor.value.slice(lineStart, rangeEnd);
        const after = editor.value.slice(rangeEnd);
        const updated = selected.split("\n").map((line) => `${codeSpaceIndent}${line}`).join("\n");

        editor.value = `${before}${updated}${after}`;
        editor.selectionStart = start + codeSpaceIndent.length;
        editor.selectionEnd = end + (updated.length - selected.length);
        handleEditorInput();
    }

    function handleEnterKey(event) {
        event.preventDefault();

        const start = editor.selectionStart;
        const value = editor.value;
        const previousIndent = getCurrentLineIndent(start);
        const nextChar = value[start] || "";
        const shouldIndent = /[\{\[\(]$/.test(value.slice(0, start).trimEnd());

        if (shouldIndent && /[\}\]\)]/.test(nextChar)) {
            insertEditorText(`\n${previousIndent}${codeSpaceIndent}\n${previousIndent}`, previousIndent.length + codeSpaceIndent.length + 1);
            return;
        }

        insertEditorText(`\n${previousIndent}${shouldIndent ? codeSpaceIndent : ""}`);
    }

    function handleClosingBrace(event) {
        const start = editor.selectionStart;
        const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
        const beforeCursor = editor.value.slice(lineStart, start);

        if (!/^\s+$/.test(beforeCursor) || !beforeCursor.startsWith(codeSpaceIndent)) {
            return false;
        }

        event.preventDefault();
        editor.value = `${editor.value.slice(0, start - codeSpaceIndent.length)}}${editor.value.slice(editor.selectionEnd)}`;
        editor.selectionStart = start - codeSpaceIndent.length + 1;
        editor.selectionEnd = editor.selectionStart;
        handleEditorInput();
        return true;
    }

    function handleEditorKeydown(event) {
        if (event.key === "Tab") {
            event.preventDefault();

            if (event.shiftKey) {
                outdentSelectedLines();
                return;
            }

            if (editor.selectionStart !== editor.selectionEnd) {
                indentSelectedLines();
                return;
            }

            insertEditorText(codeSpaceIndent);
            return;
        }

        if (event.key === "Enter") {
            handleEnterKey(event);
            return;
        }

        if (event.key === "}") {
            handleClosingBrace(event);
        }
    }

    function handleEditorInput() {
        const activeFile = getActiveFile();

        if (activeFile) {
            activeFile.content = editor.value;
        }

        renderCodeLineNumbers(editor.value, lineNumbers);
        renderSyntaxHighlight();
        persistCodeProject();
    }

    newFileButton.addEventListener("click", () => {
        const requestedName = window.prompt("File name", getNextFileName());
        const fileName = normalizeNewFileName(requestedName);

        if (!fileName) {
            return;
        }

        if (projectFiles.some((projectFile) => projectFile.name === fileName)) {
            notifyStatus("A file with that name already exists.", "error");
            return;
        }

        const activeFile = getActiveFile();

        if (activeFile) {
            activeFile.content = editor.value;
        }

        projectFiles = [
            ...projectFiles,
            {
                name: fileName,
                language: getLanguageForCodeFile(fileName),
                content: getStarterCodeForFile(fileName),
            },
        ];
        activeFileName = fileName;
        renderFiles();
        renderEditor();
        persistCodeProject();
        editor.focus();
    });
    editor.addEventListener("input", handleEditorInput);
    editor.addEventListener("keydown", handleEditorKeydown);
    editor.addEventListener("scroll", syncEditorScroll);
    runButton.addEventListener("click", async () => {
        const activeFile = getActiveFile();
        const output = { current: "", lines: [] };
        const print = (value = "") => {
            output.current += String(value);
        };
        const println = (value = "") => {
            output.lines.push(`${output.current}${String(value)}`);
            output.current = "";
        };
        const printf = (template = "", ...values) => {
            let valueIndex = 0;
            output.current += String(template).replace(/%[dfs]/g, () => String(values[valueIndex++]));
        };

        consoleOutput.textContent = "";
        try {
            if (!activeFile?.name.endsWith(".java")) {
                throw new Error("Open a Java file before running code.");
            }

            const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
            const execute = new AsyncFunction("__print", "__println", "__printf", "Math", `"use strict";\n${createLessonJavaScriptFromJava(activeFile.content)}`);

            await execute(print, println, printf, Math);
            if (output.current) {
                output.lines.push(output.current);
            }
            consoleOutput.textContent = output.lines.join("\n") || "No console output.";
        } catch (error) {
            consoleOutput.textContent = `Java error: ${error.message}`;
        }
    });

    filesHeader.append(createElement("span", "lesson-code-files-label", "Files"), newFileButton);
    files.append(filesHeader, fileList);
    toolbar.append(title, runButton);
    editorLayer.append(highlight, editor);
    editorShell.append(lineNumbers, editorLayer);
    main.append(toolbar, editorShell, consoleOutput);
    workspace.append(files, main);
    renderFiles();
    renderEditor();
    return workspace;
}

function normalizeCodeSpaceFiles(answer, savedCode = "") {
    if (Array.isArray(answer?.files) && answer.files.length) {
        return answer.files
            .filter((file) => file && typeof file.name === "string")
            .map((file) => ({
                name: file.name,
                language: file.language || (file.name.endsWith(".java") ? "Java" : "Text"),
                content: typeof file.content === "string" ? file.content : "",
            }));
    }

    return [{
        name: "Main.java",
        language: "Java",
        content: savedCode || defaultCodeSpaceCode,
    }];
}

function createQuestionAnswerControl(question) {
    if (question.question_type === "code_space") {
        return createCodeSpaceControl(question);
    }

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
    const sortedQuestions = [...questions].sort((first, second) => first.order_index - second.order_index);
    const cards = sortedQuestions.map((question) => {
        const section = createElement("section", "lesson-flow-card");
        const statusClass = question.is_required ? "required" : "optional";
        const item = createElement("li", `question-card question-card--${statusClass}`);
        const prompt = createElement("strong", "", question.prompt);
        const instructions = createElement(
            "p",
            "",
            question.student_instructions || (question.is_required ? "Required checkpoint" : "Optional checkpoint")
        );
        const badge = createElement(
            "span",
            `question-status-badge question-status-badge--${statusClass}`,
            question.is_required ? "Required" : "Optional"
        );
        const list = createElement("ol", "lesson-flow-question-list");

        badge.setAttribute("aria-label", question.is_required ? "Required question" : "Optional question");
        item.dataset.questionId = question.id;
        item.append(prompt, badge, instructions, createQuestionAnswerControl(question));
        list.append(item);
        section.append(list);
        return section;
    });

    questionFlow.hidden = !cards.length;
    questionFlow.replaceChildren(
        ...(cards.length
            ? [
                createElement("h3", "", "Student response"),
                createElement("p", "section-copy", "Answer the questions your teacher added for this lesson."),
                ...cards,
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
    let { data, error } = await supabase
        .from("lesson_content_blocks")
        .select("id, lesson_page_id, block_type, title, body_text, external_url, file_url, file_type, order_index")
        .eq("lesson_id", lessonId)
        .eq("is_visible", true)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (isLessonPageSchemaError(error)) {
        const fallbackResult = await supabase
            .from("lesson_content_blocks")
            .select("id, block_type, title, body_text, external_url, file_url, file_type, order_index")
            .eq("lesson_id", lessonId)
            .eq("is_visible", true)
            .is("archived_at", null)
            .order("order_index", { ascending: true });

        data = (fallbackResult.data || []).map((contentBlock) => ({ ...contentBlock, lesson_page_id: "" }));
        error = fallbackResult.error;
    }

    if (error) {
        contentRenderer.replaceChildren(createElement("p", "empty-state", "Lesson content could not be loaded."));
        setStatus("Lesson content could not be loaded.", "error");
        return false;
    }

    loadedContentBlocks = data || [];
    await renderActiveLessonPage();
    return true;
}

async function loadLessonPages() {
    const { data, error } = await supabase
        .from("lesson_pages")
        .select("id, lesson_id, title, page_type, order_index, is_visible")
        .eq("lesson_id", lessonId)
        .eq("is_visible", true)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error || !data.length) {
        loadedLessonPages = [{
            id: "",
            lesson_id: lessonId,
            title: "Page 1",
            page_type: "lesson",
            order_index: 0,
            is_visible: true,
        }];
        activeLessonPageId = "";
        return !error;
    }

    loadedLessonPages = data;
    if (!loadedLessonPages.some((page) => page.id === activeLessonPageId)) {
        activeLessonPageId = loadedLessonPages[0].id;
    }
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
        .select("id, lesson_page_id, phase, question_type, prompt, student_instructions, hint, points, is_required, order_index")
        .eq("lesson_id", lessonId)
        .order("order_index", { ascending: true });

    if (error) {
        console.warn("Student questions view unavailable, falling back to manager-readable questions", error);
        let fallbackResult = await supabase
            .from("questions")
            .select("id, lesson_page_id, phase, question_type, prompt, student_instructions, hint, points, is_required, order_index")
            .eq("lesson_id", lessonId)
            .eq("is_visible", true)
            .is("archived_at", null)
            .order("order_index", { ascending: true });

        if (isLessonPageSchemaError(fallbackResult.error)) {
            fallbackResult = await supabase
                .from("questions")
                .select("id, phase, question_type, prompt, student_instructions, hint, points, is_required, order_index")
                .eq("lesson_id", lessonId)
                .eq("is_visible", true)
                .is("archived_at", null)
                .order("order_index", { ascending: true });

            fallbackResult.data = (fallbackResult.data || []).map((question) => ({ ...question, lesson_page_id: "" }));
        }

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

    await renderActiveLessonPage();
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

    await renderActiveLessonPage();
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

    if (!isOnLastLessonPage()) {
        const pages = getSortedLessonPages();
        const lastPage = pages[pages.length - 1];

        if (lastPage) {
            activeLessonPageId = lastPage.id;
            await renderActiveLessonPage();
        }

        setSubmitStatus("Finish the final page before turning in this lesson.", "error");
        return;
    }

    const missingRequiredQuestions = getMissingRequiredQuestions();

    if (missingRequiredQuestions.length) {
        const questionText = missingRequiredQuestions.length === 1 ? "1 required question" : `${missingRequiredQuestions.length} required questions`;
        const firstMissingQuestion = missingRequiredQuestions[0];

        if (firstMissingQuestion.lesson_page_id && firstMissingQuestion.lesson_page_id !== activeLessonPageId) {
            activeLessonPageId = firstMissingQuestion.lesson_page_id;
            await renderActiveLessonPage();
        }

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
        updateTeacherPreviewBackLink();
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
    await loadLessonPages();

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
previousPageButton?.addEventListener("click", () => {
    setActiveLessonPageByOffset(-1);
});
nextPageButton?.addEventListener("click", () => {
    setActiveLessonPageByOffset(1);
});

await initializePage();
