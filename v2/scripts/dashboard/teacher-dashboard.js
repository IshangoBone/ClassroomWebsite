import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const dashboardStatus = qs("[data-dashboard-status]");
const greetingElement = qs("[data-dashboard-greeting]");
const courseList = qs("[data-course-list]");
const submissionList = qs("[data-submission-list]");
const courseFormPanel = qs("[data-course-form-panel]");
const courseForm = qs("[data-course-form]");
const courseFormToggle = qs("[data-course-form-toggle]");
const courseFormCancel = qs("[data-course-form-cancel]");
const coursesSummary = qs("[data-summary-courses]");
const classroomsSummary = qs("[data-summary-classrooms]");
const submissionsSummary = qs("[data-summary-submissions]");

let currentProfile = null;

function setStatus(message, tone = "info") {
    dashboardStatus.textContent = message;
    dashboardStatus.dataset.tone = tone;
}

function formatStatus(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function setCourseFormVisible(isVisible) {
    courseFormPanel.hidden = !isVisible;
    courseFormToggle.textContent = isVisible ? "Close form" : "New course";

    if (isVisible) {
        courseForm.elements.title.focus();
    }
}

function renderEmpty(container, message) {
    container.replaceChildren(createElement("p", "empty-state", message));
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

    return [...courseMap.values()].sort((first, second) => (
        new Date(second.updated_at) - new Date(first.updated_at)
    ));
}

async function loadManagedClassrooms(profileId, courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data: ownedClassrooms, error: ownedError } = await supabase
        .from("classrooms")
        .select("id, course_id, name, period_block, status")
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
            .select("id, course_id, name, period_block, status")
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

    return [...classroomMap.values()];
}

async function loadRecentSubmissions(courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("lesson_submissions")
        .select("id, course_id, status, submitted_at, updated_at")
        .in("course_id", courseIds)
        .order("updated_at", { ascending: false })
        .limit(5);

    if (error) {
        throw error;
    }

    return data;
}

function renderClassrooms(course, classrooms) {
    const courseClassrooms = classrooms.filter((classroom) => classroom.course_id === course.id);
    const area = createElement("div", "course-classrooms");
    const title = createElement("strong", "course-subheading", "Managed classrooms");
    area.append(title);

    if (!courseClassrooms.length) {
        area.append(createElement("p", "course-muted", "No classrooms you manage in this course yet."));
        return area;
    }

    const list = createElement("ul", "classroom-list");
    courseClassrooms.forEach((classroom) => {
        const label = classroom.period_block
            ? `${classroom.name} - ${classroom.period_block}`
            : classroom.name;
        const item = createElement("li", "classroom-item", label);
        item.append(createElement("span", "badge badge--quiet", formatStatus(classroom.status)));
        list.append(item);
    });
    area.append(list);

    return area;
}

function renderCourses(courses, classrooms) {
    if (!courses.length) {
        renderEmpty(courseList, "You are not teaching any courses yet. Create your first draft course to begin.");
        return;
    }

    const cards = courses.map((course) => {
        const card = createElement("article", "course-card");
        const heading = createElement("div", "course-card-header");
        const name = createElement("h3", "course-title", course.title || "Untitled course");
        const badges = createElement("div", "badge-row");
        badges.append(
            createElement("span", "badge", course.relationship),
            createElement("span", "badge badge--quiet", formatStatus(course.status))
        );
        heading.append(name, badges);

        const details = createElement(
            "p",
            "course-details",
            `${course.subject_area} | ${course.estimated_length}`
        );
        const description = createElement(
            "p",
            "course-muted",
            course.description || "No course description has been added yet."
        );
        const actions = createElement("div", "course-actions");
        const builderAction = createElement("a", "secondary-button", "Manage course");
        const classroomAction = createElement("a", "secondary-button", "Manage classrooms");
        const courseParam = encodeURIComponent(course.id);
        builderAction.href = `../courses/editor.html?course=${courseParam}`;
        classroomAction.href = `../classrooms/manage.html?course=${courseParam}`;
        actions.append(builderAction, classroomAction);

        card.append(heading, details, description, renderClassrooms(course, classrooms), actions);
        return card;
    });

    courseList.replaceChildren(...cards);
}

function renderSubmissions(submissions, courses) {
    if (!submissions.length) {
        renderEmpty(submissionList, "No recent student submissions are available for your managed courses.");
        return;
    }

    const courseNames = new Map(courses.map((course) => [course.id, course.title || "Untitled course"]));
    const list = createElement("ul", "submission-list");

    submissions.forEach((submission) => {
        const item = createElement("li", "submission-item");
        const text = createElement(
            "span",
            "submission-name",
            `${courseNames.get(submission.course_id) || "Course"} submission`
        );
        const status = createElement("span", "badge badge--quiet", formatStatus(submission.status));
        item.append(text, status);
        list.append(item);
    });

    submissionList.replaceChildren(list);
}

async function refreshDashboard() {
    setStatus("Loading your teaching workspace...");

    try {
        const courses = await loadTeachingCourses(currentProfile.id);
        const courseIds = courses.map((course) => course.id);
        const [classrooms, submissions] = await Promise.all([
            loadManagedClassrooms(currentProfile.id, courseIds),
            loadRecentSubmissions(courseIds),
        ]);

        coursesSummary.textContent = String(courses.length);
        classroomsSummary.textContent = String(classrooms.length);
        submissionsSummary.textContent = String(submissions.length);
        renderCourses(courses, classrooms);
        renderSubmissions(submissions, courses);
        setStatus("");
    } catch (error) {
        setStatus(error.message || "Your teaching workspace could not be loaded.", "error");
        renderEmpty(courseList, "Courses could not be loaded right now.");
        renderEmpty(submissionList, "Submissions could not be loaded right now.");
    }
}

async function initializeDashboard() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
        window.location.href = "../auth/login.html";
        return;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, profile_completed")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();

    if (profileError || !profile) {
        setStatus("Your profile could not be loaded. Please sign in again.", "error");
        return;
    }

    if (!profile.profile_completed) {
        window.location.href = "../auth/onboarding.html";
        return;
    }

    currentProfile = profile;
    greetingElement.textContent = `Welcome, ${profile.username || "teacher"}. Manage courses you own or help teach.`;
    courseFormToggle.disabled = false;
    await refreshDashboard();
}

courseFormToggle.addEventListener("click", () => {
    setCourseFormVisible(courseFormPanel.hidden);
});

courseFormCancel.addEventListener("click", () => {
    courseForm.reset();
    setCourseFormVisible(false);
});

courseForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentProfile) {
        setStatus("Your profile must be loaded before creating a course.", "error");
        return;
    }

    const formData = new FormData(courseForm);
    const newCourse = {
        owner_user_id: currentProfile.id,
        title: String(formData.get("title") || "").trim(),
        description: String(formData.get("description") || "").trim() || null,
        subject_area: String(formData.get("subject-area") || "").trim(),
        estimated_length: String(formData.get("estimated-length") || "").trim(),
    };

    if (!newCourse.title || !newCourse.subject_area || !newCourse.estimated_length) {
        setStatus("Enter a title, subject area, and estimated length before creating a course.", "error");
        return;
    }

    setStatus("Creating your draft course...");

    const { error } = await supabase.from("courses").insert(newCourse);

    if (error) {
        setStatus(error.message, "error");
        return;
    }

    courseForm.reset();
    setCourseFormVisible(false);
    await refreshDashboard();
    setStatus("Draft course created.", "success");
});

await initializeDashboard();
