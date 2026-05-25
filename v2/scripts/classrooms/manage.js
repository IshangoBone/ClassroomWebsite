import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const params = new URLSearchParams(window.location.search);
const courseId = params.get("course");
const headingElement = qs("[data-classrooms-heading]");
const statusElement = qs("[data-classrooms-status]");
const contentSections = [...document.querySelectorAll("[data-classrooms-content]")];
const classroomList = qs("[data-classroom-list]");

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
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

    const { data: canManage, error: permissionError } = await supabase.rpc("can_manage_course", {
        course_to_check: courseId,
    });

    if (permissionError || !canManage) {
        headingElement.textContent = "Classrooms unavailable";
        setStatus("You do not have permission to manage classrooms for this course.", "error");
        return;
    }

    const [{ data: course, error: courseError }, { data: classrooms, error: classroomsError }] = await Promise.all([
        supabase.from("courses").select("title").eq("id", courseId).single(),
        supabase
            .from("classrooms")
            .select("id, name, period_block, school_year, status")
            .eq("course_id", courseId)
            .neq("status", "deleted")
            .order("created_at", { ascending: false }),
    ]);

    if (courseError || classroomsError) {
        headingElement.textContent = "Classrooms unavailable";
        setStatus("Classroom information could not be loaded.", "error");
        return;
    }

    headingElement.textContent = `${course.title || "Untitled course"} classrooms`;
    contentSections.forEach((section) => {
        section.hidden = false;
    });
    renderClassrooms(classrooms);
    setStatus("");
}

await initializePage();
