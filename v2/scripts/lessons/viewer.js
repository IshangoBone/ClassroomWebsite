import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const params = new URLSearchParams(window.location.search);
const lessonId = params.get("lesson");
const classroomId = params.get("classroom");
const headingElement = qs("[data-lesson-heading]");
const contextElement = qs("[data-lesson-context]");
const statusElement = qs("[data-lesson-status]");
const shellElement = qs("[data-lesson-shell]");
const objectiveElement = qs("[data-lesson-objective]");
const contentRenderer = qs("[data-content-renderer]");
const questionFlow = qs("[data-question-flow]");
const submitPanel = qs("[data-submit-panel]");
const saveStatusElement = qs("[data-save-status]");
const submitStatusElement = qs("[data-submit-status]");
const turnInButton = qs("[data-turn-in-button]");
const nextLessonLink = qs("[data-next-lesson-link]");
const questionPhases = [
    ["before", "Before lesson"],
    ["during", "During lesson"],
    ["reflection", "Reflection"],
];
const optionQuestionTypes = ["multiple_choice", "select_all_that_apply"];
const responseQuestionTypes = ["short_response", "long_response", "fill_in_the_blank"];
let currentUserId = "";
let currentLessonContext = null;
let currentSubmission = null;
let loadedQuestions = [];
let questionOptionsByQuestion = new Map();
let answerState = {};
let autoSaveTimer = null;
let isSubmitted = false;

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function setSubmitStatus(message, tone = "info") {
    submitStatusElement.textContent = message;
    submitStatusElement.dataset.tone = tone;
}

function getBlockUrl(contentBlock) {
    return contentBlock.file_url || contentBlock.external_url || "";
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
    answerState = {
        ...answerState,
        [questionId]: value,
    };
    scheduleDraftSave();
}

function getSubmissionFilter(query) {
    let filteredQuery = query
        .eq("student_user_id", currentUserId)
        .eq("course_id", currentLessonContext.course.id)
        .eq("lesson_id", currentLessonContext.lesson.id);

    filteredQuery = classroomId ? filteredQuery.eq("classroom_id", classroomId) : filteredQuery.is("classroom_id", null);
    return filteredQuery;
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

function isAudioUrl(url) {
    return /\.(mp3|m4a|ogg|wav|webm)(\?.*)?$/i.test(url);
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
            return url.includes("/embed") ? url : url.replace(/\/edit.*$/, "/embed");
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

function createContentBlock(contentBlock) {
    const article = createElement("article", `lesson-render-block lesson-render-block--${contentBlock.block_type}`);
    const title = createElement("h3", "", contentBlock.title || "Untitled content");
    const label = createElement("span", "badge badge--quiet", `Block ${contentBlock.order_index + 1}`);
    const url = getBlockUrl(contentBlock);

    article.append(title, label);

    if (contentBlock.block_type === "text") {
        article.append(createElement("p", "lesson-render-text", contentBlock.body_text || ""));
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

        image.src = url;
        image.alt = contentBlock.title || "Lesson image";
        article.append(image, createExternalLink(url, "Open image"));
        return article;
    }

    if (isAudioUrl(url)) {
        const audio = document.createElement("audio");

        audio.controls = true;
        audio.src = url;
        article.append(audio, createExternalLink(url, "Open audio"));
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

function renderContentBlocks(contentBlocks) {
    if (!contentBlocks.length) {
        contentRenderer.replaceChildren(createElement("p", "empty-state", "No visible lesson content is available yet."));
        return;
    }

    contentRenderer.replaceChildren(...contentBlocks.map(createContentBlock));
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
    const sections = questionPhases.map(([phase, title]) => {
        const phaseQuestions = questions.filter((question) => question.phase === phase);
        const section = createElement("section", "lesson-flow-card");
        const heading = createElement("h3", "", title);

        section.append(heading);

        if (!phaseQuestions.length) {
            section.append(createElement("p", "", "Questions for this section will appear in the full lesson experience."));
            return section;
        }

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

            item.append(prompt, badge, instructions, createQuestionAnswerControl(question));
            list.append(item);
        });

        section.append(list);
        return section;
    });

    questionFlow.replaceChildren(...sections);
    setQuestionInputsDisabled(isSubmitted);
}

async function loadLessonContext() {
    if (!lessonId) {
        headingElement.textContent = "Lesson unavailable";
        setStatus("Open a lesson from a course before viewing lesson content.", "error");
        return null;
    }

    const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select("id, module_id, title, objective, summary, estimated_time, order_index")
        .eq("id", lessonId)
        .is("archived_at", null)
        .single();

    if (lessonError) {
        headingElement.textContent = "Lesson unavailable";
        setStatus("This lesson could not be loaded.", "error");
        return null;
    }

    const { data: module, error: moduleError } = await supabase
        .from("modules")
        .select("id, course_id, title, order_index")
        .eq("id", lesson.module_id)
        .is("archived_at", null)
        .single();

    if (moduleError) {
        headingElement.textContent = "Lesson unavailable";
        setStatus("The module for this lesson could not be loaded.", "error");
        return null;
    }

    const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id, title")
        .eq("id", module.course_id)
        .single();

    if (courseError) {
        headingElement.textContent = "Lesson unavailable";
        setStatus("The course for this lesson could not be loaded.", "error");
        return null;
    }

    return { lesson, module, course };
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

    renderContentBlocks(data);
    return true;
}

async function loadQuestionOptions(questions) {
    const questionIds = questions.map((question) => question.id);

    questionOptionsByQuestion = new Map();
    if (!questionIds.length) {
        return;
    }

    const { data, error } = await supabase
        .from("student_visible_question_options")
        .select("id, question_id, option_text, option_value, order_index")
        .in("question_id", questionIds)
        .order("order_index", { ascending: true });

    if (error) {
        setSubmitStatus("Answer choices could not be loaded.", "error");
        return;
    }

    data.forEach((option) => {
        const options = questionOptionsByQuestion.get(option.question_id) || [];

        options.push(option);
        questionOptionsByQuestion.set(option.question_id, options);
    });
}

async function loadQuestionFlow() {
    const { data, error } = await supabase
        .from("student_visible_questions")
        .select("id, phase, question_type, prompt, student_instructions, hint, points, is_required, order_index")
        .eq("lesson_id", lessonId)
        .order("order_index", { ascending: true });

    if (error) {
        loadedQuestions = [];
        renderQuestionFlow([]);
        setSubmitStatus("Lesson questions could not be loaded.", "error");
        return false;
    }

    loadedQuestions = data;
    await loadQuestionOptions(loadedQuestions);
    renderQuestionFlow(loadedQuestions);
    return true;
}

async function loadSubmissionDraft() {
    const { data, error } = await getSubmissionFilter(
        supabase
            .from("lesson_submissions")
            .select("id, answers_json, status, submitted_at")
    ).maybeSingle();

    if (error) {
        setSubmitStatus("Your draft could not be loaded.", "error");
        return false;
    }

    currentSubmission = data;
    answerState = data?.answers_json || {};
    isSubmitted = data?.status === "submitted";
    return true;
}

async function createSubmissionDraft() {
    const { data, error } = await supabase
        .from("lesson_submissions")
        .insert({
            student_user_id: currentUserId,
            course_id: currentLessonContext.course.id,
            classroom_id: classroomId || null,
            lesson_id: currentLessonContext.lesson.id,
            answers_json: answerState,
        })
        .select("id, answers_json, status, submitted_at")
        .single();

    if (error) {
        throw error;
    }

    currentSubmission = data;
    return data;
}

async function saveDraftAnswers() {
    if (isSubmitted) {
        return true;
    }

    saveStatusElement.textContent = "Saving draft...";

    try {
        if (!currentSubmission) {
            await createSubmissionDraft();
        } else {
            const { error } = await supabase
                .from("lesson_submissions")
                .update({ answers_json: answerState })
                .eq("id", currentSubmission.id);

            if (error) {
                throw error;
            }
        }

        saveStatusElement.textContent = "Draft saved.";
        setSubmitStatus("");
        return true;
    } catch (error) {
        saveStatusElement.textContent = "Draft was not saved.";
        setSubmitStatus(error.message || "Draft answers could not be saved.", "error");
        return false;
    }
}

function scheduleDraftSave() {
    if (isSubmitted) {
        return;
    }

    window.clearTimeout(autoSaveTimer);
    saveStatusElement.textContent = "Unsaved changes...";
    autoSaveTimer = window.setTimeout(saveDraftAnswers, 600);
}

async function loadNextLesson() {
    const { lesson } = currentLessonContext;
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

    const nextParams = new URLSearchParams({ lesson: data.id });

    if (classroomId) {
        nextParams.set("classroom", classroomId);
    }

    nextLessonLink.href = `view.html?${nextParams.toString()}`;
    nextLessonLink.textContent = `Next lesson: ${data.title || "Continue"}`;
    nextLessonLink.hidden = false;
}

async function turnInLesson() {
    const missingRequiredQuestions = getMissingRequiredQuestions();

    if (missingRequiredQuestions.length) {
        const questionText = missingRequiredQuestions.length === 1 ? "1 required question" : `${missingRequiredQuestions.length} required questions`;

        setSubmitStatus(`Answer ${questionText} before turning in this lesson.`, "error");
        return;
    }

    window.clearTimeout(autoSaveTimer);
    turnInButton.disabled = true;
    setSubmitStatus("Turning in lesson...", "info");

    if (!(await saveDraftAnswers())) {
        turnInButton.disabled = false;
        return;
    }

    const { error } = await supabase
        .from("lesson_submissions")
        .update({
            answers_json: answerState,
            total_questions: loadedQuestions.length,
            points_possible: loadedQuestions.reduce((total, question) => total + Number(question.points || 0), 0),
            status: "submitted",
            submitted_at: new Date().toISOString(),
        })
        .eq("id", currentSubmission.id);

    if (error) {
        turnInButton.disabled = false;
        setSubmitStatus(error.message || "This lesson could not be turned in.", "error");
        return;
    }

    isSubmitted = true;
    saveStatusElement.textContent = "Lesson submitted.";
    setSubmitStatus("Lesson turned in successfully. Your answers are locked.", "success");
    setQuestionInputsDisabled(true);
    await loadNextLesson();
}

async function initializePage() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
        window.location.href = "../auth/login.html";
        return;
    }

    currentUserId = authData.user.id;
    const context = await loadLessonContext();

    if (!context) {
        return;
    }

    const { lesson, module, course } = context;

    currentLessonContext = context;
    headingElement.textContent = lesson.title || "Untitled lesson";
    contextElement.textContent = `${course.title || "Untitled course"} / ${module.title || "Untitled module"}`;
    objectiveElement.textContent = lesson.objective || lesson.summary || "No objective has been added for this lesson yet.";
    shellElement.hidden = false;
    submitPanel.hidden = false;

    await loadSubmissionDraft();
    await loadQuestionFlow();

    if (isSubmitted) {
        saveStatusElement.textContent = "Lesson submitted.";
        setSubmitStatus("Lesson already turned in. Your answers are locked.", "success");
        turnInButton.disabled = true;
        await loadNextLesson();
    }

    if (await loadContentBlocks()) {
        setStatus("");
    }
}

turnInButton.addEventListener("click", turnInLesson);

await initializePage();
