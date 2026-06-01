import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const statusElement = qs("[data-analytics-status]");
const shellElements = [...document.querySelectorAll("[data-analytics-shell]")];
const summaryElement = qs("[data-analytics-summary]");
const filterForm = qs("[data-analytics-filter-form]");
const courseFilter = qs("[data-analytics-filter-course]");
const classroomFilter = qs("[data-analytics-filter-classroom]");
const reviewLink = qs("[data-analytics-review-link]");
const courseAnalyticsElement = qs("[data-course-analytics]");
const classroomAnalyticsElement = qs("[data-classroom-analytics]");
const studentRiskElement = qs("[data-student-risk-analytics]");
const lessonAnalyticsElement = qs("[data-lesson-analytics]");
const questionAnalyticsElement = qs("[data-question-analytics]");
const activityElement = qs("[data-analytics-activity]");

let currentProfile = null;
let loadedCourses = [];
let loadedClassrooms = [];
let loadedLessons = [];
let loadedQuestions = [];
let loadedSubmissions = [];
let loadedEnrollments = [];
let studentNames = new Map();

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
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
    return studentNames.get(studentId) || `Student ${formatShortId(studentId)}`;
}

function formatNumber(value) {
    return new Intl.NumberFormat().format(value);
}

function formatPercent(value) {
    return `${Math.round(value)}%`;
}

function formatDate(value) {
    if (!value) {
        return "No activity";
    }

    return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function createSummaryCard(label, value, detail = "") {
    const card = createElement("article", "summary-card");

    card.append(createElement("span", "summary-label", label), createElement("strong", "summary-value summary-value--small", value));

    if (detail) {
        card.append(createElement("span", "course-muted", detail));
    }

    return card;
}

function createProgressBar(percent, label) {
    const progress = createElement("div", "dashboard-progress");
    const value = createElement("span", "dashboard-progress-value");

    progress.setAttribute("role", "progressbar");
    progress.setAttribute("aria-label", label);
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", "100");
    progress.setAttribute("aria-valuenow", String(Math.round(percent)));
    value.style.width = `${Math.min(Math.max(percent, 0), 100)}%`;
    progress.append(value);

    return progress;
}

function showShell() {
    shellElements.forEach((element) => {
        element.hidden = false;
    });
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

function getFilterValues() {
    const formData = new FormData(filterForm);

    return {
        classroomId: String(formData.get("classroom") || ""),
        courseId: String(formData.get("course") || ""),
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

async function loadTeachingCourses(profileId) {
    const { data: ownedCourses, error: ownedError } = await supabase
        .from("courses")
        .select("id, title, status, updated_at")
        .eq("owner_user_id", profileId)
        .neq("status", "deleted")
        .order("updated_at", { ascending: false });

    if (ownedError) {
        throw ownedError;
    }

    const { data: collaboratorRows, error: collaboratorError } = await supabase
        .from("course_collaborators")
        .select("course_id")
        .eq("user_id", profileId)
        .in("permission_level", ["teacher", "editor", "co_owner"]);

    if (collaboratorError) {
        throw collaboratorError;
    }

    let collaborativeCourses = [];
    const collaborativeCourseIds = collaboratorRows.map((row) => row.course_id);

    if (collaborativeCourseIds.length) {
        const { data, error } = await supabase
            .from("courses")
            .select("id, title, status, updated_at")
            .in("id", collaborativeCourseIds)
            .neq("status", "deleted");

        if (error) {
            throw error;
        }

        collaborativeCourses = data;
    }

    const courseMap = new Map();

    ownedCourses.forEach((course) => courseMap.set(course.id, course));
    collaborativeCourses.forEach((course) => courseMap.set(course.id, course));

    return [...courseMap.values()].sort((first, second) => new Date(second.updated_at) - new Date(first.updated_at));
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

    let assignedClassrooms = [];
    const assignedClassroomIds = teacherAssignments.map((assignment) => assignment.classroom_id);

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

async function loadSubmissions(courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("lesson_submissions")
        .select("id, student_user_id, course_id, classroom_id, lesson_id, answers_json, status, submitted_at, updated_at, points_earned, points_possible")
        .in("course_id", courseIds)
        .order("updated_at", { ascending: false })
        .limit(500);

    if (error) {
        throw error;
    }

    return data;
}

async function loadQuestions(lessonIds) {
    if (!lessonIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("questions")
        .select("id, lesson_id, phase, question_type, prompt, points, order_index")
        .in("lesson_id", lessonIds)
        .eq("is_visible", true)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        throw error;
    }

    return data;
}

async function loadActiveClassroomEnrollments(classroomIds) {
    if (!classroomIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("enrollments")
        .select("id, user_id, course_id, classroom_id, joined_at")
        .in("classroom_id", classroomIds)
        .eq("enrollment_type", "classroom")
        .eq("enrollment_status", "active");

    if (error) {
        throw error;
    }

    return data;
}

async function loadStudentNames() {
    const { data, error } = await supabase.rpc("reviewable_student_profiles");

    if (error || !data) {
        return new Map();
    }

    return new Map(data.map((profile) => [profile.id, formatStudentName(profile)]));
}

function getClassroomLabel(classroom) {
    return classroom.period_block ? `${classroom.name} - ${classroom.period_block}` : classroom.name;
}

function getFilteredClassrooms(courseId = "") {
    return loadedClassrooms.filter((classroom) => !courseId || classroom.course_id === courseId);
}

function getFilteredSubmissions(filters = getFilterValues()) {
    return loadedSubmissions.filter((submission) => (
        (!filters.courseId || submission.course_id === filters.courseId)
        && (!filters.classroomId || submission.classroom_id === filters.classroomId)
    ));
}

function getFilteredEnrollments(filters = getFilterValues()) {
    return loadedEnrollments.filter((enrollment) => (
        (!filters.courseId || enrollment.course_id === filters.courseId)
        && (!filters.classroomId || enrollment.classroom_id === filters.classroomId)
    ));
}

function getFilteredLessons(filters = getFilterValues()) {
    const courseIds = new Set(getFilteredEnrollments(filters).map((enrollment) => enrollment.course_id));

    return loadedLessons.filter((lesson) => (
        (!filters.courseId || lesson.course_id === filters.courseId)
        && (!courseIds.size || courseIds.has(lesson.course_id))
    ));
}

function getFilteredQuestions(filters = getFilterValues()) {
    const lessonIds = new Set(getFilteredLessons(filters).map((lesson) => lesson.id));

    return loadedQuestions.filter((question) => lessonIds.has(question.lesson_id));
}

function renderFilters() {
    const params = new URLSearchParams(window.location.search);
    const initialCourseId = params.get("course") || "";
    const courseOptions = loadedCourses.map((course) => ({
        label: course.title || "Untitled course",
        value: course.id,
    }));
    const classroomOptions = getFilteredClassrooms(initialCourseId).map((classroom) => ({
        label: getClassroomLabel(classroom),
        value: classroom.id,
    }));

    populateSelect(courseFilter, courseOptions, "All courses");
    populateSelect(classroomFilter, classroomOptions, "All classrooms");

    params.forEach((value, key) => {
        const field = filterForm.elements[key];

        if (field && [...field.options].some((option) => option.value === value)) {
            field.value = value;
        }
    });
}

function updateReviewLink(filters = getFilterValues()) {
    const params = new URLSearchParams();

    if (filters.courseId) {
        params.set("course", filters.courseId);
    }

    if (filters.classroomId) {
        params.set("classroom", filters.classroomId);
    }

    reviewLink.href = params.toString()
        ? `../submissions/index.html?${params.toString()}`
        : "../submissions/index.html";
}

function getContextAnalytics({ courseId = "", classroomId = "" } = {}) {
    const lessons = loadedLessons.filter((lesson) => (
        (!courseId || lesson.course_id === courseId)
    ));
    const enrollments = loadedEnrollments.filter((enrollment) => (
        (!courseId || enrollment.course_id === courseId)
        && (!classroomId || enrollment.classroom_id === classroomId)
    ));
    const submissions = loadedSubmissions.filter((submission) => (
        (!courseId || submission.course_id === courseId)
        && (!classroomId || submission.classroom_id === classroomId)
    ));
    const submittedSubmissions = submissions.filter((submission) => submission.status === "submitted");
    const draftSubmissions = submissions.filter((submission) => submission.status === "draft");
    const submittedContextKeys = new Set(submittedSubmissions.map((submission) => [
        submission.student_user_id,
        submission.classroom_id || "",
        submission.lesson_id,
    ].join(":")));
    const expectedWork = enrollments.flatMap((enrollment) => (
        lessons
            .filter((lesson) => lesson.course_id === enrollment.course_id)
            .map((lesson) => ({
                isSubmitted: submittedContextKeys.has([
                    enrollment.user_id,
                    enrollment.classroom_id || "",
                    lesson.id,
                ].join(":")),
            }))
    ));
    const expectedWorkCount = expectedWork.length;
    const completedExpectedCount = expectedWork.filter((item) => item.isSubmitted).length;
    const missingCount = expectedWorkCount - completedExpectedCount;
    const draftContextKeys = new Set(draftSubmissions.map((submission) => [
        submission.student_user_id,
        submission.classroom_id || "",
        submission.lesson_id,
    ].join(":")));
    const draftCount = enrollments.reduce((total, enrollment) => (
        total + lessons.filter((lesson) => draftContextKeys.has([
            enrollment.user_id,
            enrollment.classroom_id || "",
            lesson.id,
        ].join(":"))).length
    ), 0);
    const pointsEarned = submissions.reduce((total, submission) => total + Number(submission.points_earned || 0), 0);
    const pointsPossible = submissions.reduce((total, submission) => total + Number(submission.points_possible || 0), 0);
    const lastActivityAt = submissions.reduce((latest, submission) => {
        const activityDate = new Date(submission.submitted_at || submission.updated_at || 0);

        return activityDate > latest ? activityDate : latest;
    }, new Date(0));

    return {
        averagePoints: submittedSubmissions.length ? pointsEarned / submittedSubmissions.length : 0,
        completionPercent: expectedWorkCount ? (completedExpectedCount / expectedWorkCount) * 100 : 0,
        draftCount,
        enrollmentCount: enrollments.length,
        expectedWorkCount,
        lastActivityAt: lastActivityAt.getTime() ? lastActivityAt.toISOString() : "",
        lessonCount: lessons.length,
        missingCount,
        pointsEarned,
        pointsPossible,
        submissionCount: completedExpectedCount,
    };
}

function renderSummary(filters = getFilterValues()) {
    const analytics = getContextAnalytics(filters);
    const filteredEnrollments = getFilteredEnrollments(filters);
    const filteredSubmissions = getFilteredSubmissions(filters);
    const submissionsToday = filteredSubmissions.filter((submission) => {
        const activityDate = new Date(submission.submitted_at || submission.updated_at || 0);
        const today = new Date();

        return activityDate.toDateString() === today.toDateString();
    }).length;

    summaryElement.replaceChildren(
        createSummaryCard("Active students", formatNumber(new Set(filteredEnrollments.map((enrollment) => enrollment.user_id)).size)),
        createSummaryCard("Average progress", formatPercent(analytics.completionPercent), `${analytics.submissionCount} of ${analytics.expectedWorkCount} expected submissions`),
        createSummaryCard("Missing work", formatNumber(analytics.missingCount)),
        createSummaryCard("Incomplete drafts", formatNumber(analytics.draftCount)),
        createSummaryCard("Participation points", `${analytics.pointsEarned} / ${analytics.pointsPossible}`),
        createSummaryCard("Activity today", formatNumber(submissionsToday))
    );
}

function createAnalyticsTable(columns, rows, emptyMessage) {
    if (!rows.length) {
        return createElement("p", "empty-state", emptyMessage);
    }

    const wrapper = createElement("div", "analytics-table-shell");
    const table = createElement("table", "analytics-table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    const tbody = document.createElement("tbody");

    columns.forEach((column) => {
        headerRow.append(createElement("th", "", column.label));
    });
    thead.append(headerRow);

    rows.forEach((row) => {
        const tr = document.createElement("tr");

        columns.forEach((column) => {
            const cell = document.createElement("td");
            const value = column.render ? column.render(row) : row[column.key];

            if (value instanceof Node) {
                cell.append(value);
            } else {
                cell.textContent = String(value ?? "");
            }

            tr.append(cell);
        });
        tbody.append(tr);
    });

    table.append(thead, tbody);
    wrapper.append(table);
    return wrapper;
}

function createProgressCell(row) {
    const cell = createElement("div", "analytics-progress-cell");

    cell.append(createElement("strong", "", formatPercent(row.analytics.completionPercent)));
    cell.append(createProgressBar(row.analytics.completionPercent, `${row.name} completion`));
    return cell;
}

function createActionLink(label, href) {
    const link = createElement("a", "secondary-button analytics-table-action", label);

    link.href = href;
    return link;
}

function renderCourseAnalytics(filters = getFilterValues()) {
    const courses = filters.courseId
        ? loadedCourses.filter((course) => course.id === filters.courseId)
        : loadedCourses;
    const rows = courses.map((course) => ({
        analytics: getContextAnalytics({ courseId: course.id }),
        course,
        name: course.title || "Untitled course",
    }));

    courseAnalyticsElement.replaceChildren(createAnalyticsTable([
        { label: "Course", key: "name" },
        { label: "Students", render: (row) => formatNumber(row.analytics.enrollmentCount) },
        { label: "Progress", render: createProgressCell },
        { label: "Missing", render: (row) => formatNumber(row.analytics.missingCount) },
        { label: "Incomplete", render: (row) => formatNumber(row.analytics.draftCount) },
        { label: "Points", render: (row) => `${row.analytics.pointsEarned} / ${row.analytics.pointsPossible}` },
        {
            label: "Actions",
            render: (row) => createActionLink("Review", `../submissions/index.html?course=${encodeURIComponent(row.course.id)}`),
        },
    ], rows, "Managed courses are required before teacher analytics are available."));
}

function renderClassroomAnalytics(filters = getFilterValues()) {
    const courseNames = new Map(loadedCourses.map((course) => [course.id, course.title || "Untitled course"]));
    const classrooms = loadedClassrooms.filter((classroom) => (
        (!filters.courseId || classroom.course_id === filters.courseId)
        && (!filters.classroomId || classroom.id === filters.classroomId)
    ));
    const rows = classrooms.map((classroom) => ({
        analytics: getContextAnalytics({ courseId: classroom.course_id, classroomId: classroom.id }),
        classroom,
        courseName: courseNames.get(classroom.course_id) || "Course",
        name: getClassroomLabel(classroom),
    }));

    classroomAnalyticsElement.replaceChildren(createAnalyticsTable([
        { label: "Classroom", key: "name" },
        { label: "Course", key: "courseName" },
        { label: "Students", render: (row) => formatNumber(row.analytics.enrollmentCount) },
        { label: "Progress", render: createProgressCell },
        { label: "Missing", render: (row) => formatNumber(row.analytics.missingCount) },
        { label: "Last activity", render: (row) => formatDate(row.analytics.lastActivityAt) },
        {
            label: "Actions",
            render: (row) => createActionLink("Roster", `../classrooms/roster.html?classroom=${encodeURIComponent(row.classroom.id)}`),
        },
    ], rows, "Create or manage a classroom before classroom analytics are available."));
}

function getStudentProgressRows(filters = getFilterValues()) {
    const courseNames = new Map(loadedCourses.map((course) => [course.id, course.title || "Untitled course"]));
    const classroomNames = new Map(loadedClassrooms.map((classroom) => [classroom.id, getClassroomLabel(classroom)]));
    const lessonsByCourse = getFilteredLessons(filters).reduce((lessonMap, lesson) => {
        const courseLessons = lessonMap.get(lesson.course_id) || [];

        courseLessons.push(lesson);
        lessonMap.set(lesson.course_id, courseLessons);
        return lessonMap;
    }, new Map());
    const submissionsByContext = getFilteredSubmissions(filters).reduce((submissionMap, submission) => {
        const key = [
            submission.student_user_id,
            submission.classroom_id || "",
            submission.lesson_id,
        ].join(":");
        const existing = submissionMap.get(key);
        const existingDate = new Date(existing?.submitted_at || existing?.updated_at || 0);
        const submissionDate = new Date(submission.submitted_at || submission.updated_at || 0);

        if (!existing || submissionDate > existingDate) {
            submissionMap.set(key, submission);
        }

        return submissionMap;
    }, new Map());

    return getFilteredEnrollments(filters).map((enrollment) => {
        const lessons = lessonsByCourse.get(enrollment.course_id) || [];
        const lessonStats = lessons.map((lesson) => {
            const submission = submissionsByContext.get([
                enrollment.user_id,
                enrollment.classroom_id || "",
                lesson.id,
            ].join(":"));

            return {
                isDraft: submission?.status === "draft",
                isSubmitted: submission?.status === "submitted",
                submission,
            };
        });
        const submittedCount = lessonStats.filter((stat) => stat.isSubmitted).length;
        const draftCount = lessonStats.filter((stat) => stat.isDraft).length;
        const missingCount = Math.max(lessons.length - submittedCount, 0);
        const studentSubmissions = lessonStats.map((stat) => stat.submission).filter(Boolean);
        const pointsEarned = studentSubmissions.reduce((total, submission) => total + Number(submission.points_earned || 0), 0);
        const pointsPossible = studentSubmissions.reduce((total, submission) => total + Number(submission.points_possible || 0), 0);
        const lastActivityAt = studentSubmissions.reduce((latest, submission) => {
            const activityDate = new Date(submission.submitted_at || submission.updated_at || 0);

            return activityDate > latest ? activityDate : latest;
        }, new Date(0));
        const progressPercent = lessons.length ? (submittedCount / lessons.length) * 100 : 0;

        return {
            classroomId: enrollment.classroom_id,
            classroomName: classroomNames.get(enrollment.classroom_id) || "Classroom",
            courseName: courseNames.get(enrollment.course_id) || "Course",
            draftCount,
            lastActivityAt: lastActivityAt.getTime() ? lastActivityAt.toISOString() : "",
            lessonCount: lessons.length,
            missingCount,
            pointsEarned,
            pointsPossible,
            progressPercent,
            studentId: enrollment.user_id,
            studentName: getStudentName(enrollment.user_id),
            submittedCount,
        };
    }).sort((first, second) => (
        first.progressPercent - second.progressPercent
        || second.missingCount - first.missingCount
        || new Date(first.lastActivityAt || 0) - new Date(second.lastActivityAt || 0)
        || first.studentName.localeCompare(second.studentName)
    ));
}

function createStudentProgressCell(row) {
    const cell = createElement("div", "analytics-progress-cell");

    cell.append(
        createElement("strong", "", formatPercent(row.progressPercent)),
        createProgressBar(row.progressPercent, `${row.studentName} progress`),
        createElement("span", "course-muted", `${row.submittedCount} of ${row.lessonCount} lessons`)
    );
    return cell;
}

function renderStudentRiskAnalytics(filters = getFilterValues()) {
    const rows = getStudentProgressRows(filters).filter((row) => (
        row.progressPercent < 80 || row.missingCount > 0 || row.draftCount > 0
    ));

    studentRiskElement.replaceChildren(createAnalyticsTable([
        { label: "Student", key: "studentName" },
        { label: "Course", key: "courseName" },
        { label: "Classroom", key: "classroomName" },
        { label: "Progress", render: createStudentProgressCell },
        { label: "Missing", render: (row) => formatNumber(row.missingCount) },
        { label: "Incomplete", render: (row) => formatNumber(row.draftCount) },
        { label: "Points", render: (row) => `${row.pointsEarned} / ${row.pointsPossible}` },
        { label: "Last activity", render: (row) => formatDate(row.lastActivityAt) },
        {
            label: "Actions",
            render: (row) => createActionLink("Open student", `../classrooms/student.html?classroom=${encodeURIComponent(row.classroomId)}&student=${encodeURIComponent(row.studentId)}`),
        },
    ], rows.slice(0, 12), "No students are currently below the attention threshold for this view."));
}

function getLessonCompletionRows(filters = getFilterValues()) {
    const courseNames = new Map(loadedCourses.map((course) => [course.id, course.title || "Untitled course"]));
    const lessons = getFilteredLessons(filters);
    const enrollmentsByCourse = getFilteredEnrollments(filters).reduce((enrollmentMap, enrollment) => {
        const courseEnrollments = enrollmentMap.get(enrollment.course_id) || [];

        courseEnrollments.push(enrollment);
        enrollmentMap.set(enrollment.course_id, courseEnrollments);
        return enrollmentMap;
    }, new Map());
    const submissionsByContext = getFilteredSubmissions(filters).reduce((submissionMap, submission) => {
        const key = [
            submission.student_user_id,
            submission.classroom_id || "",
            submission.lesson_id,
        ].join(":");
        const existing = submissionMap.get(key);
        const existingDate = new Date(existing?.submitted_at || existing?.updated_at || 0);
        const submissionDate = new Date(submission.submitted_at || submission.updated_at || 0);

        if (!existing || submissionDate > existingDate) {
            submissionMap.set(key, submission);
        }

        return submissionMap;
    }, new Map());

    return lessons.map((lesson) => {
        const enrollments = enrollmentsByCourse.get(lesson.course_id) || [];
        const lessonStats = enrollments.map((enrollment) => {
            const submission = submissionsByContext.get([
                enrollment.user_id,
                enrollment.classroom_id || "",
                lesson.id,
            ].join(":"));

            return {
                isDraft: submission?.status === "draft",
                isSubmitted: submission?.status === "submitted",
                submission,
            };
        });
        const submittedCount = lessonStats.filter((stat) => stat.isSubmitted).length;
        const draftCount = lessonStats.filter((stat) => stat.isDraft).length;
        const missingCount = Math.max(enrollments.length - submittedCount, 0);
        const submissions = lessonStats.map((stat) => stat.submission).filter(Boolean);
        const pointsEarned = submissions.reduce((total, submission) => total + Number(submission.points_earned || 0), 0);
        const pointsPossible = submissions.reduce((total, submission) => total + Number(submission.points_possible || 0), 0);
        const completionPercent = enrollments.length ? (submittedCount / enrollments.length) * 100 : 0;

        return {
            completionPercent,
            courseId: lesson.course_id,
            courseName: courseNames.get(lesson.course_id) || "Course",
            draftCount,
            expectedCount: enrollments.length,
            lesson,
            missingCount,
            name: lesson.title || "Untitled lesson",
            pointsEarned,
            pointsPossible,
            submittedCount,
        };
    }).sort((first, second) => (
        first.completionPercent - second.completionPercent
        || second.missingCount - first.missingCount
        || first.courseName.localeCompare(second.courseName)
        || first.lesson.order_index - second.lesson.order_index
    ));
}

function createLessonCompletionCell(row) {
    const cell = createElement("div", "analytics-progress-cell");

    cell.append(
        createElement("strong", "", formatPercent(row.completionPercent)),
        createProgressBar(row.completionPercent, `${row.name} completion`),
        createElement("span", "course-muted", `${row.submittedCount} of ${row.expectedCount} students`)
    );
    return cell;
}

function getLessonReviewHref(row, filters = getFilterValues()) {
    const params = new URLSearchParams();

    params.set("course", row.courseId);
    params.set("lesson", row.lesson.id);

    if (filters.classroomId) {
        params.set("classroom", filters.classroomId);
    }

    return `../submissions/index.html?${params.toString()}`;
}

function renderLessonAnalytics(filters = getFilterValues()) {
    const rows = getLessonCompletionRows(filters);

    lessonAnalyticsElement.replaceChildren(createAnalyticsTable([
        { label: "Lesson", key: "name" },
        { label: "Course", key: "courseName" },
        { label: "Completion", render: createLessonCompletionCell },
        { label: "Missing", render: (row) => formatNumber(row.missingCount) },
        { label: "Incomplete", render: (row) => formatNumber(row.draftCount) },
        { label: "Points", render: (row) => `${row.pointsEarned} / ${row.pointsPossible}` },
        {
            label: "Actions",
            render: (row) => createActionLink("Review lesson", getLessonReviewHref(row, filters)),
        },
    ], rows, "Lessons with active classroom enrollments will appear here."));
}

function hasAnswerValue(value) {
    if (value === undefined || value === null || value === "") {
        return false;
    }

    if (Array.isArray(value)) {
        return value.length > 0;
    }

    if (typeof value === "object") {
        return Object.values(value).some((entry) => hasAnswerValue(entry));
    }

    return String(value).trim().length > 0;
}

function getQuestionTrendRows(filters = getFilterValues()) {
    const courseNames = new Map(loadedCourses.map((course) => [course.id, course.title || "Untitled course"]));
    const lessonById = new Map(loadedLessons.map((lesson) => [lesson.id, lesson]));
    const enrollmentsByCourse = getFilteredEnrollments(filters).reduce((enrollmentMap, enrollment) => {
        const courseEnrollments = enrollmentMap.get(enrollment.course_id) || [];

        courseEnrollments.push(enrollment);
        enrollmentMap.set(enrollment.course_id, courseEnrollments);
        return enrollmentMap;
    }, new Map());
    const submissionsByLesson = getFilteredSubmissions(filters).reduce((submissionMap, submission) => {
        const lessonSubmissions = submissionMap.get(submission.lesson_id) || [];

        lessonSubmissions.push(submission);
        submissionMap.set(submission.lesson_id, lessonSubmissions);
        return submissionMap;
    }, new Map());

    return getFilteredQuestions(filters).map((question) => {
        const lesson = lessonById.get(question.lesson_id);
        const expectedCount = (enrollmentsByCourse.get(lesson?.course_id) || []).length;
        const submissions = submissionsByLesson.get(question.lesson_id) || [];
        const answeredCount = submissions.filter((submission) => hasAnswerValue(submission.answers_json?.[question.id])).length;
        const missingCount = Math.max(expectedCount - answeredCount, 0);
        const pointsEarned = submissions.reduce((total, submission) => total + Number(submission.points_earned || 0), 0);
        const pointsPossible = submissions.reduce((total, submission) => total + Number(submission.points_possible || 0), 0);
        const averagePointsPercent = pointsPossible ? (pointsEarned / pointsPossible) * 100 : 0;
        const answerRate = expectedCount ? (answeredCount / expectedCount) * 100 : 0;

        return {
            answerRate,
            answeredCount,
            averagePointsPercent,
            courseId: lesson?.course_id || "",
            courseName: courseNames.get(lesson?.course_id) || "Course",
            expectedCount,
            lessonName: lesson?.title || "Untitled lesson",
            missingCount,
            pointsEarned,
            pointsPossible,
            prompt: question.prompt,
            question,
            type: question.question_type.replaceAll("_", " "),
        };
    }).sort((first, second) => (
        first.answerRate - second.answerRate
        || second.missingCount - first.missingCount
        || first.averagePointsPercent - second.averagePointsPercent
        || first.courseName.localeCompare(second.courseName)
        || first.lessonName.localeCompare(second.lessonName)
        || first.question.order_index - second.question.order_index
    ));
}

function createQuestionPromptCell(row) {
    const cell = createElement("div", "analytics-question-cell");
    const prompt = row.prompt.length > 90 ? `${row.prompt.slice(0, 87)}...` : row.prompt;

    cell.append(
        createElement("strong", "", prompt),
        createElement("span", "course-muted", `${row.lessonName} / ${row.type}`)
    );
    return cell;
}

function createAnswerRateCell(row) {
    const cell = createElement("div", "analytics-progress-cell");

    cell.append(
        createElement("strong", "", formatPercent(row.answerRate)),
        createProgressBar(row.answerRate, `${row.prompt} answer rate`),
        createElement("span", "course-muted", `${row.answeredCount} of ${row.expectedCount} students`)
    );
    return cell;
}

function getQuestionReviewHref(row, filters = getFilterValues()) {
    const params = new URLSearchParams();

    params.set("course", row.courseId);
    params.set("lesson", row.question.lesson_id);

    if (filters.classroomId) {
        params.set("classroom", filters.classroomId);
    }

    return `../submissions/index.html?${params.toString()}`;
}

function renderQuestionAnalytics(filters = getFilterValues()) {
    const rows = getQuestionTrendRows(filters).filter((row) => row.expectedCount > 0);

    questionAnalyticsElement.replaceChildren(createAnalyticsTable([
        { label: "Question", render: createQuestionPromptCell },
        { label: "Course", key: "courseName" },
        { label: "Answer rate", render: createAnswerRateCell },
        { label: "Missing", render: (row) => formatNumber(row.missingCount) },
        { label: "Lesson avg points", render: (row) => `${row.pointsEarned} / ${row.pointsPossible}` },
        {
            label: "Actions",
            render: (row) => createActionLink("Review", getQuestionReviewHref(row, filters)),
        },
    ], rows.slice(0, 12), "Question trends will appear after lessons have visible questions and active classroom enrollments."));
}

function renderRecentActivity(filters = getFilterValues()) {
    const filteredSubmissions = getFilteredSubmissions(filters);

    if (!filteredSubmissions.length) {
        activityElement.replaceChildren(createElement("p", "empty-state", "No student activity is available yet."));
        return;
    }

    const courseNames = new Map(loadedCourses.map((course) => [course.id, course.title || "Untitled course"]));
    const classroomNames = new Map(loadedClassrooms.map((classroom) => [classroom.id, getClassroomLabel(classroom)]));
    const lessonNames = new Map(loadedLessons.map((lesson) => [lesson.id, lesson.title || "Untitled lesson"]));
    const list = createElement("ul", "submission-list analytics-activity-list");
    const recentSubmissions = [...filteredSubmissions].sort((first, second) => (
        new Date(second.submitted_at || second.updated_at || 0) - new Date(first.submitted_at || first.updated_at || 0)
    ));

    recentSubmissions.slice(0, 8).forEach((submission) => {
        const item = createElement("li", "submission-item submission-item--review-page");
        const link = createElement("a", "submission-name", lessonNames.get(submission.lesson_id) || "Untitled lesson");
        const contextParts = [
            getStudentName(submission.student_user_id),
            courseNames.get(submission.course_id) || "Course",
            classroomNames.get(submission.classroom_id),
        ].filter(Boolean);
        const context = createElement("span", "course-muted", contextParts.join(" / "));
        const activityDate = createElement("span", "course-muted", formatDate(submission.submitted_at || submission.updated_at));
        const points = createElement("span", "course-muted", `${Number(submission.points_earned || 0)} / ${Number(submission.points_possible || 0)} pts`);
        const status = createElement("span", "badge badge--quiet", submission.status.charAt(0).toUpperCase() + submission.status.slice(1));

        link.href = `../submissions/view.html?submission=${encodeURIComponent(submission.id)}&returnTo=${encodeURIComponent("/pages/analytics/index.html")}`;
        item.append(link, context, activityDate, points, status);
        list.append(item);
    });

    activityElement.replaceChildren(list);
}

function renderAnalyticsView() {
    const filters = getFilterValues();
    const url = new URL(window.location.href);

    updateReviewLink(filters);
    Object.entries({
        classroom: filters.classroomId,
        course: filters.courseId,
    }).forEach(([key, value]) => {
        if (value) {
            url.searchParams.set(key, value);
        } else {
            url.searchParams.delete(key);
        }
    });
    window.history.replaceState({}, "", url);
    renderSummary(filters);
    renderCourseAnalytics(filters);
    renderClassroomAnalytics(filters);
    renderStudentRiskAnalytics(filters);
    renderLessonAnalytics(filters);
    renderQuestionAnalytics(filters);
    renderRecentActivity(filters);
}

async function initializePage() {
    setStatus("Loading teacher analytics...");

    currentProfile = await loadCurrentProfile();

    if (!currentProfile) {
        return;
    }

    try {
        loadedCourses = await loadTeachingCourses(currentProfile.id);

        if (!loadedCourses.length) {
            showShell();
            renderSummary();
            courseAnalyticsElement.replaceChildren(createElement("p", "empty-state", "Managed courses are required before teacher analytics are available."));
            classroomAnalyticsElement.replaceChildren(createElement("p", "empty-state", "Create a course and classroom before analytics are available."));
            studentRiskElement.replaceChildren(createElement("p", "empty-state", "Student progress will appear after students join a classroom."));
            lessonAnalyticsElement.replaceChildren(createElement("p", "empty-state", "Lesson completion will appear after students join a classroom."));
            questionAnalyticsElement.replaceChildren(createElement("p", "empty-state", "Question trends will appear after students answer visible questions."));
            activityElement.replaceChildren(createElement("p", "empty-state", "No student activity is available yet."));
            setStatus("");
            return;
        }

        const courseIds = loadedCourses.map((course) => course.id);

        [loadedClassrooms, loadedLessons, loadedSubmissions, studentNames] = await Promise.all([
            loadManagedClassrooms(currentProfile.id, courseIds),
            loadLessons(courseIds),
            loadSubmissions(courseIds),
            loadStudentNames(),
        ]);
        loadedQuestions = await loadQuestions(loadedLessons.map((lesson) => lesson.id));

        loadedEnrollments = await loadActiveClassroomEnrollments(loadedClassrooms.map((classroom) => classroom.id));

        renderFilters();
        renderAnalyticsView();
        showShell();
        setStatus("");
    } catch (error) {
        setStatus(error.message || "Teacher analytics could not be loaded.", "error");
    }
}

filterForm.addEventListener("change", (event) => {
    if (event.target === courseFilter) {
        classroomFilter.value = "";
        populateSelect(
            classroomFilter,
            getFilteredClassrooms(courseFilter.value).map((classroom) => ({
                label: getClassroomLabel(classroom),
                value: classroom.id,
            })),
            "All classrooms"
        );
    }

    renderAnalyticsView();
});

await initializePage();
