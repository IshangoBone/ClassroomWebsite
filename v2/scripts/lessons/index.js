import { supabase } from "../../services/supabase/client.js";
import { isTeachingRole, loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { getLessonOverview } from "../utils/lesson-metadata.js";
import { createBadge, setStatusMessage } from "../utils/ui-components.js";

const statusElement = qs("[data-builder-hub-status]");
const hubSection = qs("[data-builder-hub]");
const courseList = qs("[data-builder-hub-course-list]");
const searchInput = qs("[data-builder-hub-search]");
const courseFilter = qs("[data-builder-hub-course-filter]");
const statusFilter = qs("[data-builder-hub-status-filter]");
const summaryCourses = qs("[data-summary-courses]");
const summaryModules = qs("[data-summary-modules]");
const summaryLessons = qs("[data-summary-lessons]");
const summaryVisible = qs("[data-summary-visible]");
const hubParams = new URLSearchParams(window.location.search);

let loadedCourses = [];
let loadedModules = [];
let loadedLessons = [];
let loadedContentBlocks = [];
let loadedQuestions = [];

function setStatus(message = "", tone = "") {
    setStatusMessage(statusElement, message, tone);
}

function normalize(value) {
    return String(value || "").trim().toLowerCase();
}

function countBy(items, key) {
    return items.reduce((map, item) => {
        const value = item[key];
        map.set(value, (map.get(value) || 0) + 1);
        return map;
    }, new Map());
}

function getLessonNumber(lesson) {
    return Number.isFinite(lesson.order_index) ? lesson.order_index + 1 : 1;
}

function getFilters() {
    return {
        search: normalize(searchInput?.value),
        courseId: courseFilter?.value || "",
        status: statusFilter?.value || "",
    };
}

function lessonMatchesStatus(lesson, status) {
    if (!status) {
        return true;
    }

    if (status === "visible") {
        return lesson.is_visible;
    }

    if (status === "hidden") {
        return !lesson.is_visible;
    }

    if (status === "locked") {
        return lesson.is_locked;
    }

    return true;
}

function lessonMatchesSearch(course, module, lesson, searchTerm) {
    if (!searchTerm) {
        return true;
    }

    const haystack = [
        course.title,
        course.subject_area,
        module.title,
        module.description,
        lesson.title,
        lesson.objective,
        getLessonOverview(lesson),
    ].map(normalize).join(" ");

    return haystack.includes(searchTerm);
}

function buildCourseFilterOptions() {
    const selectedValue = courseFilter.value;
    const requestedCourseId = hubParams.get("course");

    courseFilter.replaceChildren(createElement("option", "", "All taught courses"));
    courseFilter.firstElementChild.value = "";

    loadedCourses.forEach((course) => {
        const option = createElement("option", "", course.title || "Untitled course");
        option.value = course.id;
        courseFilter.append(option);
    });

    if (requestedCourseId && loadedCourses.some((course) => course.id === requestedCourseId)) {
        courseFilter.value = requestedCourseId;
        return;
    }

    courseFilter.value = selectedValue;
}

function updateSummary() {
    const visibleLessons = loadedLessons.filter((lesson) => lesson.is_visible);

    summaryCourses.textContent = String(loadedCourses.length);
    summaryModules.textContent = String(loadedModules.length);
    summaryLessons.textContent = String(loadedLessons.length);
    summaryVisible.textContent = String(visibleLessons.length);
}

function createEmptyState(message) {
    return createElement("p", "empty-state", message);
}

function createLessonCard(course, module, lesson, contentCount, questionCount) {
    const card = createElement("article", "lesson-hub-lesson-card");
    const copy = createElement("div", "lesson-hub-lesson-copy");
    const title = createElement("h4", "", lesson.title || "Untitled lesson");
    const description = createElement(
        "p",
        "",
        getLessonOverview(lesson) || lesson.objective || "No overview has been added yet."
    );
    const meta = createElement("div", "lesson-hub-lesson-meta");
    const actions = createElement("div", "lesson-hub-lesson-actions");
    const builderLink = createElement("a", "primary-button lesson-hub-action", "Open builder");
    const previewLink = createElement("a", "secondary-button lesson-hub-action", "View student page");

    builderLink.href = `builder.html?lesson=${lesson.id}`;
    previewLink.href = `view.html?lesson=${lesson.id}&preview=teacher&course=${course.id}`;

    meta.append(
        createBadge(`Lesson ${getLessonNumber(lesson)}`, { quiet: true }),
        createBadge(`${lesson.estimated_time || 20} minutes`, { quiet: true }),
        createBadge(lesson.is_visible ? "Visible" : "Hidden", { quiet: !lesson.is_visible }),
        createBadge(lesson.is_locked ? "Locked" : "Unlocked", { quiet: !lesson.is_locked }),
        createBadge(`${contentCount} content ${contentCount === 1 ? "block" : "blocks"}`, { quiet: true }),
        createBadge(`${questionCount} ${questionCount === 1 ? "question" : "questions"}`, { quiet: true })
    );

    copy.append(title, description, meta);
    actions.append(builderLink, previewLink);
    card.append(copy, actions);

    return card;
}

function createModuleSection(course, module, moduleLessons, counts) {
    const section = createElement("section", "lesson-hub-module");
    const header = createElement("div", "lesson-hub-module-header");
    const titleGroup = createElement("div", "lesson-hub-module-title");
    const title = createElement("h3", "", module.title || "Untitled module");
    const description = createElement("p", "", module.description || "No module description has been added yet.");
    const countBadge = createBadge(`${moduleLessons.length} ${moduleLessons.length === 1 ? "lesson" : "lessons"}`, { quiet: true });
    const lessonList = createElement("div", "lesson-hub-lesson-list");

    titleGroup.append(title, description);
    header.append(titleGroup, countBadge);

    moduleLessons.forEach((lesson) => {
        lessonList.append(createLessonCard(
            course,
            module,
            lesson,
            counts.content.get(lesson.id) || 0,
            counts.questions.get(lesson.id) || 0
        ));
    });

    section.append(header, lessonList);
    return section;
}

function renderCourses() {
    const filters = getFilters();
    const counts = {
        content: countBy(loadedContentBlocks, "lesson_id"),
        questions: countBy(loadedQuestions, "lesson_id"),
    };
    const coursesToRender = loadedCourses
        .filter((course) => !filters.courseId || course.id === filters.courseId)
        .map((course) => {
            const modules = loadedModules.filter((module) => module.course_id === course.id);
            const modulePayload = modules.map((module) => {
                const lessons = loadedLessons
                    .filter((lesson) => lesson.module_id === module.id)
                    .filter((lesson) => lessonMatchesStatus(lesson, filters.status))
                    .filter((lesson) => lessonMatchesSearch(course, module, lesson, filters.search));

                return { module, lessons };
            }).filter((payload) => payload.lessons.length);

            return { course, modulePayload };
        })
        .filter((payload) => payload.modulePayload.length);

    if (!coursesToRender.length) {
        courseList.replaceChildren(createEmptyState("No taught lessons match those filters yet."));
        return;
    }

    const fragment = document.createDocumentFragment();

    coursesToRender.forEach(({ course, modulePayload }) => {
        const card = createElement("article", "lesson-hub-course-card");
        const header = createElement("div", "lesson-hub-course-header");
        const copy = createElement("div", "lesson-hub-course-copy");
        const title = createElement("h2", "", course.title || "Untitled course");
        const description = createElement("p", "", course.description || "No course description has been added yet.");
        const meta = createElement("div", "lesson-hub-course-meta");
        const moduleList = createElement("div", "lesson-hub-module-list");
        const lessonTotal = modulePayload.reduce((total, payload) => total + payload.lessons.length, 0);

        meta.append(
            createBadge(course.relationship || "Teacher", { quiet: true }),
            createBadge(course.status || "draft", { quiet: true }),
            createBadge(`${modulePayload.length} ${modulePayload.length === 1 ? "module" : "modules"}`, { quiet: true }),
            createBadge(`${lessonTotal} ${lessonTotal === 1 ? "lesson" : "lessons"}`, { quiet: true })
        );

        copy.append(title, description, meta);
        header.append(copy);
        card.append(header);

        modulePayload.forEach((payload) => {
            moduleList.append(createModuleSection(course, payload.module, payload.lessons, counts));
        });

        card.append(moduleList);
        fragment.append(card);
    });

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

async function loadModules(courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("modules")
        .select("id, course_id, title, description, order_index")
        .in("course_id", courseIds)
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
        .select("id, module_id, title, objective, summary, estimated_time, order_index, is_visible, is_locked")
        .in("module_id", moduleIds)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        throw error;
    }

    return data;
}

async function loadLessonCounts(lessonIds) {
    if (!lessonIds.length) {
        return { contentBlocks: [], questions: [] };
    }

    const [{ data: contentBlocks, error: contentError }, { data: questions, error: questionError }] = await Promise.all([
        supabase
            .from("lesson_content_blocks")
            .select("id, lesson_id")
            .in("lesson_id", lessonIds)
            .is("archived_at", null),
        supabase
            .from("questions")
            .select("id, lesson_id")
            .in("lesson_id", lessonIds)
            .is("archived_at", null),
    ]);

    if (contentError) {
        throw contentError;
    }

    if (questionError) {
        throw questionError;
    }

    return {
        contentBlocks,
        questions,
    };
}

async function init() {
    setStatus("Loading lesson builder workspace...");

    const profile = await loadProtectedProfile({
        loginPath: "../auth/login.html",
        onboardingPath: "../auth/onboarding.html",
        profileColumns: "id, profile_completed, platform_role, account_status",
        statusElement,
    });

    if (!profile) {
        return;
    }

    if (!isTeachingRole(profile.platform_role)) {
        setStatus("Teacher access is required before the lesson builder hub is available.", "error");
        courseList.replaceChildren(createEmptyState("Ask an admin to promote your account to teacher before building lessons."));
        return;
    }

    try {
        loadedCourses = await loadTeachingCourses(profile.id);
        loadedModules = await loadModules(loadedCourses.map((course) => course.id));
        loadedLessons = await loadLessons(loadedModules.map((module) => module.id));

        const counts = await loadLessonCounts(loadedLessons.map((lesson) => lesson.id));
        loadedContentBlocks = counts.contentBlocks;
        loadedQuestions = counts.questions;

        buildCourseFilterOptions();
        updateSummary();
        hubSection.hidden = false;
        setStatus(loadedLessons.length ? "Lesson builder workspace loaded." : "No taught lessons are ready yet.", loadedLessons.length ? "success" : "warning");
        renderCourses();
    } catch (error) {
        console.error(error);
        hubSection.hidden = false;
        courseList.replaceChildren(createEmptyState("Lesson builder workspace could not be loaded."));
        setStatus(error.message || "Lesson builder workspace could not be loaded.", "error");
    }
}

[searchInput, courseFilter, statusFilter].forEach((control) => {
    control?.addEventListener("input", renderCourses);
    control?.addEventListener("change", renderCourses);
});

init();
