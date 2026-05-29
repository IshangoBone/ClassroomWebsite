import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const dashboardStatus = qs("[data-dashboard-status]");
const greetingElement = qs("[data-dashboard-greeting]");
const courseList = qs("[data-course-list]");
const submissionList = qs("[data-submission-list]");
const studentSubmissionList = qs("[data-student-submission-list]");
const courseFormPanel = qs("[data-course-form-panel]");
const courseForm = qs("[data-course-form]");
const courseFormToggle = qs("[data-course-form-toggle]");
const courseFormCancel = qs("[data-course-form-cancel]");
const submissionFilterForm = qs("[data-submission-filter-form]");
const submissionFilterCourse = qs("[data-submission-filter-course]");
const submissionFilterClassroom = qs("[data-submission-filter-classroom]");
const submissionFilterLesson = qs("[data-submission-filter-lesson]");
const submissionFilterStudent = qs("[data-submission-filter-student]");
const coursesSummary = qs("[data-summary-courses]");
const classroomsSummary = qs("[data-summary-classrooms]");
const submissionsSummary = qs("[data-summary-submissions]");
const studentSubmissionsSummary = qs("[data-summary-my-submissions]");

let currentProfile = null;
let dashboardCourses = [];
let dashboardClassrooms = [];
let dashboardLessons = [];
let dashboardSubmissions = [];
let dashboardStudentNames = new Map();

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

function setCourseFormVisible(isVisible) {
    courseFormPanel.hidden = !isVisible;
    courseFormToggle.textContent = isVisible ? "Close form" : "New course";

    if (isVisible) {
        courseForm.elements.title.focus();
    }
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
        .select("id, course_id, classroom_id, lesson_id, status, submitted_at, updated_at")
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

function renderStudentSubmissions(submissions, courses, lessons) {
    if (!submissions.length) {
        renderEmpty(studentSubmissionList, "You do not have any saved lesson work yet.");
        return;
    }

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

    studentSubmissionList.replaceChildren(list);
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
        const studentSubmissions = await loadStudentSubmissions(currentProfile.id);
        const studentCourseIds = studentSubmissions.map((submission) => submission.course_id);
        const allCourseIds = [...new Set([...courseIds, ...studentCourseIds])];
        const [classrooms, lessons, submissions, visibleCourses, studentNames] = await Promise.all([
            loadManagedClassrooms(currentProfile.id, courseIds),
            loadLessons(allCourseIds),
            loadRecentSubmissions(courseIds),
            loadVisibleCourses(allCourseIds),
            loadStudentNameMap(),
        ]);

        dashboardCourses = courses;
        dashboardClassrooms = classrooms;
        dashboardLessons = lessons;
        dashboardSubmissions = submissions;
        dashboardStudentNames = studentNames;
        coursesSummary.textContent = String(courses.length);
        classroomsSummary.textContent = String(classrooms.length);
        submissionsSummary.textContent = String(submissions.length);
        studentSubmissionsSummary.textContent = String(studentSubmissions.length);
        renderCourses(courses, classrooms);
        renderSubmissionFilters(courses, classrooms, lessons.filter((lesson) => courseIds.includes(lesson.course_id)), submissions);
        refreshSubmissionList();
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
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
        window.location.href = "../auth/login.html";
        return;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, profile_completed")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();

    if (profileError || !profile) {
        setStatus("Your profile could not be loaded. Please sign in again.", "error");
        return;
    }

    if (!profile.profile_completed) {
        window.location.href = "../auth/onboarding.html";
        return;
    }

    currentProfile = profile;
    greetingElement.textContent = `Welcome, ${profile.username || "there"}. Manage teaching work and continue saved lessons.`;
    courseFormToggle.disabled = false;
    await refreshDashboard();
}

courseFormToggle.addEventListener("click", () => {
    setCourseFormVisible(courseFormPanel.hidden);
});

courseFormCancel.addEventListener("click", () => {
    courseForm.reset();
    setCourseFormVisible(false);
});

submissionFilterForm.addEventListener("change", refreshSubmissionList);

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
