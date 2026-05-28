import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const params = new URLSearchParams(window.location.search);
const courseId = params.get("course");
const headingElement = qs("[data-course-heading]");
const statusElement = qs("[data-course-status]");
const contentSections = [...document.querySelectorAll("[data-course-content]")];
const editorForm = qs("[data-course-editor-form]");
const moduleCount = qs("[data-module-count]");
const lessonCount = qs("[data-lesson-count]");
const moduleList = qs("[data-module-list]");
const moduleForm = qs("[data-module-form]");
const moduleFormHeading = qs("[data-module-form-heading]");
const moduleSubmitButton = qs("[data-module-submit]");
const addModuleButton = qs("[data-toggle-module-form]");
const cancelModuleButton = qs("[data-cancel-module-form]");
const lessonForm = qs("[data-lesson-form]");
const lessonFormHeading = qs("[data-lesson-form-heading]");
const cancelLessonButton = qs("[data-cancel-lesson-form]");
const contentBlockForm = qs("[data-content-block-form]");
const contentBlockFormHeading = qs("[data-content-block-form-heading]");
const cancelContentBlockButton = qs("[data-cancel-content-block-form]");
const questionForm = qs("[data-question-form]");
const questionFormHeading = qs("[data-question-form-heading]");
const cancelQuestionButton = qs("[data-cancel-question-form]");
let loadedModules = [];
let loadedLessons = [];
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

function fillCourseForm(course) {
    editorForm.elements.title.value = course.title || "";
    editorForm.elements["subject-area"].value = course.subject_area || "";
    editorForm.elements["estimated-length"].value = course.estimated_length || "";
    editorForm.elements.description.value = course.description || "";
}

function toggleModuleForm(isOpen, module = null) {
    moduleForm.hidden = !isOpen;
    addModuleButton.hidden = isOpen;

    if (isOpen && module) {
        moduleForm.elements["module-id"].value = module.id;
        moduleForm.elements.title.value = module.title || "";
        moduleForm.elements.description.value = module.description || "";
        moduleFormHeading.textContent = `Edit ${module.title}`;
        moduleSubmitButton.textContent = "Save module";
        moduleForm.elements.title.focus();
    } else if (isOpen) {
        moduleForm.reset();
        moduleFormHeading.textContent = "Add module";
        moduleSubmitButton.textContent = "Create module";
        moduleForm.elements.title.focus();
    } else {
        moduleForm.reset();
        moduleFormHeading.textContent = "Add module";
        moduleSubmitButton.textContent = "Create module";
    }
}

function toggleLessonForm(isOpen, module = null) {
    lessonForm.hidden = !isOpen;

    if (isOpen && module) {
        lessonForm.elements["module-id"].value = module.id;
        lessonFormHeading.textContent = `Add lesson to ${module.title}`;
        lessonForm.elements.title.focus();
    } else {
        lessonForm.reset();
        lessonFormHeading.textContent = "Add lesson";
    }
}

function toggleContentBlockForm(isOpen, lesson = null) {
    contentBlockForm.hidden = !isOpen;

    if (isOpen && lesson) {
        contentBlockForm.elements["lesson-id"].value = lesson.id;
        contentBlockFormHeading.textContent = `Add text content to ${lesson.title}`;
        contentBlockForm.elements.title.focus();
    } else {
        contentBlockForm.reset();
        contentBlockFormHeading.textContent = "Add text content";
    }
}

function toggleQuestionForm(isOpen, lesson = null) {
    questionForm.hidden = !isOpen;

    if (isOpen && lesson) {
        questionForm.elements["lesson-id"].value = lesson.id;
        questionFormHeading.textContent = `Add draft question to ${lesson.title}`;
        questionForm.elements.prompt.focus();
    } else {
        questionForm.reset();
        questionFormHeading.textContent = "Add draft question";
    }
}

function renderContentBlocks(contentBlocks) {
    if (!contentBlocks.length) {
        return createElement("p", "empty-state empty-state--compact", "No written content has been added yet.");
    }

    const list = createElement("ol", "content-block-list");

    contentBlocks.forEach((contentBlock) => {
        const item = createElement("li", "content-block-card");
        const title = createElement("h6", "content-block-title", contentBlock.title || "Text section");
        const body = createElement("p", "course-muted content-block-body", contentBlock.body_text || "");
        const labelPrefix = contentBlock.is_visible ? "Text" : "Draft text";
        const label = createElement("span", "badge badge--quiet", `${labelPrefix} ${contentBlock.order_index + 1}`);

        item.append(title, label, body);
        list.append(item);
    });

    return list;
}

function renderQuestions(questions) {
    if (!questions.length) {
        return createElement("p", "empty-state empty-state--compact", "No draft questions have been added yet.");
    }

    const list = createElement("ol", "question-list");

    questions.forEach((question) => {
        const item = createElement("li", "question-card");
        const prompt = createElement("h6", "question-prompt", question.prompt);
        const phaseLabel = question.phase.charAt(0).toUpperCase() + question.phase.slice(1);
        const label = createElement("span", "badge badge--quiet", `Draft ${phaseLabel}`);
        const instructions = createElement(
            "p",
            "course-muted question-instructions",
            question.student_instructions || "Short response question"
        );

        item.append(prompt, label, instructions);
        list.append(item);
    });

    return list;
}

async function deleteLesson(lesson) {
    const confirmed = window.confirm(
        `Delete lesson "${lesson.title}"? This hides it from the course while preserving its existing content.`
    );

    if (!confirmed) {
        return;
    }

    setStatus("Deleting lesson...");

    const { error } = await supabase
        .from("lessons")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", lesson.id);

    if (error) {
        setStatus(error.message || "The lesson could not be deleted.", "error");
        return;
    }

    await loadModules();
    setStatus("Lesson deleted.", "success");
}

async function deleteModule(module) {
    const confirmed = window.confirm(
        `Delete module "${module.title}"? This hides the module and its lessons while preserving their existing content.`
    );

    if (!confirmed) {
        return;
    }

    setStatus("Deleting module...");

    const { error } = await supabase
        .from("modules")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", module.id);

    if (error) {
        setStatus(error.message || "The module could not be deleted.", "error");
        return;
    }

    await loadModules();
    setStatus("Module deleted.", "success");
}

function renderLessons(lessons, contentBlocks, questions) {
    if (!lessons.length) {
        return createElement("p", "empty-state empty-state--compact", "No lessons in this module yet.");
    }

    const list = createElement("ol", "lesson-list");

    lessons.forEach((lesson) => {
        const item = createElement("li", "lesson-card");
        const header = createElement("div", "lesson-card-header");
        const content = createElement("div");
        const title = createElement("h5", "lesson-title", lesson.title);
        const objective = createElement(
            "p",
            "course-muted",
            lesson.summary || lesson.objective || "No lesson overview added yet."
        );
        const labelText = lesson.estimated_time
            ? `Lesson ${lesson.order_index + 1} | ${lesson.estimated_time}`
            : `Lesson ${lesson.order_index + 1}`;
        const label = createElement("span", "badge badge--quiet", labelText);
        const headerActions = createElement("div", "lesson-header-actions");
        const deleteLessonButton = createElement("button", "secondary-button destructive-button lesson-action", "Delete lesson");
        const contentSection = createElement("section", "lesson-content");
        const contentHeader = createElement("div", "lesson-content-header");
        const contentHeading = createElement("h6", "", "Lesson content");
        const addContentButton = createElement("button", "secondary-button lesson-action", "Add text content");
        const lessonContentBlocks = contentBlocks.filter((contentBlock) => contentBlock.lesson_id === lesson.id);
        const questionSection = createElement("section", "lesson-content lesson-questions");
        const questionHeader = createElement("div", "lesson-content-header");
        const questionHeading = createElement("h6", "", "Draft questions");
        const addQuestionButton = createElement("button", "secondary-button lesson-action", "Add question");
        const lessonQuestions = questions.filter((question) => question.lesson_id === lesson.id);

        addContentButton.type = "button";
        addContentButton.addEventListener("click", () => toggleContentBlockForm(true, lesson));
        addQuestionButton.type = "button";
        addQuestionButton.addEventListener("click", () => toggleQuestionForm(true, lesson));
        deleteLessonButton.type = "button";
        deleteLessonButton.addEventListener("click", () => deleteLesson(lesson));
        content.append(title, objective);
        headerActions.append(label, deleteLessonButton);
        header.append(content, headerActions);
        contentHeader.append(contentHeading, addContentButton);
        contentSection.append(contentHeader, renderContentBlocks(lessonContentBlocks));
        questionHeader.append(questionHeading, addQuestionButton);
        questionSection.append(questionHeader, renderQuestions(lessonQuestions));
        item.append(header, contentSection, questionSection);
        list.append(item);
    });

    return list;
}

function renderModules(modules, lessons, contentBlocks, questions) {
    if (!modules.length) {
        moduleList.replaceChildren(createElement("p", "empty-state", "No modules have been created yet."));
        return;
    }

    const list = createElement("ol", "module-list");

    modules.forEach((module) => {
        const item = createElement("li", "module-card");
        const header = createElement("div", "module-card-header");
        const content = createElement("div");
        const title = createElement("h3", "course-title", module.title);
        const description = createElement(
            "p",
            "course-muted",
            module.description || "No module description added yet."
        );
        const label = createElement("span", "badge badge--quiet", `Module ${module.order_index + 1}`);
        const lessonSection = createElement("section", "module-lessons");
        const lessonHeader = createElement("div", "module-lessons-header");
        const lessonHeading = createElement("h4", "", "Lessons");
        const actions = createElement("div", "module-actions");
        const editModuleButton = createElement("button", "secondary-button lesson-action", "Edit module");
        const addLessonButton = createElement("button", "secondary-button lesson-action", "Add lesson");
        const deleteModuleButton = createElement("button", "secondary-button destructive-button lesson-action", "Delete module");
        const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id);

        editModuleButton.type = "button";
        editModuleButton.addEventListener("click", () => toggleModuleForm(true, module));
        addLessonButton.type = "button";
        addLessonButton.addEventListener("click", () => toggleLessonForm(true, module));
        deleteModuleButton.type = "button";
        deleteModuleButton.addEventListener("click", () => deleteModule(module));
        content.append(title, description);
        header.append(content, label);
        actions.append(editModuleButton, addLessonButton, deleteModuleButton);
        lessonHeader.append(lessonHeading, actions);
        lessonSection.append(lessonHeader, renderLessons(moduleLessons, contentBlocks, questions));
        item.append(header, lessonSection);
        list.append(item);
    });

    moduleList.replaceChildren(list);
}

async function loadModules() {
    const { data: modules, error } = await supabase
        .from("modules")
        .select("id, title, description, order_index")
        .eq("course_id", courseId)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        moduleList.replaceChildren(createElement("p", "empty-state", "Modules could not be loaded."));
        setStatus("Module information could not be loaded.", "error");
        return null;
    }

    let lessons = [];
    let contentBlocks = [];
    let questions = [];

    if (modules.length) {
        const { data, error: lessonsError } = await supabase
            .from("lessons")
            .select("id, module_id, title, objective, summary, estimated_time, order_index")
            .in("module_id", modules.map((module) => module.id))
            .is("archived_at", null)
            .order("order_index", { ascending: true });

        if (lessonsError) {
            moduleList.replaceChildren(createElement("p", "empty-state", "Lessons could not be loaded."));
            setStatus("Lesson information could not be loaded.", "error");
            return null;
        }

        lessons = data;

        if (lessons.length) {
            const { data: lessonContent, error: contentError } = await supabase
                .from("lesson_content_blocks")
                .select("id, lesson_id, block_type, title, body_text, order_index, is_visible")
                .in("lesson_id", lessons.map((lesson) => lesson.id))
                .is("archived_at", null)
                .order("order_index", { ascending: true });

            if (contentError) {
                moduleList.replaceChildren(createElement("p", "empty-state", "Lesson content could not be loaded."));
                setStatus("Lesson content could not be loaded.", "error");
                return null;
            }

            contentBlocks = lessonContent;

            const { data: lessonQuestions, error: questionsError } = await supabase
                .from("questions")
                .select("id, lesson_id, phase, prompt, student_instructions, order_index, is_visible")
                .in("lesson_id", lessons.map((lesson) => lesson.id))
                .is("archived_at", null)
                .order("order_index", { ascending: true });

            if (questionsError) {
                moduleList.replaceChildren(createElement("p", "empty-state", "Draft questions could not be loaded."));
                setStatus("Draft questions could not be loaded.", "error");
                return null;
            }

            questions = lessonQuestions;
        }
    }

    loadedModules = modules;
    loadedLessons = lessons;
    loadedContentBlocks = contentBlocks;
    loadedQuestions = questions;
    renderModules(modules, lessons, contentBlocks, questions);
    moduleCount.textContent = String(modules.length);
    lessonCount.textContent = String(lessons.length);
    return modules;
}

async function confirmCourseManagement() {
    if (!courseId) {
        setStatus("Choose a course from the dashboard before opening course management.", "error");
        return null;
    }

    const { data: canManage, error } = await supabase.rpc("can_manage_course", {
        course_to_check: courseId,
    });

    if (error || !canManage) {
        setStatus("You do not have permission to manage this course.", "error");
        return null;
    }

    const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id, title, description, subject_area, estimated_length")
        .eq("id", courseId)
        .single();

    if (courseError) {
        setStatus("This course could not be loaded.", "error");
        return null;
    }

    return course;
}

async function initializePage() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
        window.location.href = "../auth/login.html";
        return;
    }

    const course = await confirmCourseManagement();

    if (!course) {
        headingElement.textContent = "Course unavailable";
        return;
    }

    headingElement.textContent = course.title || "Untitled course";
    fillCourseForm(course);
    showContent();
    const modules = await loadModules();

    if (modules) {
        setStatus("");
    }
}

editorForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(editorForm);
    const changes = {
        title: String(formData.get("title") || "").trim(),
        subject_area: String(formData.get("subject-area") || "").trim(),
        estimated_length: String(formData.get("estimated-length") || "").trim(),
        description: String(formData.get("description") || "").trim() || null,
    };

    if (!changes.title || !changes.subject_area || !changes.estimated_length) {
        setStatus("Enter a title, subject area, and estimated length before saving.", "error");
        return;
    }

    setStatus("Saving course basics...");

    const { data: course, error } = await supabase
        .from("courses")
        .update(changes)
        .eq("id", courseId)
        .select("title")
        .single();

    if (error) {
        setStatus(error.message, "error");
        return;
    }

    headingElement.textContent = course.title;
    setStatus("Course basics saved.", "success");
});

moduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(moduleForm);
    const moduleId = String(formData.get("module-id") || "");
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const submitButton = moduleForm.querySelector("button[type='submit']");

    if (!title) {
        setStatus("Enter a module title before saving.", "error");
        return;
    }

    if (moduleId) {
        setStatus("Saving module...");
        submitButton.disabled = true;

        const { error } = await supabase
            .from("modules")
            .update({
                title,
                description: description || null,
            })
            .eq("id", moduleId);

        submitButton.disabled = false;

        if (error) {
            setStatus(error.message || "The module could not be saved.", "error");
            return;
        }

        toggleModuleForm(false);
        await loadModules();
        setStatus("Module saved.", "success");
        return;
    }

    const modules = await loadModules();

    if (!modules) {
        return;
    }

    const nextOrder = modules.reduce((highest, module) => Math.max(highest, module.order_index), -1) + 1;
    setStatus("Creating module...");
    submitButton.disabled = true;

    const { error } = await supabase.from("modules").insert({
        course_id: courseId,
        title,
        description: description || null,
        order_index: nextOrder,
    });

    submitButton.disabled = false;

    if (error) {
        setStatus(error.message || "The module could not be created.", "error");
        return;
    }

    toggleModuleForm(false);
    await loadModules();
    setStatus("Module created.", "success");
});

lessonForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(lessonForm);
    const moduleId = String(formData.get("module-id") || "");
    const title = String(formData.get("title") || "").trim();
    const objective = String(formData.get("objective") || "").trim();
    const summary = String(formData.get("summary") || "").trim();
    const estimatedTime = String(formData.get("estimated-time") || "").trim();
    const submitButton = lessonForm.querySelector("button[type='submit']");
    const module = loadedModules.find((currentModule) => currentModule.id === moduleId);

    if (!module || !title) {
        setStatus("Choose a module and enter a lesson title before saving.", "error");
        return;
    }

    const moduleLessons = loadedLessons.filter((lesson) => lesson.module_id === moduleId);
    const nextOrder = moduleLessons.reduce((highest, lesson) => Math.max(highest, lesson.order_index), -1) + 1;
    setStatus("Creating lesson...");
    submitButton.disabled = true;

    const { error } = await supabase.from("lessons").insert({
        module_id: moduleId,
        title,
        objective: objective || null,
        summary: summary || null,
        estimated_time: estimatedTime || null,
        order_index: nextOrder,
    });

    submitButton.disabled = false;

    if (error) {
        setStatus(error.message || "The lesson could not be created.", "error");
        return;
    }

    toggleLessonForm(false);
    await loadModules();
    setStatus("Lesson created.", "success");
});

contentBlockForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(contentBlockForm);
    const lessonId = String(formData.get("lesson-id") || "");
    const title = String(formData.get("title") || "").trim();
    const bodyText = String(formData.get("body-text") || "").trim();
    const submitButton = contentBlockForm.querySelector("button[type='submit']");
    const lesson = loadedLessons.find((currentLesson) => currentLesson.id === lessonId);

    if (!lesson || !title || !bodyText) {
        setStatus("Choose a lesson and enter a title and written content before saving.", "error");
        return;
    }

    const lessonContent = loadedContentBlocks.filter((contentBlock) => contentBlock.lesson_id === lessonId);
    const nextOrder = lessonContent.reduce(
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

    toggleContentBlockForm(false);
    await loadModules();
    setStatus("Text content created.", "success");
});

questionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(questionForm);
    const lessonId = String(formData.get("lesson-id") || "");
    const phase = String(formData.get("phase") || "");
    const prompt = String(formData.get("prompt") || "").trim();
    const studentInstructions = String(formData.get("student-instructions") || "").trim();
    const submitButton = questionForm.querySelector("button[type='submit']");
    const lesson = loadedLessons.find((currentLesson) => currentLesson.id === lessonId);

    if (!lesson || !["before", "during", "reflection"].includes(phase) || !prompt) {
        setStatus("Choose a lesson, phase, and question prompt before saving.", "error");
        return;
    }

    const lessonPhaseQuestions = loadedQuestions.filter(
        (question) => question.lesson_id === lessonId && question.phase === phase
    );
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

    toggleQuestionForm(false);
    await loadModules();
    setStatus("Draft question created.", "success");
});

addModuleButton.addEventListener("click", () => toggleModuleForm(true));
cancelModuleButton.addEventListener("click", () => toggleModuleForm(false));
cancelLessonButton.addEventListener("click", () => toggleLessonForm(false));
cancelContentBlockButton.addEventListener("click", () => toggleContentBlockForm(false));
cancelQuestionButton.addEventListener("click", () => toggleQuestionForm(false));

await initializePage();
