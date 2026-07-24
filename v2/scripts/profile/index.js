import { supabase } from "../../services/supabase/client.js";
import { isTeachingRole, loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import {
    filterHallPassesByStudent,
    formatHallPassDateTime,
    formatHallPassDuration,
    getHallPassDestination,
    getPassDurationSeconds,
    readAllLocalHallPasses,
    summarizeHallPasses,
} from "../utils/hall-pass-data.js";
import { createProfileAvatar, getProfileDisplayName, getProfilePhotoUrl } from "../utils/profile-images.js";
import { notifyStatus } from "../utils/ui-components.js";

const statusElement = qs("[data-profile-status]");
const avatarElement = qs("[data-profile-avatar]");
const nameElement = qs("[data-profile-name]");
const usernameElement = qs("[data-profile-username]");
const introElement = qs("[data-profile-intro]");
const badgesElement = qs("[data-profile-badges]");
const enrolledCountElement = qs("[data-profile-enrolled-count]");
const submittedCountElement = qs("[data-profile-submitted-count]");
const pointsCountElement = qs("[data-profile-points-count]");
const teachingCountElement = qs("[data-profile-teaching-count]");
const activityListElement = qs("[data-profile-activity-list]");
const learningListElement = qs("[data-profile-learning-list]");
const hallPassSection = qs("[data-profile-hall-pass-section]");
const hallPassSummaryElement = qs("[data-profile-hall-pass-summary]");
const hallPassListElement = qs("[data-profile-hall-pass-list]");
const teachingSection = qs("[data-profile-teaching-section]");
const teachingListElement = qs("[data-profile-teaching-list]");
const toolkitSection = qs("[data-profile-toolkit-section]");
const analyticsSection = qs("[data-profile-analytics-section]");
const profileTabButtons = [...document.querySelectorAll("[data-profile-tab-button]")];
const profileTabPanels = [...document.querySelectorAll("[data-profile-tab-panel]")];
const teacherTabControls = [...document.querySelectorAll("[data-profile-teacher-tab]")];
const aboutNameElement = qs("[data-profile-about-name]");
const aboutUsernameElement = qs("[data-profile-about-username]");
const aboutEmailElement = qs("[data-profile-about-email]");
const aboutRoleElement = qs("[data-profile-about-role]");
const aboutStatusElement = qs("[data-profile-about-status]");
const analyticsSummaryElement = qs("[data-profile-analytics-summary]");
const teacherCourseAnalyticsElement = qs("[data-profile-teacher-course-analytics]");
const teacherClassroomAnalyticsElement = qs("[data-profile-teacher-classroom-analytics]");
const teacherStudentAnalyticsElement = qs("[data-profile-teacher-student-analytics]");
const teacherLessonAnalyticsElement = qs("[data-profile-teacher-lesson-analytics]");
const teacherHallPassAnalyticsElement = qs("[data-profile-teacher-hall-pass-analytics]");
const courseEditorVersion = "20260709-tabs";
const validProfileTabs = new Set(["about", "learning", "teaching", "analytics", "submissions"]);
const teacherOnlyTabs = new Set(["teaching"]);
let hasTeacherTabAccess = false;

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

function formatShortDate(value) {
    if (!value) {
        return "No activity yet";
    }

    return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function formatPercent(value) {
    const percent = Number.isFinite(value) ? value : 0;
    return `${Math.round(Math.max(0, Math.min(100, percent)))}%`;
}

function formatWholeNumber(value) {
    return new Intl.NumberFormat().format(Number(value || 0));
}

function getRoleLabel(profile, teachingCount) {
    if (profile.platform_role === "supreme_admin") {
        return "Supreme admin";
    }

    if (profile.platform_role === "admin") {
        return "Admin";
    }

    if (profile.platform_role === "teacher") {
        return "Teacher";
    }

    return teachingCount ? "Teacher" : "Student";
}

function formatStudentName(profile) {
    if (!profile) {
        return "Student";
    }

    const legalName = [profile.legal_first_name, profile.legal_last_name].filter(Boolean).join(" ").trim();
    return legalName || profile.username || profile.email || "Student";
}

function renderEmpty(target, message) {
    target.replaceChildren(createElement("p", "empty-state", message));
}

function getProfileTabStorageKey(profileId = "current") {
    return `brainkernl:profile-tab:${profileId || "current"}`;
}

function getInitialProfileTab(profileId) {
    const hashTab = window.location.hash.replace(/^#/, "");

    if (validProfileTabs.has(hashTab)) {
        return hashTab;
    }

    const savedTab = window.localStorage.getItem(getProfileTabStorageKey(profileId));
    return validProfileTabs.has(savedTab) ? savedTab : "learning";
}

function setProfileTab(tabName, { persist = true, profileId = "current" } = {}) {
    const requestedTab = validProfileTabs.has(tabName) ? tabName : "learning";
    const nextTab = teacherOnlyTabs.has(requestedTab) && !hasTeacherTabAccess ? "learning" : requestedTab;

    profileTabButtons.forEach((button) => {
        const tab = button.dataset.profileTabButton;
        const isTeacherOnly = button.hasAttribute("data-profile-teacher-tab");
        const isActive = tab === nextTab;

        button.hidden = isTeacherOnly && !hasTeacherTabAccess;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
    });

    profileTabPanels.forEach((panel) => {
        const tab = panel.dataset.profileTabPanel;
        const isTeacherOnly = panel.hasAttribute("data-profile-teacher-panel");
        const isActive = tab === nextTab && (!isTeacherOnly || hasTeacherTabAccess);

        panel.hidden = !isActive;
        panel.classList.toggle("is-active", isActive);
    });

    if (persist) {
        window.localStorage.setItem(getProfileTabStorageKey(profileId), nextTab);
        window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${nextTab}`);
    }
}

function setupProfileTabs(profileId) {
    profileTabButtons.forEach((button) => {
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", button.classList.contains("is-active") ? "true" : "false");
        button.addEventListener("click", () => setProfileTab(button.dataset.profileTabButton, { profileId }));
    });

    profileTabPanels.forEach((panel) => {
        panel.setAttribute("role", "tabpanel");
    });

    setProfileTab(getInitialProfileTab(profileId), { persist: false, profileId });
}

function closeProfilePhotoViewer(viewer) {
    viewer.remove();
    document.removeEventListener("keydown", viewer.handleEscape);
}

function openProfilePhotoViewer(photoUrl, displayName) {
    const viewer = createElement("div", "profile-photo-viewer");
    const panel = createElement("section", "profile-photo-viewer__panel");
    const header = createElement("div", "profile-photo-viewer__header");
    const title = createElement("h2", "", `${displayName} profile photo`);
    const closeButton = createElement("button", "profile-photo-viewer__close", "Close");
    const image = document.createElement("img");

    viewer.setAttribute("role", "presentation");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-label", `${displayName} profile photo`);
    closeButton.type = "button";
    image.src = photoUrl;
    image.alt = `${displayName} profile photo`;

    viewer.handleEscape = (event) => {
        if (event.key === "Escape") {
            closeProfilePhotoViewer(viewer);
        }
    };

    closeButton.addEventListener("click", () => closeProfilePhotoViewer(viewer));
    viewer.addEventListener("click", (event) => {
        if (event.target === viewer) {
            closeProfilePhotoViewer(viewer);
        }
    });

    header.append(title, closeButton);
    panel.append(header, image);
    viewer.append(panel);
    document.body.append(viewer);
    document.addEventListener("keydown", viewer.handleEscape);
    closeButton.focus();
}

function renderProfileHeader(profile, teachingCount) {
    const displayName = getProfileDisplayName(profile, "User");
    const roleLabel = getRoleLabel(profile, teachingCount);
    const avatarButton = createElement("button", "profile-avatar-button");
    const avatar = createProfileAvatar(profile, "profile-avatar profile-avatar--hero", "U");

    avatarButton.type = "button";
    avatarButton.disabled = true;
    avatarButton.setAttribute("aria-label", "Profile photo not available");
    avatarButton.append(avatar);
    avatarElement.replaceChildren(avatarButton);
    getProfilePhotoUrl(profile).then((photoUrl) => {
        if (!photoUrl || !avatarButton.isConnected) {
            return;
        }

        avatarButton.disabled = false;
        avatarButton.setAttribute("aria-label", `Open ${displayName} profile photo`);
        avatarButton.addEventListener("click", () => openProfilePhotoViewer(photoUrl, displayName), { once: false });
    });
    nameElement.textContent = displayName;
    usernameElement.textContent = profile.username ? `@${profile.username}` : profile.email || "No username yet";
    introElement.textContent = isTeachingRole(profile.platform_role) || teachingCount
        ? "Your learning, teaching, and platform work all live here in one profile view."
        : "Your courses, classroom progress, and lesson submissions live here in one profile view.";
    badgesElement.replaceChildren(
        createElement("span", "badge", roleLabel),
        createElement("span", "badge badge--quiet", formatStatus(profile.account_status))
    );
}

function renderAbout(profile, teachingCount) {
    const displayName = getProfileDisplayName(profile, "User");
    const roleLabel = getRoleLabel(profile, teachingCount);

    if (aboutNameElement) {
        aboutNameElement.textContent = displayName;
    }

    if (aboutUsernameElement) {
        aboutUsernameElement.textContent = profile.username ? `@${profile.username}` : "No username yet";
    }

    if (aboutEmailElement) {
        aboutEmailElement.textContent = profile.email || "No email listed";
    }

    if (aboutRoleElement) {
        aboutRoleElement.textContent = roleLabel;
    }

    if (aboutStatusElement) {
        aboutStatusElement.textContent = formatStatus(profile.account_status);
    }
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

async function loadTeacherEnrollments(courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("enrollments")
        .select("id, user_id, course_id, classroom_id, enrollment_type, enrollment_status, joined_at")
        .in("course_id", courseIds)
        .eq("enrollment_status", "active")
        .order("joined_at", { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
}

async function loadTeacherSubmissions(courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("lesson_submissions")
        .select("id, student_user_id, course_id, classroom_id, lesson_id, status, submitted_at, updated_at, points_earned, points_possible")
        .in("course_id", courseIds)
        .order("updated_at", { ascending: false })
        .limit(500);

    if (error) {
        throw error;
    }

    return data || [];
}

async function loadStudentNameMap() {
    const { data, error } = await supabase.rpc("reviewable_student_profiles");

    if (error) {
        console.warn("Student names could not be loaded.", error);
        return new Map();
    }

    return new Map((data || []).map((profile) => [profile.id, formatStudentName(profile)]));
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
    const safePercent = Math.round(Math.max(0, Math.min(100, Number(percent) || 0)));

    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", label);
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    progress.setAttribute("aria-valuenow", String(safePercent));
    value.style.width = `${safePercent}%`;
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

        manageCourse.href = `../courses/editor.html?course=${courseParam}&editor=${courseEditorVersion}`;
        manageClassrooms.href = `../classrooms/manage.html?course=${courseParam}`;
        actions.append(manageCourse, manageClassrooms);
        header.append(title, badge);
        card.append(header, details, description, classroomSummary, actions);
        return card;
    });

    teachingSection.hidden = false;
    teachingListElement.replaceChildren(...cards);
}

function renderTeacherToolkit(hasTeachingAccess, profileId = "current") {
    hasTeacherTabAccess = hasTeachingAccess;
    teacherTabControls.forEach((control) => {
        control.hidden = !hasTeachingAccess;
    });

    if (!toolkitSection) {
        return;
    }

    toolkitSection.hidden = !hasTeachingAccess;

    if (analyticsSection) {
        analyticsSection.hidden = !hasTeachingAccess;
    }

    const activeTab = profileTabButtons.find((button) => button.classList.contains("is-active"))?.dataset.profileTabButton;
    if (!hasTeachingAccess && teacherOnlyTabs.has(activeTab)) {
        setProfileTab("learning", { profileId });
    }
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

function createHallPassSummaryCard(label, value, detail = "") {
    const card = createElement("article", "summary-card");

    card.append(
        createElement("span", "summary-label", label),
        createElement("strong", "summary-value summary-value--small", value)
    );

    if (detail) {
        card.append(createElement("span", "course-muted", detail));
    }

    return card;
}

function getContextAnalytics({ courseId, classroomId = null }, lessons, enrollments, submissions) {
    const contextLessons = lessons.filter((lesson) => lesson.course_id === courseId);
    const contextEnrollments = enrollments.filter((enrollment) => (
        enrollment.course_id === courseId
        && (classroomId ? enrollment.classroom_id === classroomId : true)
    ));
    const lessonIds = new Set(contextLessons.map((lesson) => lesson.id));
    const studentIds = new Set(contextEnrollments.map((enrollment) => enrollment.user_id));
    const contextSubmissions = submissions.filter((submission) => (
        submission.course_id === courseId
        && lessonIds.has(submission.lesson_id)
        && studentIds.has(submission.student_user_id)
        && (classroomId ? submission.classroom_id === classroomId : true)
    ));
    const submittedCount = contextSubmissions.filter((submission) => submission.status === "submitted").length;
    const draftCount = contextSubmissions.filter((submission) => submission.status !== "submitted").length;
    const expectedCount = contextLessons.length * contextEnrollments.length;
    const missingCount = Math.max(expectedCount - submittedCount - draftCount, 0);
    const completionPercent = expectedCount ? (submittedCount / expectedCount) * 100 : 0;
    const latestActivity = contextSubmissions.reduce((latest, submission) => {
        const value = new Date(submission.updated_at || submission.submitted_at || 0).getTime();
        return value > latest ? value : latest;
    }, 0);

    return {
        lessonCount: contextLessons.length,
        studentCount: contextEnrollments.length,
        submittedCount,
        draftCount,
        expectedCount,
        missingCount,
        completionPercent,
        latestActivity: latestActivity ? new Date(latestActivity).toISOString() : null,
    };
}

function createAnalyticsProgressCell(percent, detail) {
    const cell = createElement("div", "analytics-progress-cell");
    cell.append(
        createElement("strong", "", formatPercent(percent)),
        createProgressBar(Math.round(percent || 0), detail),
        createElement("span", "course-muted", detail)
    );
    return cell;
}

function createProfileAnalyticsTable(columns, rows, emptyMessage) {
    if (!rows.length) {
        return createElement("p", "empty-state", emptyMessage);
    }

    const shell = createElement("div", "analytics-table-shell profile-analytics-table-shell");
    const table = createElement("table", "analytics-table profile-analytics-table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const tbody = document.createElement("tbody");

    columns.forEach((column) => {
        headerRow.append(createElement("th", "", column.label));
    });

    rows.forEach((row) => {
        const tableRow = document.createElement("tr");

        columns.forEach((column) => {
            const cell = document.createElement("td");
            const value = row[column.key];
            if (value instanceof Node) {
                cell.append(value);
            } else {
                cell.textContent = value ?? "";
            }
            tableRow.append(cell);
        });

        tbody.append(tableRow);
    });

    thead.append(headerRow);
    table.append(thead, tbody);
    shell.append(table);
    return shell;
}

function getTeacherHallPasses(profile) {
    return readAllLocalHallPasses().filter((pass) => (
        pass.teacher_id === profile.id
        || pass.owner_teacher_id === profile.id
        || pass.created_by === profile.id
    ));
}

function renderTeacherHallPassAnalytics(profile) {
    if (!teacherHallPassAnalyticsElement) {
        return;
    }

    const hallPasses = getTeacherHallPasses(profile);
    const summary = summarizeHallPasses(hallPasses);
    const activePasses = hallPasses.filter((pass) => pass.status === "active");
    const scanClosedCount = hallPasses.filter((pass) => pass.closed_by === "qr_scan").length;
    const cards = createElement("div", "hall-pass-report-grid");
    const recentList = createElement("div", "hall-pass-history-list hall-pass-history-list--compact");

    cards.append(
        createHallPassSummaryCard("Total passes", formatWholeNumber(summary.totalPasses)),
        createHallPassSummaryCard("Active now", formatWholeNumber(activePasses.length)),
        createHallPassSummaryCard("Average time", formatHallPassDuration(summary.averageDurationSeconds)),
        createHallPassSummaryCard("Closed by scan", formatWholeNumber(scanClosedCount))
    );

    if (!hallPasses.length) {
        recentList.append(createElement("p", "empty-state", "No teacher hall pass activity has been logged yet."));
    } else {
        recentList.append(...hallPasses.slice(0, 6).map(createHallPassRow));
    }

    teacherHallPassAnalyticsElement.replaceChildren(cards, recentList);
}

function renderTeacherAnalytics(profile, teachingCourses, managedClassrooms, lessons, enrollments = [], submissions = [], studentNameMap = new Map()) {
    if (!analyticsSummaryElement) {
        return;
    }

    const taughtCourseIds = new Set(teachingCourses.map((course) => course.id));
    const taughtLessons = lessons.filter((lesson) => taughtCourseIds.has(lesson.course_id));
    const activeStudentIds = new Set(enrollments.map((enrollment) => enrollment.user_id));
    const courseMetrics = teachingCourses.map((course) => getContextAnalytics({ courseId: course.id }, lessons, enrollments, submissions));
    const submittedSubmissions = courseMetrics.reduce((total, metrics) => total + metrics.submittedCount, 0);
    const draftSubmissions = courseMetrics.reduce((total, metrics) => total + metrics.draftCount, 0);
    const expectedSubmissions = courseMetrics.reduce((total, metrics) => total + metrics.expectedCount, 0);
    const missingSubmissions = courseMetrics.reduce((total, metrics) => total + metrics.missingCount, 0);
    const completionPercent = expectedSubmissions ? (submittedSubmissions / expectedSubmissions) * 100 : 0;
    const hallPasses = getTeacherHallPasses(profile);
    const activePasses = hallPasses.filter((pass) => pass.status === "active");

    analyticsSummaryElement.replaceChildren(
        createHallPassSummaryCard("Courses taught", String(teachingCourses.length)),
        createHallPassSummaryCard("Active students", String(new Set(enrollments.map((enrollment) => enrollment.user_id)).size)),
        createHallPassSummaryCard("Avg completion", formatPercent(completionPercent)),
        createHallPassSummaryCard("Missing work", formatWholeNumber(missingSubmissions)),
        createHallPassSummaryCard("Drafts in progress", formatWholeNumber(draftSubmissions.length)),
        createHallPassSummaryCard("Active hall passes", String(activePasses.length))
    );

    if (!teachingCourses.length) {
        [
            teacherCourseAnalyticsElement,
            teacherClassroomAnalyticsElement,
            teacherStudentAnalyticsElement,
            teacherLessonAnalyticsElement,
            teacherHallPassAnalyticsElement,
        ].filter(Boolean).forEach((element) => renderEmpty(element, "Teacher analytics will appear here once you are teaching a course."));
        return;
    }

    const courseRows = teachingCourses.map((course) => {
        const metrics = getContextAnalytics({ courseId: course.id }, lessons, enrollments, submissions);
        const link = createElement("a", "secondary-button analytics-table-action", "Open");
        link.href = `../analytics/index.html?course=${encodeURIComponent(course.id)}`;

        return {
            course: course.title || "Untitled course",
            students: formatWholeNumber(metrics.studentCount),
            lessons: formatWholeNumber(metrics.lessonCount),
            progress: createAnalyticsProgressCell(
                metrics.completionPercent,
                `${formatWholeNumber(metrics.submittedCount)} of ${formatWholeNumber(metrics.expectedCount)} submitted`
            ),
            missing: formatWholeNumber(metrics.missingCount),
            activity: formatShortDate(metrics.latestActivity),
            action: link,
        };
    });

    teacherCourseAnalyticsElement?.replaceChildren(createProfileAnalyticsTable(
        [
            { key: "course", label: "Course" },
            { key: "students", label: "Students" },
            { key: "lessons", label: "Lessons" },
            { key: "progress", label: "Progress" },
            { key: "missing", label: "Missing" },
            { key: "activity", label: "Last activity" },
            { key: "action", label: "" },
        ],
        courseRows,
        "No course analytics are available yet."
    ));

    const classroomRows = managedClassrooms.map((classroom) => {
        const course = getCourse(classroom.course_id, teachingCourses);
        const metrics = getContextAnalytics({ courseId: classroom.course_id, classroomId: classroom.id }, lessons, enrollments, submissions);
        const link = createElement("a", "secondary-button analytics-table-action", "Roster");
        link.href = `../classrooms/manage.html?course=${encodeURIComponent(classroom.course_id)}&classroom=${encodeURIComponent(classroom.id)}`;

        return {
            classroom: `${classroom.name || "Classroom"}${classroom.period_block ? ` - ${classroom.period_block}` : ""}`,
            course: course?.title || "Course",
            students: formatWholeNumber(metrics.studentCount),
            progress: createAnalyticsProgressCell(
                metrics.completionPercent,
                `${formatWholeNumber(metrics.submittedCount)} of ${formatWholeNumber(metrics.expectedCount)} submitted`
            ),
            missing: formatWholeNumber(metrics.missingCount),
            activity: formatShortDate(metrics.latestActivity),
            action: link,
        };
    });

    teacherClassroomAnalyticsElement?.replaceChildren(createProfileAnalyticsTable(
        [
            { key: "classroom", label: "Classroom" },
            { key: "course", label: "Course" },
            { key: "students", label: "Students" },
            { key: "progress", label: "Progress" },
            { key: "missing", label: "Missing" },
            { key: "activity", label: "Last activity" },
            { key: "action", label: "" },
        ],
        classroomRows,
        "No managed classrooms are available yet."
    ));

    const studentContexts = enrollments.map((enrollment) => {
        const courseLessons = lessons.filter((lesson) => lesson.course_id === enrollment.course_id);
        const lessonIds = new Set(courseLessons.map((lesson) => lesson.id));
        const studentSubmissions = submissions.filter((submission) => (
            submission.student_user_id === enrollment.user_id
            && submission.course_id === enrollment.course_id
            && lessonIds.has(submission.lesson_id)
            && (enrollment.classroom_id ? submission.classroom_id === enrollment.classroom_id : true)
        ));
        const submittedCount = studentSubmissions.filter((submission) => submission.status === "submitted").length;
        const draftCount = studentSubmissions.filter((submission) => submission.status !== "submitted").length;
        const expectedCount = courseLessons.length;
        const missingCount = Math.max(expectedCount - submittedCount - draftCount, 0);
        const latestActivity = studentSubmissions[0]?.updated_at || studentSubmissions[0]?.submitted_at || null;
        const course = getCourse(enrollment.course_id, teachingCourses);
        const classroom = getClassroom(enrollment.classroom_id, managedClassrooms);

        return {
            student: studentNameMap.get(enrollment.user_id) || `Student ${String(enrollment.user_id).slice(0, 8)}`,
            context: classroom?.name || course?.title || "Course",
            progressPercent: expectedCount ? (submittedCount / expectedCount) * 100 : 0,
            submittedCount,
            expectedCount,
            missingCount,
            latestActivity,
        };
    }).sort((first, second) => (
        second.missingCount - first.missingCount
        || first.progressPercent - second.progressPercent
    ));

    teacherStudentAnalyticsElement?.replaceChildren(createProfileAnalyticsTable(
        [
            { key: "student", label: "Student" },
            { key: "context", label: "Course / class" },
            { key: "progress", label: "Progress" },
            { key: "missing", label: "Missing" },
            { key: "activity", label: "Last activity" },
        ],
        studentContexts.slice(0, 8).map((student) => ({
            student: student.student,
            context: student.context,
            progress: createAnalyticsProgressCell(
                student.progressPercent,
                `${formatWholeNumber(student.submittedCount)} of ${formatWholeNumber(student.expectedCount)} submitted`
            ),
            missing: formatWholeNumber(student.missingCount),
            activity: formatShortDate(student.latestActivity),
        })),
        "No enrolled student analytics are available yet."
    ));

    const enrollmentCountsByCourse = enrollments.reduce((map, enrollment) => {
        map.set(enrollment.course_id, (map.get(enrollment.course_id) || 0) + 1);
        return map;
    }, new Map());
    const lessonRows = taughtLessons.map((lesson) => {
        const expectedCount = enrollmentCountsByCourse.get(lesson.course_id) || 0;
        const submittedCount = submissions.filter((submission) => (
            submission.lesson_id === lesson.id
            && submission.status === "submitted"
            && activeStudentIds.has(submission.student_user_id)
        )).length;
        const completion = expectedCount ? (submittedCount / expectedCount) * 100 : 0;
        const link = createElement("a", "secondary-button analytics-table-action", "Review");
        link.href = `../submissions/index.html?lesson=${encodeURIComponent(lesson.id)}`;

        return {
            lesson: lesson.title || "Untitled lesson",
            course: getCourse(lesson.course_id, teachingCourses)?.title || "Course",
            progressPercent: completion,
            submittedCount,
            expectedCount,
            action: link,
        };
    }).sort((first, second) => first.progressPercent - second.progressPercent);

    teacherLessonAnalyticsElement?.replaceChildren(createProfileAnalyticsTable(
        [
            { key: "lesson", label: "Lesson" },
            { key: "course", label: "Course" },
            { key: "completion", label: "Completion" },
            { key: "action", label: "" },
        ],
        lessonRows.slice(0, 8).map((lesson) => ({
            lesson: lesson.lesson,
            course: lesson.course,
            completion: createAnalyticsProgressCell(
                lesson.progressPercent,
                `${formatWholeNumber(lesson.submittedCount)} of ${formatWholeNumber(lesson.expectedCount)} submitted`
            ),
            action: lesson.action,
        })),
        "No lesson completion data is available yet."
    ));

    renderTeacherHallPassAnalytics(profile);
}

function createHallPassRow(pass) {
    const item = createElement("article", "hall-pass-report-row");
    const main = createElement("div", "hall-pass-report-row__main");
    const status = pass.status === "active"
        ? createElement("span", "badge", "Active")
        : createElement("span", "badge badge--quiet", "Closed");

    main.append(
        createElement("strong", "", getHallPassDestination(pass)),
        createElement("span", "course-muted", pass.pass_code || "No pass ID")
    );
    item.append(
        main,
        createElement("span", "course-muted", `Out: ${formatHallPassDateTime(pass.departure_time, "No time out")}`),
        createElement(
            "span",
            "course-muted",
            pass.status === "active"
                ? `Elapsed: ${formatHallPassDuration(getPassDurationSeconds(pass))}`
                : `Duration: ${formatHallPassDuration(getPassDurationSeconds(pass))}`
        ),
        status
    );

    return item;
}

function renderHallPassReport(profile) {
    if (!hallPassSection || !hallPassSummaryElement || !hallPassListElement) {
        return;
    }

    const passes = filterHallPassesByStudent(readAllLocalHallPasses(), profile.id);
    const summary = summarizeHallPasses(passes);

    hallPassSummaryElement.replaceChildren(
        createHallPassSummaryCard("Total passes", String(summary.totalPasses)),
        createHallPassSummaryCard("Active now", String(summary.activePasses)),
        createHallPassSummaryCard("Average time", formatHallPassDuration(summary.averageDurationSeconds)),
        createHallPassSummaryCard(
            "Longest pass",
            summary.longestPass ? formatHallPassDuration(getPassDurationSeconds(summary.longestPass)) : "None"
        )
    );

    if (!passes.length) {
        renderEmpty(hallPassListElement, "No hall passes have been logged for this account yet.");
        return;
    }

    hallPassListElement.replaceChildren(...passes.slice(0, 8).map(createHallPassRow));
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
        const hasTeachingAccess = isTeachingRole(profile.platform_role) || Boolean(teachingCourses.length);
        const [teacherEnrollments, teacherSubmissions, studentNameMap] = hasTeachingAccess
            ? await Promise.all([
                loadTeacherEnrollments(teachingCourses.map((course) => course.id)),
                loadTeacherSubmissions(teachingCourses.map((course) => course.id)),
                loadStudentNameMap(),
            ])
            : [[], [], new Map()];
        const allCourses = [...visibleCourses];

        teachingCourses.forEach((course) => {
            if (!allCourses.some((visibleCourse) => visibleCourse.id === course.id)) {
                allCourses.push(course);
            }
        });

        renderProfileHeader(profile, teachingCourses.length);
        renderAbout(profile, teachingCourses.length);
        renderStats(enrollments, submissions, teachingCourses);
        renderLearning(enrollments, visibleCourses, classrooms, lessons, submissions);
        renderHallPassReport(profile);
        renderTeaching(teachingCourses, managedClassrooms);
        renderTeacherToolkit(hasTeachingAccess, profile.id);
        renderTeacherAnalytics(profile, teachingCourses, managedClassrooms, lessons, teacherEnrollments, teacherSubmissions, studentNameMap);
        renderActivity(submissions, allCourses, lessons);
        setupProfileTabs(profile.id);
        setStatus("");
    } catch (error) {
        setStatus(error.message || "Profile details could not be loaded.", "error");
        renderEmpty(learningListElement, "Learning details could not be loaded right now.");
        renderEmpty(teachingListElement, "Teaching details could not be loaded right now.");
        renderTeacherToolkit(false, profile.id);
        renderEmpty(activityListElement, "Recent lesson work could not be loaded right now.");
        setupProfileTabs(profile.id);
    }
}

await initializeProfile();
