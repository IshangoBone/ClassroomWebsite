import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const statusElement = qs("[data-admin-status]");
const shellElements = [...document.querySelectorAll("[data-admin-shell]")];
const summaryElement = qs("[data-admin-summary]");
const healthElement = qs("[data-admin-health]");
const recentActivityElement = qs("[data-admin-recent-activity]");
const searchForm = qs("[data-admin-search-form]");
const searchResultsElement = qs("[data-admin-search-results]");

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
        createElement("strong", "summary-value summary-value--small", formatNumber(value))
    );
    return card;
}

function createHealthCard(label, value, detail, tone = "info") {
    const card = createElement("article", `summary-card admin-health-card admin-health-card--${tone}`);

    card.append(
        createElement("span", "summary-label", label),
        createElement("strong", "summary-value summary-value--small", formatNumber(value)),
        createElement("span", "course-muted", detail)
    );
    return card;
}

function formatEntityLabel(label, id) {
    return label || formatShortId(id);
}

function formatStatus(status = "") {
    return status.charAt(0).toUpperCase() + status.slice(1);
}

function getActivityUrlForRecord(result) {
    const url = new URL("../activity/index.html", window.location.href);

    url.searchParams.set("query", result.record_id);
    return url.href;
}

function getActivityUrlForLog(log) {
    const url = new URL("../activity/index.html", window.location.href);
    const query = log.target_id || log.course_id || log.classroom_id || log.action_type;

    url.searchParams.set("query", query);
    return url.href;
}

function getDetailUrlForRecord(result) {
    const url = new URL("./detail.html", window.location.href);

    url.searchParams.set("type", result.record_type);
    url.searchParams.set("id", result.record_id);
    return url.href;
}

function renderSummary(summary) {
    summaryElement.replaceChildren(
        createSummaryCard("Total users", summary.total_users),
        createSummaryCard("Active users", summary.active_users),
        createSummaryCard("Teachers", summary.teacher_users),
        createSummaryCard("Students", summary.student_users),
        createSummaryCard("Courses", summary.total_courses),
        createSummaryCard("Published courses", summary.published_courses),
        createSummaryCard("Classrooms", summary.total_classrooms),
        createSummaryCard("Active classrooms", summary.active_classrooms),
        createSummaryCard("Enrollments", summary.total_enrollments),
        createSummaryCard("Submissions this week", summary.submissions_this_week),
        createSummaryCard("New signups this week", summary.new_signups_this_week),
        createSummaryCard("Activity this week", summary.activity_this_week),
        createSummaryCard("Archived courses", summary.archived_courses),
        createSummaryCard("Suspended users", summary.suspended_users)
    );
}

function renderHealth(summary) {
    const deletedContent = Number(summary.deleted_courses || 0)
        + Number(summary.deleted_classrooms || 0)
        + Number(summary.deleted_files || 0);

    healthElement.replaceChildren(
        createHealthCard(
            "Suspended users",
            summary.suspended_users,
            "Accounts that may need moderation review.",
            Number(summary.suspended_users || 0) ? "warning" : "success"
        ),
        createHealthCard(
            "Deleted users",
            summary.deleted_users,
            "Soft-deleted accounts preserved for audit history.",
            Number(summary.deleted_users || 0) ? "warning" : "success"
        ),
        createHealthCard(
            "Archived courses",
            summary.archived_courses,
            "Courses hidden from active discovery.",
            Number(summary.archived_courses || 0) ? "info" : "success"
        ),
        createHealthCard(
            "Archived classrooms",
            summary.archived_classrooms,
            "Classrooms removed from active teaching workflows.",
            Number(summary.archived_classrooms || 0) ? "info" : "success"
        ),
        createHealthCard(
            "Draft submissions",
            summary.draft_submissions,
            "Student work started but not submitted.",
            Number(summary.draft_submissions || 0) ? "info" : "success"
        ),
        createHealthCard(
            "Deleted content",
            deletedContent,
            "Courses, classrooms, and files marked deleted.",
            deletedContent ? "warning" : "success"
        )
    );
}

function renderRecentActivity(logs) {
    if (!logs.length) {
        recentActivityElement.replaceChildren(createElement("p", "empty-state", "No activity has been logged yet."));
        return;
    }

    const list = createElement("ul", "submission-list admin-activity-list");

    logs.slice(0, 8).forEach((log) => {
        const item = createElement("li", "submission-item");
        const action = createElement("a", "submission-name", formatAction(log.action_type));
        const target = createElement("span", "course-muted", `${log.target_type} ${formatEntityLabel(log.target_display_name, log.target_id)}`);
        const actor = createElement("span", "course-muted", `Actor: ${formatEntityLabel(log.actor_display_name, log.actor_user_id)}`);
        const createdAt = createElement("span", "course-muted", formatDate(log.created_at));

        action.href = getActivityUrlForLog(log);
        item.append(action, target, actor, createdAt);
        list.append(item);
    });

    recentActivityElement.replaceChildren(list);
}

function renderSearchResults(results, query) {
    if (!query) {
        searchResultsElement.replaceChildren(createElement("p", "empty-state", "Search results will appear here."));
        return;
    }

    if (!results.length) {
        searchResultsElement.replaceChildren(createElement("p", "empty-state", "No users, courses, or classrooms matched that search."));
        return;
    }

    const list = createElement("ul", "submission-list admin-search-results");

    results.forEach((result) => {
        const item = createElement("li", "submission-item");
        const title = createElement("strong", "submission-name", result.primary_label || formatShortId(result.record_id));
        const type = createElement("span", "badge", formatStatus(result.record_type));
        const details = createElement("span", "course-muted", result.secondary_label || `${result.record_type} ${formatShortId(result.record_id)}`);
        const status = createElement("span", "badge badge--quiet", formatStatus(result.status_label));
        const detailLink = createElement("a", "primary-button admin-result-action", "View details");
        const activityLink = createElement("a", "secondary-button admin-result-action", "View activity");

        detailLink.href = getDetailUrlForRecord(result);
        activityLink.href = getActivityUrlForRecord(result);
        item.append(title, type, details, status, detailLink, activityLink);
        list.append(item);
    });

    searchResultsElement.replaceChildren(list);
}

async function handleSearchSubmit(event) {
    event.preventDefault();

    const formData = new FormData(searchForm);
    const query = String(formData.get("query") || "").trim();

    if (query.length < 2) {
        renderSearchResults([], "");
        setStatus("Enter at least 2 characters to search.", "error");
        return;
    }

    setStatus("Searching platform records...");

    const { data, error } = await supabase.rpc("search_admin_records", {
        search_input: query,
        limit_input: 20,
    });

    if (error) {
        setStatus(error.message || "Search could not be completed.", "error");
        return;
    }

    renderSearchResults(data || [], query);
    setStatus("");
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
        setStatus("The admin dashboard is only available to active platform admins.", "error");
        return null;
    }

    return profile;
}

async function loadAdminDashboard() {
    setStatus("Loading admin dashboard...");

    const [{ data: summaryData, error: summaryError }, { data: activityData, error: activityError }] = await Promise.all([
        supabase.rpc("get_admin_dashboard_summary"),
        supabase.rpc("get_admin_activity_logs", { limit_input: 8 }),
    ]);

    if (summaryError) {
        setStatus(summaryError.message || "Admin dashboard summary could not be loaded.", "error");
        return;
    }

    if (activityError) {
        setStatus(activityError.message || "Recent activity could not be loaded.", "error");
        return;
    }

    renderSummary(summaryData?.[0] || {});
    renderHealth(summaryData?.[0] || {});
    renderRecentActivity(activityData || []);
    setStatus("");
}

async function initializeAdminDashboard() {
    const profile = await loadCurrentProfile();

    if (!profile) {
        return;
    }

    shellElements.forEach((element) => {
        element.hidden = false;
    });
    await loadAdminDashboard();
}

searchForm.addEventListener("submit", handleSearchSubmit);

await initializeAdminDashboard();
