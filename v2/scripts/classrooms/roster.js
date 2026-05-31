import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const params = new URLSearchParams(window.location.search);
const classroomId = params.get("classroom");
const headingElement = qs("[data-roster-heading]");
const contextElement = qs("[data-roster-context]");
const statusElement = qs("[data-roster-status]");
const shellElement = qs("[data-roster-shell]");
const summaryElement = qs("[data-roster-summary]");
const rosterAddForm = qs("[data-roster-add-form]");
const rosterControls = qs("[data-roster-controls]");
const rosterListElement = qs("[data-roster-list]");
const copyInviteLinkButton = qs("[data-copy-invite-link]");
const manageClassroomsLink = qs("[data-manage-classrooms-link]");
let currentClassroom = null;
let loadedRoster = [];
let courseLessonCount = 0;
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

function createInviteToken() {
    const values = new Uint8Array(18);
    window.crypto.getRandomValues(values);

    return btoa(String.fromCharCode(...values))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function getInviteUrl(inviteToken) {
    const url = new URL("../dashboard/index.html", window.location.href);
    url.searchParams.set("classroomInvite", inviteToken);

    return url.href;
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

function getStudentProgress(studentId) {
    const activity = getStudentActivity(studentId);
    const hasKnownLessonTotal = courseLessonCount > 0;
    const progressPercent = courseLessonCount ? Math.round((activity.submittedCount / courseLessonCount) * 100) : 0;
    const incompleteCount = courseLessonCount
        ? Math.max(courseLessonCount - activity.submittedCount, 0)
        : activity.draftCount;

    return {
        incompleteCount,
        isComplete: hasKnownLessonTotal
            ? activity.submittedCount >= courseLessonCount
            : activity.submittedCount > 0 && activity.draftCount === 0,
        needsWork: hasKnownLessonTotal
            ? Boolean(incompleteCount) || activity.draftCount > 0
            : activity.submittedCount === 0 || activity.draftCount > 0,
        progressPercent,
        submittedCount: activity.submittedCount,
        totalLessons: courseLessonCount,
    };
}

function formatProgress(progress) {
    if (!progress.totalLessons && progress.submittedCount) {
        return `${progress.submittedCount} submitted`;
    }

    return `${progress.progressPercent}% (${progress.submittedCount}/${progress.totalLessons || 0} lessons)`;
}

function createSummaryCard(label, value) {
    const card = createElement("article", "summary-card");

    card.append(createElement("span", "summary-label", label), createElement("strong", "summary-value summary-value--small", value));
    return card;
}

function getRosterView() {
    const formData = new FormData(rosterControls);
    const status = String(formData.get("status") || "");
    const work = String(formData.get("work") || "");
    const sort = String(formData.get("sort") || "name-asc");
    let filteredRoster = status
        ? loadedRoster.filter((student) => student.enrollment_status === status)
        : [...loadedRoster];

    if (work) {
        filteredRoster = filteredRoster.filter((student) => {
            const progress = getStudentProgress(student.student_user_id);

            if (work === "needs-work") {
                return progress.needsWork;
            }

            if (work === "missing") {
                return progress.submittedCount === 0;
            }

            if (work === "complete") {
                return progress.isComplete;
            }

            return true;
        });
    }

    return filteredRoster.sort((firstStudent, secondStudent) => {
        if (sort === "progress-asc" || sort === "progress-desc") {
            const firstProgress = getStudentProgress(firstStudent.student_user_id).progressPercent;
            const secondProgress = getStudentProgress(secondStudent.student_user_id).progressPercent;
            const progressSort = sort === "progress-asc"
                ? firstProgress - secondProgress
                : secondProgress - firstProgress;

            return progressSort || getStudentSortName(firstStudent).localeCompare(getStudentSortName(secondStudent));
        }

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
        .select("id, course_id, name, period_block, school_year, status, invite_token")
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

async function restoreStudentToRoster(student) {
    const studentName = formatStudentName(student);
    const confirmed = window.confirm(
        `Restore ${studentName} to this classroom? They will regain active classroom access.`
    );

    if (!confirmed) {
        return;
    }

    setStatus(`Restoring ${studentName}...`);

    const { error } = await supabase.rpc("restore_student_to_classroom", {
        classroom_to_check: classroomId,
        enrollment_to_restore: student.enrollment_id,
    });

    if (error) {
        setStatus(error.message || "Student could not be restored to the classroom.", "error");
        return;
    }

    loadedRoster = await loadRoster();

    if (!loadedRoster) {
        return;
    }

    renderSummary(loadedRoster);
    renderRosterView();
    setStatus(`${studentName} was restored to this classroom.`, "success");
}

async function addStudentByEmail(event) {
    event.preventDefault();

    const formData = new FormData(rosterAddForm);
    const email = String(formData.get("studentEmail") || "").trim();

    if (!email) {
        setStatus("Enter a student email address.", "error");
        return;
    }

    const submitButton = rosterAddForm.querySelector("button[type='submit']");

    submitButton.disabled = true;
    setStatus(`Adding ${email}...`);

    const { error } = await supabase.rpc("add_student_to_classroom_by_email", {
        classroom_to_check: classroomId,
        student_email_input: email,
    });

    if (error) {
        submitButton.disabled = false;
        setStatus(error.message || "Student could not be added to this classroom.", "error");
        return;
    }

    loadedRoster = await loadRoster();

    if (!loadedRoster) {
        submitButton.disabled = false;
        return;
    }

    rosterAddForm.reset();
    renderSummary(loadedRoster);
    renderRosterView();
    submitButton.disabled = false;
    setStatus(`${email} is active in this classroom.`, "success");
}

async function copyInviteLink() {
    if (!currentClassroom) {
        setStatus("Classroom details are still loading.", "error");
        return;
    }

    let inviteToken = currentClassroom.invite_token;

    copyInviteLinkButton.disabled = true;

    if (!inviteToken) {
        inviteToken = createInviteToken();
        setStatus("Creating invite link...");

        const { error } = await supabase
            .from("classrooms")
            .update({ invite_token: inviteToken })
            .eq("id", currentClassroom.id)
            .eq("course_id", currentClassroom.course_id);

        if (error) {
            copyInviteLinkButton.disabled = false;
            setStatus(error.message || "Invite link could not be created.", "error");
            return;
        }

        currentClassroom.invite_token = inviteToken;
    }

    const inviteUrl = getInviteUrl(inviteToken);

    try {
        await navigator.clipboard.writeText(inviteUrl);
        setStatus("Invite link copied.", "success");
    } catch (error) {
        setStatus(`Copy this invite link: ${inviteUrl}`, "success");
    }

    copyInviteLinkButton.disabled = false;
}

function renderSummary(roster) {
    const activeCount = roster.filter((student) => student.enrollment_status === "active").length;
    const removedCount = roster.filter((student) => student.enrollment_status === "removed").length;
    const needsWorkCount = roster.filter((student) => getStudentProgress(student.student_user_id).needsWork).length;

    summaryElement.replaceChildren(
        createSummaryCard("Total students", String(roster.length)),
        createSummaryCard("Active", String(activeCount)),
        createSummaryCard("Needs work", String(needsWorkCount)),
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
        const progress = getStudentProgress(student.student_user_id);
        const item = createElement("li", "roster-item");
        const identity = createElement("div", "roster-identity");
        const activityMeta = createElement("div", "roster-activity");
        const name = createElement("a", "roster-name submission-name", formatStudentName(student));
        const username = createElement("span", "course-muted", student.username ? `@${student.username}` : "No username set");
        const email = createElement("span", "course-muted", student.email || "No email available");
        const joined = createElement("span", "course-muted", `Joined ${formatDate(student.joined_at)}`);
        const lessonWork = createElement(
            "span",
            "course-muted",
            `Lesson work: ${activity.totalCount} total, ${activity.submittedCount} submitted`
        );
        const lastActivity = createElement("span", "course-muted", `Last activity: ${formatActivityDate(activity.lastActivityAt)}`);
        const progressMeta = createElement(
            "span",
            "course-muted",
            `Progress: ${formatProgress(progress)}`
        );
        const badge = createElement("span", "badge badge--quiet", student.enrollment_status);
        const actions = createElement("div", "roster-actions");
        const removeButton = createElement("button", "secondary-button destructive-button lesson-action", "Remove student");
        const restoreButton = createElement("button", "secondary-button lesson-action", "Restore student");

        name.href = `student.html?classroom=${encodeURIComponent(classroomId)}&student=${encodeURIComponent(student.student_user_id)}`;
        activityMeta.append(lessonWork, progressMeta, lastActivity);

        if (activity.latestSubmissionId) {
            const latestWorkLink = createElement("a", "submission-name", "Open latest work");

            latestWorkLink.href = `../submissions/view.html?submission=${encodeURIComponent(activity.latestSubmissionId)}`;
            activityMeta.append(latestWorkLink);
        }

        removeButton.type = "button";
        removeButton.hidden = student.enrollment_status === "removed";
        removeButton.addEventListener("click", () => removeStudentFromRoster(student));
        restoreButton.type = "button";
        restoreButton.hidden = student.enrollment_status !== "removed";
        restoreButton.addEventListener("click", () => restoreStudentToRoster(student));
        actions.append(removeButton, restoreButton);

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

    currentClassroom = classroom;
    headingElement.textContent = `${classroomLabel} roster`;
    contextElement.textContent = `${course?.title || "Untitled course"} · ${classroom.school_year || "School year not set"} · ${classroom.status}`;
    manageClassroomsLink.href = `manage.html?course=${encodeURIComponent(classroom.course_id)}`;
    shellElement.hidden = false;

    loadedRoster = await loadRoster();

    if (!loadedRoster) {
        return;
    }

    courseLessonCount = await loadCourseLessonCount();

    if (courseLessonCount === null) {
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
rosterAddForm.addEventListener("submit", addStudentByEmail);
copyInviteLinkButton.addEventListener("click", copyInviteLink);

await initializePage();
