import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

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

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function resetClassroomFormText() {
    classroomFormHeading.textContent = "Create classroom";
    classroomFormCopy.textContent = "Create one classroom for this course. Join access and roster tools come later.";
    classroomSubmitButton.textContent = "Create classroom";
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
            classroomFormHeading.textContent = `Edit ${classroom.name}`;
            classroomFormCopy.textContent = "Update the classroom name, period, or school year shown in the teacher dashboard.";
            classroomSubmitButton.textContent = "Save classroom details";
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

async function copyJoinCode(joinCode) {
    try {
        await navigator.clipboard.writeText(joinCode);
        setStatus("Join code copied.", "success");
    } catch (error) {
        setStatus(`Copy this join code: ${joinCode}`, "success");
    }
}

async function generateJoinCode(classroom) {
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
        const item = createElement("li", "managed-classroom-card");
        item.dataset.classroomId = classroom.id;
        item.draggable = true;
        item.addEventListener("dragstart", (event) => {
            draggedClassroomId = classroom.id;
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", classroom.id);
            item.classList.add("managed-classroom-card--dragging");
        });
        item.addEventListener("dragover", (event) => {
            if (!draggedClassroomId || draggedClassroomId === classroom.id) {
                return;
            }

            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
            clearDragStyles();
            item.classList.add("managed-classroom-card--drop-target");
        });
        item.addEventListener("drop", async (event) => {
            event.preventDefault();

            if (!draggedClassroomId || draggedClassroomId === classroom.id) {
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
        const title = createElement("h3", "course-title", classroom.name);
        const details = createElement(
            "p",
            "course-muted",
            classroom.period_block || classroom.school_year || "Classroom details not set yet."
        );
        const joinCode = createElement(
            "p",
            "managed-classroom-join-code",
            classroom.join_code ? `Join code: ${classroom.join_code}` : "No join code generated yet."
        );
        const badge = createElement("span", "badge badge--quiet", classroom.status);
        const actions = createElement("div", "managed-classroom-actions");
        const dragHint = createElement("span", "managed-classroom-drag-hint", "Drag to reorder");
        const editButton = createElement("button", "secondary-button lesson-action", "Edit classroom");
        const joinButton = createElement(
            "button",
            "secondary-button lesson-action",
            classroom.join_code ? "Copy join code" : "Generate join code"
        );
        const deleteButton = createElement("button", "secondary-button destructive-button lesson-action", "Delete classroom");
        editButton.type = "button";
        editButton.addEventListener("click", () => toggleClassroomForm(true, classroom));
        joinButton.type = "button";
        joinButton.addEventListener("click", () => {
            if (classroom.join_code) {
                copyJoinCode(classroom.join_code);
                return;
            }

            generateJoinCode(classroom);
        });
        deleteButton.type = "button";
        deleteButton.addEventListener("click", () => deleteClassroom(classroom));
        actions.append(dragHint, editButton, joinButton, deleteButton);
        item.append(title, details, joinCode, badge, actions);
        list.append(item);
    });

    classroomList.replaceChildren(list);
}

async function loadClassrooms() {
    const { data: classrooms, error } = await supabase
        .from("classrooms")
        .select("id, name, period_block, school_year, status, display_order, join_code")
        .eq("course_id", courseId)
        .neq("status", "deleted")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

    if (error) {
        setStatus("Classroom information could not be loaded.", "error");
        return false;
    }

    renderClassrooms(classrooms);
    return true;
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

    setStatus(classroomId ? "Saving classroom details..." : "Creating classroom...");
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
        setStatus(error.message || `The classroom could not be ${classroomId ? "updated" : "created"}.`, "error");
        return;
    }

    toggleClassroomForm(false);
    await loadClassrooms();
    setStatus(classroomId ? "Classroom details saved." : "Classroom created.", "success");
}

async function initializePage() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
        window.location.href = "../auth/login.html";
        return;
    }

    if (!courseId) {
        headingElement.textContent = "Course unavailable";
        setStatus("Choose a course from the dashboard before opening classrooms.", "error");
        return;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_user_id", authData.user.id)
        .single();

    if (profileError || !profile) {
        headingElement.textContent = "Classrooms unavailable";
        setStatus("Complete your profile before managing classrooms.", "error");
        return;
    }

    currentProfileId = profile.id;

    const { data: canManage, error: permissionError } = await supabase.rpc("can_manage_course", {
        course_to_check: courseId,
    });

    if (permissionError || !canManage) {
        headingElement.textContent = "Classrooms unavailable";
        setStatus("You do not have permission to manage classrooms for this course.", "error");
        return;
    }

    const { data: course, error: courseError } = await supabase.from("courses").select("title").eq("id", courseId).single();

    if (courseError) {
        headingElement.textContent = "Classrooms unavailable";
        setStatus("Classroom information could not be loaded.", "error");
        return;
    }

    headingElement.textContent = `${course.title || "Untitled course"} classrooms`;
    contentSections.forEach((section) => {
        section.hidden = false;
    });

    if (await loadClassrooms()) {
        setStatus("");
    }
}

createButton.addEventListener("click", () => toggleClassroomForm(true));
cancelButton.addEventListener("click", () => toggleClassroomForm(false));
classroomForm.addEventListener("submit", handleClassroomSubmit);

await initializePage();
