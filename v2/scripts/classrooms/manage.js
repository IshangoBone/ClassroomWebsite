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
let currentProfileId = null;

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function toggleClassroomForm(isOpen) {
    classroomForm.hidden = !isOpen;
    createButton.hidden = isOpen;

    if (isOpen) {
        classroomForm.elements.name.focus();
    } else {
        classroomForm.reset();
    }
}

function renderClassrooms(classrooms) {
    if (!classrooms.length) {
        classroomList.replaceChildren(
            createElement("p", "empty-state", "No classrooms are attached to this course yet.")
        );
        return;
    }

    const list = createElement("ul", "managed-classroom-list");

    classrooms.forEach((classroom) => {
        const item = createElement("li", "managed-classroom-card");
        const title = createElement("h3", "course-title", classroom.name);
        const details = createElement(
            "p",
            "course-muted",
            classroom.period_block || classroom.school_year || "Classroom details not set yet."
        );
        const badge = createElement("span", "badge badge--quiet", classroom.status);
        item.append(title, details, badge);
        list.append(item);
    });

    classroomList.replaceChildren(list);
}

async function loadClassrooms() {
    const { data: classrooms, error } = await supabase
        .from("classrooms")
        .select("id, name, period_block, school_year, status")
        .eq("course_id", courseId)
        .neq("status", "deleted")
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
    setStatus("Creating classroom...");

    const formData = new FormData(classroomForm);
    const name = String(formData.get("name") || "").trim();
    const periodBlock = String(formData.get("period_block") || "").trim();
    const schoolYear = String(formData.get("school_year") || "").trim();
    const submitButton = classroomForm.querySelector("button[type='submit']");

    submitButton.disabled = true;

    const { error } = await supabase.from("classrooms").insert({
        course_id: courseId,
        owner_teacher_id: currentProfileId,
        name,
        period_block: periodBlock || null,
        school_year: schoolYear || null,
    });

    submitButton.disabled = false;

    if (error) {
        setStatus(error.message || "The classroom could not be created.", "error");
        return;
    }

    toggleClassroomForm(false);
    await loadClassrooms();
    setStatus("Classroom created.", "success");
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
