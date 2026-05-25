import { supabase } from "../../services/supabase/client.js";
import { qs } from "../utils/dom.js";

const params = new URLSearchParams(window.location.search);
const courseId = params.get("course");
const headingElement = qs("[data-course-heading]");
const statusElement = qs("[data-course-status]");
const contentSections = [...document.querySelectorAll("[data-course-content]")];
const editorForm = qs("[data-course-editor-form]");
const moduleCount = qs("[data-module-count]");
const lessonCount = qs("[data-lesson-count]");

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
    const [{ count: modules, error: modulesError }, { count: lessons, error: lessonsError }] = await Promise.all([
        supabase.from("modules").select("*", { count: "exact", head: true }).eq("course_id", courseId),
        supabase.from("lessons").select("*, modules!inner(course_id)", { count: "exact", head: true })
            .eq("modules.course_id", courseId),
    ]);

    if (modulesError || lessonsError) {
        moduleCount.textContent = "-";
        lessonCount.textContent = "-";
        return;
    }

    moduleCount.textContent = String(modules || 0);
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
    await loadContentCounts();
    setStatus("");
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

await initializePage();
