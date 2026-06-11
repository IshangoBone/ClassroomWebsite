import { supabase } from "../../services/supabase/client.js";
import { isTeachingRole, loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { createBadge, setStatusMessage } from "../utils/ui-components.js";

const statusElement = qs("[data-courses-hub-status]");
const summarySection = qs("[data-courses-hub-summary]");
const summaryCourses = qs("[data-summary-courses]");
const summaryClassrooms = qs("[data-summary-classrooms]");
const summaryLessons = qs("[data-summary-lessons]");
const summaryVisibleLessons = qs("[data-summary-visible-lessons]");
const courseList = qs("[data-courses-hub-list]");
const courseFormPanel = qs("[data-course-form-panel]");
const courseFormToggle = qs("[data-course-form-toggle]");
const courseFormCancel = qs("[data-course-form-cancel]");
const courseForm = qs("[data-course-form]");

let currentProfile = null;
let loadedCourses = [];
let loadedClassrooms = [];
let loadedModules = [];
let loadedLessons = [];

function setStatus(message = "", tone = "") {
    setStatusMessage(statusElement, message, tone);
}

function normalizeText(value) {
    return String(value || "").trim();
}

function formatCourseStatus(status) {
    const labels = {
        archived: "Archived",
        deleted: "Deleted",
        draft: "Draft",
        private: "Private",
        published: "Published",
    };

    return labels[status] || "Private";
}

function getCourseClassrooms(courseId) {
    return loadedClassrooms.filter((classroom) => classroom.course_id === courseId);
}

function getCourseModules(courseId) {
    return loadedModules.filter((module) => module.course_id === courseId);
}

function getCourseLessons(courseId) {
    const moduleIds = new Set(getCourseModules(courseId).map((module) => module.id));

    return loadedLessons.filter((lesson) => moduleIds.has(lesson.module_id));
}

function createEmptyState(message) {
    return createElement("p", "empty-state", message);
}

function createCourseMetric(label, value) {
    const item = createElement("article", "teacher-course-metric");
    const valueElement = createElement("strong", "", value);
    const labelElement = createElement("span", "", label);

    item.append(valueElement, labelElement);
    return item;
}

function createCourseCard(course) {
    const classrooms = getCourseClassrooms(course.id);
    const modules = getCourseModules(course.id);
    const lessons = getCourseLessons(course.id);
    const visibleLessons = lessons.filter((lesson) => lesson.is_visible);
    const lockedLessons = lessons.filter((lesson) => lesson.is_locked);
    const card = createElement("article", "teacher-course-card");
    const header = createElement("div", "teacher-course-card-header");
    const copy = createElement("div", "teacher-course-card-copy");
    const titleRow = createElement("div", "teacher-course-title-row");
    const titleGroup = createElement("div", "teacher-course-title-group");
    const title = createElement("h3", "", course.title || "Untitled course");
    const detail = createElement(
        "p",
        "course-details",
        [course.subject_area, course.estimated_length].filter(Boolean).join(" | ") || "Course details not set yet."
    );
    const description = createElement(
        "p",
        "course-muted teacher-course-description",
        course.description || "No course description has been added yet."
    );
    const badges = createElement("div", "badge-row");
    const metrics = createElement("div", "teacher-course-metrics");
    const actions = createElement("div", "teacher-course-actions");
    const openCourseLink = createElement("a", "primary-button", "Open course");
    const lessonHubLink = createElement("a", "secondary-button", "Lesson builder");
    const classesLink = createElement("a", "secondary-button", "Classes");

    badges.append(
        createBadge(course.relationship || "Teacher", { quiet: true }),
        createBadge(formatCourseStatus(course.status), { quiet: course.status !== "published" })
    );

    metrics.append(
        createCourseMetric("classes", String(classrooms.length)),
        createCourseMetric("modules", String(modules.length)),
        createCourseMetric("lessons", String(lessons.length)),
        createCourseMetric("visible", String(visibleLessons.length)),
        createCourseMetric("locked", String(lockedLessons.length))
    );

    openCourseLink.href = `editor.html?course=${course.id}`;
    lessonHubLink.href = `../lessons/index.html?course=${course.id}`;
    classesLink.href = `../classrooms/manage.html?course=${course.id}`;

    titleGroup.append(title, detail);
    titleRow.append(titleGroup, badges);
    actions.append(openCourseLink, lessonHubLink, classesLink);
    copy.append(titleRow, description);
    header.append(copy, actions);
    card.append(header, metrics);

    return card;
}

function updateSummary() {
    const visibleLessons = loadedLessons.filter((lesson) => lesson.is_visible);

    summaryCourses.textContent = String(loadedCourses.length);
    summaryClassrooms.textContent = String(loadedClassrooms.length);
    summaryLessons.textContent = String(loadedLessons.length);
    summaryVisibleLessons.textContent = String(visibleLessons.length);
    summarySection.hidden = false;
}

function renderCourses() {
    if (!loadedCourses.length) {
        courseList.replaceChildren(createEmptyState("No taught courses are available yet. Create your first draft course to begin."));
        return;
    }

    const fragment = document.createDocumentFragment();
    loadedCourses.forEach((course) => fragment.append(createCourseCard(course)));
    courseList.replaceChildren(fragment);
}

async function loadTeachingCourses(profileId) {
    const { data: ownedCourses, error: ownedError } = await supabase
        .from("courses")
        .select("id, title, description, subject_area, estimated_length, status, updated_at")
        .eq("owner_user_id", profileId)
        .neq("status", "deleted")
        .order("updated_at", { ascending: false });

    if (ownedError) {
        throw ownedError;
    }

    const { data: collaboratorRows, error: collaboratorError } = await supabase
        .from("course_collaborators")
        .select("course_id, permission_level")
        .eq("user_id", profileId)
        .in("permission_level", ["teacher", "editor", "co_owner"]);

    if (collaboratorError) {
        throw collaboratorError;
    }

    const collaborativeCourseIds = collaboratorRows.map((row) => row.course_id);
    let collaborativeCourses = [];

    if (collaborativeCourseIds.length) {
        const { data, error } = await supabase
            .from("courses")
            .select("id, title, description, subject_area, estimated_length, status, updated_at")
            .in("id", collaborativeCourseIds)
            .neq("status", "deleted");

        if (error) {
            throw error;
        }

        collaborativeCourses = data;
    }

    const courseMap = new Map();

    ownedCourses.forEach((course) => courseMap.set(course.id, { ...course, relationship: "Owner" }));
    collaborativeCourses.forEach((course) => {
        if (!courseMap.has(course.id)) {
            courseMap.set(course.id, { ...course, relationship: "Collaborator" });
        }
    });

    return [...courseMap.values()].sort((first, second) => new Date(second.updated_at) - new Date(first.updated_at));
}

async function loadManagedClassrooms(profileId, courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data: ownedClassrooms, error: ownedError } = await supabase
        .from("classrooms")
        .select("id, course_id, name, period_block, status, join_code, display_order")
        .eq("owner_teacher_id", profileId)
        .in("course_id", courseIds)
        .neq("status", "deleted");

    if (ownedError) {
        throw ownedError;
    }

    const { data: teacherAssignments, error: assignmentError } = await supabase
        .from("classroom_teachers")
        .select("classroom_id")
        .eq("user_id", profileId);

    if (assignmentError) {
        throw assignmentError;
    }

    const assignedClassroomIds = teacherAssignments.map((assignment) => assignment.classroom_id);
    let assignedClassrooms = [];

    if (assignedClassroomIds.length) {
        const { data, error } = await supabase
            .from("classrooms")
            .select("id, course_id, name, period_block, status, join_code, display_order")
            .in("id", assignedClassroomIds)
            .in("course_id", courseIds)
            .neq("status", "deleted");

        if (error) {
            throw error;
        }

        assignedClassrooms = data;
    }

    const classroomMap = new Map();
    [...ownedClassrooms, ...assignedClassrooms].forEach((classroom) => classroomMap.set(classroom.id, classroom));

    return [...classroomMap.values()].sort((first, second) => (first.display_order || 0) - (second.display_order || 0));
}

async function loadModules(courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("modules")
        .select("id, course_id")
        .in("course_id", courseIds)
        .is("archived_at", null);

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
        .select("id, module_id, is_visible, is_locked")
        .in("module_id", moduleIds)
        .is("archived_at", null);

    if (error) {
        throw error;
    }

    return data;
}

async function refreshCourses({ quiet = false } = {}) {
    if (!quiet) {
        setStatus("Loading your taught courses...");
    }

    loadedCourses = await loadTeachingCourses(currentProfile.id);
    loadedClassrooms = await loadManagedClassrooms(currentProfile.id, loadedCourses.map((course) => course.id));
    loadedModules = await loadModules(loadedCourses.map((course) => course.id));
    loadedLessons = await loadLessons(loadedModules.map((module) => module.id));

    updateSummary();
    renderCourses();
    setStatus(loadedCourses.length ? "" : "Create a draft course to begin.", loadedCourses.length ? "" : "warning");
}

function toggleCourseForm(show) {
    courseFormPanel.hidden = !show;

    if (show) {
        courseForm.elements.title.focus();
    }
}

async function handleCreateCourse(event) {
    event.preventDefault();

    const formData = new FormData(courseForm);
    const payload = {
        owner_user_id: currentProfile.id,
        title: normalizeText(formData.get("title")),
        subject_area: normalizeText(formData.get("subject-area")),
        estimated_length: normalizeText(formData.get("estimated-length")),
        description: normalizeText(formData.get("description")),
        status: "draft",
        is_publicly_discoverable: false,
    };

    if (!payload.title || !payload.subject_area || !payload.estimated_length) {
        setStatus("Course title, subject area, and estimated length are required.", "error");
        return;
    }

    const submitButton = courseForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    setStatus("Creating draft course...");

    const { data, error } = await supabase
        .from("courses")
        .insert(payload)
        .select("id")
        .single();

    submitButton.disabled = false;

    if (error) {
        setStatus(error.message || "Course could not be created.", "error");
        return;
    }

    courseForm.reset();
    toggleCourseForm(false);
    await refreshCourses({ quiet: true });
    setStatus("Draft course created. Opening course editor...", "success");

    window.location.href = `editor.html?course=${data.id}`;
}

async function init() {
    currentProfile = await loadProtectedProfile({
        loginPath: "../auth/login.html",
        onboardingPath: "../auth/onboarding.html",
        profileColumns: "id, profile_completed, platform_role, account_status",
        statusElement,
    });

    if (!currentProfile) {
        return;
    }

    if (!isTeachingRole(currentProfile.platform_role)) {
        setStatus("Teacher access is required before My Courses is available.", "error");
        courseList.replaceChildren(createEmptyState("Ask an admin to promote your account to teacher before creating or managing courses."));
        return;
    }

    try {
        await refreshCourses();
    } catch (error) {
        console.error(error);
        setStatus(error.message || "Your taught courses could not be loaded.", "error");
        courseList.replaceChildren(createEmptyState("Your taught courses could not be loaded."));
    }
}

courseFormToggle?.addEventListener("click", () => {
    toggleCourseForm(courseFormPanel.hidden);
});

courseFormCancel?.addEventListener("click", () => {
    courseForm.reset();
    toggleCourseForm(false);
});

courseForm?.addEventListener("submit", handleCreateCourse);

init();
