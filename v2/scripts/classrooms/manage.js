import { supabase } from "../../services/supabase/client.js";
import { loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { notifyStatus } from "../utils/ui-components.js";

const params = new URLSearchParams(window.location.search);
const courseId = params.get("course");
const headingElement = qs("[data-classrooms-heading]");
const statusElement = qs("[data-classrooms-status]");
const contentSections = [...document.querySelectorAll("[data-classrooms-content]")];
const classroomList = qs("[data-classroom-list]");
const createButton = qs("[data-toggle-classroom-form]");
const cancelButton = qs("[data-cancel-classroom-form]");
const classroomForm = qs("[data-classroom-form]");
const classroomFormHeading = qs("[data-classroom-form-heading]");
const classroomFormCopy = qs("[data-classroom-form-copy]");
const classroomSubmitButton = qs("[data-classroom-submit]");
let currentProfileId = null;
let loadedClassrooms = [];
let draggedClassroomId = null;
let classroomInsights = new Map();
let classroomInsightsWarning = false;

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
    notifyStatus(message, tone);
}

function resetClassroomFormText() {
    classroomFormHeading.textContent = "Create class";
    classroomFormCopy.textContent = "Create one class period for this course. Students can join with the class code or invite link.";
    classroomSubmitButton.textContent = "Create class";
}

function toggleClassroomForm(isOpen, classroom = null) {
    classroomForm.hidden = !isOpen;
    createButton.hidden = isOpen;

    if (isOpen) {
        classroomForm.reset();
        classroomForm.elements["classroom-id"].value = "";

        if (classroom) {
            classroomForm.elements["classroom-id"].value = classroom.id;
            classroomForm.elements.name.value = classroom.name || "";
            classroomForm.elements.period_block.value = classroom.period_block || "";
            classroomForm.elements.school_year.value = classroom.school_year || "";
            classroomFormHeading.textContent = `Edit ${formatClassroomName(classroom)}`;
            classroomFormCopy.textContent = "Update the class name, period, or school year shown in the teacher workspace.";
            classroomSubmitButton.textContent = "Save class details";
        } else {
            resetClassroomFormText();
        }

        classroomForm.elements.name.focus();
    } else {
        classroomForm.reset();
        classroomForm.elements["classroom-id"].value = "";
        resetClassroomFormText();
    }
}

function clearDragStyles() {
    classroomList.querySelectorAll(".managed-classroom-card").forEach((card) => {
        card.classList.remove("managed-classroom-card--dragging", "managed-classroom-card--drop-target");
    });
}

function createJoinCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const values = new Uint32Array(6);
    window.crypto.getRandomValues(values);

    return `CTC-${[...values].map((value) => alphabet[value % alphabet.length]).join("")}`;
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

function formatClassroomName(classroom) {
    return classroom.period_block
        ? `${classroom.name} - ${classroom.period_block}`
        : classroom.name || "Untitled class";
}

function formatLatestActivity(value) {
    if (!value) {
        return "No submissions yet";
    }

    return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function getClassroomInsights(classroomId) {
    return classroomInsights.get(classroomId) || {
        activeStudents: 0,
        draftSubmissions: 0,
        latestActivityAt: "",
        submittedSubmissions: 0,
    };
}

function createMetric(label, value) {
    const metric = createElement("article", "class-hub-metric");

    metric.append(
        createElement("strong", "", value),
        createElement("span", "", label)
    );
    return metric;
}

async function copyJoinCode(joinCode) {
    try {
        await navigator.clipboard.writeText(joinCode);
        setStatus("Join code copied.", "success");
    } catch (error) {
        setStatus(`Copy this join code: ${joinCode}`, "success");
    }
}

async function generateJoinCode(classroom) {
    if (classroom.join_code) {
        const confirmed = window.confirm(`Replace the join code for "${classroom.name}"? The old code will stop working.`);

        if (!confirmed) {
            return;
        }
    }

    const joinCode = createJoinCode();

    setStatus("Generating join code...");

    const { error } = await supabase
        .from("classrooms")
        .update({ join_code: joinCode })
        .eq("id", classroom.id)
        .eq("course_id", courseId);

    if (error) {
        setStatus(error.message || "Join code could not be generated.", "error");
        return;
    }

    await loadClassrooms();
    setStatus(`Join code generated: ${joinCode}`, "success");
}

async function copyInviteLink(classroom) {
    let inviteToken = classroom.invite_token;

    if (!inviteToken) {
        inviteToken = createInviteToken();
        setStatus("Creating invite link...");

        const { error } = await supabase
            .from("classrooms")
            .update({ invite_token: inviteToken })
            .eq("id", classroom.id)
            .eq("course_id", courseId);

        if (error) {
            setStatus(error.message || "Invite link could not be created.", "error");
            return;
        }

        await loadClassrooms();
    }

    const inviteUrl = getInviteUrl(inviteToken);

    try {
        await navigator.clipboard.writeText(inviteUrl);
        setStatus("Invite link copied.", "success");
    } catch (error) {
        setStatus(`Copy this invite link: ${inviteUrl}`, "success");
    }
}

async function toggleJoining(classroom) {
    const nextJoinState = !classroom.join_enabled;

    setStatus(nextJoinState ? "Opening classroom joining..." : "Closing classroom joining...");

    const { error } = await supabase
        .from("classrooms")
        .update({ join_enabled: nextJoinState })
        .eq("id", classroom.id)
        .eq("course_id", courseId);

    if (error) {
        setStatus(error.message || "Joining status could not be changed.", "error");
        return;
    }

    await loadClassrooms();
    setStatus(nextJoinState ? "Classroom joining opened." : "Classroom joining closed.", "success");
}

async function saveClassroomOrder(classrooms) {
    const results = await Promise.all(classrooms.map((classroom, index) => (
        supabase
            .from("classrooms")
            .update({ display_order: index })
            .eq("id", classroom.id)
            .eq("course_id", courseId)
    )));

    return results.find((result) => result.error)?.error || null;
}

async function deleteClassroom(classroom) {
    const label = classroom.period_block
        ? `${classroom.name} - ${classroom.period_block}`
        : classroom.name;
    const confirmed = window.confirm(
        `Delete "${label}"? This removes it from active classrooms while preserving its existing history.`
    );

    if (!confirmed) {
        return;
    }

    setStatus("Deleting classroom...");

    const { error } = await supabase
        .from("classrooms")
        .update({ status: "deleted" })
        .eq("id", classroom.id)
        .eq("course_id", courseId);

    if (error) {
        setStatus(error.message || "The classroom could not be deleted.", "error");
        return;
    }

    toggleClassroomForm(false);
    await loadClassrooms();
    setStatus("Classroom deleted.", "success");
}

async function archiveClassroom(classroom) {
    const label = classroom.period_block
        ? `${classroom.name} - ${classroom.period_block}`
        : classroom.name;
    const confirmed = window.confirm(
        `Archive "${label}"? Students will not be able to join or submit new work, but roster, progress, and submissions will stay available for review.`
    );

    if (!confirmed) {
        return;
    }

    setStatus("Archiving classroom...");

    const { error } = await supabase
        .from("classrooms")
        .update({ status: "archived", join_enabled: false })
        .eq("id", classroom.id)
        .eq("course_id", courseId);

    if (error) {
        setStatus(error.message || "The classroom could not be archived.", "error");
        return;
    }

    toggleClassroomForm(false);
    await loadClassrooms();
    setStatus("Classroom archived. Historical records are preserved.", "success");
}

function renderClassrooms(classrooms) {
    loadedClassrooms = classrooms;

    if (!classrooms.length) {
        classroomList.replaceChildren(
            createElement("p", "empty-state", "No classrooms are attached to this course yet.")
        );
        return;
    }

    const list = createElement("ul", "managed-classroom-list");

    classrooms.forEach((classroom) => {
        const isArchived = classroom.status === "archived";
        const item = createElement("li", "managed-classroom-card");
        item.dataset.classroomId = classroom.id;
        item.draggable = !isArchived;
        item.classList.toggle("managed-classroom-card--archived", isArchived);
        item.addEventListener("dragstart", (event) => {
            if (isArchived) {
                event.preventDefault();
                return;
            }

            draggedClassroomId = classroom.id;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", classroom.id);
            item.classList.add("managed-classroom-card--dragging");
        });
        item.addEventListener("dragover", (event) => {
            if (isArchived || !draggedClassroomId || draggedClassroomId === classroom.id) {
                return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            clearDragStyles();
            item.classList.add("managed-classroom-card--drop-target");
        });
        item.addEventListener("drop", async (event) => {
            event.preventDefault();

            if (isArchived || !draggedClassroomId || draggedClassroomId === classroom.id) {
                clearDragStyles();
                return;
            }

            const reordered = [...loadedClassrooms];
            const fromIndex = reordered.findIndex((row) => row.id === draggedClassroomId);
            const toIndex = reordered.findIndex((row) => row.id === classroom.id);
            const [movedClassroom] = reordered.splice(fromIndex, 1);
            reordered.splice(toIndex, 0, movedClassroom);
            reordered.forEach((row, index) => {
                row.display_order = index;
            });

            draggedClassroomId = null;
            clearDragStyles();
            renderClassrooms(reordered);
            setStatus("Saving classroom order...");

            const error = await saveClassroomOrder(reordered);

            if (error) {
                setStatus(error.message || "Classroom order could not be saved.", "error");
                await loadClassrooms();
                return;
            }

            setStatus("Classroom order saved.", "success");
        });
        item.addEventListener("dragend", () => {
            draggedClassroomId = null;
            clearDragStyles();
        });
        const insights = getClassroomInsights(classroom.id);
        const cardHeader = createElement("div", "class-hub-card-header");
        const copy = createElement("div", "class-hub-card-copy");
        const title = createElement("h3", "course-title", formatClassroomName(classroom));
        const details = createElement(
            "p",
            "course-muted",
            [classroom.school_year, isArchived ? "Archived" : classroom.join_enabled ? "Joining open" : "Joining closed"]
                .filter(Boolean)
                .join(" | ") || "Class details not set yet."
        );
        const badge = createElement("span", "badge badge--quiet", classroom.status || "active");
        const metrics = createElement("div", "class-hub-metrics");
        const access = createElement("div", "class-hub-access");
        const actions = createElement("div", "managed-classroom-actions managed-classroom-actions--primary");
        const settings = createElement("details", "managed-classroom-settings");
        const settingsSummary = createElement("summary", "", "Class settings");
        const settingsActions = createElement("div", "managed-classroom-settings-actions");
        const dragHint = createElement("span", "managed-classroom-drag-hint", "Drag to reorder");
        const editButton = createElement("button", "secondary-button lesson-action", "Edit");
        const joinButton = createElement(
            "button",
            "secondary-button lesson-action",
            classroom.join_code ? "Copy join code" : "Generate join code"
        );
        const inviteButton = createElement("button", "secondary-button lesson-action", "Copy invite link");
        const rosterLink = createElement("a", "primary-button lesson-action", "Open roster");
        const reviewLink = createElement("a", "secondary-button lesson-action", "Review work");
        const regenerateButton = createElement("button", "secondary-button lesson-action", "Regenerate code");
        const archiveButton = createElement("button", "secondary-button lesson-action", "Archive");
        const joinToggleButton = createElement(
            "button",
            "secondary-button lesson-action",
            classroom.join_enabled ? "Close joining" : "Open joining"
        );
        const deleteButton = createElement("button", "secondary-button destructive-button lesson-action", "Delete");

        copy.append(title, details);
        cardHeader.append(copy, badge);
        metrics.append(
            createMetric("students", String(insights.activeStudents)),
            createMetric("submitted", String(insights.submittedSubmissions)),
            createMetric("drafts", String(insights.draftSubmissions)),
            createMetric("latest activity", formatLatestActivity(insights.latestActivityAt))
        );
        access.append(
            createElement("p", "managed-classroom-join-code", classroom.join_code ? `Join code: ${classroom.join_code}` : "No join code generated yet."),
            createElement(
                "p",
                classroom.join_enabled && !isArchived ? "managed-classroom-join-state" : "managed-classroom-join-state managed-classroom-join-state--closed",
                isArchived ? "Archived classes are view-only" : classroom.join_enabled ? "Students can join this class" : "Joining is closed"
            ),
            createElement("p", "managed-classroom-invite-state", classroom.invite_token ? "Invite link ready" : "No invite link created yet.")
        );

        editButton.type = "button";
        editButton.disabled = isArchived;
        editButton.addEventListener("click", () => toggleClassroomForm(true, classroom));
        joinButton.type = "button";
        joinButton.disabled = isArchived;
        joinButton.addEventListener("click", () => {
            if (classroom.join_code) {
                copyJoinCode(classroom.join_code);
                return;
            }

            generateJoinCode(classroom);
        });
        inviteButton.type = "button";
        inviteButton.disabled = isArchived;
        inviteButton.addEventListener("click", () => copyInviteLink(classroom));
        rosterLink.href = `roster.html?classroom=${encodeURIComponent(classroom.id)}`;
        reviewLink.href = `../submissions/index.html?classroom=${encodeURIComponent(classroom.id)}`;
        regenerateButton.type = "button";
        regenerateButton.hidden = !classroom.join_code || isArchived;
        regenerateButton.addEventListener("click", () => generateJoinCode(classroom));
        archiveButton.type = "button";
        archiveButton.hidden = isArchived;
        archiveButton.addEventListener("click", () => archiveClassroom(classroom));
        joinToggleButton.type = "button";
        joinToggleButton.disabled = isArchived;
        joinToggleButton.addEventListener("click", () => toggleJoining(classroom));
        deleteButton.type = "button";
        deleteButton.addEventListener("click", () => deleteClassroom(classroom));
        actions.append(rosterLink, reviewLink, joinButton, inviteButton);
        settingsActions.append(joinToggleButton, editButton, regenerateButton, archiveButton, deleteButton);
        settings.append(settingsSummary, settingsActions, dragHint);
        item.append(cardHeader, metrics, access, actions, settings);
        list.append(item);
    });

    classroomList.replaceChildren(list);
}

async function loadClassrooms() {
    const { data: classrooms, error } = await supabase
        .from("classrooms")
        .select("id, name, period_block, school_year, status, display_order, join_code, join_enabled, invite_token")
        .eq("course_id", courseId)
        .neq("status", "deleted")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

    if (error) {
        setStatus("Classroom information could not be loaded.", "error");
        return false;
    }

    await loadClassroomInsights(classrooms);
    renderClassrooms(classrooms);
    return true;
}

async function loadClassroomInsights(classrooms) {
    const classroomIds = classrooms.map((classroom) => classroom.id);

    classroomInsights = new Map();
    classroomInsightsWarning = false;

    if (!classroomIds.length) {
        return;
    }

    const [enrollmentResult, submissionResult] = await Promise.all([
        supabase
            .from("enrollments")
            .select("classroom_id, enrollment_status")
            .in("classroom_id", classroomIds)
            .eq("enrollment_type", "classroom"),
        supabase
            .from("lesson_submissions")
            .select("classroom_id, status, submitted_at, updated_at")
            .in("classroom_id", classroomIds),
    ]);

    if (enrollmentResult.error || submissionResult.error) {
        classroomInsightsWarning = true;
        setStatus("Classes loaded, but roster/submission summaries could not be loaded.", "warning");
        return;
    }

    classroomIds.forEach((classroomId) => {
        classroomInsights.set(classroomId, getClassroomInsights(classroomId));
    });

    (enrollmentResult.data || []).forEach((enrollment) => {
        const insights = getClassroomInsights(enrollment.classroom_id);

        if (enrollment.enrollment_status === "active") {
            insights.activeStudents += 1;
        }

        classroomInsights.set(enrollment.classroom_id, insights);
    });

    (submissionResult.data || []).forEach((submission) => {
        const insights = getClassroomInsights(submission.classroom_id);
        const activityAt = submission.submitted_at || submission.updated_at;

        if (submission.status === "submitted") {
            insights.submittedSubmissions += 1;
        }

        if (submission.status === "draft") {
            insights.draftSubmissions += 1;
        }

        if (activityAt && (!insights.latestActivityAt || new Date(activityAt) > new Date(insights.latestActivityAt))) {
            insights.latestActivityAt = activityAt;
        }

        classroomInsights.set(submission.classroom_id, insights);
    });
}

async function handleClassroomSubmit(event) {
    event.preventDefault();

    const formData = new FormData(classroomForm);
    const classroomId = String(formData.get("classroom-id") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const periodBlock = String(formData.get("period_block") || "").trim();
    const schoolYear = String(formData.get("school_year") || "").trim();
    const submitButton = classroomForm.querySelector("button[type='submit']");
    const nextDisplayOrder = loadedClassrooms.reduce(
        (highest, classroom) => Math.max(highest, classroom.display_order),
        -1
    ) + 1;

    if (!name) {
        setStatus("Enter a classroom name before saving.", "error");
        return;
    }

    setStatus(classroomId ? "Saving class details..." : "Creating class...");
    submitButton.disabled = true;

    const { error } = classroomId
        ? await supabase
            .from("classrooms")
            .update({
                name,
                period_block: periodBlock || null,
                school_year: schoolYear || null,
            })
            .eq("id", classroomId)
            .eq("course_id", courseId)
        : await supabase.from("classrooms").insert({
            course_id: courseId,
            owner_teacher_id: currentProfileId,
            name,
            period_block: periodBlock || null,
            school_year: schoolYear || null,
            display_order: nextDisplayOrder,
        });

    submitButton.disabled = false;

    if (error) {
        setStatus(error.message || `The class could not be ${classroomId ? "updated" : "created"}.`, "error");
        return;
    }

    toggleClassroomForm(false);
    await loadClassrooms();
    setStatus(classroomId ? "Class details saved." : "Class created.", "success");
}

async function initializePage() {
    const profile = await loadProtectedProfile({ statusElement });

    if (!profile) {
        return;
    }

    if (!courseId) {
        headingElement.textContent = "Course unavailable";
        setStatus("Choose a course from My Courses before opening classes.", "error");
        return;
    }

    currentProfileId = profile.id;

    const { data: canManage, error: permissionError } = await supabase.rpc("can_manage_course", {
        course_to_check: courseId,
    });

    if (permissionError || !canManage) {
        headingElement.textContent = "Classes unavailable";
        setStatus("You do not have permission to manage classes for this course.", "error");
        return;
    }

    const { data: course, error: courseError } = await supabase.from("courses").select("title").eq("id", courseId).single();

    if (courseError) {
        headingElement.textContent = "Classes unavailable";
        setStatus("Class information could not be loaded.", "error");
        return;
    }

    headingElement.textContent = `${course.title || "Untitled course"} classes`;
    contentSections.forEach((section) => {
        section.hidden = false;
    });

    if (await loadClassrooms() && !classroomInsightsWarning) {
        setStatus("");
    }
}

createButton.addEventListener("click", () => toggleClassroomForm(true));
cancelButton.addEventListener("click", () => toggleClassroomForm(false));
classroomForm.addEventListener("submit", handleClassroomSubmit);

await initializePage();
