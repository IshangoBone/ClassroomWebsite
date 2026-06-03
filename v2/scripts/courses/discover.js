import { supabase } from "../../services/supabase/client.js";
import { loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { createProfileAvatar } from "../utils/profile-images.js";

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

function getJoinPreviewLabel(preview) {
    return preview.classroom_name
        ? `${preview.course_title} / ${preview.classroom_name}`
        : preview.course_title;
}

async function loadCurrentProfile() {
    return loadProtectedProfile({ statusElement });
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

async function joinClassroomWithCode(joinCode, form, expectedCourse) {
    const submitButton = form.querySelector("button[type='submit']");
    const expectedCourseId = String(expectedCourse.course_id || "");

    if (!joinCode) {
        setStatus("Enter a classroom join code.", "error");
        return;
    }

    submitButton.disabled = true;
    setStatus("Checking class code...");

    const { data: previewData, error: previewError } = await supabase.rpc("preview_classroom_join_by_code", {
        join_code_input: joinCode,
    });

    if (previewError) {
        submitButton.disabled = false;
        setStatus(previewError.message || "That class code could not be checked.", "error");
        return;
    }

    const preview = previewData?.[0];

    if (!preview) {
        submitButton.disabled = false;
        setStatus("That class code was not found.", "error");
        return;
    }

    if (String(preview.course_id || "") !== expectedCourseId) {
        submitButton.disabled = false;
        setStatus(
            `That class code belongs to ${preview.course_title || "a different course"}, not ${expectedCourse.title || "this course"}. Choose the matching course card or ask your teacher for the correct code.`,
            "error"
        );
        return;
    }

    if (preview.already_enrolled) {
        form.reset();
        submitButton.disabled = false;
        setStatus(`You are already enrolled in ${getJoinPreviewLabel(preview)}.`, "success");
        return;
    }

    if (!preview.is_joining_open) {
        submitButton.disabled = false;
        setStatus("Joining is closed for this classroom.", "error");
        return;
    }

    const confirmed = window.confirm(`Join ${getJoinPreviewLabel(preview)} with this class code?`);

    if (!confirmed) {
        submitButton.disabled = false;
        setStatus("Join canceled.");
        return;
    }

    setStatus("Joining classroom...");

    const { error } = await supabase.rpc("join_classroom_by_code", {
        join_code_input: joinCode,
    });

    if (error) {
        submitButton.disabled = false;
        setStatus(error.message || "That classroom could not be joined.", "error");
        return;
    }

    form.reset();
    await refreshDiscovery();
    setStatus(`Joined ${getJoinPreviewLabel(preview)}.`, "success");
}

function createCourseCard(course) {
    const card = createElement("article", "course-card");
    const media = createElement("div", "course-card-media");
    const heading = createElement("div", "course-card-header");
    const title = createElement("h3", "course-title", course.title || "Untitled course");
    const badges = createElement("div", "badge-row");
    const details = createElement(
        "p",
        "course-details",
        `${course.subject_area || "General"} | ${course.estimated_length || "Flexible pace"}`
    );
    const teacher = createElement("div", "profile-inline");
    const teacherProfile = {
        profile_photo_url: course.teacher_profile_photo_url,
        avatar_type: course.teacher_avatar_type,
        avatar_key: course.teacher_avatar_key,
        username: course.teacher_name,
    };
    const description = createElement("p", "course-muted", course.description || "No course description has been added yet.");
    const actions = createElement("div", "course-actions");
    const joinPanel = createElement("div", "catalog-join-panel");
    const joinPanelHeading = createElement("h4", "", "How are you joining?");
    const joinPanelCopy = createElement("p", "course-muted", "Use a class code for a teacher classroom, or join independently without a classroom.");
    const classCodeForm = createElement("form", "catalog-class-code-form");
    const codeLabel = createElement("label", "form-field");
    const codeLabelText = createElement("span", "", "Class code");
    const codeInput = document.createElement("input");
    const classCodeButton = createElement("button", "secondary-button", "Join with class code");
    const primaryAction = course.already_enrolled
        ? createElement("a", "primary-button", "Open course")
        : createElement("button", "primary-button", "Join independently");
    const courseId = encodeURIComponent(course.course_id);

    badges.append(
        createElement("span", "badge", "Public"),
        createElement("span", "badge badge--quiet", formatLessonCount(course.lesson_count))
    );

    if (course.has_classroom_access && !course.already_enrolled) {
        badges.append(createElement("span", "badge badge--quiet", "Classroom access"));
    }

    if (course.thumbnail_url) {
        const thumbnail = createElement("img", "course-card-thumbnail");

        thumbnail.src = course.thumbnail_url;
        thumbnail.alt = `${course.title || "Course"} thumbnail`;
        media.append(thumbnail);
    } else {
        media.append(createElement("span", "course-card-thumbnail-fallback", course.subject_area || "Course"));
    }

    teacher.append(
        createProfileAvatar(teacherProfile, "profile-avatar profile-avatar--small", "T"),
        createElement("span", "course-muted", `Teacher: ${course.teacher_name || "Teacher"}`)
    );
    heading.append(title, badges);

    if (course.already_enrolled) {
        primaryAction.href = `student.html?course=${courseId}`;
    } else {
        primaryAction.type = "button";
        primaryAction.addEventListener("click", () => joinCourse(course, primaryAction));
        codeInput.type = "text";
        codeInput.name = "join-code";
        codeInput.autocomplete = "off";
        codeInput.placeholder = "Example: ABC123";
        classCodeButton.type = "submit";
        codeLabel.append(codeLabelText, codeInput);
        classCodeForm.append(codeLabel, classCodeButton);
        classCodeForm.addEventListener("submit", (event) => {
            event.preventDefault();
            const formData = new FormData(classCodeForm);
            const joinCode = String(formData.get("join-code") || "").trim();

            joinClassroomWithCode(joinCode, classCodeForm, course);
        });
        joinPanel.append(joinPanelHeading, joinPanelCopy, classCodeForm);
    }

    actions.append(primaryAction);

    if (course.has_classroom_access && !course.already_enrolled) {
        const accessNote = createElement("p", "course-muted", "You already have classroom access. Join here only if you also want independent course access.");

        card.append(media, heading, details, teacher, description, accessNote, joinPanel, actions);
        return card;
    }

    card.append(media, heading, details, teacher, description);

    if (!course.already_enrolled) {
        card.append(joinPanel);
    }

    card.append(actions);
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
