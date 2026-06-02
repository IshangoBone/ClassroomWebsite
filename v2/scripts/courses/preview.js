import { supabase } from "../../services/supabase/client.js";
import { loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";

const params = new URLSearchParams(window.location.search);
const courseId = params.get("course");
const editorLink = qs("[data-course-editor-link]");
const headingElement = qs("[data-preview-heading]");
const contextElement = qs("[data-preview-context]");
const statusElement = qs("[data-preview-status]");
const shellElement = qs("[data-preview-shell]");
const visibilityElement = qs("[data-preview-visibility]");
const moduleCountElement = qs("[data-preview-module-count]");
const lessonCountElement = qs("[data-preview-lesson-count]");
const contentCountElement = qs("[data-preview-content-count]");
const questionCountElement = qs("[data-preview-question-count]");
const moduleListElement = qs("[data-preview-module-list]");

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function formatCourseStatus(status) {
    const labels = {
        archived: "Archived",
        deleted: "Deleted",
        draft: "Draft",
        private: "Private",
        published: "Public",
    };

    return labels[status] || "Private";
}

async function loadCurrentProfile() {
    return loadProtectedProfile({ statusElement });
}

async function confirmCourseAccess() {
    if (!courseId) {
        setStatus("Open a course from course management before previewing it.", "error");
        return null;
    }

    const { data: canManage, error } = await supabase.rpc("can_manage_course", {
        course_to_check: courseId,
    });

    if (error || !canManage) {
        setStatus("You do not have permission to preview this course as a teacher.", "error");
        return null;
    }

    const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id, title, description, subject_area, estimated_length, status")
        .eq("id", courseId)
        .single();

    if (courseError) {
        setStatus("This course could not be loaded.", "error");
        return null;
    }

    return course;
}

async function loadModules() {
    const { data, error } = await supabase
        .from("modules")
        .select("id, title, description, order_index")
        .eq("course_id", courseId)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        throw error;
    }

    return data;
}

async function loadLessons(moduleIds) {
    if (!moduleIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("lessons")
        .select("id, module_id, title, objective, summary, estimated_time, order_index")
        .in("module_id", moduleIds)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        throw error;
    }

    return data;
}

async function loadVisibleContent(lessonIds) {
    if (!lessonIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("lesson_content_blocks")
        .select("id, lesson_id, block_type, title, is_visible")
        .in("lesson_id", lessonIds)
        .is("archived_at", null)
        .eq("is_visible", true);

    if (error) {
        throw error;
    }

    return data;
}

async function loadVisibleQuestions(lessonIds) {
    if (!lessonIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("questions")
        .select("id, lesson_id, phase, is_visible")
        .in("lesson_id", lessonIds)
        .is("archived_at", null)
        .eq("is_visible", true);

    if (error) {
        throw error;
    }

    return data;
}

function createLessonCard(lesson, contentBlocks, questions) {
    const item = createElement("li", "lesson-card");
    const header = createElement("div", "lesson-card-header");
    const content = createElement("div");
    const title = createElement("h5", "lesson-title", lesson.title || "Untitled lesson");
    const summary = createElement("p", "course-muted", lesson.summary || lesson.objective || "No student-facing overview added yet.");
    const metaRow = createElement("div", "badge-row lesson-meta-row");
    const actions = createElement("div", "lesson-header-actions");
    const lessonContent = contentBlocks.filter((contentBlock) => contentBlock.lesson_id === lesson.id);
    const lessonQuestions = questions.filter((question) => question.lesson_id === lesson.id);
    const contentText = lessonContent.length === 1 ? "1 visible content block" : `${lessonContent.length} visible content blocks`;
    const questionText = lessonQuestions.length === 1 ? "1 visible question" : `${lessonQuestions.length} visible questions`;
    const timeText = lesson.estimated_time ? lesson.estimated_time : "No time estimate";
    const previewLink = createElement("a", "secondary-button lesson-action", "Preview lesson");

    const previewParams = new URLSearchParams({
        lesson: lesson.id,
        preview: "teacher",
        course: courseId,
    });

    previewLink.href = `../lessons/view.html?${previewParams.toString()}`;
    metaRow.append(
        createElement("span", "badge badge--quiet", `Lesson ${lesson.order_index + 1}`),
        createElement("span", "badge badge--quiet", timeText),
        createElement("span", "badge badge--quiet", contentText),
        createElement("span", "badge badge--quiet", questionText)
    );
    content.append(title, summary, metaRow);
    actions.append(previewLink);
    header.append(content, actions);
    item.append(header);
    return item;
}

function renderModules(modules, lessons, contentBlocks, questions) {
    if (!modules.length) {
        moduleListElement.replaceChildren(createElement("p", "empty-state", "No modules have been created for this course yet."));
        return;
    }

    const list = createElement("ol", "module-list");

    modules.forEach((module) => {
        const item = createElement("li", "module-card");
        const header = createElement("div", "module-card-header");
        const content = createElement("div");
        const title = createElement("h3", "course-title", module.title || "Untitled module");
        const description = createElement("p", "course-muted", module.description || "No module description added yet.");
        const label = createElement("span", "badge badge--quiet", `Module ${module.order_index + 1}`);
        const lessonSection = createElement("section", "module-lessons");
        const lessonHeader = createElement("div", "module-lessons-header");
        const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id);

        content.append(title, description);
        header.append(content, label);
        lessonHeader.append(createElement("h4", "", "Lessons"));
        lessonSection.append(lessonHeader);

        if (moduleLessons.length) {
            const lessonList = createElement("ol", "lesson-list");

            moduleLessons.forEach((lesson) => {
                lessonList.append(createLessonCard(lesson, contentBlocks, questions));
            });
            lessonSection.append(lessonList);
        } else {
            lessonSection.append(createElement("p", "empty-state empty-state--compact", "No lessons in this module yet."));
        }

        item.append(header, lessonSection);
        list.append(item);
    });

    moduleListElement.replaceChildren(list);
}

async function initializePage() {
    setStatus("Loading course preview...");

    const profile = await loadCurrentProfile();

    if (!profile) {
        return;
    }

    const course = await confirmCourseAccess();

    if (!course) {
        headingElement.textContent = "Course preview unavailable";
        return;
    }

    try {
        editorLink.href = `editor.html?course=${encodeURIComponent(course.id)}`;
        editorLink.textContent = "Back to course editor";
        headingElement.textContent = course.title || "Untitled course";
        contextElement.textContent = course.description || "No course description has been added yet.";
        visibilityElement.textContent = `${formatCourseStatus(course.status)} preview`;

        const modules = await loadModules();
        const lessons = await loadLessons(modules.map((module) => module.id));
        const lessonIds = lessons.map((lesson) => lesson.id);
        const [contentBlocks, questions] = await Promise.all([
            loadVisibleContent(lessonIds),
            loadVisibleQuestions(lessonIds),
        ]);

        moduleCountElement.textContent = String(modules.length);
        lessonCountElement.textContent = String(lessons.length);
        contentCountElement.textContent = String(contentBlocks.length);
        questionCountElement.textContent = String(questions.length);
        renderModules(modules, lessons, contentBlocks, questions);
        shellElement.hidden = false;
        setStatus("");
    } catch (error) {
        setStatus(error.message || "Course preview could not be loaded.", "error");
    }
}

await initializePage();
