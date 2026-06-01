import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const statusElement = qs("[data-review-status]");
const shellElement = qs("[data-review-shell]");
const summaryElement = qs("[data-review-summary]");
const filterForm = qs("[data-review-filter-form]");
const courseFilter = qs("[data-review-filter-course]");
const classroomFilter = qs("[data-review-filter-classroom]");
const lessonFilter = qs("[data-review-filter-lesson]");
const studentFilter = qs("[data-review-filter-student]");
const reviewListElement = qs("[data-review-list]");

let currentProfile = null;
let loadedCourses = [];
let loadedClassrooms = [];
let loadedLessons = [];
let loadedSubmissions = [];
let loadedReviewItems = [];
let studentNames = new Map();

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function formatShortId(id) {
    return id ? id.slice(0, 8) : "unknown";
}

function formatStatus(status = "draft") {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value) {
    if (!value) {
        return "Not submitted";
    }

    return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
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

function createSummaryCard(label, value) {
    const card = createElement("article", "summary-card");

    card.append(createElement("span", "summary-label", label), createElement("strong", "summary-value summary-value--small", value));
    return card;
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
        lessonId: String(formData.get("lesson") || ""),
        status: String(formData.get("status") || ""),
        studentId: String(formData.get("student") || ""),
    };
}

function getReviewReturnUrl() {
    const url = new URL(window.location.href);

    new FormData(filterForm).forEach((value, key) => {
        const normalizedValue = String(value || "");

        if (normalizedValue) {
            url.searchParams.set(key, normalizedValue);
        } else {
            url.searchParams.delete(key);
        }
    });

    return `${url.pathname}${url.search}`;
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
        .select("id, title, updated_at")
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
            .select("id, title, updated_at")
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
        .select("id, student_user_id, course_id, classroom_id, lesson_id, status, submitted_at, updated_at, total_questions, points_possible, points_earned")
        .in("course_id", courseIds)
        .order("updated_at", { ascending: false })
        .limit(250);

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

function createMissingWorkItems(enrollments) {
    const submissionsByContext = new Set(loadedSubmissions.map((submission) => [
        submission.student_user_id,
        submission.classroom_id || "",
        submission.lesson_id,
    ].join(":")));
    const lessonsByCourse = loadedLessons.reduce((lessonMap, lesson) => {
        const courseLessons = lessonMap.get(lesson.course_id) || [];

        courseLessons.push(lesson);
        lessonMap.set(lesson.course_id, courseLessons);
        return lessonMap;
    }, new Map());

    return enrollments.flatMap((enrollment) => {
        const courseLessons = lessonsByCourse.get(enrollment.course_id) || [];

        return courseLessons
            .filter((lesson) => !submissionsByContext.has([
                enrollment.user_id,
                enrollment.classroom_id || "",
                lesson.id,
            ].join(":")))
            .map((lesson) => ({
                classroom_id: enrollment.classroom_id,
                course_id: enrollment.course_id,
                id: `missing:${enrollment.id}:${lesson.id}`,
                isMissing: true,
                lesson_id: lesson.id,
                points_earned: 0,
                points_possible: 0,
                status: "missing",
                student_user_id: enrollment.user_id,
                submitted_at: "",
                updated_at: enrollment.joined_at,
            }));
    });
}

function buildReviewItems(enrollments) {
    const missingWorkItems = createMissingWorkItems(enrollments);

    return [...loadedSubmissions, ...missingWorkItems].sort((firstItem, secondItem) => {
        const firstDate = new Date(firstItem.submitted_at || firstItem.updated_at || 0);
        const secondDate = new Date(secondItem.submitted_at || secondItem.updated_at || 0);

        return secondDate - firstDate || getStudentName(firstItem.student_user_id).localeCompare(getStudentName(secondItem.student_user_id));
    });
}

function renderFilters() {
    const courseOptions = loadedCourses.map((course) => ({
        label: course.title || "Untitled course",
        value: course.id,
    }));
    const classroomOptions = loadedClassrooms.map((classroom) => ({
        label: classroom.period_block ? `${classroom.name} - ${classroom.period_block}` : classroom.name,
        value: classroom.id,
    }));
    const lessonOptions = loadedLessons.map((lesson) => ({
        label: lesson.title || "Untitled lesson",
        value: lesson.id,
    }));
    const studentOptions = [...new Set(loadedReviewItems.map((submission) => submission.student_user_id).filter(Boolean))]
        .sort((firstId, secondId) => getStudentName(firstId).localeCompare(getStudentName(secondId)))
        .map((studentId) => ({
            label: getStudentName(studentId),
            value: studentId,
        }));

    populateSelect(courseFilter, courseOptions, "All courses");
    populateSelect(classroomFilter, classroomOptions, "All classrooms");
    populateSelect(lessonFilter, lessonOptions, "All lessons");
    populateSelect(studentFilter, studentOptions, "All students");

    new URLSearchParams(window.location.search).forEach((value, key) => {
        const field = filterForm.elements[key];

        if (field && [...field.options].some((option) => option.value === value)) {
            field.value = value;
        }
    });
}

function getFilteredSubmissions() {
    const filters = getFilterValues();

    return loadedReviewItems.filter((submission) => (
        (!filters.courseId || submission.course_id === filters.courseId)
        && (!filters.classroomId || submission.classroom_id === filters.classroomId)
        && (!filters.lessonId || submission.lesson_id === filters.lessonId)
        && (!filters.status || submission.status === filters.status)
        && (!filters.studentId || submission.student_user_id === filters.studentId)
    ));
}

function renderSummary(submissions) {
    const submittedCount = submissions.filter((submission) => submission.status === "submitted").length;
    const draftCount = submissions.filter((submission) => submission.status === "draft").length;
    const missingCount = submissions.filter((submission) => submission.status === "missing").length;
    const scorableSubmissions = submissions.filter((submission) => !submission.isMissing);
    const pointsEarned = scorableSubmissions.reduce((total, submission) => total + Number(submission.points_earned || 0), 0);
    const pointsPossible = scorableSubmissions.reduce((total, submission) => total + Number(submission.points_possible || 0), 0);

    summaryElement.replaceChildren(
        createSummaryCard("Visible work", String(submissions.length)),
        createSummaryCard("Submitted", String(submittedCount)),
        createSummaryCard("Incomplete drafts", String(draftCount)),
        createSummaryCard("Missing", String(missingCount)),
        createSummaryCard("Points", `${pointsEarned} / ${pointsPossible}`)
    );
}

function renderSubmissions(submissions) {
    if (!submissions.length) {
        reviewListElement.replaceChildren(createElement("p", "empty-state", "No submissions match the current filters."));
        return;
    }

    const courseNames = new Map(loadedCourses.map((course) => [course.id, course.title || "Untitled course"]));
    const classroomNames = new Map(loadedClassrooms.map((classroom) => [
        classroom.id,
        classroom.period_block ? `${classroom.name} - ${classroom.period_block}` : classroom.name,
    ]));
    const lessonNames = new Map(loadedLessons.map((lesson) => [lesson.id, lesson.title || "Untitled lesson"]));
    const list = createElement("ul", "submission-list submission-list--review-page");

    submissions.forEach((submission) => {
        const item = createElement("li", "submission-item submission-item--review-page");
        const link = createElement("a", "submission-name", lessonNames.get(submission.lesson_id) || "Untitled lesson");
        const student = createElement("span", "course-muted", getStudentName(submission.student_user_id));
        const contextParts = [
            courseNames.get(submission.course_id) || "Course",
            classroomNames.get(submission.classroom_id),
        ].filter(Boolean);
        const context = createElement("span", "course-muted", contextParts.join(" / "));
        const submittedAt = createElement(
            "span",
            "course-muted",
            submission.isMissing ? "No submission yet" : formatDate(submission.submitted_at || submission.updated_at)
        );
        const points = createElement(
            "span",
            "course-muted",
            submission.isMissing ? "No points yet" : `${Number(submission.points_earned || 0)} / ${Number(submission.points_possible || 0)} pts`
        );
        const status = createElement("span", "badge badge--quiet", formatStatus(submission.status));

        const returnTo = getReviewReturnUrl();

        link.href = submission.isMissing
            ? `../classrooms/student.html?classroom=${encodeURIComponent(submission.classroom_id)}&student=${encodeURIComponent(submission.student_user_id)}`
            : `view.html?submission=${encodeURIComponent(submission.id)}&returnTo=${encodeURIComponent(returnTo)}`;
        item.append(link, student, context, submittedAt, points, status);
        list.append(item);
    });

    reviewListElement.replaceChildren(list);
}

function renderReviewView() {
    const filteredSubmissions = getFilteredSubmissions();

    renderSummary(filteredSubmissions);
    renderSubmissions(filteredSubmissions);
}

async function initializePage() {
    setStatus("Loading submission review...");

    currentProfile = await loadCurrentProfile();

    if (!currentProfile) {
        return;
    }

    try {
        loadedCourses = await loadTeachingCourses(currentProfile.id);

        if (!loadedCourses.length) {
            shellElement.hidden = false;
            renderSummary([]);
            reviewListElement.replaceChildren(createElement("p", "empty-state", "Managed courses are required before submission review is available."));
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

        const classroomIds = loadedClassrooms.map((classroom) => classroom.id);
        const activeEnrollments = await loadActiveClassroomEnrollments(classroomIds);

        loadedReviewItems = buildReviewItems(activeEnrollments);
        renderFilters();
        renderReviewView();
        shellElement.hidden = false;
        setStatus("");
    } catch (error) {
        setStatus(error.message || "Submission review could not be loaded.", "error");
    }
}

filterForm.addEventListener("change", renderReviewView);

await initializePage();
