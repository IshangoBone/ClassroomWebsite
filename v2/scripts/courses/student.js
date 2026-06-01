import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const params = new URLSearchParams(window.location.search);
const courseId = params.get("course");
const classroomId = params.get("classroom");
const headingElement = qs("[data-student-course-heading]");
const contextElement = qs("[data-student-course-context]");
const statusElement = qs("[data-student-course-status]");
const summaryElement = qs("[data-student-course-summary]");
const shellElement = qs("[data-student-course-shell]");
const progressSection = qs("[data-student-course-progress-section]");
const progressCopyElement = qs("[data-student-course-progress-copy]");
const progressBarElement = qs("[data-student-course-progress-bar]");
const progressValueElement = qs("[data-student-course-progress-value]");
const nextSection = qs("[data-student-course-next-section]");
const progressElement = qs("[data-student-course-progress]");
const submittedElement = qs("[data-student-course-submitted]");
const nextElement = qs("[data-student-course-next]");
const pointsElement = qs("[data-student-course-points]");
const nextCopyElement = qs("[data-student-course-next-copy]");
const nextLinkElement = qs("[data-student-course-next-link]");
const moduleListElement = qs("[data-student-course-module-list]");

let currentProfileId = "";

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function setAccessStatus(message) {
    const discoveryLink = createElement("a", "status-link", "Browse public courses");
    const dashboardLink = createElement("a", "status-link", "Back to dashboard");

    discoveryLink.href = "discover.html";
    dashboardLink.href = "../dashboard/index.html";
    statusElement.replaceChildren(message, " ", discoveryLink, " ", dashboardLink);
    statusElement.dataset.tone = "error";
}

function formatStatus(status) {
    return status
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function formatTeacherName(profile) {
    const fullName = [profile.legal_first_name, profile.legal_last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || profile.username || "Teacher";
}

function getSubmissionForLesson(lesson, submissions) {
    return submissions.find((submission) => submission.lesson_id === lesson.id);
}

function getLessonStatus(lesson, submissions) {
    const submission = getSubmissionForLesson(lesson, submissions);

    if (submission?.status === "submitted") {
        return "submitted";
    }

    if (submission?.status === "draft") {
        return "in_progress";
    }

    return "not_started";
}

function getLessonHref(lesson, enrollment) {
    const paramsToSet = new URLSearchParams({ lesson: lesson.id });

    if (enrollment.classroom_id) {
        paramsToSet.set("classroom", enrollment.classroom_id);
    }

    return `../lessons/view.html?${paramsToSet.toString()}`;
}

function getNextLesson(lessons, submissions) {
    const orderedLessons = [...lessons].sort((first, second) => first.order_index - second.order_index);
    const draftSubmission = submissions.find((submission) => submission.status === "draft");

    if (draftSubmission) {
        const draftLesson = orderedLessons.find((lesson) => lesson.id === draftSubmission.lesson_id);

        if (draftLesson) {
            return { lesson: draftLesson, label: "Continue draft" };
        }
    }

    const nextLesson = orderedLessons.find((lesson) => getLessonStatus(lesson, submissions) !== "submitted");

    if (nextLesson) {
        return { lesson: nextLesson, label: "Continue lesson" };
    }

    return orderedLessons.length
        ? { lesson: orderedLessons[orderedLessons.length - 1], label: "Review lesson" }
        : null;
}

function getProgress(lessons, submissions) {
    const submittedCount = lessons.filter((lesson) => getLessonStatus(lesson, submissions) === "submitted").length;
    const points = submissions
        .filter((submission) => submission.status === "submitted")
        .reduce((total, submission) => total + Number(submission.points_earned || 0), 0);

    return {
        points,
        progressPercent: lessons.length ? Math.round((submittedCount / lessons.length) * 100) : 0,
        submittedCount,
        totalLessons: lessons.length,
    };
}

function getModuleProgress(moduleLessons, submissions) {
    const submittedCount = moduleLessons.filter((lesson) => getLessonStatus(lesson, submissions) === "submitted").length;

    return {
        isComplete: Boolean(moduleLessons.length) && submittedCount === moduleLessons.length,
        submittedCount,
        totalLessons: moduleLessons.length,
    };
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

async function loadEnrollment() {
    if (!courseId) {
        setStatus("Open a course from your dashboard before viewing it.", "error");
        return null;
    }

    let query = supabase
        .from("enrollments")
        .select("id, course_id, classroom_id, enrollment_type, enrollment_status, joined_at")
        .eq("user_id", currentProfileId)
        .eq("course_id", courseId)
        .neq("enrollment_status", "removed");

    query = classroomId ? query.eq("classroom_id", classroomId) : query;

    const { data, error } = await query;

    if (error) {
        setStatus("Your course enrollment could not be loaded.", "error");
        return null;
    }

    const enrollment = classroomId
        ? data?.[0]
        : data?.find((row) => row.enrollment_type === "course" && !row.classroom_id) || data?.[0];

    if (!enrollment) {
        setAccessStatus("This course is not in your active enrollments. Join it from public discovery or use a classroom invite from your teacher.");
        return null;
    }

    return enrollment;
}

async function loadCourse() {
    const { data, error } = await supabase
        .from("courses")
        .select("id, title, description, subject_area, estimated_length, status")
        .eq("id", courseId)
        .single();

    if (error) {
        setStatus("This course could not be loaded.", "error");
        return null;
    }

    return data;
}

async function loadClassroom(enrollment) {
    if (!enrollment.classroom_id) {
        return null;
    }

    const { data, error } = await supabase
        .from("classrooms")
        .select("id, name, period_block, school_year, status")
        .eq("id", enrollment.classroom_id)
        .single();

    if (error) {
        setStatus("Classroom details could not be loaded, but the course is still available.", "error");
        return null;
    }

    return data;
}

async function loadModules() {
    const { data, error } = await supabase
        .from("modules")
        .select("id, title, description, order_index")
        .eq("course_id", courseId)
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
        .select("id, module_id, title, objective, summary, estimated_time, order_index")
        .in("module_id", moduleIds)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        throw error;
    }

    return data;
}

async function loadSubmissions(enrollment) {
    let query = supabase
        .from("lesson_submissions")
        .select("id, course_id, classroom_id, lesson_id, status, submitted_at, updated_at, points_earned, points_possible")
        .eq("student_user_id", currentProfileId)
        .eq("course_id", courseId);

    query = enrollment.classroom_id ? query.eq("classroom_id", enrollment.classroom_id) : query.is("classroom_id", null);

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return data;
}

async function loadTeacherName(enrollment) {
    const { data, error } = await supabase.rpc("student_visible_teachers");

    if (error || !data) {
        return "Teacher";
    }

    const teacher = data.find((profile) => (
        profile.course_id === enrollment.course_id
        && (enrollment.classroom_id ? profile.classroom_id === enrollment.classroom_id : !profile.classroom_id)
    )) || data.find((profile) => profile.course_id === enrollment.course_id);

    return teacher ? formatTeacherName(teacher) : "Teacher";
}

function renderSummary(enrollment, lessons, submissions) {
    const { points, progressPercent, submittedCount, totalLessons } = getProgress(lessons, submissions);
    const nextLesson = getNextLesson(lessons, submissions);
    const isComplete = Boolean(totalLessons) && submittedCount === totalLessons;

    progressElement.textContent = `${progressPercent}%`;
    submittedElement.textContent = `${submittedCount}/${totalLessons}`;
    pointsElement.textContent = String(points);
    nextElement.textContent = isComplete ? "Complete" : nextLesson?.lesson?.title || "Ready";
    progressCopyElement.textContent = totalLessons
        ? `${submittedCount} of ${totalLessons} lessons submitted.`
        : "Lessons will appear once this course is ready.";
    progressBarElement.setAttribute("aria-valuenow", String(progressPercent));
    progressValueElement.style.width = `${progressPercent}%`;

    if (nextLesson) {
        nextCopyElement.textContent = isComplete
            ? "All lessons are submitted. You can still review the latest lesson and feedback."
            : `${nextLesson.label}: ${nextLesson.lesson.title || "Untitled lesson"}`;
        nextLinkElement.textContent = nextLesson.label;
        nextLinkElement.href = getLessonHref(nextLesson.lesson, enrollment);
        nextSection.hidden = false;
    } else {
        nextSection.hidden = true;
    }

    summaryElement.hidden = false;
    progressSection.hidden = false;
}

function renderModules(modules, lessons, submissions, enrollment) {
    if (!modules.length) {
        moduleListElement.replaceChildren(createElement("p", "empty-state", "Modules will appear here when this course is ready."));
        return;
    }

    const list = createElement("ol", "module-list");

    const firstIncompleteModuleId = modules.find((module) => {
        const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id);

        return moduleLessons.some((lesson) => getLessonStatus(lesson, submissions) !== "submitted");
    })?.id;

    modules.forEach((module, moduleIndex) => {
        const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id);
        const moduleProgress = getModuleProgress(moduleLessons, submissions);
        const item = document.createElement("details");
        const summary = createElement("summary", "module-card-header");
        const titleGroup = createElement("div");
        const title = createElement("h3", "course-title", module.title || "Untitled module");
        const description = createElement("p", "course-muted", module.description || "No module description added yet.");
        const label = createElement(
            "span",
            moduleProgress.isComplete ? "badge" : "badge badge--quiet",
            moduleProgress.totalLessons
                ? `Module ${module.order_index + 1} / ${moduleProgress.submittedCount} of ${moduleProgress.totalLessons}`
                : `Module ${module.order_index + 1}`
        );
        const lessonSection = createElement("section", "module-lessons");

        item.className = "module-card student-module-card";
        item.open = firstIncompleteModuleId ? module.id === firstIncompleteModuleId : moduleIndex === 0;
        titleGroup.append(title, description);
        summary.append(titleGroup, label);
        lessonSection.append(createElement("h4", "", "Lessons"));

        if (!moduleLessons.length) {
            lessonSection.append(createElement("p", "empty-state empty-state--compact", "No lessons in this module yet."));
        } else {
            const lessonList = createElement("ol", "lesson-list");

            moduleLessons.forEach((lesson) => {
                const status = getLessonStatus(lesson, submissions);
                const lessonItem = createElement("li", "lesson-card");
                const header = createElement("div", "lesson-card-header");
                const content = createElement("div");
                const lessonTitle = createElement("h5", "lesson-title", lesson.title || "Untitled lesson");
                const lessonSummary = createElement("p", "course-muted", lesson.summary || lesson.objective || "No lesson overview added yet.");
                const metaRow = createElement("div", "badge-row lesson-meta-row");
                const actions = createElement("div", "lesson-header-actions");
                const lessonLink = createElement("a", status === "submitted" ? "secondary-button lesson-action" : "primary-button lesson-action", status === "submitted" ? "Review" : "Open");

                lessonLink.href = getLessonHref(lesson, enrollment);
                metaRow.append(
                    createElement("span", "badge badge--quiet", `Lesson ${lesson.order_index + 1}`),
                    createElement("span", "badge badge--quiet", lesson.estimated_time || "No time estimate"),
                    createElement("span", status === "submitted" ? "badge" : "badge badge--quiet", formatStatus(status))
                );
                content.append(lessonTitle, lessonSummary, metaRow);
                actions.append(lessonLink);
                header.append(content, actions);
                lessonItem.append(header);
                lessonList.append(lessonItem);
            });
            lessonSection.append(lessonList);
        }

        item.append(summary, lessonSection);
        list.append(item);
    });

    moduleListElement.replaceChildren(list);
}

async function initializePage() {
    setStatus("Loading student course view...");
    const profile = await loadCurrentProfile();

    if (!profile) {
        return;
    }

    currentProfileId = profile.id;
    const enrollment = await loadEnrollment();

    if (!enrollment) {
        headingElement.textContent = "Course unavailable";
        return;
    }

    const course = await loadCourse();

    if (!course) {
        headingElement.textContent = "Course unavailable";
        return;
    }

    try {
        const [classroom, teacherName, modules] = await Promise.all([
            loadClassroom(enrollment),
            loadTeacherName(enrollment),
            loadModules(),
        ]);
        const lessons = await loadLessons(modules.map((module) => module.id));
        const submissions = await loadSubmissions(enrollment);
        const classroomLabel = classroom
            ? `${classroom.name}${classroom.period_block ? ` - ${classroom.period_block}` : ""}`
            : "Independent course";

        headingElement.textContent = course.title || "Untitled course";
        contextElement.textContent = `${classroomLabel} / ${teacherName} / ${course.description || "No course description added yet."}`;
        renderSummary(enrollment, lessons, submissions);
        renderModules(modules, lessons, submissions, enrollment);
        shellElement.hidden = false;
        setStatus("");
    } catch (error) {
        setStatus(error.message || "Student course view could not be loaded.", "error");
    }
}

await initializePage();
