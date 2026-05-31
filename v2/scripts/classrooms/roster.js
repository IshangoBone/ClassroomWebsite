import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const params = new URLSearchParams(window.location.search);
const classroomId = params.get("classroom");
const headingElement = qs("[data-roster-heading]");
const contextElement = qs("[data-roster-context]");
const statusElement = qs("[data-roster-status]");
const shellElement = qs("[data-roster-shell]");
const summaryElement = qs("[data-roster-summary]");
const rosterControls = qs("[data-roster-controls]");
const rosterListElement = qs("[data-roster-list]");
const manageClassroomsLink = qs("[data-manage-classrooms-link]");
let loadedRoster = [];
let rosterActivityByStudent = new Map();

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function formatStudentName(student) {
    const fullName = [student.legal_first_name, student.legal_last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || student.username || student.email || "Unnamed student";
}

function formatDate(value) {
    if (!value) {
        return "Unknown";
    }

    return new Date(value).toLocaleDateString([], {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function formatActivityDate(value) {
    if (!value) {
        return "No lesson activity yet";
    }

    return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function getStudentSortName(student) {
    return [
        student.legal_last_name,
        student.legal_first_name,
        student.username,
        student.email,
    ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
}

function getStudentActivity(studentId) {
    return rosterActivityByStudent.get(studentId) || {
        draftCount: 0,
        latestSubmissionId: "",
        lastActivityAt: "",
        submittedCount: 0,
        totalCount: 0,
    };
}

function createSummaryCard(label, value) {
    const card = createElement("article", "summary-card");

    card.append(createElement("span", "summary-label", label), createElement("strong", "summary-value summary-value--small", value));
    return card;
}

function getRosterView() {
    const formData = new FormData(rosterControls);
    const status = String(formData.get("status") || "");
    const sort = String(formData.get("sort") || "name-asc");
    const filteredRoster = status
        ? loadedRoster.filter((student) => student.enrollment_status === status)
        : [...loadedRoster];

    return filteredRoster.sort((firstStudent, secondStudent) => {
        if (sort === "last-activity-desc") {
            const firstActivity = getStudentActivity(firstStudent.student_user_id).lastActivityAt || 0;
            const secondActivity = getStudentActivity(secondStudent.student_user_id).lastActivityAt || 0;

            return new Date(secondActivity) - new Date(firstActivity)
                || getStudentSortName(firstStudent).localeCompare(getStudentSortName(secondStudent));
        }

        if (sort === "joined-desc") {
            return new Date(secondStudent.joined_at || 0) - new Date(firstStudent.joined_at || 0);
        }

        if (sort === "joined-asc") {
            return new Date(firstStudent.joined_at || 0) - new Date(secondStudent.joined_at || 0);
        }

        if (sort === "status-asc") {
            return String(firstStudent.enrollment_status || "").localeCompare(String(secondStudent.enrollment_status || ""))
                || getStudentSortName(firstStudent).localeCompare(getStudentSortName(secondStudent));
        }

        return getStudentSortName(firstStudent).localeCompare(getStudentSortName(secondStudent));
    });
}

function renderRosterView() {
    renderRoster(getRosterView());
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

async function loadClassroomContext() {
    if (!classroomId) {
        headingElement.textContent = "Roster unavailable";
        setStatus("Open a classroom roster from the classroom manager.", "error");
        return null;
    }

    const { data: classroom, error: classroomError } = await supabase
        .from("classrooms")
        .select("id, course_id, name, period_block, school_year, status")
        .eq("id", classroomId)
        .single();

    if (classroomError || !classroom) {
        headingElement.textContent = "Roster unavailable";
        setStatus("This classroom could not be loaded. Check that your account can manage it.", "error");
        return null;
    }

    const { data: canManage, error: permissionError } = await supabase.rpc("manages_classroom", {
        classroom_to_check: classroomId,
    });

    if (permissionError || !canManage) {
        headingElement.textContent = "Roster unavailable";
        setStatus("You do not have permission to view this classroom roster.", "error");
        return null;
    }

    const { data: course } = await supabase
        .from("courses")
        .select("id, title")
        .eq("id", classroom.course_id)
        .maybeSingle();

    return { classroom, course };
}

async function loadRoster() {
    const { data, error } = await supabase.rpc("classroom_roster", {
        classroom_to_check: classroomId,
    });

    if (error) {
        setStatus(error.message || "Roster could not be loaded.", "error");
        return null;
    }

    return data || [];
}

async function loadRosterActivity() {
    const { data, error } = await supabase
        .from("lesson_submissions")
        .select("id, student_user_id, status, submitted_at, updated_at")
        .eq("classroom_id", classroomId)
        .order("updated_at", { ascending: false });

    if (error) {
        setStatus(error.message || "Roster activity could not be loaded.", "error");
        return null;
    }

    const activityByStudent = new Map();

    (data || []).forEach((submission) => {
        const currentActivity = activityByStudent.get(submission.student_user_id) || {
            draftCount: 0,
            latestSubmissionId: "",
            lastActivityAt: "",
            submittedCount: 0,
            totalCount: 0,
        };
        const activityAt = submission.updated_at || submission.submitted_at || "";

        currentActivity.totalCount += 1;
        currentActivity.submittedCount += submission.status === "submitted" ? 1 : 0;
        currentActivity.draftCount += submission.status === "draft" ? 1 : 0;

        if (!currentActivity.lastActivityAt || new Date(activityAt) > new Date(currentActivity.lastActivityAt)) {
            currentActivity.lastActivityAt = activityAt;
            currentActivity.latestSubmissionId = submission.id;
        }

        activityByStudent.set(submission.student_user_id, currentActivity);
    });

    return activityByStudent;
}

async function removeStudentFromRoster(student) {
    const studentName = formatStudentName(student);
    const confirmed = window.confirm(
        `Remove ${studentName} from this classroom? Their existing submissions stay available for review, but they will lose active classroom access.`
    );

    if (!confirmed) {
        return;
    }

    setStatus(`Removing ${studentName}...`);

    const { error } = await supabase.rpc("remove_student_from_classroom", {
        classroom_to_check: classroomId,
        enrollment_to_remove: student.enrollment_id,
    });

    if (error) {
        setStatus(error.message || "Student could not be removed from the classroom.", "error");
        return;
    }

    loadedRoster = await loadRoster();

    if (!loadedRoster) {
        return;
    }

    renderSummary(loadedRoster);
    renderRosterView();
    setStatus(`${studentName} was removed from this classroom.`, "success");
}

function renderSummary(roster) {
    const activeCount = roster.filter((student) => student.enrollment_status === "active").length;
    const removedCount = roster.filter((student) => student.enrollment_status === "removed").length;

    summaryElement.replaceChildren(
        createSummaryCard("Total students", String(roster.length)),
        createSummaryCard("Active", String(activeCount)),
        createSummaryCard("Removed", String(removedCount))
    );
}

function renderRoster(roster) {
    if (!roster.length) {
        const emptyMessage = loadedRoster.length
            ? "No students match the current roster filters."
            : "No students have joined this classroom yet.";

        rosterListElement.replaceChildren(createElement("p", "empty-state", emptyMessage));
        return;
    }

    const list = createElement("ul", "roster-list");

    roster.forEach((student) => {
        const activity = getStudentActivity(student.student_user_id);
        const item = createElement("li", "roster-item");
        const identity = createElement("div", "roster-identity");
        const activityMeta = createElement("div", "roster-activity");
        const name = createElement("strong", "roster-name", formatStudentName(student));
        const username = createElement("span", "course-muted", student.username ? `@${student.username}` : "No username set");
        const email = createElement("span", "course-muted", student.email || "No email available");
        const joined = createElement("span", "course-muted", `Joined ${formatDate(student.joined_at)}`);
        const lessonWork = createElement(
            "span",
            "course-muted",
            `Lesson work: ${activity.totalCount} total, ${activity.submittedCount} submitted`
        );
        const lastActivity = createElement("span", "course-muted", `Last activity: ${formatActivityDate(activity.lastActivityAt)}`);
        const badge = createElement("span", "badge badge--quiet", student.enrollment_status);
        const actions = createElement("div", "roster-actions");
        const removeButton = createElement("button", "secondary-button destructive-button lesson-action", "Remove student");

        activityMeta.append(lessonWork, lastActivity);

        if (activity.latestSubmissionId) {
            const latestWorkLink = createElement("a", "submission-name", "Open latest work");

            latestWorkLink.href = `../submissions/view.html?submission=${encodeURIComponent(activity.latestSubmissionId)}`;
            activityMeta.append(latestWorkLink);
        }

        removeButton.type = "button";
        removeButton.disabled = student.enrollment_status === "removed";
        removeButton.addEventListener("click", () => removeStudentFromRoster(student));
        actions.append(removeButton);

        identity.append(name, username, email, joined);
        item.append(identity, activityMeta, badge, actions);
        list.append(item);
    });

    rosterListElement.replaceChildren(list);
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

    const { classroom, course } = context;
    const classroomLabel = classroom.period_block
        ? `${classroom.name} - ${classroom.period_block}`
        : classroom.name;

    headingElement.textContent = `${classroomLabel} roster`;
    contextElement.textContent = `${course?.title || "Untitled course"} · ${classroom.school_year || "School year not set"} · ${classroom.status}`;
    manageClassroomsLink.href = `manage.html?course=${encodeURIComponent(classroom.course_id)}`;
    shellElement.hidden = false;

    loadedRoster = await loadRoster();

    if (!loadedRoster) {
        return;
    }

    rosterActivityByStudent = await loadRosterActivity();

    if (!rosterActivityByStudent) {
        return;
    }

    renderSummary(loadedRoster);
    renderRosterView();
    setStatus("");
}

rosterControls.addEventListener("change", renderRosterView);

await initializePage();
