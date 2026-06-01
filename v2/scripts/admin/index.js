import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const statusElement = qs("[data-admin-status]");
const shellElements = [...document.querySelectorAll("[data-admin-shell]")];
const summaryElement = qs("[data-admin-summary]");
const recentActivityElement = qs("[data-admin-recent-activity]");

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

function formatEntityLabel(label, id) {
    return label || formatShortId(id);
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

function renderRecentActivity(logs) {
    if (!logs.length) {
        recentActivityElement.replaceChildren(createElement("p", "empty-state", "No activity has been logged yet."));
        return;
    }

    const list = createElement("ul", "submission-list admin-activity-list");

    logs.slice(0, 8).forEach((log) => {
        const item = createElement("li", "submission-item");
        const action = createElement("strong", "submission-name", formatAction(log.action_type));
        const target = createElement("span", "course-muted", `${log.target_type} ${formatEntityLabel(log.target_display_name, log.target_id)}`);
        const actor = createElement("span", "course-muted", `Actor: ${formatEntityLabel(log.actor_display_name, log.actor_user_id)}`);
        const createdAt = createElement("span", "course-muted", formatDate(log.created_at));

        item.append(action, target, actor, createdAt);
        list.append(item);
    });

    recentActivityElement.replaceChildren(list);
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

await initializeAdminDashboard();
