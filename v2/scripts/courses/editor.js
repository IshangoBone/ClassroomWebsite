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
const addModuleButton = qs("[data-toggle-module-form]");
const cancelModuleButton = qs("[data-cancel-module-form]");

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

function toggleModuleForm(isOpen) {
    moduleForm.hidden = !isOpen;
    addModuleButton.hidden = isOpen;

    if (isOpen) {
        moduleForm.elements.title.focus();
    } else {
        moduleForm.reset();
    }
}

function renderModules(modules) {
    if (!modules.length) {
        moduleList.replaceChildren(createElement("p", "empty-state", "No modules have been created yet."));
        return;
    }

    const list = createElement("ol", "module-list");

    modules.forEach((module) => {
        const item = createElement("li", "module-card");
        const content = createElement("div");
        const title = createElement("h3", "course-title", module.title);
        const description = createElement(
            "p",
            "course-muted",
            module.description || "No module description added yet."
        );
        const label = createElement("span", "badge badge--quiet", `Module ${module.order_index + 1}`);
        content.append(title, description);
        item.append(content, label);
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

    renderModules(modules);
    moduleCount.textContent = String(modules.length);
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

async function loadContentCounts() {
    const { count: lessons, error: lessonsError } = await supabase
        .from("lessons")
        .select("*, modules!inner(course_id)", { count: "exact", head: true })
        .eq("modules.course_id", courseId);

    if (lessonsError) {
        lessonCount.textContent = "-";
        return;
    }

    lessonCount.textContent = String(lessons || 0);
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
    const [, modules] = await Promise.all([loadContentCounts(), loadModules()]);

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
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const submitButton = moduleForm.querySelector("button[type='submit']");

    if (!title) {
        setStatus("Enter a module title before saving.", "error");
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

addModuleButton.addEventListener("click", () => toggleModuleForm(true));
cancelModuleButton.addEventListener("click", () => toggleModuleForm(false));

await initializePage();
