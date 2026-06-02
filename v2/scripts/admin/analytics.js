import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const statusElement = qs("[data-platform-analytics-status]");
const shellElements = [...document.querySelectorAll("[data-platform-analytics-shell]")];
const summaryElement = qs("[data-platform-analytics-summary]");
const growthElement = qs("[data-platform-growth]");
const teachersElement = qs("[data-platform-teachers]");
const coursesElement = qs("[data-platform-courses]");

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function formatPercent(value) {
    return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function formatDate(value) {
    if (!value) {
        return "-";
    }

    return new Date(`${value}T00:00:00`).toLocaleDateString([], {
        month: "short",
        day: "numeric",
    });
}

function isAdminRole(role) {
    return role === "admin" || role === "supreme_admin";
}

function createSummaryCard(label, value, detail = "") {
    const card = createElement("article", "summary-card");

    card.append(
        createElement("span", "summary-label", label),
        createElement("strong", "summary-value summary-value--small", value)
    );

    if (detail) {
        card.append(createElement("span", "course-muted", detail));
    }

    return card;
}

function renderSummary(analytics) {
    summaryElement.replaceChildren(
        createSummaryCard("Total users", formatNumber(analytics.total_users), `${formatNumber(analytics.active_users)} active`),
        createSummaryCard("Teachers", formatNumber(analytics.teacher_users), `${formatNumber(analytics.student_users)} students`),
        createSummaryCard("Courses", formatNumber(analytics.total_courses), `${formatNumber(analytics.published_courses)} published`),
        createSummaryCard("Classrooms", formatNumber(analytics.total_classrooms), `${formatNumber(analytics.active_classrooms)} active`),
        createSummaryCard("Enrollments", formatNumber(analytics.total_enrollments), "active or retained"),
        createSummaryCard("Submissions", formatNumber(analytics.total_submissions), `${formatPercent(analytics.completion_rate)} submitted`),
        createSummaryCard("Engagement points", formatNumber(analytics.engagement_points), "earned by students"),
        createSummaryCard("New users", formatNumber(analytics.new_users_this_week), "last 7 days"),
        createSummaryCard("New courses", formatNumber(analytics.new_courses_this_month), "last 30 days"),
        createSummaryCard("New classrooms", formatNumber(analytics.new_classrooms_this_month), "last 30 days"),
        createSummaryCard("Suspended users", formatNumber(analytics.suspended_users), `${formatNumber(analytics.deleted_users)} deleted users`),
        createSummaryCard("Archived content", formatNumber(Number(analytics.archived_courses || 0) + Number(analytics.archived_classrooms || 0)), `${formatNumber(Number(analytics.deleted_courses || 0) + Number(analytics.deleted_classrooms || 0))} deleted records`)
    );
}

function renderTable(container, headers, rows, emptyMessage) {
    if (!rows.length) {
        container.replaceChildren(createElement("p", "empty-state", emptyMessage));
        return;
    }

    const table = createElement("table", "analytics-table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    const body = document.createElement("tbody");

    headers.forEach((header) => {
        headRow.append(createElement("th", "", header));
    });
    head.append(headRow);

    rows.forEach((cells) => {
        const row = document.createElement("tr");

        cells.forEach((cell) => {
            row.append(createElement("td", "", cell));
        });
        body.append(row);
    });

    table.append(head, body);
    container.replaceChildren(table);
}

function renderGrowth(rows) {
    renderTable(
        growthElement,
        ["Day", "New users", "Active users"],
        rows.map((row) => [
            formatDate(row.day),
            formatNumber(row.new_users),
            formatNumber(row.active_users),
        ]),
        "No growth activity has been recorded yet."
    );
}

function renderTeachers(rows) {
    renderTable(
        teachersElement,
        ["Teacher", "Email", "Courses", "Classrooms", "Submitted work"],
        rows.map((row) => [
            row.display_name || "Unnamed teacher",
            row.email || "-",
            formatNumber(row.course_count),
            formatNumber(row.classroom_count),
            formatNumber(row.submitted_count),
        ]),
        "No teacher activity has been recorded yet."
    );
}

function renderCourses(rows) {
    renderTable(
        coursesElement,
        ["Course", "Status", "Owner", "Enrollments", "Submitted work"],
        rows.map((row) => [
            row.title || "Untitled course",
            row.status || "-",
            row.owner_email || "-",
            formatNumber(row.enrollment_count),
            formatNumber(row.submitted_count),
        ]),
        "No course activity has been recorded yet."
    );
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
        setStatus("Platform analytics are only available to active platform admins.", "error");
        return null;
    }

    return profile;
}

async function loadPlatformAnalytics() {
    setStatus("Loading platform analytics...");

    const { data, error } = await supabase.rpc("get_admin_platform_analytics");

    if (error) {
        setStatus(error.message || "Platform analytics could not be loaded.", "error");
        return;
    }

    const analytics = data?.[0];

    if (!analytics) {
        setStatus("No platform analytics were returned.", "error");
        return;
    }

    renderSummary(analytics);
    renderGrowth(analytics.growth_7d_json || []);
    renderTeachers(analytics.top_teachers_json || []);
    renderCourses(analytics.top_courses_json || []);
    setStatus("");
}

async function initializePlatformAnalytics() {
    const profile = await loadCurrentProfile();

    if (!profile) {
        return;
    }

    shellElements.forEach((element) => {
        element.hidden = false;
    });
    await loadPlatformAnalytics();
}

await initializePlatformAnalytics();
