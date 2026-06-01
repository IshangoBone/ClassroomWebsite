import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const statusElement = qs("[data-progress-status]");
const summaryElement = qs("[data-progress-summary]");
const shellElements = [...document.querySelectorAll("[data-progress-shell]")];
const progressPercentElement = qs("[data-progress-percent]");
const completedElement = qs("[data-progress-completed]");
const remainingElement = qs("[data-progress-remaining]");
const pointsElement = qs("[data-progress-points]");
const progressCopyElement = qs("[data-progress-copy]");
const progressBarElement = qs("[data-progress-bar]");
const progressValueElement = qs("[data-progress-value]");
const filterForm = qs("[data-progress-filter-form]");
const courseFilter = qs("[data-progress-filter-course]");
const classroomFilter = qs("[data-progress-filter-classroom]");
const courseListElement = qs("[data-progress-course-list]");
const historyListElement = qs("[data-progress-history-list]");

let currentProfileId = "";
let loadedEnrollments = [];
let loadedCourses = [];
let loadedClassrooms = [];
let loadedLessons = [];
let loadedSubmissions = [];

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function formatStatus(status) {
    return status
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function formatDateTime(dateValue) {
    if (!dateValue) {
        return "No date available";
    }

    return new Date(dateValue).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function renderEmpty(container, message) {
    container.replaceChildren(createElement("p", "empty-state", message));
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

function getDisplayStudentEnrollments(enrollments) {
    const classroomCourseIds = new Set(
        enrollments
            .filter((enrollment) => enrollment.enrollment_type === "classroom")
            .map((enrollment) => enrollment.course_id)
    );

    return enrollments.filter((enrollment) => (
        enrollment.enrollment_type === "classroom" || !classroomCourseIds.has(enrollment.course_id)
    ));
}

function getCourseLessons(enrollment, lessons) {
    return lessons
        .filter((lesson) => lesson.course_id === enrollment.course_id)
        .sort((first, second) => first.order_index - second.order_index);
}

function getEnrollmentSubmissions(enrollment, submissions) {
    return submissions.filter((submission) => (
        submission.course_id === enrollment.course_id
        && (enrollment.classroom_id ? submission.classroom_id === enrollment.classroom_id : !submission.classroom_id)
    ));
}

function getSubmittedLessonIds(enrollment, submissions) {
    return new Set(
        getEnrollmentSubmissions(enrollment, submissions)
            .filter((submission) => submission.status === "submitted")
            .map((submission) => submission.lesson_id)
    );
}

function getCourseProgress(enrollment, lessons, submissions) {
    const courseLessons = getCourseLessons(enrollment, lessons);
    const submittedLessonIds = getSubmittedLessonIds(enrollment, submissions);
    const submittedCount = courseLessons.filter((lesson) => submittedLessonIds.has(lesson.id)).length;
    const points = getEnrollmentSubmissions(enrollment, submissions)
        .filter((submission) => submission.status === "submitted")
        .reduce((total, submission) => total + Number(submission.points_earned || 0), 0);

    return {
        remainingCount: Math.max(courseLessons.length - submittedCount, 0),
        percent: courseLessons.length ? Math.round((submittedCount / courseLessons.length) * 100) : 0,
        points,
        submittedCount,
        totalLessons: courseLessons.length,
    };
}

function getFilters() {
    const formData = new FormData(filterForm);

    return {
        classroomId: String(formData.get("classroom") || ""),
        courseId: String(formData.get("course") || ""),
    };
}

function getFilteredEnrollments() {
    const filters = getFilters();

    return loadedEnrollments.filter((enrollment) => (
        (!filters.courseId || enrollment.course_id === filters.courseId)
        && (!filters.classroomId || enrollment.classroom_id === filters.classroomId)
    ));
}

function getFilteredSubmissions(enrollments) {
    const enrollmentKeys = new Set(enrollments.map((enrollment) => `${enrollment.course_id}:${enrollment.classroom_id || "course"}`));

    return loadedSubmissions.filter((submission) => (
        enrollmentKeys.has(`${submission.course_id}:${submission.classroom_id || "course"}`)
    ));
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
        .select("id, title, description, subject_area, estimated_length")
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

async function loadStudentSubmissions(profileId) {
    const { data, error } = await supabase
        .from("lesson_submissions")
        .select("id, course_id, classroom_id, lesson_id, status, submitted_at, updated_at, points_earned, points_possible")
        .eq("student_user_id", profileId)
        .order("updated_at", { ascending: false });

    if (error) {
        throw error;
    }

    return data;
}

function renderSummary(enrollments, lessons, submissions) {
    const totals = enrollments.reduce((summary, enrollment) => {
        const progress = getCourseProgress(enrollment, lessons, submissions);

        return {
            completed: summary.completed + progress.submittedCount,
            points: summary.points + progress.points,
            total: summary.total + progress.totalLessons,
        };
    }, { completed: 0, points: 0, total: 0 });
    const remaining = Math.max(totals.total - totals.completed, 0);
    const percent = totals.total ? Math.round((totals.completed / totals.total) * 100) : 0;

    progressPercentElement.textContent = `${percent}%`;
    completedElement.textContent = String(totals.completed);
    remainingElement.textContent = String(remaining);
    pointsElement.textContent = String(totals.points);
    progressCopyElement.textContent = totals.total
        ? `${totals.completed} of ${totals.total} lessons submitted across ${enrollments.length} selected enrollment${enrollments.length === 1 ? "" : "s"}.`
        : "Lessons will appear here once your enrolled courses are ready.";
    progressBarElement.setAttribute("aria-valuenow", String(percent));
    progressValueElement.style.width = `${percent}%`;
    summaryElement.hidden = false;
}

function renderFilters(enrollments, courses, classrooms) {
    const courseNames = new Map(courses.map((course) => [course.id, course.title || "Untitled course"]));
    const selectedCourseId = courseFilter.value;
    const activeCourseIds = [...new Set(enrollments.map((enrollment) => enrollment.course_id))];
    const activeClassrooms = classrooms
        .filter((classroom) => enrollments.some((enrollment) => (
            enrollment.classroom_id === classroom.id
            && (!selectedCourseId || enrollment.course_id === selectedCourseId)
        )))
        .map((classroom) => ({
            label: classroom.period_block
                ? `${courseNames.get(classroom.course_id) || "Course"} / ${classroom.name} - ${classroom.period_block}`
                : `${courseNames.get(classroom.course_id) || "Course"} / ${classroom.name}`,
            value: classroom.id,
        }));

    populateSelect(
        courseFilter,
        activeCourseIds.map((courseId) => ({
            label: courseNames.get(courseId) || "Untitled course",
            value: courseId,
        })),
        "All courses"
    );
    courseFilter.value = activeCourseIds.includes(selectedCourseId) ? selectedCourseId : "";
    populateSelect(classroomFilter, activeClassrooms, "All classrooms");
}

function renderCourseProgress(enrollments, courses, classrooms, lessons, submissions) {
    if (!enrollments.length) {
        renderEmpty(courseListElement, "Join a course or classroom to start tracking progress.");
        return;
    }

    const courseNames = new Map(courses.map((course) => [course.id, course.title || "Untitled course"]));
    const courseDescriptions = new Map(courses.map((course) => [course.id, course.description || "No course description added yet."]));
    const classroomNames = new Map(classrooms.map((classroom) => [
        classroom.id,
        classroom.period_block ? `${classroom.name} - ${classroom.period_block}` : classroom.name,
    ]));
    const cards = enrollments.map((enrollment) => {
        const progress = getCourseProgress(enrollment, lessons, submissions);
        const card = createElement("article", "course-card");
        const heading = createElement("div", "course-card-header");
        const title = createElement("h3", "course-title", courseNames.get(enrollment.course_id) || "Untitled course");
        const badges = createElement("div", "badge-row");
        const context = enrollment.classroom_id
            ? classroomNames.get(enrollment.classroom_id) || "Classroom"
            : "Independent course";
        const description = createElement("p", "course-muted", courseDescriptions.get(enrollment.course_id) || "No course description added yet.");
        const progressText = createElement("p", "dashboard-next-step", `${progress.percent}% complete`);
        const detail = createElement("p", "course-muted", `${progress.submittedCount} submitted / ${progress.remainingCount} remaining / ${progress.points} points`);
        const progressBar = createElement("div", "dashboard-progress");
        const progressValue = createElement("span", "dashboard-progress-value");
        const actions = createElement("div", "course-actions");
        const openCourse = createElement("a", "secondary-button", "Open course");
        const courseParams = new URLSearchParams({ course: enrollment.course_id });

        if (enrollment.classroom_id) {
            courseParams.set("classroom", enrollment.classroom_id);
        }

        badges.append(
            createElement("span", "badge", enrollment.enrollment_type === "classroom" ? "Classroom" : "Course"),
            createElement("span", progress.remainingCount ? "badge badge--quiet" : "badge", progress.remainingCount ? "In progress" : "Complete")
        );
        heading.append(title, badges);
        progressBar.setAttribute("role", "progressbar");
        progressBar.setAttribute("aria-label", `${courseNames.get(enrollment.course_id) || "Course"} progress`);
        progressBar.setAttribute("aria-valuemin", "0");
        progressBar.setAttribute("aria-valuemax", "100");
        progressBar.setAttribute("aria-valuenow", String(progress.percent));
        progressValue.style.width = `${progress.percent}%`;
        progressBar.append(progressValue);
        openCourse.href = `../courses/student.html?${courseParams.toString()}`;
        actions.append(openCourse);
        card.append(heading, createElement("p", "course-details", context), description, progressText, progressBar, detail, actions);
        return card;
    });

    courseListElement.replaceChildren(...cards);
}

function renderSubmittedHistory(submissions, courses, lessons) {
    const submittedWork = submissions.filter((submission) => submission.status === "submitted");

    if (!submittedWork.length) {
        renderEmpty(historyListElement, "Submitted lessons will appear here after you turn in work.");
        return;
    }

    const courseNames = new Map(courses.map((course) => [course.id, course.title || "Untitled course"]));
    const lessonNames = new Map(lessons.map((lesson) => [lesson.id, lesson.title || "Untitled lesson"]));
    const list = createElement("ul", "submission-list");

    submittedWork.forEach((submission) => {
        const item = createElement("li", "submission-item submission-item--review");
        const link = createElement("a", "submission-name", lessonNames.get(submission.lesson_id) || "Submitted lesson");
        const course = createElement("span", "course-muted", courseNames.get(submission.course_id) || "Course");
        const submittedAt = createElement("span", "course-muted", formatDateTime(submission.submitted_at || submission.updated_at));
        const points = createElement("span", "course-muted", `${Number(submission.points_earned || 0)} / ${Number(submission.points_possible || 0)} pts`);
        const status = createElement("span", "badge", formatStatus(submission.status));

        link.href = `../submissions/view.html?submission=${encodeURIComponent(submission.id)}`;
        item.append(link, course, submittedAt, points, status);
        list.append(item);
    });

    historyListElement.replaceChildren(list);
}

function renderProgressView() {
    const enrollments = getFilteredEnrollments();
    const submissions = getFilteredSubmissions(enrollments);

    renderSummary(enrollments, loadedLessons, submissions);
    renderCourseProgress(enrollments, loadedCourses, loadedClassrooms, loadedLessons, submissions);
    renderSubmittedHistory(submissions, loadedCourses, loadedLessons);
}

async function initializePage() {
    setStatus("Loading progress...");
    const profile = await loadCurrentProfile();

    if (!profile) {
        return;
    }

    currentProfileId = profile.id;

    try {
        loadedEnrollments = getDisplayStudentEnrollments(await loadStudentEnrollments(currentProfileId));
        const courseIds = [...new Set(loadedEnrollments.map((enrollment) => enrollment.course_id))];
        const classroomIds = [...new Set(loadedEnrollments.map((enrollment) => enrollment.classroom_id).filter(Boolean))];
        const [courses, classrooms, lessons, submissions] = await Promise.all([
            loadVisibleCourses(courseIds),
            loadVisibleClassrooms(classroomIds),
            loadLessons(courseIds),
            loadStudentSubmissions(currentProfileId),
        ]);

        loadedCourses = courses;
        loadedClassrooms = classrooms;
        loadedLessons = lessons;
        loadedSubmissions = submissions;
        renderFilters(loadedEnrollments, loadedCourses, loadedClassrooms);
        renderProgressView();
        shellElements.forEach((element) => {
            element.hidden = false;
        });
        setStatus("");
    } catch (error) {
        setStatus(error.message || "Progress could not be loaded.", "error");
        renderEmpty(courseListElement, "Progress could not be loaded right now.");
        renderEmpty(historyListElement, "Submitted work could not be loaded right now.");
    }
}

filterForm.addEventListener("change", (event) => {
    if (event.target === courseFilter) {
        classroomFilter.value = "";
        renderFilters(loadedEnrollments, loadedCourses, loadedClassrooms);
    }

    renderProgressView();
});

await initializePage();
