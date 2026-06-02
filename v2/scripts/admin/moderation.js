import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const statusElement = qs("[data-moderation-status]");
const shellElement = qs("[data-moderation-shell]");
const summaryElement = qs("[data-moderation-summary]");
const filterForm = qs("[data-moderation-filter-form]");
const listElement = qs("[data-moderation-list]");
const refreshButton = qs("[data-moderation-refresh]");

let moderationRecords = [];
let currentProfileId = null;

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function formatShortId(id) {
    return id ? id.slice(0, 8) : "-";
}

function formatStatus(status = "") {
    return status.charAt(0).toUpperCase() + status.slice(1);
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

function createSummaryCard(label, value) {
    const card = createElement("article", "summary-card");

    card.append(
        createElement("span", "summary-label", label),
        createElement("strong", "summary-value summary-value--small", formatNumber(value))
    );
    return card;
}

function getDetailUrl(userId) {
    const url = new URL("./detail.html", window.location.href);

    url.searchParams.set("type", "user");
    url.searchParams.set("id", userId);
    return url.href;
}

function getActivityUrl(userId) {
    const url = new URL("../activity/index.html", window.location.href);

    url.searchParams.set("query", userId);
    return url.href;
}

function getFilters() {
    const formData = new FormData(filterForm);

    return {
        query: String(formData.get("query") || "").trim().toLowerCase(),
        role: String(formData.get("role") || ""),
        status: String(formData.get("status") || ""),
    };
}

function getSearchText(record) {
    return [
        record.user_id,
        record.display_name,
        record.email,
        record.username,
        record.platform_role,
        record.account_status,
    ].filter(Boolean).join(" ").toLowerCase();
}

function getFilteredRecords() {
    const filters = getFilters();

    return moderationRecords.filter((record) => (
        (!filters.status || record.account_status === filters.status)
        && (!filters.role || record.platform_role === filters.role)
        && (!filters.query || getSearchText(record).includes(filters.query))
    ));
}

function renderSummary(records) {
    const activeCount = records.filter((record) => record.account_status === "active").length;
    const suspendedCount = records.filter((record) => record.account_status === "suspended").length;
    const deletedCount = records.filter((record) => record.account_status === "deleted").length;
    const adminCount = records.filter((record) => record.platform_role === "admin").length;
    const incompleteCount = records.filter((record) => !record.profile_completed).length;

    summaryElement.replaceChildren(
        createSummaryCard("Visible users", records.length),
        createSummaryCard("Active", activeCount),
        createSummaryCard("Suspended", suspendedCount),
        createSummaryCard("Deleted", deletedCount),
        createSummaryCard("Admins", adminCount),
        createSummaryCard("Incomplete profiles", incompleteCount)
    );
}

function createBadge(text, quiet = false) {
    return createElement("span", quiet ? "badge badge--quiet" : "badge", text);
}

function createModerationButton(record) {
    const button = createElement("button", "secondary-button admin-result-action moderation-action-button");

    button.type = "button";
    button.dataset.userId = record.user_id;

    if (record.account_status === "active") {
        button.textContent = "Suspend user";
        button.dataset.nextStatus = "suspended";
    } else if (record.account_status === "suspended") {
        button.textContent = "Reactivate user";
        button.dataset.nextStatus = "active";
    } else {
        button.textContent = "No status action";
        button.disabled = true;
    }

    if (record.user_id === currentProfileId) {
        button.textContent = "Current admin";
        button.disabled = true;
    } else if (record.platform_role === "admin") {
        button.textContent = "Admin protected";
        button.disabled = true;
    }

    return button;
}

function renderUsers() {
    const records = getFilteredRecords();

    renderSummary(records);

    if (!records.length) {
        listElement.replaceChildren(createElement("p", "empty-state", "No users match these moderation filters."));
        return;
    }

    const table = createElement("table", "activity-table moderation-table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    const body = document.createElement("tbody");

    ["User", "Role", "Status", "Teaching", "Learning", "Activity", "Updated", "Actions"].forEach((label) => {
        headRow.append(createElement("th", "", label));
    });
    head.append(headRow);

    records.forEach((record) => {
        const row = document.createElement("tr");
        const userCell = document.createElement("td");
        const roleCell = document.createElement("td");
        const statusCell = document.createElement("td");
        const actionsCell = document.createElement("td");
        const name = createElement("strong", "admin-detail-value", record.display_name || formatShortId(record.user_id));
        const detail = createElement("span", "course-muted", record.email || record.username || record.user_id);
        const detailLink = createElement("a", "secondary-button admin-result-action", "View details");
        const activityLink = createElement("a", "secondary-button admin-result-action", "View activity");
        const moderationButton = createModerationButton(record);

        detailLink.href = getDetailUrl(record.user_id);
        activityLink.href = getActivityUrl(record.user_id);
        userCell.append(name, detail);
        roleCell.append(createBadge(formatStatus(record.platform_role), true));
        statusCell.append(createBadge(formatStatus(record.account_status), record.account_status === "active"));
        actionsCell.append(moderationButton, detailLink, activityLink);
        row.append(
            userCell,
            roleCell,
            statusCell,
            createElement("td", "", `${formatNumber(record.courses_owned)} courses / ${formatNumber(record.classrooms_managed)} classrooms`),
            createElement("td", "", `${formatNumber(record.enrollments)} enrollments / ${formatNumber(record.submissions)} submissions`),
            createElement("td", "", `${formatNumber(record.activity_count)} events`),
            createElement("td", "", formatDate(record.updated_at || record.last_activity_at)),
            actionsCell
        );
        body.append(row);
    });

    table.append(head, body);
    listElement.replaceChildren(table);
}

function findModerationRecord(userId) {
    return moderationRecords.find((record) => record.user_id === userId);
}

function getModerationConfirmation(record, nextStatus) {
    const label = record.display_name || record.email || formatShortId(record.user_id);

    if (nextStatus === "suspended") {
        return `Suspend ${label}? This blocks the account from normal platform use until an admin reactivates it. The change will be logged.`;
    }

    return `Reactivate ${label}? This restores normal account access and logs the moderation action.`;
}

async function handleModerationAction(event) {
    const button = event.target.closest("[data-user-id][data-next-status]");

    if (!button || button.disabled) {
        return;
    }

    const record = findModerationRecord(button.dataset.userId);
    const nextStatus = button.dataset.nextStatus;

    if (!record) {
        setStatus("That user record is no longer loaded. Refresh users and try again.", "error");
        return;
    }

    if (!window.confirm(getModerationConfirmation(record, nextStatus))) {
        return;
    }

    setStatus("Updating user account status...");
    button.disabled = true;

    const { error } = await supabase.rpc("moderate_user_account_status", {
        next_status_input: nextStatus,
        target_user_id_input: record.user_id,
    });

    if (error) {
        setStatus(error.message || "User account status could not be updated.", "error");
        button.disabled = false;
        return;
    }

    await loadModerationRecords();
    setStatus(`User account ${nextStatus === "active" ? "reactivated" : "suspended"}.`);
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
        setStatus("User moderation is only available to active platform admins.", "error");
        return null;
    }

    currentProfileId = profile.id;
    return profile;
}

async function loadModerationRecords() {
    setStatus("Loading user moderation records...");
    refreshButton.disabled = true;

    const { data, error } = await supabase.rpc("get_admin_user_moderation_records", {
        limit_input: 100,
        role_filter: "",
        search_input: "",
        status_filter: "",
    });

    refreshButton.disabled = false;

    if (error) {
        setStatus(error.message || "User moderation records could not be loaded.", "error");
        return;
    }

    moderationRecords = data || [];
    renderUsers();
    setStatus("");
}

async function initializeModerationPage() {
    const profile = await loadCurrentProfile();

    if (!profile) {
        return;
    }

    shellElement.hidden = false;
    await loadModerationRecords();
}

filterForm.addEventListener("input", renderUsers);
filterForm.addEventListener("change", renderUsers);
refreshButton.addEventListener("click", loadModerationRecords);
listElement.addEventListener("click", handleModerationAction);

await initializeModerationPage();
