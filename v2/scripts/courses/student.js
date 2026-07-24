import { supabase } from "../../services/supabase/client.js";
import { loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { getLessonOverview } from "../utils/lesson-metadata.js";
import { notifyStatus } from "../utils/ui-components.js";

const params = new URLSearchParams(window.location.search);
const courseId = params.get("course");
const classroomId = params.get("classroom");
const headingElement = qs("[data-student-course-heading]");
const contextElement = qs("[data-student-course-context]");
const statusElement = qs("[data-student-course-status]");
const workspaceElement = qs("[data-student-course-workspace]");
const tabButtons = [...document.querySelectorAll("[data-course-tab-button]")];
const tabPanels = [...document.querySelectorAll("[data-course-tab-panel]")];
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
const gradebookElement = qs("[data-student-course-gradebook]");
const detailsElement = qs("[data-student-course-details]");
const announcementsElement = qs("[data-student-course-announcements]");
const unenrollButton = qs("[data-student-course-unenroll]");

let currentProfileId = "";
let currentEnrollment = null;
const validCourseTabs = new Set(["details", "content", "announcements", "gradebook"]);

function getCourseTabStorageKey() {
    return `brainkernl:student-course-tab:${courseId || "new"}:${classroomId || "independent"}`;
}

function getInitialTabName() {
    const hashTab = window.location.hash.replace(/^#/, "");

    if (validCourseTabs.has(hashTab)) {
        return hashTab;
    }

    const storedTab = window.localStorage.getItem(getCourseTabStorageKey());
    return validCourseTabs.has(storedTab) ? storedTab : "details";
}

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
    notifyStatus(message, tone);
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

function formatDate(dateLike) {
    if (!dateLike) {
        return "Not submitted";
    }

    return new Date(dateLike).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function setActiveTab(tabName) {
    const nextTabName = validCourseTabs.has(tabName) ? tabName : "details";

    tabButtons.forEach((button) => {
        const isActive = button.dataset.courseTabButton === nextTabName;

        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
    });
    tabPanels.forEach((panel) => {
        panel.hidden = panel.dataset.courseTabPanel !== nextTabName;
    });

    window.localStorage.setItem(getCourseTabStorageKey(), nextTabName);
    if (window.location.hash !== `#${nextTabName}`) {
        window.history.replaceState(null, "", `#${nextTabName}`);
    }
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

function getOrderedCourseLessons(modules, lessons) {
    return modules.flatMap((module) => {
        return lessons
            .filter((lesson) => lesson.module_id === module.id)
            .sort((first, second) => first.order_index - second.order_index);
    });
}

function getLessonNumberMap(modules, lessons) {
    return new Map(getOrderedCourseLessons(modules, lessons).map((lesson, index) => [lesson.id, index + 1]));
}

function getLocalDate(dateLike) {
    if (!dateLike) {
        return null;
    }

    const date = new Date(dateLike);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getPacingStartDate(course, enrollment, classroom) {
    return getLocalDate(course.lesson_release_start_date)
        || getLocalDate(classroom?.start_date)
        || getLocalDate(enrollment.joined_at)
        || getLocalDate(new Date());
}

function getUnlockedLessonCount(course, enrollment, classroom, totalLessons) {
    if (course.lesson_release_mode !== "daily") {
        return totalLessons;
    }

    const startDate = getPacingStartDate(course, enrollment, classroom);
    const today = getLocalDate(new Date());
    const intervalDays = Math.max(Number(course.lesson_release_interval_days || 1), 1);
    const elapsedDays = Math.floor((today - startDate) / 86400000);

    if (elapsedDays < 0) {
        return 0;
    }

    return Math.min(Math.floor(elapsedDays / intervalDays) + 1, totalLessons);
}

function getLessonAvailability(lesson, lessonNumberMap, course, enrollment, classroom, lessons) {
    if (lesson.is_locked) {
        return {
            isAvailable: false,
            label: "Locked by teacher",
            message: "Your teacher has locked this lesson for now.",
        };
    }

    const lessonNumber = lessonNumberMap.get(lesson.id) || lesson.order_index + 1;
    const unlockedLessonCount = getUnlockedLessonCount(course, enrollment, classroom, lessons.length);

    if (lessonNumber > unlockedLessonCount) {
        return {
            isAvailable: false,
            label: "Scheduled",
            message: `This lesson unlocks after lesson ${unlockedLessonCount || 0}.`,
        };
    }

    return {
        isAvailable: true,
        label: "Available",
        message: "",
    };
}

function getNextLesson(modules, lessons, submissions, course, enrollment, classroom) {
    const orderedLessons = getOrderedCourseLessons(modules, lessons);
    const lessonNumberMap = getLessonNumberMap(modules, lessons);
    const availableLessons = orderedLessons.filter((lesson) => {
        return getLessonAvailability(lesson, lessonNumberMap, course, enrollment, classroom, orderedLessons).isAvailable;
    });
    const draftSubmission = submissions.find((submission) => submission.status === "draft");

    if (draftSubmission) {
        const draftLesson = availableLessons.find((lesson) => lesson.id === draftSubmission.lesson_id);

        if (draftLesson) {
            return { lesson: draftLesson, label: "Continue draft" };
        }
    }

    const nextLesson = availableLessons.find((lesson) => getLessonStatus(lesson, submissions) !== "submitted");

    if (nextLesson) {
        return { lesson: nextLesson, label: "Continue lesson" };
    }

    return availableLessons.length
        ? { lesson: availableLessons[availableLessons.length - 1], label: "Review lesson" }
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

async function unenrollFromCourse() {
    if (!currentEnrollment) {
        return;
    }

    const label = currentEnrollment.enrollment_type === "classroom" ? "classroom" : "course";
    const confirmed = window.confirm(
        `Leave this ${label}? It will be removed from your active courses, but your existing work history will be preserved.`
    );

    if (!confirmed) {
        return;
    }

    unenrollButton.disabled = true;
    setStatus(`Leaving ${label}...`);

    const { error } = await supabase.rpc("leave_student_enrollment", {
        enrollment_id_input: currentEnrollment.id,
    });

    if (error) {
        unenrollButton.disabled = false;
        setStatus(error.message || `You could not leave this ${label}.`, "error");
        return;
    }

    setStatus(`You left this ${label}. Redirecting to your dashboard...`, "success");
    window.location.href = "../dashboard/index.html";
}

async function loadCurrentProfile() {
    return loadProtectedProfile({ statusElement });
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
        .select("id, title, description, subject_area, estimated_length, status, lesson_release_mode, lesson_release_start_date, lesson_release_interval_days")
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
        .select("id, module_id, title, objective, summary, estimated_time, order_index, is_locked")
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

function renderSummary(enrollment, course, classroom, modules, lessons, submissions) {
    const { points, progressPercent, submittedCount, totalLessons } = getProgress(lessons, submissions);
    const nextLesson = getNextLesson(modules, lessons, submissions, course, enrollment, classroom);
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

function renderModules(modules, lessons, submissions, enrollment, course, classroom) {
    if (!modules.length) {
        moduleListElement.replaceChildren(createElement("p", "empty-state", "Modules will appear here when this course is ready."));
        return;
    }

    const list = createElement("ol", "module-list");
    const lessonNumberMap = getLessonNumberMap(modules, lessons);
    const orderedLessons = getOrderedCourseLessons(modules, lessons);

    modules.forEach((module) => {
        const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id);
        const moduleProgress = getModuleProgress(moduleLessons, submissions);
        const item = document.createElement("details");
        const summary = createElement("summary", "module-card-header");
        const titleGroup = createElement("div");
        const title = createElement("h3", "course-title", module.title || "Untitled module");
        const description = createElement("p", "course-muted", module.description || "No module description added yet.");
        const label = createElement(
            "span",
            moduleProgress.isComplete ? "badge student-module-progress-badge" : "badge badge--quiet student-module-progress-badge",
            moduleProgress.totalLessons
                ? `Module ${module.order_index + 1} • ${moduleProgress.submittedCount}/${moduleProgress.totalLessons} complete`
                : `Module ${module.order_index + 1}`
        );
        const lessonSection = createElement("section", "module-lessons");

        item.className = "module-card student-module-card";
        titleGroup.append(title, description);
        summary.append(titleGroup, label);
        lessonSection.append(createElement("h4", "", "Lessons"));

        if (!moduleLessons.length) {
            lessonSection.append(createElement("p", "empty-state empty-state--compact", "No lessons in this module yet."));
        } else {
            const lessonList = createElement("ol", "lesson-list");

            moduleLessons.forEach((lesson) => {
                const status = getLessonStatus(lesson, submissions);
                const availability = getLessonAvailability(lesson, lessonNumberMap, course, enrollment, classroom, orderedLessons);
                const lessonItem = createElement("li", "lesson-card");
                const header = createElement("div", "lesson-card-header");
                const content = createElement("div");
                const lessonTitle = createElement("h5", "lesson-title", lesson.title || "Untitled lesson");
                const lessonSummary = createElement("p", "course-muted", getLessonOverview(lesson) || lesson.objective || "No lesson overview added yet.");
                const metaRow = createElement("div", "badge-row lesson-meta-row");
                const actions = createElement("div", "lesson-header-actions");
                const lessonLink = availability.isAvailable
                    ? createElement("a", status === "submitted" ? "secondary-button lesson-action" : "primary-button lesson-action", status === "submitted" ? "Review" : "Open")
                    : createElement("span", "secondary-button lesson-action lesson-action--disabled", "Locked");

                if (availability.isAvailable) {
                    lessonLink.href = getLessonHref(lesson, enrollment);
                } else {
                    lessonItem.classList.add("lesson-card--locked");
                    lessonLink.setAttribute("aria-disabled", "true");
                }
                metaRow.append(
                    createElement("span", "badge student-lesson-number-badge", `Lesson ${lessonNumberMap.get(lesson.id) || lesson.order_index + 1}`),
                    createElement("span", "badge badge--quiet", lesson.estimated_time || "No time estimate"),
                    createElement("span", status === "submitted" ? "badge" : "badge badge--quiet", formatStatus(status)),
                    createElement("span", availability.isAvailable ? "badge badge--quiet" : "badge lesson-lock-badge lesson-lock-badge--locked", availability.label)
                );
                if (!availability.isAvailable) {
                    lessonSummary.append(` ${availability.message}`);
                }
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

function renderGradebook(modules, lessons, submissions) {
    const orderedLessons = getOrderedCourseLessons(modules, lessons);

    if (!orderedLessons.length) {
        gradebookElement.replaceChildren(createElement("p", "empty-state", "Gradebook details will appear once lessons are available."));
        return;
    }

    const list = createElement("ul", "student-course-gradebook-list");

    orderedLessons.forEach((lesson, index) => {
        const submission = getSubmissionForLesson(lesson, submissions);
        const status = getLessonStatus(lesson, submissions);
        const item = createElement("li", "student-course-gradebook-item");
        const content = createElement("div", "student-course-gradebook-content");
        const title = createElement("strong", "submission-name", `${index + 1}. ${lesson.title || "Untitled lesson"}`);
        const meta = createElement(
            "span",
            "course-muted",
            status === "submitted"
                ? `Submitted ${formatDate(submission.submitted_at || submission.updated_at)}`
                : status === "in_progress"
                    ? `Draft saved ${formatDate(submission.updated_at)}`
                    : "Not started"
        );
        const score = createElement(
            "span",
            status === "submitted" ? "badge" : "badge badge--quiet",
            status === "submitted"
                ? `${Number(submission.points_earned || 0)} / ${Number(submission.points_possible || 0)} pts`
                : formatStatus(status)
        );

        content.append(title, meta);
        item.append(content, score);
        list.append(item);
    });

    gradebookElement.replaceChildren(list);
}

async function loadAnnouncements() {
    const { data, error } = await supabase
        .from("course_announcements")
        .select("id, title, message, published_at, created_at")
        .eq("course_id", courseId)
        .eq("status", "published")
        .is("archived_at", null)
        .order("published_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
}

function renderAnnouncements(announcements, teacherName = "Teacher") {
    if (!announcementsElement) {
        return;
    }

    if (!announcements.length) {
        announcementsElement.replaceChildren(createElement("p", "empty-state", "No announcements have been posted for this course yet."));
        return;
    }

    const list = createElement("ol", "announcement-list announcement-list--student");

    announcements.forEach((announcement) => {
        const item = createElement("li", "announcement-card");
        const header = createElement("div", "announcement-card-header");
        const titleGroup = createElement("div");
        const title = createElement("h3", "", announcement.title || "Course announcement");
        const meta = createElement(
            "p",
            "announcement-meta",
            `From ${teacherName} · Posted ${formatDate(announcement.published_at || announcement.created_at)}`
        );
        const message = createElement("p", "announcement-message", announcement.message || "");

        titleGroup.append(title, meta);
        header.append(titleGroup);
        item.append(header, message);
        list.append(item);
    });

    announcementsElement.replaceChildren(list);
}

function renderCourseDetails(course, classroom, teacherName, enrollment, modules, lessons) {
    const layout = createElement("div", "student-course-detail-layout");
    const overview = createElement("article", "student-course-detail-overview");
    const stats = createElement("div", "student-course-detail-stats");
    const detailsGrid = createElement("div", "student-course-details-grid");
    const classroomLabel = classroom
        ? `${classroom.name}${classroom.period_block ? ` - ${classroom.period_block}` : ""}`
        : "Independent course";
    const statItems = [
        ["Modules", String(modules.length)],
        ["Lessons", String(lessons.length)],
        ["Estimated length", course.estimated_length || "Not listed"],
    ];
    const details = [
        ["Teacher", teacherName],
        ["Course access", classroom ? "Classroom course" : "Independent course"],
        ["Classroom", classroomLabel],
        ["Subject", course.subject_area || "Not listed"],
        ["Status", formatStatus(enrollment.enrollment_status)],
    ];

    overview.append(
        createElement("p", "eyebrow", "Course Details"),
        createElement("h2", "", course.title || "Untitled course"),
        createElement("p", "student-course-detail-description", course.description || "No course description has been added yet.")
    );
    statItems.forEach(([label, value]) => {
        const item = createElement("article", "student-course-detail-stat");

        item.append(
            createElement("span", "summary-label", label),
            createElement("strong", "", value)
        );
        stats.append(item);
    });

    details.forEach(([label, value]) => {
        const card = createElement("article", "student-course-detail-card");

        card.append(
            createElement("span", "summary-label", label),
            createElement("strong", "", value)
        );
        detailsGrid.append(card);
    });

    layout.append(overview, stats);
    detailsElement.replaceChildren(layout, detailsGrid);
}

async function initializePage() {
    setStatus("Loading student course view...");
    const profile = await loadCurrentProfile();

    if (!profile) {
        return;
    }

    currentProfileId = profile.id;
    const enrollment = await loadEnrollment();
    currentEnrollment = enrollment;

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
        let announcements = [];
        let announcementsLoaded = true;
        const classroomLabel = classroom
            ? `${classroom.name}${classroom.period_block ? ` - ${classroom.period_block}` : ""}`
            : "Independent course";

        try {
            announcements = await loadAnnouncements();
        } catch (error) {
            announcementsLoaded = false;
            announcementsElement?.replaceChildren(createElement("p", "empty-state", "Announcements could not be loaded."));
        }

        headingElement.textContent = course.title || "Untitled course";
        contextElement.textContent = `${classroomLabel} / ${teacherName}`;
        unenrollButton.textContent = enrollment.enrollment_type === "classroom" ? "Leave classroom" : "Unenroll";
        unenrollButton.hidden = false;
        renderSummary(enrollment, course, classroom, modules, lessons, submissions);
        renderModules(modules, lessons, submissions, enrollment, course, classroom);
        renderGradebook(modules, lessons, submissions);
        if (announcementsLoaded) {
            renderAnnouncements(announcements, teacherName);
        }
        renderCourseDetails(course, classroom, teacherName, enrollment, modules, lessons);
        workspaceElement.hidden = false;
        shellElement.hidden = false;
        setActiveTab(getInitialTabName());
        setStatus("");
    } catch (error) {
        setStatus(error.message || "Student course view could not be loaded.", "error");
    }
}

unenrollButton.addEventListener("click", unenrollFromCourse);
tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
        setActiveTab(button.dataset.courseTabButton);
    });
});

await initializePage();
