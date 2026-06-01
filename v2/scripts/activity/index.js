import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const statusElement = qs("[data-activity-status]");
const shellElement = qs("[data-activity-shell]");
const summaryElement = qs("[data-activity-summary]");
const filterForm = qs("[data-activity-filter-form]");
const actionFilter = qs("[data-activity-filter-action]");
const targetFilter = qs("[data-activity-filter-target]");
const activityList = qs("[data-activity-list]");
const refreshButton = qs("[data-activity-refresh]");
const activityParams = new URLSearchParams(window.location.search);

let activityLogs = [];

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function formatShortId(id) {
    return id ? id.slice(0, 8) : "-";
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function formatAction(actionType) {
    return String(actionType || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function createSummaryCard(label, value) {
    const card = createElement("article", "summary-card");

    card.append(
        createElement("span", "summary-label", label),
        createElement("strong", "summary-value summary-value--small", String(value))
    );
    return card;
}

function populateSelect(select, values, placeholder) {
    const currentValue = select.value;
    const optionElements = [createElement("option", "", placeholder)];

    optionElements[0].value = "";
    values.forEach((value) => {
        const option = createElement("option", "", formatAction(value));

        option.value = value;
        optionElements.push(option);
    });

    select.replaceChildren(...optionElements);
    select.value = values.includes(currentValue) ? currentValue : "";
}

function getFilters() {
    const formData = new FormData(filterForm);

    return {
        action: String(formData.get("action") || ""),
        classroom: String(formData.get("classroom") || "").trim().toLowerCase(),
        course: String(formData.get("course") || "").trim().toLowerCase(),
        query: String(formData.get("query") || "").trim().toLowerCase(),
        target: String(formData.get("target") || ""),
    };
}

function getSearchText(log) {
    return [
        log.action_type,
        log.target_type,
        log.target_display_name,
        log.target_id,
        log.actor_display_name,
        log.actor_user_id,
        log.course_title,
        log.course_id,
        log.classroom_label,
        log.classroom_id,
        JSON.stringify(log.metadata_json || {}),
        JSON.stringify(log.old_value_json || {}),
        JSON.stringify(log.new_value_json || {}),
    ].filter(Boolean).join(" ").toLowerCase();
}

function getFilteredLogs() {
    const filters = getFilters();

    return activityLogs.filter((log) => (
        (!filters.action || log.action_type === filters.action)
        && (!filters.target || log.target_type === filters.target)
        && (!filters.course || String(log.course_id || "").toLowerCase().includes(filters.course))
        && (!filters.classroom || String(log.classroom_id || "").toLowerCase().includes(filters.classroom))
        && (!filters.query || getSearchText(log).includes(filters.query))
    ));
}

function renderSummary(logs) {
    const actorCount = new Set(logs.map((log) => log.actor_user_id).filter(Boolean)).size;
    const courseCount = new Set(logs.map((log) => log.course_id).filter(Boolean)).size;
    const classroomCount = new Set(logs.map((log) => log.classroom_id).filter(Boolean)).size;
    const latest = logs[0]?.created_at ? formatDate(logs[0].created_at) : "-";

    summaryElement.replaceChildren(
        createSummaryCard("Loaded events", activityLogs.length),
        createSummaryCard("Visible after filters", logs.length),
        createSummaryCard("Actors", actorCount),
        createSummaryCard("Courses", courseCount),
        createSummaryCard("Classrooms", classroomCount),
        createSummaryCard("Latest event", latest)
    );
}

function createJsonDetails(label, value, isOpen = false) {
    const details = createElement("details", "activity-json-details");
    const summary = createElement("summary", "", label);
    const content = createElement("pre", "activity-json-value", JSON.stringify(value || {}, null, 2));

    details.open = isOpen;
    details.append(summary, content);
    return details;
}

function createDetailsCell(log) {
    const cell = document.createElement("td");
    const detailsWrap = createElement("div", "activity-details-stack");

    detailsWrap.append(
        createJsonDetails("Metadata", log.metadata_json, true),
        createJsonDetails("Old value", log.old_value_json),
        createJsonDetails("New value", log.new_value_json)
    );
    cell.append(detailsWrap);
    return cell;
}

function formatEntityLabel(label, id) {
    return label || formatShortId(id);
}

function formatTargetLabel(log) {
    const targetLabel = formatEntityLabel(log.target_display_name, log.target_id);

    return `${log.target_type} ${targetLabel}`;
}

function renderLogs() {
    const logs = getFilteredLogs();

    renderSummary(logs);

    if (!logs.length) {
        activityList.replaceChildren(createElement("p", "empty-state", "No activity logs match these filters."));
        return;
    }

    const table = createElement("table", "activity-table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    const body = document.createElement("tbody");

    ["When", "Action", "Target", "Actor", "Course", "Classroom", "Metadata"].forEach((label) => {
        headRow.append(createElement("th", "", label));
    });
    head.append(headRow);

    logs.forEach((log) => {
        const row = document.createElement("tr");

        row.append(
            createElement("td", "", formatDate(log.created_at)),
            createElement("td", "", formatAction(log.action_type)),
            createElement("td", "", formatTargetLabel(log)),
            createElement("td", "", formatEntityLabel(log.actor_display_name, log.actor_user_id)),
            createElement("td", "", formatEntityLabel(log.course_title, log.course_id)),
            createElement("td", "", formatEntityLabel(log.classroom_label, log.classroom_id)),
            createDetailsCell(log)
        );
        body.append(row);
    });

    table.append(head, body);
    activityList.replaceChildren(table);
}

async function loadCurrentProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
        window.location.href = "../auth/login.html";
        return null;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, profile_completed, platform_role, account_status")
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

    if (profile.platform_role !== "admin" || profile.account_status !== "active") {
        setStatus("Activity logs are only available to active platform admins.", "error");
        return null;
    }

    return profile;
}

async function loadActivityLogs() {
    setStatus("Loading activity logs...");
    refreshButton.disabled = true;

    const { data, error } = await supabase.rpc("get_admin_activity_logs", {
        limit_input: 200,
    });

    refreshButton.disabled = false;

    if (error) {
        setStatus(error.message || "Activity logs could not be loaded.", "error");
        return;
    }

    activityLogs = data || [];
    populateSelect(actionFilter, [...new Set(activityLogs.map((log) => log.action_type).filter(Boolean))].sort(), "All actions");
    populateSelect(targetFilter, [...new Set(activityLogs.map((log) => log.target_type).filter(Boolean))].sort(), "All targets");

    if (activityParams.has("query")) {
        filterForm.elements.query.value = activityParams.get("query") || "";
    }

    renderLogs();
    setStatus("");
}

async function initializeActivityPage() {
    const profile = await loadCurrentProfile();

    if (!profile) {
        return;
    }

    shellElement.hidden = false;
    await loadActivityLogs();
}

filterForm.addEventListener("input", renderLogs);
filterForm.addEventListener("change", renderLogs);
refreshButton.addEventListener("click", loadActivityLogs);

await initializeActivityPage();
