import { supabase } from "../../services/supabase/client.js";
import { loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { createProfileAvatar, getProfileDisplayName } from "../utils/profile-images.js";
import { notifyStatus } from "../utils/ui-components.js";

const statusElement = qs("[data-profile-status]");
const avatarElement = qs("[data-profile-avatar]");
const nameElement = qs("[data-profile-name]");
const usernameElement = qs("[data-profile-username]");
const introElement = qs("[data-profile-intro]");
const badgesElement = qs("[data-profile-badges]");
const detailsElement = qs("[data-profile-details]");
const enrolledCountElement = qs("[data-profile-enrolled-count]");
const submittedCountElement = qs("[data-profile-submitted-count]");
const pointsCountElement = qs("[data-profile-points-count]");
const teachingCountElement = qs("[data-profile-teaching-count]");
const activityListElement = qs("[data-profile-activity-list]");
const learningListElement = qs("[data-profile-learning-list]");
const teachingSection = qs("[data-profile-teaching-section]");
const teachingListElement = qs("[data-profile-teaching-list]");

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
    notifyStatus(message, tone);
}

function formatStatus(status) {
    return String(status || "active")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
    if (!value) {
        return "Not available";
    }

    return new Date(value).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function formatDateTime(value) {
    if (!value) {
        return "In progress";
    }

    return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function getRoleLabel(profile, teachingCount) {
    if (profile.platform_role === "supreme_admin") {
        return "Supreme admin";
    }

    if (profile.platform_role === "admin") {
        return "Admin";
    }

    return teachingCount ? "Teacher" : "Student";
}

function renderEmpty(target, message) {
    target.replaceChildren(createElement("p", "empty-state", message));
}

function renderProfileHeader(profile, teachingCount) {
    const displayName = getProfileDisplayName(profile, "User");
    const roleLabel = getRoleLabel(profile, teachingCount);

    avatarElement.replaceChildren(createProfileAvatar(profile, "profile-avatar profile-avatar--hero", "U"));
    nameElement.textContent = displayName;
    usernameElement.textContent = profile.username ? `@${profile.username}` : profile.email || "No username yet";
    introElement.textContent = teachingCount
        ? "Your learning, teaching, and platform work all live here in one profile view."
        : "Your courses, classroom progress, and lesson submissions live here in one profile view.";
    badgesElement.replaceChildren(
        createElement("span", "badge", roleLabel),
        createElement("span", "badge badge--quiet", formatStatus(profile.account_status))
    );
}

function renderDetails(profile, teachingCount) {
    const rows = [
        ["Display name", getProfileDisplayName(profile, "User")],
        ["Username", profile.username ? `@${profile.username}` : "Not set"],
        ["Email", profile.email || "Not available"],
        ["Role", getRoleLabel(profile, teachingCount)],
        ["Joined", formatDate(profile.created_at)],
        ["Last updated", formatDate(profile.updated_at)],
    ];

    detailsElement.replaceChildren(...rows.map(([label, value]) => {
        const row = createElement("div", "profile-detail-row");
        row.append(
            createElement("dt", "profile-detail-label", label),
            createElement("dd", "profile-detail-value", value)
        );
        return row;
    }));
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

async function loadStudentEnrollments(profileId) {
    const { data, error } = await supabase
        .from("enrollments")
        .select("id, course_id, classroom_id, enrollment_type, enrollment_status, joined_at")
        .eq("user_id", profileId)
        .neq("enrollment_status", "removed")
        .order("joined_at", { ascending: false });

    if (error) {
        throw error;
    }

    return data;
}

async function loadVisibleCourses(courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("courses")
        .select("id, title, description, subject_area, estimated_length, status")
        .in("id", courseIds)
        .neq("status", "deleted");

    if (error) {
        throw error;
    }

    return data;
}

async function loadVisibleClassrooms(classroomIds) {
    if (!classroomIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("classrooms")
        .select("id, course_id, name, period_block, status")
        .in("id", classroomIds)
        .neq("status", "deleted");

    if (error) {
        throw error;
    }

    return data;
}

async function loadLessons(courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data: modules, error: moduleError } = await supabase
        .from("modules")
        .select("id, course_id")
        .in("course_id", courseIds)
        .is("archived_at", null);

    if (moduleError) {
        throw moduleError;
    }

    const moduleIds = modules.map((module) => module.id);

    if (!moduleIds.length) {
        return [];
    }

    const { data: lessons, error: lessonError } = await supabase
        .from("lessons")
        .select("id, module_id, title, order_index")
        .in("module_id", moduleIds)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (lessonError) {
        throw lessonError;
    }

    const courseByModuleId = new Map(modules.map((module) => [module.id, module.course_id]));

    return lessons.map((lesson) => ({
        ...lesson,
        course_id: courseByModuleId.get(lesson.module_id),
    }));
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

async function loadStudentSubmissions(profileId) {
    const { data, error } = await supabase
        .from("lesson_submissions")
        .select("id, course_id, classroom_id, lesson_id, status, submitted_at, updated_at, points_earned")
        .eq("student_user_id", profileId)
        .order("updated_at", { ascending: false })
        .limit(50);

    if (error) {
        throw error;
    }

    return data;
}

function getCourse(courseId, courses) {
    return courses.find((course) => course.id === courseId);
}

function getClassroom(classroomId, classrooms) {
    return classroomId ? classrooms.find((classroom) => classroom.id === classroomId) : null;
}

function getLesson(lessonId, lessons) {
    return lessons.find((lesson) => lesson.id === lessonId);
}

function getCourseProgress(enrollment, lessons, submissions) {
    const lessonCount = lessons.filter((lesson) => lesson.course_id === enrollment.course_id).length;
    const submittedCount = submissions.filter((submission) => (
        submission.course_id === enrollment.course_id
        && submission.status === "submitted"
        && (enrollment.classroom_id ? submission.classroom_id === enrollment.classroom_id : !submission.classroom_id)
    )).length;

    return {
        lessonCount,
        submittedCount,
        progressPercent: lessonCount ? Math.round((submittedCount / lessonCount) * 100) : 0,
    };
}

function createProgressBar(percent, label) {
    const progress = createElement("div", "dashboard-progress");
    const value = createElement("span", "dashboard-progress-value");

    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", label);
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    progress.setAttribute("aria-valuenow", String(percent));
    value.style.width = `${percent}%`;
    progress.append(value);

    return progress;
}

function renderLearning(enrollments, courses, classrooms, lessons, submissions) {
    if (!enrollments.length) {
        renderEmpty(learningListElement, "You are not enrolled in any courses yet.");
        return;
    }

    const cards = enrollments.map((enrollment) => {
        const course = getCourse(enrollment.course_id, courses);
        const classroom = getClassroom(enrollment.classroom_id, classrooms);
        const progress = getCourseProgress(enrollment, lessons, submissions);
        const card = createElement("article", "profile-mini-card");
        const header = createElement("div", "profile-mini-card__header");
        const title = createElement("h3", "", course?.title || "Untitled course");
        const badge = createElement("span", "badge badge--quiet", enrollment.enrollment_type === "classroom" ? "Classroom" : "Independent");
        const context = classroom
            ? `${classroom.name}${classroom.period_block ? ` - ${classroom.period_block}` : ""}`
            : "Independent course";
        const details = createElement("p", "course-muted", context);
        const submitted = createElement("p", "course-muted", `${progress.submittedCount} of ${progress.lessonCount} lessons submitted.`);
        const action = createElement("a", "secondary-button", "Open course");
        const params = new URLSearchParams({ course: enrollment.course_id });

        if (enrollment.classroom_id) {
            params.set("classroom", enrollment.classroom_id);
        }

        action.href = `../courses/student.html?${params.toString()}`;
        header.append(title, badge);
        card.append(header, details, submitted, createProgressBar(progress.progressPercent, `${progress.progressPercent}% complete`), action);
        return card;
    });

    learningListElement.replaceChildren(...cards);
}

function renderTeaching(courses, classrooms) {
    if (!courses.length) {
        teachingSection.hidden = true;
        return;
    }

    const cards = courses.map((course) => {
        const courseClassrooms = classrooms.filter((classroom) => classroom.course_id === course.id);
        const card = createElement("article", "profile-mini-card");
        const header = createElement("div", "profile-mini-card__header");
        const title = createElement("h3", "", course.title || "Untitled course");
        const badge = createElement("span", "badge", course.relationship);
        const details = createElement("p", "course-muted", `${course.subject_area || "Course"} | ${course.estimated_length || "Length not set"}`);
        const description = createElement("p", "course-muted", course.description || "No course description has been added yet.");
        const classroomSummary = createElement(
            "p",
            "course-muted",
            courseClassrooms.length === 1
                ? "1 managed classroom"
                : `${courseClassrooms.length} managed classrooms`
        );
        const actions = createElement("div", "course-actions");
        const manageCourse = createElement("a", "secondary-button", "Manage course");
        const manageClassrooms = createElement("a", "secondary-button", "Manage classrooms");
        const courseParam = encodeURIComponent(course.id);

        manageCourse.href = `../courses/editor.html?course=${courseParam}`;
        manageClassrooms.href = `../classrooms/manage.html?course=${courseParam}`;
        actions.append(manageCourse, manageClassrooms);
        header.append(title, badge);
        card.append(header, details, description, classroomSummary, actions);
        return card;
    });

    teachingSection.hidden = false;
    teachingListElement.replaceChildren(...cards);
}

function renderActivity(submissions, courses, lessons) {
    if (!submissions.length) {
        renderEmpty(activityListElement, "No lesson work has been saved yet.");
        return;
    }

    const recent = submissions.slice(0, 6).map((submission) => {
        const item = createElement("article", "profile-activity-item");
        const title = createElement("a", "submission-name", getLesson(submission.lesson_id, lessons)?.title || "Lesson work");
        const course = createElement("span", "course-muted", getCourse(submission.course_id, courses)?.title || "Course");
        const date = createElement("span", "course-muted", formatDateTime(submission.status === "submitted" ? submission.submitted_at : submission.updated_at));
        const badge = createElement("span", submission.status === "submitted" ? "badge" : "badge badge--quiet", formatStatus(submission.status));
        const draftParams = new URLSearchParams({ lesson: submission.lesson_id });

        if (submission.classroom_id) {
            draftParams.set("classroom", submission.classroom_id);
        }

        const href = submission.status === "submitted"
            ? `../submissions/view.html?submission=${encodeURIComponent(submission.id)}`
            : `../lessons/view.html?${draftParams.toString()}`;

        title.href = href;
        item.append(title, course, date, badge);
        return item;
    });

    activityListElement.replaceChildren(...recent);
}

function renderStats(enrollments, submissions, teachingCourses) {
    const submitted = submissions.filter((submission) => submission.status === "submitted");
    const points = submitted.reduce((total, submission) => total + Number(submission.points_earned || 0), 0);

    enrolledCountElement.textContent = String(enrollments.length);
    submittedCountElement.textContent = String(submitted.length);
    pointsCountElement.textContent = String(points);
    teachingCountElement.textContent = String(teachingCourses.length);
}

async function initializeProfile() {
    setStatus("Loading profile...");

    const profile = await loadProtectedProfile({
        profileColumns: "id, username, legal_first_name, legal_last_name, email, profile_photo_url, avatar_type, avatar_key, profile_completed, platform_role, account_status, created_at, updated_at",
        statusElement,
    });

    if (!profile) {
        return;
    }

    try {
        const [teachingCourses, enrollments, submissions] = await Promise.all([
            loadTeachingCourses(profile.id),
            loadStudentEnrollments(profile.id),
            loadStudentSubmissions(profile.id),
        ]);
        const courseIds = [...new Set([
            ...teachingCourses.map((course) => course.id),
            ...enrollments.map((enrollment) => enrollment.course_id),
            ...submissions.map((submission) => submission.course_id),
        ])];
        const classroomIds = [...new Set(enrollments.map((enrollment) => enrollment.classroom_id).filter(Boolean))];
        const [visibleCourses, classrooms, lessons, managedClassrooms] = await Promise.all([
            loadVisibleCourses(courseIds),
            loadVisibleClassrooms(classroomIds),
            loadLessons(courseIds),
            loadManagedClassrooms(profile.id, teachingCourses.map((course) => course.id)),
        ]);
        const allCourses = [...visibleCourses];

        teachingCourses.forEach((course) => {
            if (!allCourses.some((visibleCourse) => visibleCourse.id === course.id)) {
                allCourses.push(course);
            }
        });

        renderProfileHeader(profile, teachingCourses.length);
        renderDetails(profile, teachingCourses.length);
        renderStats(enrollments, submissions, teachingCourses);
        renderLearning(enrollments, visibleCourses, classrooms, lessons, submissions);
        renderTeaching(teachingCourses, managedClassrooms);
        renderActivity(submissions, allCourses, lessons);
        setStatus("");
    } catch (error) {
        setStatus(error.message || "Profile details could not be loaded.", "error");
        renderEmpty(learningListElement, "Learning details could not be loaded right now.");
        renderEmpty(teachingListElement, "Teaching details could not be loaded right now.");
        renderEmpty(activityListElement, "Recent lesson work could not be loaded right now.");
    }
}

await initializeProfile();
