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

function resetContentBlockForm() {
    contentBlockForm.reset();
    contentBlockForm.elements["content-block-id"].value = "";
    contentBlockFormHeading.textContent = "Add text content";
    contentBlockSubmit.textContent = "Create text section";
    cancelContentBlockEditButton.hidden = true;
}

function editContentBlock(contentBlock) {
    contentBlockForm.elements["content-block-id"].value = contentBlock.id;
    contentBlockForm.elements.title.value = contentBlock.title || "";
    contentBlockForm.elements["body-text"].value = contentBlock.body_text || "";
    contentBlockFormHeading.textContent = `Edit ${contentBlock.title || "text section"}`;
    contentBlockSubmit.textContent = "Save text section";
    cancelContentBlockEditButton.hidden = false;
    contentBlockForm.elements.title.focus();
}

async function deleteContentBlock(contentBlock) {
    const confirmed = window.confirm(
        `Delete text section "${contentBlock.title || "Text section"}"? This hides it from the lesson while preserving its history.`
    );

    if (!confirmed) {
        return;
    }

    setStatus("Deleting text content...");

    const { error } = await supabase
        .from("lesson_content_blocks")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", contentBlock.id)
        .eq("lesson_id", lessonId);

    if (error) {
        setStatus(error.message || "The text content could not be deleted.", "error");
        return;
    }

    if (contentBlockForm.elements["content-block-id"].value === contentBlock.id) {
        resetContentBlockForm();
    }

    await loadContentBlocks();
    setStatus("Text content deleted.", "success");
}

async function moveContentBlock(contentBlock, direction) {
    const currentIndex = loadedContentBlocks.findIndex((currentBlock) => currentBlock.id === contentBlock.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const targetBlock = loadedContentBlocks[targetIndex];

    if (currentIndex === -1 || !targetBlock) {
        return;
    }

    setStatus("Saving text content order...");

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
        setStatus(failedUpdate.error.message || "The text content order could not be saved.", "error");
        return;
    }

    await loadContentBlocks();
    setStatus("Text content order saved.", "success");
}

async function toggleContentBlockVisibility(contentBlock) {
    const nextVisibility = !contentBlock.is_visible;

    setStatus(`${nextVisibility ? "Showing" : "Hiding"} text content...`);

    const { error } = await supabase
        .from("lesson_content_blocks")
        .update({ is_visible: nextVisibility })
        .eq("id", contentBlock.id)
        .eq("lesson_id", lessonId);

    if (error) {
        setStatus(error.message || "The text content visibility could not be updated.", "error");
        return;
    }

    await loadContentBlocks();
    setStatus(`Text content ${nextVisibility ? "shown" : "hidden"}.`, "success");
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
        const title = createElement("h3", "content-block-title", contentBlock.title || "Text section");
        const body = createElement("p", "course-muted content-block-body", contentBlock.body_text || "");
        const labelPrefix = contentBlock.is_visible ? "Text" : "Draft text";
        const label = createElement("span", "badge badge--quiet", `${labelPrefix} ${contentBlock.order_index + 1}`);
        const moveUpButton = createElement("button", "secondary-button lesson-action", "Move up");
        const moveDownButton = createElement("button", "secondary-button lesson-action", "Move down");
        const visibilityButton = createElement(
            "button",
            "secondary-button lesson-action",
            contentBlock.is_visible ? "Hide text" : "Show text"
        );
        const editButton = createElement("button", "secondary-button lesson-action", "Edit text");
        const deleteButton = createElement("button", "secondary-button destructive-button lesson-action", "Delete text");

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
        item.append(title, label, body, moveUpButton, moveDownButton, visibilityButton, editButton, deleteButton);
        list.append(item);
    });

    contentBlockList.replaceChildren(list);
}

async function loadContentBlocks() {
    const { data, error } = await supabase
        .from("lesson_content_blocks")
        .select("id, title, body_text, order_index, is_visible")
        .eq("lesson_id", lessonId)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        contentBlockList.replaceChildren(
            createElement("p", "empty-state", "Lesson text content could not be loaded.")
        );
        setStatus("Lesson text content could not be loaded.", "error");
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
        item.append(prompt, label, instructions, moveUpButton, moveDownButton, visibilityButton, editButton, deleteButton);
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
    const title = String(formData.get("title") || "").trim();
    const bodyText = String(formData.get("body-text") || "").trim();
    const submitButton = contentBlockForm.querySelector("button[type='submit']");

    if (!title || !bodyText) {
        setStatus("Enter a title and written content before saving.", "error");
        return;
    }

    if (contentBlockId) {
        const contentBlock = loadedContentBlocks.find((currentBlock) => currentBlock.id === contentBlockId);

        if (!contentBlock) {
            setStatus("Choose a text section before saving.", "error");
            return;
        }

        setStatus("Saving text content...");
        submitButton.disabled = true;

        const { error } = await supabase
            .from("lesson_content_blocks")
            .update({
                title,
                body_text: bodyText,
            })
            .eq("id", contentBlockId)
            .eq("lesson_id", lessonId);

        submitButton.disabled = false;

        if (error) {
            setStatus(error.message || "The text content could not be saved.", "error");
            return;
        }

        resetContentBlockForm();
        await loadContentBlocks();
        setStatus("Text content saved.", "success");
        return;
    }

    const nextOrder = loadedContentBlocks.reduce(
        (highest, contentBlock) => Math.max(highest, contentBlock.order_index),
        -1
    ) + 1;
    setStatus("Creating text content...");
    submitButton.disabled = true;

    const { error } = await supabase.from("lesson_content_blocks").insert({
        lesson_id: lessonId,
        block_type: "text",
        title,
        body_text: bodyText,
        order_index: nextOrder,
        is_visible: false,
    });

    submitButton.disabled = false;

    if (error) {
        setStatus(error.message || "The text content could not be created.", "error");
        return;
    }

    resetContentBlockForm();
    await loadContentBlocks();
    setStatus("Text content created.", "success");
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
