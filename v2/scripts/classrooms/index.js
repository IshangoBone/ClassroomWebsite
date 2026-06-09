import { supabase } from "../../services/supabase/client.js";
import { loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { setStatusMessage } from "../utils/ui-components.js";

const statusElement = qs("[data-classes-status]");
const classList = qs("[data-class-list]");
const enrollmentsSummary = qs("[data-summary-enrollments]");
const classroomsSummary = qs("[data-summary-classrooms]");
const submittedSummary = qs("[data-summary-submitted]");
const progressSummary = qs("[data-summary-progress]");

let currentProfile = null;
let teacherNames = new Map();

function formatStatus(status = "") {
    return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Active";
}

function formatShortId(id) {
    return id ? id.slice(0, 8) : "unknown";
}

function formatStudentName(profile) {
    const fullName = [profile.legal_first_name, profile.legal_last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || profile.username || `Teacher ${formatShortId(profile.id)}`;
}

function getTeacherKey(courseId, classroomId) {
    return `${courseId}:${classroomId || "course"}`;
}

function getTeacherName(enrollment) {
    return teacherNames.get(getTeacherKey(enrollment.course_id, enrollment.classroom_id))
        || teacherNames.get(getTeacherKey(enrollment.course_id, null))
        || "Teacher";
}

function renderEmpty(message) {
    classList.replaceChildren(createElement("p", "empty-state", message));
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

    return data || [];
}

async function loadCourses(courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("courses")
        .select("id, title, subject_area, estimated_length, description")
        .in("id", courseIds)
        .neq("status", "deleted");

    if (error) {
        throw error;
    }

    return data || [];
}

async function loadClassrooms(classroomIds) {
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

    return data || [];
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

    const moduleIds = (modules || []).map((module) => module.id);

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

    return (lessons || []).map((lesson) => ({
        ...lesson,
        course_id: courseByModuleId.get(lesson.module_id),
    }));
}

async function loadSubmissions(profileId) {
    const { data, error } = await supabase
        .from("lesson_submissions")
        .select("id, course_id, classroom_id, lesson_id, status, submitted_at, updated_at")
        .eq("student_user_id", profileId)
        .order("updated_at", { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
}

async function loadTeacherNames() {
    const { data, error } = await supabase.rpc("student_visible_teachers");

    if (error || !data) {
        return new Map();
    }

    return new Map(data.map((profile) => [
        getTeacherKey(profile.course_id, profile.classroom_id),
        formatStudentName(profile),
    ]));
}

function getEnrollmentCourse(enrollment, courses) {
    return courses.find((course) => course.id === enrollment.course_id);
}

function getEnrollmentClassroom(enrollment, classrooms) {
    return enrollment.classroom_id
        ? classrooms.find((classroom) => classroom.id === enrollment.classroom_id)
        : null;
}

function getRelevantSubmissions(enrollment, submissions) {
    return submissions.filter((submission) => (
        submission.course_id === enrollment.course_id
        && (enrollment.classroom_id ? submission.classroom_id === enrollment.classroom_id : !submission.classroom_id)
    ));
}

function getProgress(enrollment, lessons, submissions) {
    const lessonCount = lessons.filter((lesson) => lesson.course_id === enrollment.course_id).length;
    const submittedCount = getRelevantSubmissions(enrollment, submissions)
        .filter((submission) => submission.status === "submitted").length;

    return {
        lessonCount,
        submittedCount,
        incompleteCount: Math.max(lessonCount - submittedCount, 0),
        progressPercent: lessonCount ? Math.round((submittedCount / lessonCount) * 100) : 0,
    };
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

function getContinueLesson(enrollment, lessons, submissions) {
    const courseLessons = lessons
        .filter((lesson) => lesson.course_id === enrollment.course_id)
        .sort((first, second) => first.order_index - second.order_index);

    if (!courseLessons.length) {
        return null;
    }

    const submissionsByLesson = new Map(
        getRelevantSubmissions(enrollment, submissions)
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
    const nextSubmission = submissionsByLesson.get(nextLesson.id);

    if (enrollment.classroom_id) {
        nextParams.set("classroom", enrollment.classroom_id);
    }

    return {
        href: `../lessons/view.html?${nextParams.toString()}`,
        label: nextSubmission?.status === "submitted" ? "Review lesson" : "Continue lesson",
        detail: nextSubmission?.status === "submitted"
            ? `Completed: ${nextLesson.title || "Lesson"}`
            : `Next: ${nextLesson.title || "Lesson"}`,
        isComplete: nextSubmission?.status === "submitted",
    };
}

async function leaveEnrollment(enrollment) {
    const label = enrollment.enrollment_type === "classroom" ? "classroom" : "course";
    const confirmed = window.confirm(
        `Leave this ${label}? Your existing work history will be preserved.`
    );

    if (!confirmed) {
        return;
    }

    setStatusMessage(statusElement, `Leaving ${label}...`);

    const { error } = await supabase.rpc("leave_student_enrollment", {
        enrollment_id_input: enrollment.id,
    });

    if (error) {
        setStatusMessage(statusElement, error.message || `You could not leave this ${label}.`, "error");
        return;
    }

    await refreshClasses();
    setStatusMessage(statusElement, `You left this ${label}.`, "success");
}

function createClassCard(enrollment, courses, classrooms, lessons, submissions) {
    const course = getEnrollmentCourse(enrollment, courses);
    const classroom = getEnrollmentClassroom(enrollment, classrooms);
    const progress = getProgress(enrollment, lessons, submissions);
    const continueLesson = getContinueLesson(enrollment, lessons, submissions);
    const card = createElement("article", "course-card student-class-card");
    const heading = createElement("div", "course-card-header");
    const titleGroup = createElement("div", "student-class-card__title");
    const title = createElement("h3", "course-title", course?.title || "Untitled course");
    const badges = createElement("div", "badge-row");
    const classroomLabel = classroom
        ? (classroom.period_block ? `${classroom.name} - ${classroom.period_block}` : classroom.name)
        : "Independent course";

    badges.append(
        createElement("span", "badge", enrollment.enrollment_type === "classroom" ? "Classroom" : "Course"),
        createElement("span", "badge badge--quiet", formatStatus(enrollment.enrollment_status))
    );
    titleGroup.append(title, createElement("p", "course-details", classroomLabel));
    heading.append(titleGroup, badges);

    const teacher = createElement("p", "course-muted", `Teacher: ${getTeacherName(enrollment)}`);
    const description = createElement(
        "p",
        "course-muted",
        course?.description || "Your teacher has not added a course description yet."
    );
    const progressText = createElement(
        "p",
        "course-muted",
        progress.lessonCount
            ? `${progress.submittedCount} of ${progress.lessonCount} lessons submitted.`
            : "Lessons will appear here when your teacher adds them."
    );
    const progressBar = createElement("div", "dashboard-progress");
    const progressValue = createElement("span", "dashboard-progress-value");
    const actions = createElement("div", "course-actions course-actions--split");
    const mainActions = createElement("div", "course-actions-group course-actions-group--main");
    const enrollmentActions = createElement("div", "course-actions-group course-actions-group--danger");
    const courseParams = new URLSearchParams({ course: enrollment.course_id });
    const openCourseAction = createElement("a", "secondary-button", "Open class");
    const leaveAction = createElement(
        "button",
        "secondary-button destructive-button",
        enrollment.enrollment_type === "classroom" ? "Leave classroom" : "Unenroll"
    );

    progressBar.setAttribute("role", "progressbar");
    progressBar.setAttribute("aria-label", `${progress.progressPercent}% complete`);
    progressBar.setAttribute("aria-valuemin", "0");
    progressBar.setAttribute("aria-valuemax", "100");
    progressBar.setAttribute("aria-valuenow", String(progress.progressPercent));
    progressValue.style.width = `${progress.progressPercent}%`;
    progressBar.append(progressValue);

    if (enrollment.classroom_id) {
        courseParams.set("classroom", enrollment.classroom_id);
    }

    openCourseAction.href = `../courses/student.html?${courseParams.toString()}`;
    leaveAction.type = "button";
    leaveAction.addEventListener("click", () => leaveEnrollment(enrollment));

    if (continueLesson) {
        const continueAction = createElement("a", "primary-button", continueLesson.label);
        continueAction.href = continueLesson.href;
        mainActions.append(continueAction);
    }

    mainActions.append(openCourseAction);
    enrollmentActions.append(leaveAction);
    actions.append(mainActions, enrollmentActions);

    card.append(heading, teacher, description, progressText, progressBar);

    if (continueLesson) {
        card.append(createElement(
            "p",
            continueLesson.isComplete ? "course-muted" : "dashboard-next-step",
            continueLesson.detail
        ));
    }

    if (progress.lessonCount && progress.incompleteCount) {
        card.append(createElement(
            "p",
            "dashboard-incomplete-note",
            progress.incompleteCount === 1
                ? "1 lesson still needs your attention."
                : `${progress.incompleteCount} lessons still need your attention.`
        ));
    }

    card.append(actions);

    return card;
}

function renderClasses(enrollments, courses, classrooms, lessons, submissions) {
    if (!enrollments.length) {
        renderEmpty("You have not joined any classes yet. Browse courses or enter a join code from Home.");
        return;
    }

    classList.replaceChildren(
        ...enrollments.map((enrollment) => createClassCard(enrollment, courses, classrooms, lessons, submissions))
    );
}

function renderSummary(enrollments, lessons, submissions) {
    const submittedCount = submissions.filter((submission) => submission.status === "submitted").length;
    const totalLessonSlots = enrollments.reduce((total, enrollment) => (
        total + lessons.filter((lesson) => lesson.course_id === enrollment.course_id).length
    ), 0);
    const progressPercent = totalLessonSlots ? Math.round((submittedCount / totalLessonSlots) * 100) : 0;

    enrollmentsSummary.textContent = String(enrollments.length);
    classroomsSummary.textContent = String(enrollments.filter((enrollment) => enrollment.enrollment_type === "classroom").length);
    submittedSummary.textContent = String(submittedCount);
    progressSummary.textContent = `${progressPercent}%`;
}

async function refreshClasses() {
    setStatusMessage(statusElement, "Loading your classes...");

    try {
        const enrollments = await loadStudentEnrollments(currentProfile.id);
        const courseIds = [...new Set(enrollments.map((enrollment) => enrollment.course_id))];
        const classroomIds = [...new Set(enrollments.map((enrollment) => enrollment.classroom_id).filter(Boolean))];
        const [courses, classrooms, lessons, submissions] = await Promise.all([
            loadCourses(courseIds),
            loadClassrooms(classroomIds),
            loadLessons(courseIds),
            loadSubmissions(currentProfile.id),
        ]);

        teacherNames = await loadTeacherNames();
        renderSummary(enrollments, lessons, submissions);
        renderClasses(enrollments, courses, classrooms, lessons, submissions);
        setStatusMessage(statusElement, "");
    } catch (error) {
        setStatusMessage(statusElement, error.message || "Your classes could not be loaded.", "error");
        renderEmpty("Your classes could not be loaded right now.");
    }
}

async function initializeClassesPage() {
    const profile = await loadProtectedProfile({
        profileColumns: "id, username, legal_first_name, legal_last_name, email, profile_completed, platform_role, account_status",
        statusElement,
    });

    if (!profile) {
        return;
    }

    currentProfile = profile;
    await refreshClasses();
}

initializeClassesPage();
