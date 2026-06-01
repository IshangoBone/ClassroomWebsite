import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const statusElement = qs("[data-discovery-status]");
const shellElements = [...document.querySelectorAll("[data-discovery-shell]")];
const searchForm = qs("[data-discovery-search-form]");
const courseListElement = qs("[data-discovery-course-list]");
const discoveryParams = new URLSearchParams(window.location.search);

let currentProfileId = "";
let searchText = discoveryParams.get("q")?.trim() || "";

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function formatLessonCount(count) {
    const lessonCount = Number(count || 0);

    return lessonCount === 1 ? "1 lesson" : `${lessonCount} lessons`;
}

function renderEmpty(message) {
    courseListElement.replaceChildren(createElement("p", "empty-state", message));
}

function getDiscoveryErrorMessage(error) {
    const message = error?.message || "";

    if (message.toLowerCase().includes("discover_public_courses")) {
        return "Public course discovery needs the latest Supabase migration before courses can be listed.";
    }

    return message || "Public courses could not be loaded.";
}

async function loadCurrentProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
        window.location.href = "../auth/login.html";
        return null;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, profile_completed")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();

    if (profileError || !profile) {
        setStatus("Your profile could not be loaded. Please sign in again.", "error");
        return null;
    }

    if (!profile.profile_completed) {
        window.location.href = "../auth/onboarding.html";
        return null;
    }

    return profile;
}

async function loadPublicCourses() {
    const { data, error } = await supabase.rpc("discover_public_courses", {
        search_text: searchText || null,
    });

    if (error) {
        throw error;
    }

    return data || [];
}

function createCourseCard(course) {
    const card = createElement("article", "course-card");
    const heading = createElement("div", "course-card-header");
    const title = createElement("h3", "course-title", course.title || "Untitled course");
    const badges = createElement("div", "badge-row");
    const details = createElement(
        "p",
        "course-details",
        `${course.subject_area || "General"} | ${course.estimated_length || "Flexible pace"}`
    );
    const teacher = createElement("p", "course-muted", `Teacher: ${course.teacher_name || "Teacher"}`);
    const description = createElement("p", "course-muted", course.description || "No course description has been added yet.");
    const actions = createElement("div", "course-actions");
    const primaryAction = course.already_enrolled
        ? createElement("a", "primary-button", "Open course")
        : createElement("button", "primary-button", "Join course");
    const courseId = encodeURIComponent(course.course_id);

    badges.append(
        createElement("span", "badge", "Public"),
        createElement("span", "badge badge--quiet", formatLessonCount(course.lesson_count))
    );

    if (course.has_classroom_access && !course.already_enrolled) {
        badges.append(createElement("span", "badge badge--quiet", "Classroom access"));
    }

    heading.append(title, badges);

    if (course.already_enrolled) {
        primaryAction.href = `student.html?course=${courseId}`;
    } else {
        primaryAction.type = "button";
        primaryAction.textContent = course.has_classroom_access ? "Join independent course" : "Join course";
        primaryAction.addEventListener("click", () => joinCourse(course, primaryAction));
    }

    actions.append(primaryAction);

    if (course.has_classroom_access && !course.already_enrolled) {
        const accessNote = createElement("p", "course-muted", "You already have classroom access. Join here only if you also want independent course access.");

        card.append(heading, details, teacher, description, accessNote, actions);
        return card;
    }

    card.append(heading, details, teacher, description, actions);
    return card;
}

function renderCourses(courses) {
    if (!courses.length) {
        renderEmpty(searchText ? "No public courses match that search yet." : "No public courses are available yet.");
        return;
    }

    courseListElement.replaceChildren(...courses.map(createCourseCard));
}

async function refreshDiscovery() {
    setStatus("Loading public courses...");

    try {
        const courses = await loadPublicCourses();

        renderCourses(courses);
        setStatus("");
    } catch (error) {
        setStatus(getDiscoveryErrorMessage(error), "error");
        renderEmpty("Public courses could not be loaded right now.");
    }
}

async function joinCourse(course, button) {
    const confirmed = window.confirm(
        course.has_classroom_access
            ? `Join ${course.title || "this public course"} as an independent course too?`
            : `Join ${course.title || "this public course"}?`
    );

    if (!confirmed) {
        return;
    }

    button.disabled = true;
    setStatus("Joining course...");

    const { error } = await supabase.rpc("join_public_course", {
        course_id_input: course.course_id,
    });

    if (error) {
        button.disabled = false;
        setStatus(error.message || "This public course could not be joined.", "error");
        return;
    }

    await refreshDiscovery();
    setStatus("Course joined.", "success");
}

async function initializePage() {
    const profile = await loadCurrentProfile();

    if (!profile) {
        return;
    }

    currentProfileId = profile.id;
    searchForm.elements.search.value = searchText;
    shellElements.forEach((element) => {
        element.hidden = false;
    });
    await refreshDiscovery();
}

searchForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(searchForm);

    searchText = String(formData.get("search") || "").trim();
    const nextUrl = new URL(window.location.href);

    if (searchText) {
        nextUrl.searchParams.set("q", searchText);
    } else {
        nextUrl.searchParams.delete("q");
    }

    window.history.replaceState({}, "", nextUrl);
    await refreshDiscovery();
});

await initializePage();
