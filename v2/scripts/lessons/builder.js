import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const params = new URLSearchParams(window.location.search);
const lessonId = params.get("lesson");
const headingElement = qs("[data-lesson-heading]");
const contextElement = qs("[data-lesson-context]");
const statusElement = qs("[data-lesson-status]");
const contentSections = [...document.querySelectorAll("[data-lesson-content]")];
const courseEditorLink = qs("[data-course-editor-link]");
const modulePosition = qs("[data-module-position]");
const lessonPosition = qs("[data-lesson-position]");
const lessonDetails = qs("[data-lesson-details]");
const contentBlockForm = qs("[data-content-block-form]");
const contentBlockFormHeading = qs("[data-content-block-form-heading]");
const contentBlockSubmit = qs("[data-content-block-submit]");
const cancelContentBlockEditButton = qs("[data-cancel-content-block-edit]");
const contentBlockTypeSelect = qs("[data-content-block-type]");
const contentTitleInput = qs("[data-content-title]");
const textContentField = qs("[data-text-content-field]");
const urlContentField = qs("[data-url-content-field]");
const urlContentLabel = qs("[data-url-content-label]");
const urlContentInput = qs("[data-url-content-input]");
const fileTypeField = qs("[data-file-type-field]");
const contentBlockList = qs("[data-content-block-list]");
const questionForm = qs("[data-question-form]");
const questionFormHeading = qs("[data-question-form-heading]");
const questionSubmit = qs("[data-question-submit]");
const cancelQuestionEditButton = qs("[data-cancel-question-edit]");
const questionList = qs("[data-question-list]");
let loadedContentBlocks = [];
let loadedQuestions = [];

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function showContent() {
    contentSections.forEach((section) => {
        section.hidden = false;
    });
}

function buildDetailsList(lesson, module, course) {
    const list = createElement("dl", "course-classrooms");
    const details = [
        ["Course", course.title || "Untitled course"],
        ["Module", module.title || "Untitled module"],
        ["Objective", lesson.objective || "No objective added yet."],
        ["Overview", lesson.summary || "No lesson overview added yet."],
        ["Estimated time", lesson.estimated_time || "Not set"],
    ];

    details.forEach(([label, value]) => {
        const row = createElement("div", "classroom-item");
        const term = createElement("dt", "submission-name", label);
        const description = createElement("dd", "course-muted", value);

        row.append(term, description);
        list.append(row);
    });

    return list;
}

function formatContentBlockType(blockType) {
    return ["file", "image", "link", "slides", "youtube"].includes(blockType) ? blockType : "text";
}

function getContentBlockFormType(contentBlock) {
    if (contentBlock.block_type === "file" && contentBlock.file_type === "image") {
        return "image";
    }

    return formatContentBlockType(contentBlock.block_type);
}

function getStoredBlockType(formBlockType) {
    return ["file", "image"].includes(formBlockType) ? "file" : formBlockType;
}

function setContentBlockFormMode(blockType) {
    const normalizedBlockType = formatContentBlockType(blockType);
    const isText = normalizedBlockType === "text";
    const isSlides = normalizedBlockType === "slides";
    const isYoutube = normalizedBlockType === "youtube";
    const isImage = normalizedBlockType === "image";
    const isFile = normalizedBlockType === "file";

    contentBlockTypeSelect.value = normalizedBlockType;
    textContentField.hidden = !isText;
    urlContentField.hidden = isText;
    fileTypeField.hidden = !isFile;
    contentBlockForm.elements["body-text"].required = isText;
    contentBlockForm.elements["content-url"].required = !isText;
    contentBlockForm.elements["file-type"].required = isFile;
    contentTitleInput.placeholder = isText ? "What is a computer?" : isYoutube ? "Video title" : "Resource title";
    urlContentLabel.textContent = isYoutube
        ? "YouTube URL"
        : isSlides
            ? "Slides URL"
            : isImage
                ? "Image URL"
                : isFile
                    ? "File URL"
                    : "External URL";
    urlContentInput.placeholder = isYoutube
        ? "https://www.youtube.com/watch?v=..."
        : isSlides
            ? "https://docs.google.com/presentation/..."
            : isImage
                ? "https://example.com/image.png"
                : isFile
                    ? "https://example.com/worksheet.pdf"
                    : "https://example.com/resource";
}

function getContentBlockTypeLabel(contentBlock) {
    if (contentBlock.block_type === "file" && contentBlock.file_type === "image") {
        return contentBlock.is_visible ? "Image" : "Draft image";
    }

    if (contentBlock.block_type === "file") {
        return contentBlock.is_visible ? "File" : "Draft file";
    }

    if (contentBlock.block_type === "youtube") {
        return contentBlock.is_visible ? "YouTube" : "Draft YouTube";
    }

    if (contentBlock.block_type === "slides") {
        return contentBlock.is_visible ? "Slides" : "Draft slides";
    }

    if (contentBlock.block_type === "link") {
        return contentBlock.is_visible ? "Link" : "Draft link";
    }

    return contentBlock.is_visible ? "Text" : "Draft text";
}

function resetContentBlockForm() {
    contentBlockForm.reset();
    contentBlockForm.elements["content-block-id"].value = "";
    setContentBlockFormMode("text");
    contentBlockFormHeading.textContent = "Add lesson content";
    contentBlockSubmit.textContent = "Create content block";
    cancelContentBlockEditButton.hidden = true;
}

function editContentBlock(contentBlock) {
    const blockType = getContentBlockFormType(contentBlock);

    setContentBlockFormMode(blockType);
    contentBlockForm.elements["content-block-id"].value = contentBlock.id;
    contentBlockForm.elements.title.value = contentBlock.title || "";
    contentBlockForm.elements["body-text"].value = contentBlock.body_text || "";
    contentBlockForm.elements["content-url"].value = contentBlock.file_url || contentBlock.external_url || "";
    contentBlockForm.elements["file-type"].value = contentBlock.file_type || "pdf";
    contentBlockFormHeading.textContent = `Edit ${contentBlock.title || (blockType === "text" ? "text section" : "content block")}`;
    contentBlockSubmit.textContent = blockType === "text" ? "Save text section" : "Save content block";
    cancelContentBlockEditButton.hidden = false;
    contentBlockForm.elements.title.focus();
}

async function deleteContentBlock(contentBlock) {
    const confirmed = window.confirm(
        `Delete content block "${contentBlock.title || "Untitled content"}"? This hides it from the lesson while preserving its history.`
    );

    if (!confirmed) {
        return;
    }

    setStatus("Deleting lesson content...");

    const { error } = await supabase
        .from("lesson_content_blocks")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", contentBlock.id)
        .eq("lesson_id", lessonId);

    if (error) {
        setStatus(error.message || "The lesson content could not be deleted.", "error");
        return;
    }

    if (contentBlockForm.elements["content-block-id"].value === contentBlock.id) {
        resetContentBlockForm();
    }

    await loadContentBlocks();
    setStatus("Lesson content deleted.", "success");
}

async function moveContentBlock(contentBlock, direction) {
    const currentIndex = loadedContentBlocks.findIndex((currentBlock) => currentBlock.id === contentBlock.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const targetBlock = loadedContentBlocks[targetIndex];

    if (currentIndex === -1 || !targetBlock) {
        return;
    }

    setStatus("Saving lesson content order...");

    const results = await Promise.all([
        supabase
            .from("lesson_content_blocks")
            .update({ order_index: targetBlock.order_index })
            .eq("id", contentBlock.id)
            .eq("lesson_id", lessonId),
        supabase
            .from("lesson_content_blocks")
            .update({ order_index: contentBlock.order_index })
            .eq("id", targetBlock.id)
            .eq("lesson_id", lessonId),
    ]);
    const failedUpdate = results.find((result) => result.error);

    if (failedUpdate) {
        setStatus(failedUpdate.error.message || "The lesson content order could not be saved.", "error");
        return;
    }

    await loadContentBlocks();
    setStatus("Lesson content order saved.", "success");
}

async function toggleContentBlockVisibility(contentBlock) {
    const nextVisibility = !contentBlock.is_visible;

    setStatus(`${nextVisibility ? "Showing" : "Hiding"} lesson content...`);

    const { error } = await supabase
        .from("lesson_content_blocks")
        .update({ is_visible: nextVisibility })
        .eq("id", contentBlock.id)
        .eq("lesson_id", lessonId);

    if (error) {
        setStatus(error.message || "The lesson content visibility could not be updated.", "error");
        return;
    }

    await loadContentBlocks();
    setStatus(`Lesson content ${nextVisibility ? "shown" : "hidden"}.`, "success");
}

function resetQuestionForm() {
    questionForm.reset();
    questionForm.elements["question-id"].value = "";
    questionFormHeading.textContent = "Add draft question";
    questionSubmit.textContent = "Create draft question";
    cancelQuestionEditButton.hidden = true;
}

function editQuestion(question) {
    questionForm.elements["question-id"].value = question.id;
    questionForm.elements.phase.value = question.phase || "before";
    questionForm.elements.prompt.value = question.prompt || "";
    questionForm.elements["student-instructions"].value = question.student_instructions || "";
    questionFormHeading.textContent = "Edit draft question";
    questionSubmit.textContent = "Save draft question";
    cancelQuestionEditButton.hidden = false;
    questionForm.elements.prompt.focus();
}

async function deleteQuestion(question) {
    const confirmed = window.confirm(
        `Delete draft question "${question.prompt}"? This hides it from the lesson while preserving its history.`
    );

    if (!confirmed) {
        return;
    }

    setStatus("Deleting draft question...");

    const { error } = await supabase
        .from("questions")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", question.id)
        .eq("lesson_id", lessonId);

    if (error) {
        setStatus(error.message || "The draft question could not be deleted.", "error");
        return;
    }

    if (questionForm.elements["question-id"].value === question.id) {
        resetQuestionForm();
    }

    await loadQuestions();
    setStatus("Draft question deleted.", "success");
}

async function moveQuestion(question, direction) {
    const phaseQuestions = loadedQuestions.filter((currentQuestion) => currentQuestion.phase === question.phase);
    const currentIndex = phaseQuestions.findIndex((currentQuestion) => currentQuestion.id === question.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const targetQuestion = phaseQuestions[targetIndex];

    if (currentIndex === -1 || !targetQuestion) {
        return;
    }

    setStatus("Saving draft question order...");

    const results = await Promise.all([
        supabase
            .from("questions")
            .update({ order_index: targetQuestion.order_index })
            .eq("id", question.id)
            .eq("lesson_id", lessonId),
        supabase
            .from("questions")
            .update({ order_index: question.order_index })
            .eq("id", targetQuestion.id)
            .eq("lesson_id", lessonId),
    ]);
    const failedUpdate = results.find((result) => result.error);

    if (failedUpdate) {
        setStatus(failedUpdate.error.message || "The draft question order could not be saved.", "error");
        return;
    }

    await loadQuestions();
    setStatus("Draft question order saved.", "success");
}

async function toggleQuestionVisibility(question) {
    const nextVisibility = !question.is_visible;

    setStatus(`${nextVisibility ? "Showing" : "Hiding"} draft question...`);

    const { error } = await supabase
        .from("questions")
        .update({ is_visible: nextVisibility })
        .eq("id", question.id)
        .eq("lesson_id", lessonId);

    if (error) {
        setStatus(error.message || "The draft question visibility could not be updated.", "error");
        return;
    }

    await loadQuestions();
    setStatus(`Draft question ${nextVisibility ? "shown" : "hidden"}.`, "success");
}

function renderContentBlocks(contentBlocks) {
    if (!contentBlocks.length) {
        contentBlockList.replaceChildren(
            createElement("p", "empty-state", "No written content has been added yet.")
        );
        return;
    }

    const list = createElement("ol", "content-block-list");

    contentBlocks.forEach((contentBlock, index) => {
        const item = createElement("li", "content-block-card");
        const title = createElement("h3", "content-block-title", contentBlock.title || "Untitled content");
        const label = createElement("span", "badge badge--quiet", `${getContentBlockTypeLabel(contentBlock)} ${contentBlock.order_index + 1}`);
        const contentUrl = contentBlock.file_url || contentBlock.external_url || "";
        const isImageResource = contentBlock.block_type === "file" && contentBlock.file_type === "image";
        const contentPreview = ["file", "link", "slides", "youtube"].includes(contentBlock.block_type)
            ? createElement("a", "course-muted content-block-body", contentUrl)
            : createElement("p", "course-muted content-block-body", contentBlock.body_text || "");
        const moveUpButton = createElement("button", "secondary-button lesson-action", "Move up");
        const moveDownButton = createElement("button", "secondary-button lesson-action", "Move down");
        const visibilityButton = createElement(
            "button",
            "secondary-button lesson-action",
            contentBlock.is_visible ? "Hide content" : "Show content"
        );
        const editButton = createElement("button", "secondary-button lesson-action", "Edit content");
        const deleteButton = createElement("button", "secondary-button destructive-button lesson-action", "Delete content");
        const actions = createElement("div", "content-block-actions");

        if (["file", "link", "slides", "youtube"].includes(contentBlock.block_type)) {
            contentPreview.href = contentUrl || "#";
            contentPreview.target = "_blank";
            contentPreview.rel = "noopener noreferrer";

            if (isImageResource && contentUrl) {
                const image = createElement("img", "content-block-image-preview");
                image.src = contentUrl;
                image.alt = contentBlock.title || "Lesson image";
                contentPreview.replaceChildren(image);
            } else if (contentBlock.block_type === "file") {
                contentPreview.textContent = `${contentBlock.file_type?.toUpperCase() || "File"} resource`;
            }
        }

        moveUpButton.type = "button";
        moveUpButton.disabled = index === 0;
        moveUpButton.addEventListener("click", () => moveContentBlock(contentBlock, "up"));
        moveDownButton.type = "button";
        moveDownButton.disabled = index === contentBlocks.length - 1;
        moveDownButton.addEventListener("click", () => moveContentBlock(contentBlock, "down"));
        visibilityButton.type = "button";
        visibilityButton.addEventListener("click", () => toggleContentBlockVisibility(contentBlock));
        editButton.type = "button";
        editButton.addEventListener("click", () => editContentBlock(contentBlock));
        deleteButton.type = "button";
        deleteButton.addEventListener("click", () => deleteContentBlock(contentBlock));
        actions.append(moveUpButton, moveDownButton, visibilityButton, editButton, deleteButton);
        item.append(title, label, contentPreview, actions);
        list.append(item);
    });

    contentBlockList.replaceChildren(list);
}

async function loadContentBlocks() {
    const { data, error } = await supabase
        .from("lesson_content_blocks")
        .select("id, block_type, title, body_text, external_url, file_url, file_type, order_index, is_visible")
        .eq("lesson_id", lessonId)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        contentBlockList.replaceChildren(
            createElement("p", "empty-state", "Lesson content could not be loaded.")
        );
        setStatus("Lesson content could not be loaded.", "error");
        return false;
    }

    loadedContentBlocks = data;
    renderContentBlocks(data);
    return true;
}

function renderQuestions(questions) {
    if (!questions.length) {
        questionList.replaceChildren(createElement("p", "empty-state", "No draft questions have been added yet."));
        return;
    }

    const list = createElement("ol", "question-list");

    questions.forEach((question) => {
        const item = createElement("li", "question-card");
        const prompt = createElement("h3", "question-prompt", question.prompt);
        const phaseLabel = question.phase.charAt(0).toUpperCase() + question.phase.slice(1);
        const label = createElement("span", "badge badge--quiet", `Draft ${phaseLabel}`);
        const instructions = createElement(
            "p",
            "course-muted question-instructions",
            question.student_instructions || "Short response question"
        );
        const phaseQuestions = questions.filter((currentQuestion) => currentQuestion.phase === question.phase);
        const phaseIndex = phaseQuestions.findIndex((currentQuestion) => currentQuestion.id === question.id);
        const moveUpButton = createElement("button", "secondary-button lesson-action", "Move up");
        const moveDownButton = createElement("button", "secondary-button lesson-action", "Move down");
        const visibilityButton = createElement(
            "button",
            "secondary-button lesson-action",
            question.is_visible ? "Hide question" : "Show question"
        );
        const editButton = createElement("button", "secondary-button lesson-action", "Edit question");
        const deleteButton = createElement(
            "button",
            "secondary-button destructive-button lesson-action",
            "Delete question"
        );
        const actions = createElement("div", "content-block-actions");

        moveUpButton.type = "button";
        moveUpButton.disabled = phaseIndex === 0;
        moveUpButton.addEventListener("click", () => moveQuestion(question, "up"));
        moveDownButton.type = "button";
        moveDownButton.disabled = phaseIndex === phaseQuestions.length - 1;
        moveDownButton.addEventListener("click", () => moveQuestion(question, "down"));
        visibilityButton.type = "button";
        visibilityButton.addEventListener("click", () => toggleQuestionVisibility(question));
        editButton.type = "button";
        editButton.addEventListener("click", () => editQuestion(question));
        deleteButton.type = "button";
        deleteButton.addEventListener("click", () => deleteQuestion(question));
        actions.append(moveUpButton, moveDownButton, visibilityButton, editButton, deleteButton);
        item.append(prompt, label, instructions, actions);
        list.append(item);
    });

    questionList.replaceChildren(list);
}

async function loadQuestions() {
    const { data, error } = await supabase
        .from("questions")
        .select("id, phase, prompt, student_instructions, order_index, is_visible")
        .eq("lesson_id", lessonId)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        questionList.replaceChildren(createElement("p", "empty-state", "Draft questions could not be loaded."));
        setStatus("Draft questions could not be loaded.", "error");
        return false;
    }

    loadedQuestions = data;
    renderQuestions(data);
    return true;
}

async function loadLessonContext() {
    if (!lessonId) {
        headingElement.textContent = "Lesson unavailable";
        setStatus("Open a lesson from course management before using the lesson builder.", "error");
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

    const { data: canManage, error: permissionError } = await supabase.rpc("can_manage_course", {
        course_to_check: module.course_id,
    });

    if (permissionError || !canManage) {
        headingElement.textContent = "Lesson unavailable";
        setStatus("You do not have permission to manage this lesson.", "error");
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

async function initializePage() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
        window.location.href = "../auth/login.html";
        return;
    }

    const context = await loadLessonContext();

    if (!context) {
        return;
    }

    const { lesson, module, course } = context;

    headingElement.textContent = lesson.title || "Untitled lesson";
    contextElement.textContent = `${course.title || "Untitled course"} / ${module.title || "Untitled module"}`;
    courseEditorLink.href = `../courses/editor.html?course=${encodeURIComponent(course.id)}`;
    courseEditorLink.textContent = "Back to course editor";
    modulePosition.textContent = String(module.order_index + 1);
    lessonPosition.textContent = String(lesson.order_index + 1);
    lessonDetails.replaceChildren(buildDetailsList(lesson, module, course));
    showContent();
    const [contentLoaded, questionsLoaded] = await Promise.all([loadContentBlocks(), loadQuestions()]);

    if (contentLoaded && questionsLoaded) {
        setStatus("");
    }
}

contentBlockForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(contentBlockForm);
    const contentBlockId = String(formData.get("content-block-id") || "").trim();
    const blockType = formatContentBlockType(String(formData.get("block-type") || "text"));
    const storedBlockType = getStoredBlockType(blockType);
    const title = String(formData.get("title") || "").trim();
    const bodyText = String(formData.get("body-text") || "").trim();
    const contentUrl = String(formData.get("content-url") || "").trim();
    const fileType = String(formData.get("file-type") || "pdf");
    const submitButton = contentBlockForm.querySelector("button[type='submit']");

    if (!title || (blockType === "text" && !bodyText) || (blockType !== "text" && !contentUrl)) {
        setStatus(`Enter a title and ${blockType === "text" ? "written content" : "URL"} before saving.`, "error");
        return;
    }

    if (contentBlockId) {
        const contentBlock = loadedContentBlocks.find((currentBlock) => currentBlock.id === contentBlockId);

        if (!contentBlock) {
            setStatus("Choose a content block before saving.", "error");
            return;
        }

        setStatus("Saving lesson content...");
        submitButton.disabled = true;

        const { error } = await supabase
            .from("lesson_content_blocks")
            .update({
                block_type: storedBlockType,
                title,
                body_text: blockType === "text" ? bodyText : null,
                external_url: ["link", "slides", "youtube"].includes(blockType) ? contentUrl : null,
                file_url: ["file", "image"].includes(blockType) ? contentUrl : null,
                file_type: blockType === "image" ? "image" : blockType === "file" ? fileType : null,
            })
            .eq("id", contentBlockId)
            .eq("lesson_id", lessonId);

        submitButton.disabled = false;

        if (error) {
            setStatus(error.message || "The lesson content could not be saved.", "error");
            return;
        }

        resetContentBlockForm();
        await loadContentBlocks();
        setStatus("Lesson content saved.", "success");
        return;
    }

    const nextOrder = loadedContentBlocks.reduce(
        (highest, contentBlock) => Math.max(highest, contentBlock.order_index),
        -1
    ) + 1;
    setStatus("Creating lesson content...");
    submitButton.disabled = true;

    const { error } = await supabase.from("lesson_content_blocks").insert({
        lesson_id: lessonId,
        block_type: storedBlockType,
        title,
        body_text: blockType === "text" ? bodyText : null,
        external_url: ["link", "slides", "youtube"].includes(blockType) ? contentUrl : null,
        file_url: ["file", "image"].includes(blockType) ? contentUrl : null,
        file_type: blockType === "image" ? "image" : blockType === "file" ? fileType : null,
        order_index: nextOrder,
        is_visible: false,
    });

    submitButton.disabled = false;

    if (error) {
        setStatus(error.message || "The lesson content could not be created.", "error");
        return;
    }

    resetContentBlockForm();
    await loadContentBlocks();
    setStatus("Lesson content created.", "success");
});

contentBlockTypeSelect.addEventListener("change", () => {
    setContentBlockFormMode(contentBlockTypeSelect.value);
});

cancelContentBlockEditButton.addEventListener("click", resetContentBlockForm);

questionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(questionForm);
    const questionId = String(formData.get("question-id") || "").trim();
    const phase = String(formData.get("phase") || "");
    const prompt = String(formData.get("prompt") || "").trim();
    const studentInstructions = String(formData.get("student-instructions") || "").trim();
    const submitButton = questionForm.querySelector("button[type='submit']");

    if (!["before", "during", "reflection"].includes(phase) || !prompt) {
        setStatus("Choose a phase and enter a question prompt before saving.", "error");
        return;
    }

    if (questionId) {
        const question = loadedQuestions.find((currentQuestion) => currentQuestion.id === questionId);

        if (!question) {
            setStatus("Choose a draft question before saving.", "error");
            return;
        }

        setStatus("Saving draft question...");
        submitButton.disabled = true;

        const { error } = await supabase
            .from("questions")
            .update({
                phase,
                prompt,
                student_instructions: studentInstructions || null,
            })
            .eq("id", questionId)
            .eq("lesson_id", lessonId);

        submitButton.disabled = false;

        if (error) {
            setStatus(error.message || "The draft question could not be saved.", "error");
            return;
        }

        resetQuestionForm();
        await loadQuestions();
        setStatus("Draft question saved.", "success");
        return;
    }

    const lessonPhaseQuestions = loadedQuestions.filter((question) => question.phase === phase);
    const nextOrder = lessonPhaseQuestions.reduce(
        (highest, question) => Math.max(highest, question.order_index),
        -1
    ) + 1;
    setStatus("Creating draft question...");
    submitButton.disabled = true;

    const { error } = await supabase.from("questions").insert({
        lesson_id: lessonId,
        phase,
        question_type: "short_response",
        prompt,
        student_instructions: studentInstructions || null,
        points: 1,
        is_required: false,
        is_visible: false,
        order_index: nextOrder,
    });

    submitButton.disabled = false;

    if (error) {
        setStatus(error.message || "The draft question could not be created.", "error");
        return;
    }

    resetQuestionForm();
    await loadQuestions();
    setStatus("Draft question created.", "success");
});

cancelQuestionEditButton.addEventListener("click", resetQuestionForm);

await initializePage();
