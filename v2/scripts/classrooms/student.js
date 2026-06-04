import { supabase } from "../../services/supabase/client.js";
import { loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { notifyStatus } from "../utils/ui-components.js";

const params = new URLSearchParams(window.location.search);
const classroomId = params.get("classroom");
const studentId = params.get("student");
const backLink = qs("[data-roster-back-link]");
const headingElement = qs("[data-student-heading]");
const contextElement = qs("[data-student-context]");
const statusElement = qs("[data-student-status]");
const shellElements = [...document.querySelectorAll("[data-student-shell]")];
const summaryElement = qs("[data-student-summary]");
const reviewStudentLink = qs("[data-review-student-link]");
const workListElement = qs("[data-student-work-list]");

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
    notifyStatus(message, tone);
}

function formatStudentName(student) {
    const fullName = [student.legal_first_name, student.legal_last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || student.username || student.email || "Unnamed student";
}

function formatDateTime(value, fallback = "No activity yet") {
    if (!value) {
        return fallback;
    }

    return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function formatStatus(status = "draft") {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function createSummaryCard(label, value) {
    const card = createElement("article", "summary-card");

    card.append(createElement("span", "summary-label", label), createElement("strong", "summary-value summary-value--small", value));
    return card;
}

function formatProgress(submittedCount, lessonCount) {
    if (!lessonCount && submittedCount) {
        return `${submittedCount} submitted`;
    }

    return `${lessonCount ? Math.round((submittedCount / lessonCount) * 100) : 0}%`;
}

function getSubmissionLink(submission) {
    if (submission.status === "submitted") {
        return `../submissions/view.html?submission=${encodeURIComponent(submission.id)}`;
    }

    const lessonParams = new URLSearchParams({ lesson: submission.lesson_id, classroom: classroomId });
    return `../lessons/view.html?${lessonParams.toString()}`;
}

async function loadCurrentProfile() {
    return loadProtectedProfile({ statusElement });
}

async function loadClassroomContext() {
    if (!classroomId || !studentId) {
        headingElement.textContent = "Student unavailable";
        setStatus("Open a student from the classroom roster.", "error");
        return null;
    }

    const { data: classroom, error: classroomError } = await supabase
        .from("classrooms")
        .select("id, course_id, name, period_block, school_year, status")
        .eq("id", classroomId)
        .single();

    if (classroomError || !classroom) {
        headingElement.textContent = "Student unavailable";
        setStatus("This classroom could not be loaded. Check that your account can manage it.", "error");
        return null;
    }

    const { data: canManage, error: permissionError } = await supabase.rpc("manages_classroom", {
        classroom_to_check: classroomId,
    });

    if (permissionError || !canManage) {
        headingElement.textContent = "Student unavailable";
        setStatus("You do not have permission to view this classroom student.", "error");
        return null;
    }

    const { data: course } = await supabase
        .from("courses")
        .select("id, title")
        .eq("id", classroom.course_id)
        .maybeSingle();

    return { classroom, course };
}

async function loadRosterStudent() {
    const { data, error } = await supabase.rpc("classroom_roster", {
        classroom_to_check: classroomId,
    });

    if (error) {
        setStatus(error.message || "Classroom roster could not be loaded.", "error");
        return null;
    }

    const student = (data || []).find((row) => row.student_user_id === studentId);

    if (!student) {
        headingElement.textContent = "Student unavailable";
        setStatus("This student was not found in the classroom roster.", "error");
        return null;
    }

    return student;
}

async function loadStudentWork() {
    const { data, error } = await supabase
        .from("lesson_submissions")
        .select("id, lesson_id, status, submitted_at, updated_at, points_earned, points_possible")
        .eq("classroom_id", classroomId)
        .eq("student_user_id", studentId)
        .order("updated_at", { ascending: false });

    if (error) {
        setStatus(error.message || "Student lesson work could not be loaded.", "error");
        return null;
    }

    return data || [];
}

async function loadCourseLessonCount() {
    const { data, error } = await supabase.rpc("classroom_course_lesson_count", {
        classroom_to_check: classroomId,
    });

    if (error) {
        setStatus(error.message || "Course lesson count could not be loaded.", "error");
        return null;
    }

    return Number(data || 0);
}

async function loadLessons(submissions) {
    const lessonIds = [...new Set(submissions.map((submission) => submission.lesson_id).filter(Boolean))];

    if (!lessonIds.length) {
        return new Map();
    }

    const { data, error } = await supabase
        .from("lessons")
        .select("id, title")
        .in("id", lessonIds);

    if (error) {
        setStatus("Lesson names could not be loaded, but student work is still available.", "error");
        return new Map();
    }

    return new Map((data || []).map((lesson) => [lesson.id, lesson.title || "Untitled lesson"]));
}

function renderSummary(student, submissions, lessonCount) {
    const submittedCount = submissions.filter((submission) => submission.status === "submitted").length;
    const draftCount = submissions.filter((submission) => submission.status === "draft").length;
    const lastActivity = submissions
        .map((submission) => submission.updated_at || submission.submitted_at)
        .filter(Boolean)
        .sort((firstDate, secondDate) => new Date(secondDate) - new Date(firstDate))[0];

    summaryElement.replaceChildren(
        createSummaryCard("Enrollment", formatStatus(student.enrollment_status)),
        createSummaryCard("Lesson work", String(submissions.length)),
        createSummaryCard("Submitted", String(submittedCount)),
        createSummaryCard("Drafts", String(draftCount)),
        createSummaryCard("Progress", formatProgress(submittedCount, lessonCount)),
        createSummaryCard("Last activity", formatDateTime(lastActivity))
    );
}

function renderStudentWork(submissions, lessonNames) {
    if (!submissions.length) {
        workListElement.replaceChildren(createElement("p", "empty-state", "This student does not have lesson work in this classroom yet."));
        return;
    }

    const list = createElement("ul", "submission-list");

    submissions.forEach((submission) => {
        const item = createElement("li", "submission-item submission-item--student-detail");
        const link = createElement("a", "submission-name", lessonNames.get(submission.lesson_id) || "Untitled lesson");
        const activityDate = submission.status === "submitted" ? submission.submitted_at : submission.updated_at;
        const activity = createElement("span", "course-muted", formatDateTime(activityDate, "In progress"));
        const points = createElement(
            "span",
            "course-muted",
            `${Number(submission.points_earned || 0)} / ${Number(submission.points_possible || 0)} points`
        );
        const status = createElement("span", "badge badge--quiet", formatStatus(submission.status));

        link.href = getSubmissionLink(submission);
        item.append(link, activity, points, status);
        list.append(item);
    });

    workListElement.replaceChildren(list);
}

async function initializePage() {
    const profile = await loadCurrentProfile();

    if (!profile) {
        return;
    }

    const context = await loadClassroomContext();

    if (!context) {
        return;
    }

    const student = await loadRosterStudent();

    if (!student) {
        return;
    }

    const submissions = await loadStudentWork();

    if (!submissions) {
        return;
    }

    const lessonCount = await loadCourseLessonCount();

    if (lessonCount === null) {
        return;
    }

    const lessonNames = await loadLessons(submissions);
    const { classroom, course } = context;
    const classroomLabel = classroom.period_block
        ? `${classroom.name} - ${classroom.period_block}`
        : classroom.name;

    headingElement.textContent = formatStudentName(student);
    contextElement.textContent = `${classroomLabel} · ${course?.title || "Untitled course"} · ${student.email || "No email available"}`;
    backLink.href = `roster.html?classroom=${encodeURIComponent(classroom.id)}`;
    reviewStudentLink.href = `../submissions/index.html?classroom=${encodeURIComponent(classroom.id)}&student=${encodeURIComponent(student.student_user_id)}`;
    shellElements.forEach((element) => {
        element.hidden = false;
    });

    renderSummary(student, submissions, lessonCount);
    renderStudentWork(submissions, lessonNames);
    setStatus("");
}

await initializePage();
