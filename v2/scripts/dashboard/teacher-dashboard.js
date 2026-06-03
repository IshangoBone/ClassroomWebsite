import { supabase } from "../../services/supabase/client.js";
import { isPlatformAdmin, loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { createProfileAvatar } from "../utils/profile-images.js";

const dashboardStatus = qs("[data-dashboard-status]");
const greetingElement = qs("[data-dashboard-greeting]");
const profileAvatarElement = qs("[data-dashboard-profile-avatar]");
const courseList = qs("[data-course-list]");
const submissionList = qs("[data-submission-list]");
const studentSubmissionList = qs("[data-student-submission-list]");
const enrolledCoursesSection = qs("[data-enrolled-courses-section]");
const enrolledCourseList = qs("[data-enrolled-course-list]");
const courseFormPanel = qs("[data-course-form-panel]");
const courseForm = qs("[data-course-form]");
const courseFormToggle = qs("[data-course-form-toggle]");
const courseFormCancel = qs("[data-course-form-cancel]");
const logoutButton = qs("[data-logout-button]");
const studentJoinForm = qs("[data-student-join-form]");
const submissionFilterForm = qs("[data-submission-filter-form]");
const studentActivitySection = qs("[data-student-activity-section]");
const studentActivityList = qs("[data-student-activity-list]");
const studentProgressEntry = qs("[data-student-progress-entry]");
const submissionFilterCourse = qs("[data-submission-filter-course]");
const submissionFilterClassroom = qs("[data-submission-filter-classroom]");
const submissionFilterLesson = qs("[data-submission-filter-lesson]");
const submissionFilterStudent = qs("[data-submission-filter-student]");
const coursesSummary = qs("[data-summary-courses]");
const coursesSummaryLabel = qs("[data-summary-courses-label]");
const classroomsSummary = qs("[data-summary-classrooms]");
const classroomsSummaryLabel = qs("[data-summary-classrooms-label]");
const submissionsSummary = qs("[data-summary-submissions]");
const submissionsSummaryLabel = qs("[data-summary-submissions-label]");
const studentSubmissionsSummary = qs("[data-summary-my-submissions]");
const studentSubmissionsSummaryLabel = qs("[data-summary-my-submissions-label]");
const managedCoursesHeading = qs("[data-managed-courses-heading]");
const managedCoursesCopy = qs("[data-managed-courses-copy]");
const teacherSubmissionsSection = qs("[data-teacher-submissions-section]");
const studentJoinSection = qs("[data-student-join-section]");
const teacherAnalyticsEntry = qs("[data-teacher-analytics-entry]");
const adminDashboardEntry = qs("[data-admin-dashboard-entry]");
const adminActivityEntry = qs("[data-admin-activity-entry]");
const dashboardParams = new URLSearchParams(window.location.search);

let currentProfile = null;
let dashboardCourses = [];
let dashboardClassrooms = [];
let dashboardLessons = [];
let dashboardSubmissions = [];
let dashboardStudentNames = new Map();
let dashboardStudentTeachers = new Map();

function setStatus(message, tone = "info") {
    dashboardStatus.textContent = message;
    dashboardStatus.dataset.tone = tone;
}

function formatStatus(status) {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatShortId(id) {
    return id ? id.slice(0, 8) : "unknown";
}

function formatStudentName(profile) {
    const fullName = [profile.legal_first_name, profile.legal_last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || profile.username || `Student ${formatShortId(profile.id)}`;
}

function getStudentName(studentId) {
    return dashboardStudentNames.get(studentId) || `Student ${formatShortId(studentId)}`;
}

function getTeacherKey(courseId, classroomId) {
    return `${courseId}:${classroomId || "course"}`;
}

function getStudentTeacherName(enrollment) {
    return dashboardStudentTeachers.get(getTeacherKey(enrollment.course_id, enrollment.classroom_id))
        || dashboardStudentTeachers.get(getTeacherKey(enrollment.course_id, null))
        || "Teacher";
}

function setCourseFormVisible(isVisible) {
    courseFormPanel.hidden = !isVisible;
    courseFormToggle.textContent = isVisible ? "Close form" : "New course";

    if (isVisible) {
        courseForm.elements.title.focus();
    }
}

function renderDashboardAvatar(profile) {
    profileAvatarElement.replaceChildren(createProfileAvatar(profile, "profile-avatar profile-avatar--large", "U"));
}

async function logDashboardActivity(actionType) {
    if (!currentProfile) {
        return;
    }

    const { error } = await supabase.rpc("log_activity", {
        action_type_input: actionType,
        target_type_input: "user",
        target_id_input: currentProfile.id,
        metadata_json_input: {
            source: "dashboard",
        },
    });

    if (error) {
        console.warn("Activity logging failed:", error.message);
    }
}

async function handleLogout() {
    logoutButton.disabled = true;
    setStatus("Logging out...");

    await logDashboardActivity("user_logout");

    const { error } = await supabase.auth.signOut();

    if (error) {
        logoutButton.disabled = false;
        setStatus(error.message || "Logout failed. Please try again.", "error");
        return;
    }

    window.location.href = "../auth/login.html";
}

function getSubmissionFilters() {
    const formData = new FormData(submissionFilterForm);

    return {
        classroomId: String(formData.get("classroom") || ""),
        courseId: String(formData.get("course") || ""),
        lessonId: String(formData.get("lesson") || ""),
        studentId: String(formData.get("student") || ""),
    };
}

function renderEmpty(container, message) {
    container.replaceChildren(createElement("p", "empty-state", message));
}

function getJoinPreviewLabel(preview) {
    return preview.classroom_name
        ? `${preview.course_title} / ${preview.classroom_name}`
        : preview.course_title;
}

async function handleStudentJoinSubmit(event) {
    event.preventDefault();

    const formData = new FormData(studentJoinForm);
    const joinCode = String(formData.get("join-code") || "").trim();
    const submitButton = studentJoinForm.querySelector("button[type='submit']");

    if (!joinCode) {
        setStatus("Enter a classroom join code.", "error");
        return;
    }

    submitButton.disabled = true;
    await joinClassroomFromAccess({
        previewMessage: "Checking join code...",
        previewRpc: "preview_classroom_join_by_code",
        joinRpc: "join_classroom_by_code",
        payload: { join_code_input: joinCode },
        notFoundMessage: "That join code was not found.",
        failureMessage: "That classroom could not be joined.",
        onComplete: () => studentJoinForm.reset(),
    });
    submitButton.disabled = false;
}

async function joinClassroomFromAccess(options) {
    const {
        previewMessage,
        previewRpc,
        joinRpc,
        payload,
        notFoundMessage,
        failureMessage,
        successFallback = "Classroom joined.",
        closedMessage = "Joining is closed for this classroom.",
        joiningMessage = "Joining classroom...",
        onComplete,
    } = options;

    setStatus(previewMessage);

    const { data: previewData, error: previewError } = await supabase.rpc(previewRpc, payload);

    if (previewError) {
        setStatus(previewError.message || failureMessage, "error");
        return;
    }

    const preview = previewData?.[0];

    if (!preview) {
        setStatus(notFoundMessage, "error");
        return;
    }

    if (preview.already_enrolled) {
        onComplete?.();
        setStatus(`You are already enrolled in ${getJoinPreviewLabel(preview)}.`, "success");
        return;
    }

    if (!preview.is_joining_open) {
        setStatus(closedMessage, "error");
        return;
    }

    const confirmed = window.confirm(`Join ${getJoinPreviewLabel(preview)}?`);

    if (!confirmed) {
        setStatus("Join canceled.");
        return;
    }

    setStatus(joiningMessage);

    const { data, error } = await supabase.rpc(joinRpc, payload);

    if (error) {
        setStatus(error.message || failureMessage, "error");
        return;
    }

    const joinedClassroom = data?.[0];
    onComplete?.();
    await refreshDashboard();
    setStatus(
        joinedClassroom?.classroom_name || joinedClassroom?.course_title
            ? `Joined ${joinedClassroom.classroom_name || joinedClassroom.course_title}.`
            : successFallback,
        "success"
    );
}

async function handleClassroomInvite(inviteToken) {
    if (!inviteToken) {
        return;
    }

    await joinClassroomFromAccess({
        previewMessage: "Checking invite link...",
        previewRpc: "preview_classroom_join_by_invite",
        joinRpc: "join_classroom_by_invite",
        payload: { invite_token_input: inviteToken },
        notFoundMessage: "That invite link was not found.",
        failureMessage: "That invite link could not be joined.",
        onComplete: () => {
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete("classroomInvite");
            window.history.replaceState({}, "", cleanUrl);
        },
    });
}

async function handlePublicCourseJoin(courseIdToJoin) {
    if (!courseIdToJoin) {
        return;
    }

    await joinClassroomFromAccess({
        previewMessage: "Checking public course link...",
        previewRpc: "preview_public_course_join",
        joinRpc: "join_public_course",
        payload: { course_id_input: courseIdToJoin },
        notFoundMessage: "That public course was not found.",
        failureMessage: "That public course could not be joined.",
        successFallback: "Course joined.",
        closedMessage: "Joining is closed for this course.",
        joiningMessage: "Joining course...",
        onComplete: () => {
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete("courseJoin");
            window.history.replaceState({}, "", cleanUrl);
        },
    });
}

async function leaveEnrollment(enrollment) {
    const label = enrollment.enrollment_type === "classroom" ? "classroom" : "course";
    const confirmed = window.confirm(
        `Leave this ${label}? It will be removed from your active courses, but your existing work history will be preserved.`
    );

    if (!confirmed) {
        return;
    }

    setStatus(`Leaving ${label}...`);

    const { error } = await supabase.rpc("leave_student_enrollment", {
        enrollment_id_input: enrollment.id,
    });

    if (error) {
        setStatus(error.message || `You could not leave this ${label}.`, "error");
        return;
    }

    await refreshDashboard();
    setStatus(`You left this ${label}.`, "success");
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

async function loadVisibleCourses(courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("courses")
        .select("id, title")
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

async function loadManagedClassrooms(profileId, courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data: ownedClassrooms, error: ownedError } = await supabase
        .from("classrooms")
        .select("id, course_id, name, period_block, status, display_order")
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
            .select("id, course_id, name, period_block, status, display_order")
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

    return [...classroomMap.values()].sort((first, second) => first.display_order - second.display_order);
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

async function loadRecentSubmissions(courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("lesson_submissions")
        .select("id, student_user_id, course_id, classroom_id, lesson_id, status, submitted_at, updated_at")
        .in("course_id", courseIds)
        .eq("status", "submitted")
        .order("updated_at", { ascending: false })
        .limit(50);

    if (error) {
        throw error;
    }

    return data;
}

async function loadStudentSubmissions(profileId) {
    const { data, error } = await supabase
        .from("lesson_submissions")
        .select("id, course_id, classroom_id, lesson_id, status, submitted_at, updated_at, points_earned")
        .eq("student_user_id", profileId)
        .order("updated_at", { ascending: false })
        .limit(25);

    if (error) {
        throw error;
    }

    return data;
}

async function loadStudentNameMap() {
    const { data, error } = await supabase.rpc("reviewable_student_profiles");

    if (error || !data) {
        return new Map();
    }

    return new Map(data.map((profile) => [profile.id, formatStudentName(profile)]));
}

async function loadStudentTeacherMap() {
    const { data, error } = await supabase.rpc("student_visible_teachers");

    if (error || !data) {
        return new Map();
    }

    return new Map(data.map((profile) => [
        getTeacherKey(profile.course_id, profile.classroom_id),
        formatStudentName(profile),
    ]));
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
        const deleteAction = createElement("button", "secondary-button destructive-button", "Delete course");
        const courseParam = encodeURIComponent(course.id);
        builderAction.href = `../courses/editor.html?course=${courseParam}`;
        classroomAction.href = `../classrooms/manage.html?course=${courseParam}`;
        deleteAction.type = "button";
        deleteAction.addEventListener("click", () => deleteCourse(course));
        actions.append(builderAction, classroomAction, deleteAction);

        card.append(heading, details, description, renderClassrooms(course, classrooms), actions);
        return card;
    });

    courseList.replaceChildren(...cards);
}

function getEnrollmentCourse(enrollment, courses) {
    return courses.find((course) => course.id === enrollment.course_id);
}

function getEnrollmentClassroom(enrollment, classrooms) {
    return enrollment.classroom_id
        ? classrooms.find((classroom) => classroom.id === enrollment.classroom_id)
        : null;
}

function getDisplayStudentEnrollments(enrollments) {
    return enrollments;
}

function getStudentCourseProgress(enrollment, lessons, submissions) {
    const lessonCount = lessons.filter((lesson) => lesson.course_id === enrollment.course_id).length;
    const submittedCount = submissions.filter((submission) => (
        submission.course_id === enrollment.course_id
        && submission.status === "submitted"
        && (enrollment.classroom_id ? submission.classroom_id === enrollment.classroom_id : !submission.classroom_id)
    )).length;

    return {
        incompleteCount: Math.max(lessonCount - submittedCount, 0),
        lessonCount,
        progressPercent: lessonCount ? Math.round((submittedCount / lessonCount) * 100) : 0,
        submittedCount,
    };
}

function getContinueLesson(enrollment, lessons, submissions) {
    const courseLessons = lessons
        .filter((lesson) => lesson.course_id === enrollment.course_id)
        .sort((first, second) => first.order_index - second.order_index);

    if (!courseLessons.length) {
        return null;
    }

    const submissionsByLesson = new Map(
        submissions
            .filter((submission) => (
                submission.course_id === enrollment.course_id
                && (enrollment.classroom_id ? submission.classroom_id === enrollment.classroom_id : !submission.classroom_id)
            ))
            .map((submission) => [submission.lesson_id, submission])
    );
    const draft = [...submissionsByLesson.values()].find((submission) => submission.status === "draft");

    if (draft) {
        const draftLesson = courseLessons.find((lesson) => lesson.id === draft.lesson_id);

        return {
            href: getStudentWorkLink(draft),
            label: "Continue draft",
            detail: draftLesson?.title ? `Draft saved: ${draftLesson.title}` : "You have a saved draft.",
            isComplete: false,
        };
    }

    const nextLesson = courseLessons.find((lesson) => submissionsByLesson.get(lesson.id)?.status !== "submitted")
        || courseLessons[courseLessons.length - 1];
    const nextParams = new URLSearchParams({ lesson: nextLesson.id });

    if (enrollment.classroom_id) {
        nextParams.set("classroom", enrollment.classroom_id);
    }

    return {
        href: `../lessons/view.html?${nextParams.toString()}`,
        label: submissionsByLesson.get(nextLesson.id)?.status === "submitted" ? "Review lesson" : "Continue lesson",
        detail: submissionsByLesson.get(nextLesson.id)?.status === "submitted"
            ? `Completed: ${nextLesson.title || "Lesson"}`
            : `Next: ${nextLesson.title || "Lesson"}`,
        isComplete: submissionsByLesson.get(nextLesson.id)?.status === "submitted",
    };
}

function renderStudentEnrollments(enrollments, courses, classrooms, lessons, submissions, targetList = courseList) {
    if (!enrollments.length) {
        renderEmpty(targetList, "You are not enrolled in any courses yet.");
        return;
    }

    const cards = enrollments.map((enrollment) => {
        const course = getEnrollmentCourse(enrollment, courses);
        const classroom = getEnrollmentClassroom(enrollment, classrooms);
        const { incompleteCount, lessonCount, progressPercent, submittedCount } = getStudentCourseProgress(enrollment, lessons, submissions);
        const continueLesson = getContinueLesson(enrollment, lessons, submissions);
        const card = createElement("article", "course-card");
        const heading = createElement("div", "course-card-header");
        const title = createElement("h3", "course-title", course?.title || "Untitled course");
        const badges = createElement("div", "badge-row");
        badges.append(
            createElement("span", "badge", enrollment.enrollment_type === "classroom" ? "Classroom" : "Course"),
            createElement("span", "badge badge--quiet", formatStatus(enrollment.enrollment_status))
        );
        heading.append(title, badges);

        const classroomLabel = classroom
            ? (classroom.period_block ? `${classroom.name} - ${classroom.period_block}` : classroom.name)
            : "Independent course";
        const details = createElement("p", "course-details", classroomLabel);
        const teacher = createElement("p", "course-muted", `Teacher: ${getStudentTeacherName(enrollment)}`);
        const progress = createElement(
            "p",
            "course-muted",
            lessonCount
                ? `${submittedCount} of ${lessonCount} lessons submitted.`
                : "Lessons will appear here when your teacher adds them."
        );
        const progressBar = createElement("div", "dashboard-progress");
        const progressValue = createElement("span", "dashboard-progress-value");
        progressBar.setAttribute("role", "progressbar");
        progressBar.setAttribute("aria-label", `${progressPercent}% complete`);
        progressBar.setAttribute("aria-valuemin", "0");
        progressBar.setAttribute("aria-valuemax", "100");
        progressBar.setAttribute("aria-valuenow", String(progressPercent));
        progressValue.style.width = `${progressPercent}%`;
        progressBar.append(progressValue);
        const nextStep = continueLesson
            ? createElement(
                "p",
                continueLesson.isComplete ? "course-muted" : "dashboard-next-step",
                continueLesson.detail
            )
            : null;
        const incompleteNote = lessonCount && incompleteCount
            ? createElement(
                "p",
                "dashboard-incomplete-note",
                incompleteCount === 1
                    ? "1 lesson still needs your attention."
                    : `${incompleteCount} lessons still need your attention.`
            )
            : null;
        const actions = createElement("div", "course-actions");
        const courseParams = new URLSearchParams({ course: enrollment.course_id });
        const openCourseAction = createElement("a", "secondary-button", "Open course");
        const leaveAction = createElement(
            "button",
            "secondary-button destructive-button",
            enrollment.enrollment_type === "classroom" ? "Leave classroom" : "Unenroll"
        );

        if (enrollment.classroom_id) {
            courseParams.set("classroom", enrollment.classroom_id);
        }

        openCourseAction.href = `../courses/student.html?${courseParams.toString()}`;
        leaveAction.type = "button";
        leaveAction.addEventListener("click", () => leaveEnrollment(enrollment));
        actions.append(openCourseAction);
        if (continueLesson) {
            const continueAction = createElement("a", "primary-button", continueLesson.label);
            continueAction.href = continueLesson.href;
            actions.append(continueAction);
        }
        actions.append(leaveAction);

        card.append(heading, details, teacher, progress, progressBar);

        if (nextStep) {
            card.append(nextStep);
        }

        if (incompleteNote) {
            card.append(incompleteNote);
        }

        card.append(actions);
        return card;
    });

    targetList.replaceChildren(...cards);
}

function populateSelect(select, options, placeholder) {
    const currentValue = select.value;
    const optionElements = [createElement("option", "", placeholder)];

    optionElements[0].value = "";
    options.forEach((option) => {
        const element = createElement("option", "", option.label);

        element.value = option.value;
        optionElements.push(element);
    });
    select.replaceChildren(...optionElements);
    select.value = options.some((option) => option.value === currentValue) ? currentValue : "";
}

function renderSubmissionFilters(courses, classrooms, lessons, submissions) {
    const students = [...new Set(submissions.map((submission) => submission.student_user_id).filter(Boolean))]
        .sort()
        .map((studentId) => ({
            label: getStudentName(studentId),
            value: studentId,
        }));

    populateSelect(
        submissionFilterCourse,
        courses.map((course) => ({ label: course.title || "Untitled course", value: course.id })),
        "All courses"
    );
    populateSelect(
        submissionFilterClassroom,
        classrooms.map((classroom) => ({ label: classroom.period_block ? `${classroom.name} - ${classroom.period_block}` : classroom.name, value: classroom.id })),
        "All classrooms"
    );
    populateSelect(
        submissionFilterLesson,
        lessons.map((lesson) => ({ label: lesson.title || "Untitled lesson", value: lesson.id })),
        "All lessons"
    );
    populateSelect(submissionFilterStudent, students, "All students");
}

function getFilteredSubmissions() {
    const filters = getSubmissionFilters();

    return dashboardSubmissions.filter((submission) => (
        (!filters.courseId || submission.course_id === filters.courseId)
        && (!filters.classroomId || submission.classroom_id === filters.classroomId)
        && (!filters.lessonId || submission.lesson_id === filters.lessonId)
        && (!filters.studentId || submission.student_user_id === filters.studentId)
    ));
}

function renderSubmissions(submissions, courses, lessons) {
    if (!submissions.length) {
        renderEmpty(submissionList, "No recent student submissions are available for your managed courses.");
        return;
    }

    const courseNames = new Map(courses.map((course) => [course.id, course.title || "Untitled course"]));
    const lessonNames = new Map(lessons.map((lesson) => [lesson.id, lesson.title || "Untitled lesson"]));
    const list = createElement("ul", "submission-list");

    submissions.forEach((submission) => {
        const item = createElement("li", "submission-item submission-item--review");
        const link = createElement(
            "a",
            "submission-name",
            lessonNames.get(submission.lesson_id) || `${courseNames.get(submission.course_id) || "Course"} submission`
        );
        const context = createElement("span", "course-muted", courseNames.get(submission.course_id) || "Course");
        const student = createElement("span", "course-muted", getStudentName(submission.student_user_id));
        const submittedAt = submission.submitted_at
            ? createElement("span", "course-muted", new Date(submission.submitted_at).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
            }))
            : createElement("span", "course-muted", "Not submitted");
        const status = createElement("span", "badge badge--quiet", formatStatus(submission.status));

        link.href = `../submissions/view.html?submission=${encodeURIComponent(submission.id)}`;
        item.append(link, context, student, submittedAt, status);
        list.append(item);
    });

    submissionList.replaceChildren(list);
}

function refreshSubmissionList() {
    renderSubmissions(getFilteredSubmissions(), dashboardCourses, dashboardLessons);
}

function getStudentWorkLink(submission) {
    if (submission.status === "submitted") {
        return `../submissions/view.html?submission=${encodeURIComponent(submission.id)}`;
    }

    const params = new URLSearchParams({ lesson: submission.lesson_id });

    if (submission.classroom_id) {
        params.set("classroom", submission.classroom_id);
    }

    return `../lessons/view.html?${params.toString()}`;
}

function buildStudentSubmissionList(submissions, courses, lessons) {
    const courseNames = new Map(courses.map((course) => [course.id, course.title || "Untitled course"]));
    const lessonNames = new Map(lessons.map((lesson) => [lesson.id, lesson.title || "Untitled lesson"]));
    const list = createElement("ul", "submission-list");

    submissions.forEach((submission) => {
        const item = createElement("li", "submission-item");
        const link = createElement(
            "a",
            "submission-name",
            lessonNames.get(submission.lesson_id) || `${courseNames.get(submission.course_id) || "Course"} submission`
        );
        const context = createElement("span", "course-muted", courseNames.get(submission.course_id) || "Course");
        const activityDate = submission.status === "submitted" ? submission.submitted_at : submission.updated_at;
        const activityLabel = activityDate
            ? createElement("span", "course-muted", new Date(activityDate).toLocaleString([], {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
            }))
            : createElement("span", "course-muted", "In progress");
        const status = submission.status === "submitted"
            ? createElement("span", "badge", "Submitted")
            : createElement("span", "badge badge--quiet", "Draft");

        link.href = getStudentWorkLink(submission);
        item.append(link, context, activityLabel, status);
        list.append(item);
    });

    return list;
}

function renderStudentSubmissions(submissions, courses, lessons) {
    if (!submissions.length) {
        renderEmpty(studentSubmissionList, "You do not have any saved lesson work yet.");
        return;
    }

    studentSubmissionList.replaceChildren(buildStudentSubmissionList(submissions, courses, lessons));
}

function renderStudentActivity(submissions, courses, lessons) {
    if (!submissions.length) {
        renderEmpty(studentActivityList, "No recent lesson activity yet.");
        return;
    }

    studentActivityList.replaceChildren(buildStudentSubmissionList(submissions.slice(0, 3), courses, lessons));
}

async function deleteCourse(course) {
    const confirmed = window.confirm(
        `Delete "${course.title || "Untitled course"}"? This removes it from your dashboard while preserving its existing history.`
    );

    if (!confirmed) {
        return;
    }

    setStatus("Deleting course...");

    const { error } = await supabase
        .from("courses")
        .update({ status: "deleted" })
        .eq("id", course.id);

    if (error) {
        setStatus(error.message || "The course could not be deleted.", "error");
        return;
    }

    await refreshDashboard();
    setStatus("Course deleted.", "success");
}

async function refreshDashboard() {
    setStatus("Loading your workspace...");

    try {
        const courses = await loadTeachingCourses(currentProfile.id);
        const courseIds = courses.map((course) => course.id);
        const studentEnrollments = await loadStudentEnrollments(currentProfile.id);
        const studentEnrollmentCourseIds = studentEnrollments.map((enrollment) => enrollment.course_id);
        const studentEnrollmentClassroomIds = studentEnrollments
            .map((enrollment) => enrollment.classroom_id)
            .filter(Boolean);
        const studentSubmissions = await loadStudentSubmissions(currentProfile.id);
        const studentCourseIds = studentSubmissions.map((submission) => submission.course_id);
        const allCourseIds = [...new Set([...courseIds, ...studentEnrollmentCourseIds, ...studentCourseIds])];
        const [classrooms, studentClassrooms, lessons, submissions, visibleCourses, studentNames, studentTeachers] = await Promise.all([
            loadManagedClassrooms(currentProfile.id, courseIds),
            loadVisibleClassrooms(studentEnrollmentClassroomIds),
            loadLessons(allCourseIds),
            loadRecentSubmissions(courseIds),
            loadVisibleCourses(allCourseIds),
            loadStudentNameMap(),
            loadStudentTeacherMap(),
        ]);
        const displayStudentEnrollments = getDisplayStudentEnrollments(studentEnrollments);
        const isStudentOnly = !courses.length;
        const hasStudentEnrollments = Boolean(displayStudentEnrollments.length);
        const submittedStudentWork = studentSubmissions.filter((submission) => submission.status === "submitted");
        const studentPoints = submittedStudentWork.reduce((total, submission) => total + Number(submission.points_earned || 0), 0);
        const progressTotals = displayStudentEnrollments.reduce((totals, enrollment) => {
            const progress = getStudentCourseProgress(enrollment, lessons, studentSubmissions);

            return {
                lessonCount: totals.lessonCount + progress.lessonCount,
                submittedCount: totals.submittedCount + progress.submittedCount,
            };
        }, { lessonCount: 0, submittedCount: 0 });
        const overallProgress = progressTotals.lessonCount
            ? Math.round((progressTotals.submittedCount / progressTotals.lessonCount) * 100)
            : 0;

        dashboardCourses = courses;
        dashboardClassrooms = classrooms;
        dashboardLessons = lessons;
        dashboardSubmissions = submissions;
        dashboardStudentNames = studentNames;
        dashboardStudentTeachers = studentTeachers;
        courseFormToggle.hidden = isStudentOnly;
        courseFormPanel.hidden = true;
        teacherSubmissionsSection.hidden = isStudentOnly;
        teacherAnalyticsEntry.hidden = isStudentOnly;
        const isActiveAdmin = isPlatformAdmin(currentProfile.platform_role) && currentProfile.account_status === "active";
        adminDashboardEntry.hidden = !isActiveAdmin;
        adminActivityEntry.hidden = !isActiveAdmin;
        studentActivitySection.hidden = !isStudentOnly;
        studentJoinSection.hidden = !isStudentOnly;
        studentProgressEntry.hidden = !hasStudentEnrollments;
        if (enrolledCoursesSection) {
            enrolledCoursesSection.hidden = isStudentOnly || !hasStudentEnrollments;
        }

        if (isStudentOnly) {
            greetingElement.textContent = `Welcome, ${currentProfile.username || "there"}. Continue your courses and review lesson work.`;
            coursesSummaryLabel.textContent = "My courses";
            classroomsSummaryLabel.textContent = "Active classrooms";
            submissionsSummaryLabel.textContent = "Course progress";
            studentSubmissionsSummaryLabel.textContent = "Engagement points";
            managedCoursesHeading.textContent = "My courses";
            managedCoursesCopy.textContent = displayStudentEnrollments.length
                ? "Open enrolled courses, continue drafts, and turn in lesson work."
                : "Joined courses and classrooms will appear here.";
            coursesSummary.textContent = String(displayStudentEnrollments.length);
            classroomsSummary.textContent = String(displayStudentEnrollments.filter((enrollment) => enrollment.enrollment_type === "classroom").length);
            submissionsSummary.textContent = `${overallProgress}%`;
            studentSubmissionsSummary.textContent = String(studentPoints);
            renderStudentEnrollments(displayStudentEnrollments, visibleCourses, studentClassrooms, lessons, studentSubmissions);
        } else {
            greetingElement.textContent = `Welcome, ${currentProfile.username || "there"}. Manage teaching work and continue saved lessons.`;
            coursesSummaryLabel.textContent = "Courses I teach";
            classroomsSummaryLabel.textContent = "Managed classrooms";
            submissionsSummaryLabel.textContent = "Recent submissions";
            studentSubmissionsSummaryLabel.textContent = "My lesson work";
            managedCoursesHeading.textContent = "Your managed courses";
            managedCoursesCopy.textContent = "Courses you own or help teach appear here. New courses start as private drafts.";
            coursesSummary.textContent = String(courses.length);
            classroomsSummary.textContent = String(classrooms.length);
            submissionsSummary.textContent = String(submissions.length);
            studentSubmissionsSummary.textContent = String(studentSubmissions.length);
            renderCourses(courses, classrooms);

            if (hasStudentEnrollments && enrolledCourseList) {
                renderStudentEnrollments(displayStudentEnrollments, visibleCourses, studentClassrooms, lessons, studentSubmissions, enrolledCourseList);
            }
        }

        renderSubmissionFilters(courses, classrooms, lessons.filter((lesson) => courseIds.includes(lesson.course_id)), submissions);
        refreshSubmissionList();
        renderStudentActivity(studentSubmissions, visibleCourses, lessons);
        renderStudentSubmissions(studentSubmissions, visibleCourses, lessons);
        setStatus("");
    } catch (error) {
        setStatus(error.message || "Your workspace could not be loaded.", "error");
        renderEmpty(courseList, "Courses could not be loaded right now.");
        renderEmpty(submissionList, "Submissions could not be loaded right now.");
        renderEmpty(studentSubmissionList, "Your submissions could not be loaded right now.");
    }
}

async function initializeDashboard() {
    const profile = await loadProtectedProfile({
        profileColumns: "id, username, legal_first_name, legal_last_name, email, profile_photo_url, avatar_type, avatar_key, profile_completed, platform_role, account_status",
        statusElement: dashboardStatus,
    });

    if (!profile) {
        return;
    }

    currentProfile = profile;
    renderDashboardAvatar(profile);
    greetingElement.textContent = `Welcome, ${profile.username || "there"}. Manage teaching work and continue saved lessons.`;
    courseFormToggle.disabled = false;
    logoutButton.disabled = false;
    await refreshDashboard();
    await handleClassroomInvite(dashboardParams.get("classroomInvite"));
    await handlePublicCourseJoin(dashboardParams.get("courseJoin"));
}

courseFormToggle.addEventListener("click", () => {
    setCourseFormVisible(courseFormPanel.hidden);
});

courseFormCancel.addEventListener("click", () => {
    courseForm.reset();
    setCourseFormVisible(false);
});

submissionFilterForm.addEventListener("change", refreshSubmissionList);
studentJoinForm.addEventListener("submit", handleStudentJoinSubmit);
logoutButton.addEventListener("click", handleLogout);

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
