import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const statusElement = qs("[data-moderation-status]");
const shellElements = [...document.querySelectorAll("[data-moderation-shell]")];
const summaryElement = qs("[data-moderation-summary]");
const filterForm = qs("[data-moderation-filter-form]");
const listElement = qs("[data-moderation-list]");
const refreshButton = qs("[data-moderation-refresh]");
const contentSummaryElement = qs("[data-content-summary]");
const contentFilterForm = qs("[data-content-filter-form]");
const contentListElement = qs("[data-content-list]");
const contentRefreshButton = qs("[data-content-refresh]");

let moderationRecords = [];
let contentRecords = [];
let currentProfileId = null;
let currentProfileRole = "";

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
    return String(status || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
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

function isAdminRole(role) {
    return role === "admin" || role === "supreme_admin";
}

function isSupremeAdminRole(role) {
    return role === "supreme_admin";
}

function getDetailUrl(recordType, recordId) {
    const url = new URL("./detail.html", window.location.href);

    url.searchParams.set("type", recordType);
    url.searchParams.set("id", recordId);
    return url.href;
}

function getActivityUrl(recordId) {
    const url = new URL("../activity/index.html", window.location.href);

    url.searchParams.set("query", recordId);
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

function getContentFilters() {
    const formData = new FormData(contentFilterForm);

    return {
        query: String(formData.get("query") || "").trim().toLowerCase(),
        status: String(formData.get("status") || ""),
        type: String(formData.get("type") || ""),
    };
}

function getContentSearchText(record) {
    return [
        record.record_id,
        record.record_type,
        record.primary_label,
        record.secondary_label,
        record.status_label,
        record.owner_email,
        record.course_title,
        record.course_id,
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

function getFilteredContentRecords() {
    const filters = getContentFilters();

    return contentRecords.filter((record) => (
        (!filters.type || record.record_type === filters.type)
        && (!filters.status || record.status_label === filters.status)
        && (!filters.query || getContentSearchText(record).includes(filters.query))
    ));
}

function renderSummary(records) {
    const activeCount = records.filter((record) => record.account_status === "active").length;
    const suspendedCount = records.filter((record) => record.account_status === "suspended").length;
    const deletedCount = records.filter((record) => record.account_status === "deleted").length;
    const adminCount = records.filter((record) => isAdminRole(record.platform_role)).length;
    const supremeAdminCount = records.filter((record) => isSupremeAdminRole(record.platform_role)).length;

    summaryElement.replaceChildren(
        createSummaryCard("Visible users", records.length),
        createSummaryCard("Active", activeCount),
        createSummaryCard("Suspended", suspendedCount),
        createSummaryCard("Deleted", deletedCount),
        createSummaryCard("Platform admins", adminCount),
        createSummaryCard("Supreme admins", supremeAdminCount)
    );
}

function renderContentSummary(records) {
    const courseCount = records.filter((record) => record.record_type === "course").length;
    const classroomCount = records.filter((record) => record.record_type === "classroom").length;
    const archivedCount = records.filter((record) => record.status_label === "archived").length;
    const deletedCount = records.filter((record) => record.status_label === "deleted").length;
    const enrollmentCount = records.reduce((total, record) => total + Number(record.enrollment_count || 0), 0);
    const submissionCount = records.reduce((total, record) => total + Number(record.submission_count || 0), 0);

    contentSummaryElement.replaceChildren(
        createSummaryCard("Visible records", records.length),
        createSummaryCard("Courses", courseCount),
        createSummaryCard("Classrooms", classroomCount),
        createSummaryCard("Archived", archivedCount),
        createSummaryCard("Deleted", deletedCount),
        createSummaryCard("Submissions", submissionCount)
    );
}

function createBadge(text, quiet = false) {
    return createElement("span", quiet ? "badge badge--quiet" : "badge", text);
}

function createModerationButton(record) {
    const button = createElement("button", "secondary-button admin-result-action moderation-action-button");

    button.type = "button";
    button.dataset.userId = record.user_id;
    button.dataset.actionType = "status";

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
    } else if (isSupremeAdminRole(record.platform_role)) {
        button.textContent = "Supreme protected";
        button.disabled = true;
    } else if (record.platform_role === "admin" && !isSupremeAdminRole(currentProfileRole)) {
        button.textContent = "Admin protected";
        button.disabled = true;
    }

    return button;
}

function createDeleteButton(record) {
    const button = createElement("button", "secondary-button destructive-button admin-result-action moderation-action-button");

    button.type = "button";
    button.textContent = "Soft delete user";
    button.dataset.actionType = "delete";
    button.dataset.nextStatus = "deleted";
    button.dataset.userId = record.user_id;

    if (record.account_status === "deleted") {
        button.textContent = "Already deleted";
        button.disabled = true;
    } else if (record.user_id === currentProfileId) {
        button.textContent = "Current admin";
        button.disabled = true;
    } else if (isSupremeAdminRole(record.platform_role)) {
        button.textContent = "Supreme protected";
        button.disabled = true;
    } else if (record.platform_role === "admin" && !isSupremeAdminRole(currentProfileRole)) {
        button.textContent = "Admin protected";
        button.disabled = true;
    }

    return button;
}

function createRoleButton(record) {
    const button = createElement("button", "secondary-button admin-result-action moderation-action-button");

    button.type = "button";
    button.dataset.nextRole = record.platform_role === "admin" ? "user" : "admin";
    button.dataset.userId = record.user_id;
    button.textContent = record.platform_role === "admin" ? "Remove admin" : "Make admin";

    if (!isSupremeAdminRole(currentProfileRole)) {
        button.textContent = "Supreme admin only";
        button.disabled = true;
    } else if (record.user_id === currentProfileId) {
        button.textContent = "Current admin";
        button.disabled = true;
    } else if (isSupremeAdminRole(record.platform_role)) {
        button.textContent = "Supreme protected";
        button.disabled = true;
    } else if (record.account_status === "deleted") {
        button.textContent = "Deleted";
        button.disabled = true;
    }

    return button;
}

function createContentArchiveButton(record) {
    const button = createElement("button", "secondary-button admin-result-action moderation-action-button");

    button.type = "button";
    button.textContent = "Archive";
    button.dataset.contentAction = "archive";
    button.dataset.nextStatus = "archived";
    button.dataset.recordId = record.record_id;
    button.dataset.recordType = record.record_type;

    if (record.status_label === "archived") {
        button.textContent = "Archived";
        button.disabled = true;
    } else if (record.status_label === "deleted") {
        button.textContent = "Deleted";
        button.disabled = true;
    }

    return button;
}

function createContentDeleteButton(record) {
    const button = createElement("button", "secondary-button destructive-button admin-result-action moderation-action-button");

    button.type = "button";
    button.textContent = "Soft delete";
    button.dataset.contentAction = "delete";
    button.dataset.nextStatus = "deleted";
    button.dataset.recordId = record.record_id;
    button.dataset.recordType = record.record_type;

    if (record.status_label === "deleted") {
        button.textContent = "Already deleted";
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
        const roleButton = createRoleButton(record);
        const moderationButton = createModerationButton(record);
        const deleteButton = createDeleteButton(record);

        detailLink.href = getDetailUrl("user", record.user_id);
        activityLink.href = getActivityUrl(record.user_id);
        userCell.append(name, detail);
        roleCell.append(createBadge(formatStatus(record.platform_role), true));
        statusCell.append(createBadge(formatStatus(record.account_status), record.account_status === "active"));
        actionsCell.append(roleButton, moderationButton, deleteButton, detailLink, activityLink);
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

function renderContentRecords() {
    const records = getFilteredContentRecords();

    renderContentSummary(records);

    if (!records.length) {
        contentListElement.replaceChildren(createElement("p", "empty-state", "No courses or classrooms match these moderation filters."));
        return;
    }

    const table = createElement("table", "activity-table moderation-table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    const body = document.createElement("tbody");

    ["Record", "Type", "Status", "Owner", "Usage", "Activity", "Updated", "Actions"].forEach((label) => {
        headRow.append(createElement("th", "", label));
    });
    head.append(headRow);

    records.forEach((record) => {
        const row = document.createElement("tr");
        const recordCell = document.createElement("td");
        const actionsCell = document.createElement("td");
        const name = createElement("strong", "admin-detail-value", record.primary_label || formatShortId(record.record_id));
        const detail = createElement("span", "course-muted", record.secondary_label || record.record_id);
        const archiveButton = createContentArchiveButton(record);
        const deleteButton = createContentDeleteButton(record);
        const detailLink = createElement("a", "secondary-button admin-result-action", "View details");
        const activityLink = createElement("a", "secondary-button admin-result-action", "View activity");

        detailLink.href = getDetailUrl(record.record_type, record.record_id);
        activityLink.href = getActivityUrl(record.record_id);
        recordCell.append(name, detail);
        actionsCell.append(archiveButton, deleteButton, detailLink, activityLink);
        row.append(
            recordCell,
            createElement("td", "", formatStatus(record.record_type)),
            createElement("td", "", formatStatus(record.status_label)),
            createElement("td", "", record.owner_email || formatShortId(record.owner_user_id)),
            createElement("td", "", `${formatNumber(record.enrollment_count)} enrollments / ${formatNumber(record.submission_count)} submissions`),
            createElement("td", "", `${formatNumber(record.activity_count)} events`),
            createElement("td", "", formatDate(record.updated_at)),
            actionsCell
        );
        body.append(row);
    });

    table.append(head, body);
    contentListElement.replaceChildren(table);
}

function findModerationRecord(userId) {
    return moderationRecords.find((record) => record.user_id === userId);
}

function findContentRecord(recordType, recordId) {
    return contentRecords.find((record) => record.record_type === recordType && record.record_id === recordId);
}

function getModerationConfirmation(record, nextStatus) {
    const label = record.display_name || record.email || formatShortId(record.user_id);

    if (nextStatus === "suspended") {
        return `Suspend ${label}? This blocks the account from normal platform use until an admin reactivates it. The change will be logged.`;
    }

    return `Reactivate ${label}? This restores normal account access and logs the moderation action.`;
}

function confirmSoftDelete(record) {
    const label = record.display_name || record.email || formatShortId(record.user_id);
    const confirmation = window.prompt(
        `Soft delete ${label}? This blocks the account, preserves history for audit review, and cannot be reactivated from this page. Type DELETE to confirm.`
    );

    return confirmation === "DELETE";
}

function getRoleConfirmation(record, nextRole) {
    const label = record.display_name || record.email || formatShortId(record.user_id);

    if (nextRole === "admin") {
        return `Grant admin access to ${label}? They will be able to view admin dashboards, activity logs, and moderation tools.`;
    }

    return `Remove admin access from ${label}? They will keep their account but lose admin dashboard and moderation access.`;
}

function getContentArchiveConfirmation(record) {
    const label = record.primary_label || formatShortId(record.record_id);
    const typeLabel = record.record_type === "course" ? "course" : "classroom";

    if (record.record_type === "classroom") {
        return `Archive ${typeLabel} "${label}"? Joining will close, new submissions will be blocked, and existing records will stay available for review.`;
    }

    return `Archive ${typeLabel} "${label}"? It will be hidden from active discovery, new access will be blocked, and existing records will stay available for review.`;
}

function confirmContentSoftDelete(record) {
    const label = record.primary_label || formatShortId(record.record_id);
    const typeLabel = record.record_type === "course" ? "course" : "classroom";
    const confirmation = window.prompt(
        `Soft delete ${typeLabel} "${label}"? This preserves audit history but removes it from active workflows. Type DELETE to confirm.`
    );

    return confirmation === "DELETE";
}

async function handleModerationAction(event) {
    const button = event.target.closest("[data-user-id][data-next-status][data-action-type]");

    if (!button || button.disabled) {
        return;
    }

    const record = findModerationRecord(button.dataset.userId);
    const nextStatus = button.dataset.nextStatus;

    if (!record) {
        setStatus("That user record is no longer loaded. Refresh users and try again.", "error");
        return;
    }

    if (button.dataset.actionType === "delete") {
        if (!confirmSoftDelete(record)) {
            return;
        }
    } else if (!window.confirm(getModerationConfirmation(record, nextStatus))) {
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
    setStatus(`User account ${nextStatus === "active" ? "reactivated" : nextStatus}.`);
}

async function handleRoleAction(event) {
    const button = event.target.closest("[data-user-id][data-next-role]");

    if (!button || button.disabled) {
        return;
    }

    const record = findModerationRecord(button.dataset.userId);
    const nextRole = button.dataset.nextRole;

    if (!record) {
        setStatus("That user record is no longer loaded. Refresh users and try again.", "error");
        return;
    }

    if (!window.confirm(getRoleConfirmation(record, nextRole))) {
        return;
    }

    setStatus("Updating user platform role...");
    button.disabled = true;

    const { error } = await supabase.rpc("moderate_user_platform_role", {
        next_role_input: nextRole,
        target_user_id_input: record.user_id,
    });

    if (error) {
        setStatus(error.message || "User platform role could not be updated.", "error");
        button.disabled = false;
        return;
    }

    await loadModerationRecords();
    setStatus(`User role changed to ${formatStatus(nextRole)}.`);
}

async function handleContentModerationAction(event) {
    const button = event.target.closest("[data-record-id][data-record-type][data-next-status][data-content-action]");

    if (!button || button.disabled) {
        return;
    }

    const record = findContentRecord(button.dataset.recordType, button.dataset.recordId);
    const nextStatus = button.dataset.nextStatus;

    if (!record) {
        setStatus("That content record is no longer loaded. Refresh content and try again.", "error");
        return;
    }

    if (button.dataset.contentAction === "delete") {
        if (!confirmContentSoftDelete(record)) {
            return;
        }
    } else if (!window.confirm(getContentArchiveConfirmation(record))) {
        return;
    }

    setStatus("Updating content status...");
    button.disabled = true;

    const { error } = await supabase.rpc("moderate_content_record_status", {
        next_status_input: nextStatus,
        record_id_input: record.record_id,
        record_type_input: record.record_type,
    });

    if (error) {
        setStatus(error.message || "Content status could not be updated.", "error");
        button.disabled = false;
        return;
    }

    await loadContentRecords();
    setStatus(`${formatStatus(record.record_type)} ${nextStatus}.`);
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

    if (!isAdminRole(profile.platform_role) || profile.account_status !== "active") {
        setStatus("User moderation is only available to active platform admins.", "error");
        return null;
    }

    currentProfileId = profile.id;
    currentProfileRole = profile.platform_role;
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

async function loadContentRecords() {
    setStatus("Loading content moderation records...");
    contentRefreshButton.disabled = true;

    const { data, error } = await supabase.rpc("get_admin_content_moderation_records", {
        limit_input: 100,
        record_type_filter: "",
        search_input: "",
        status_filter: "",
    });

    contentRefreshButton.disabled = false;

    if (error) {
        setStatus(error.message || "Content moderation records could not be loaded.", "error");
        return;
    }

    contentRecords = data || [];
    renderContentRecords();
    setStatus("");
}

async function initializeModerationPage() {
    const profile = await loadCurrentProfile();

    if (!profile) {
        return;
    }

    shellElements.forEach((element) => {
        element.hidden = false;
    });
    await Promise.all([
        loadModerationRecords(),
        loadContentRecords(),
    ]);
}

filterForm.addEventListener("input", renderUsers);
filterForm.addEventListener("change", renderUsers);
refreshButton.addEventListener("click", loadModerationRecords);
listElement.addEventListener("click", handleModerationAction);
listElement.addEventListener("click", handleRoleAction);
contentFilterForm.addEventListener("input", renderContentRecords);
contentFilterForm.addEventListener("change", renderContentRecords);
contentRefreshButton.addEventListener("click", loadContentRecords);
contentListElement.addEventListener("click", handleContentModerationAction);

await initializeModerationPage();
