import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const statusElement = qs("[data-platform-analytics-status]");
const shellElements = [...document.querySelectorAll("[data-platform-analytics-shell]")];
const summaryElement = qs("[data-platform-analytics-summary]");
const growthElement = qs("[data-platform-growth]");
const teachersElement = qs("[data-platform-teachers]");
const coursesElement = qs("[data-platform-courses]");
const drilldownElement = qs("[data-platform-drilldown]");
const drilldownTitleElement = qs("[data-platform-drilldown-title]");
const drilldownCopyElement = qs("[data-platform-drilldown-copy]");
const drilldownRefreshButton = qs("[data-platform-drilldown-refresh]");

const DRILLDOWN_META = {
    users: {
        title: "Total users",
        copy: "All platform profiles, ordered by activity count and recent updates.",
        metricLabel: "Activity",
    },
    active_users: {
        title: "Active users",
        copy: "Profiles with active account status.",
        metricLabel: "Activity",
    },
    teachers: {
        title: "Teachers",
        copy: "Users who own, manage, or collaborate on teaching records.",
        metricLabel: "Activity",
    },
    students: {
        title: "Students",
        copy: "Users with active or retained enrollment records.",
        metricLabel: "Activity",
    },
    courses: {
        title: "Courses",
        copy: "Non-deleted courses, ordered by submitted student work and recent updates.",
        metricLabel: "Submitted",
    },
    published_courses: {
        title: "Published courses",
        copy: "Courses currently visible for public course discovery or access.",
        metricLabel: "Submitted",
    },
    classrooms: {
        title: "Classrooms",
        copy: "Non-deleted classrooms, ordered by enrollment count and recent updates.",
        metricLabel: "Enrollments",
    },
    active_classrooms: {
        title: "Active classrooms",
        copy: "Classrooms currently open as active teaching contexts.",
        metricLabel: "Enrollments",
    },
    enrollments: {
        title: "Enrollments",
        copy: "Active, completed, or retained student enrollments.",
        metricLabel: "Count",
    },
    submissions: {
        title: "Submissions",
        copy: "Student lesson submission records, ordered by points earned and recent updates.",
        metricLabel: "Points",
    },
    new_users: {
        title: "New users",
        copy: "Profiles created in the last 7 days.",
        metricLabel: "Activity",
    },
    new_courses: {
        title: "New courses",
        copy: "Courses created in the last 30 days.",
        metricLabel: "Submitted",
    },
    new_classrooms: {
        title: "New classrooms",
        copy: "Classrooms created in the last 30 days.",
        metricLabel: "Enrollments",
    },
    suspended_users: {
        title: "Suspended users",
        copy: "Suspended accounts that may need moderation review.",
        metricLabel: "Activity",
    },
    archived_content: {
        title: "Archived content",
        copy: "Archived courses and classrooms hidden from active discovery or teaching workflows.",
        metricLabel: "Activity",
    },
    deleted_content: {
        title: "Deleted content",
        copy: "Soft-deleted courses and classrooms preserved for audit history.",
        metricLabel: "Activity",
    },
};

let selectedDrilldownKey = "";

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

function formatDateTime(value) {
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

function formatStatus(status = "") {
    return String(status || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isAdminRole(role) {
    return role === "admin" || role === "supreme_admin";
}

function createSummaryCard(label, value, detail = "", drilldownKey = "") {
    const card = createElement("article", "summary-card");

    card.append(
        createElement("span", "summary-label", label),
        createElement("strong", "summary-value summary-value--small", value)
    );

    if (detail) {
        card.append(createElement("span", "course-muted", detail));
    }

    if (drilldownKey) {
        const button = createElement("button", "secondary-button analytics-card-action", "View records");

        button.type = "button";
        button.dataset.drilldownKey = drilldownKey;
        card.append(button);
    }

    return card;
}

function renderSummary(analytics) {
    summaryElement.replaceChildren(
        createSummaryCard("Total users", formatNumber(analytics.total_users), `${formatNumber(analytics.active_users)} active`, "users"),
        createSummaryCard("Teachers", formatNumber(analytics.teacher_users), `${formatNumber(analytics.student_users)} students`, "teachers"),
        createSummaryCard("Courses", formatNumber(analytics.total_courses), `${formatNumber(analytics.published_courses)} published`, "courses"),
        createSummaryCard("Classrooms", formatNumber(analytics.total_classrooms), `${formatNumber(analytics.active_classrooms)} active`, "classrooms"),
        createSummaryCard("Enrollments", formatNumber(analytics.total_enrollments), "active or retained", "enrollments"),
        createSummaryCard("Submissions", formatNumber(analytics.total_submissions), `${formatPercent(analytics.completion_rate)} submitted`, "submissions"),
        createSummaryCard("Engagement points", formatNumber(analytics.engagement_points), "earned by students"),
        createSummaryCard("New users", formatNumber(analytics.new_users_this_week), "last 7 days", "new_users"),
        createSummaryCard("New courses", formatNumber(analytics.new_courses_this_month), "last 30 days", "new_courses"),
        createSummaryCard("New classrooms", formatNumber(analytics.new_classrooms_this_month), "last 30 days", "new_classrooms"),
        createSummaryCard("Suspended users", formatNumber(analytics.suspended_users), `${formatNumber(analytics.deleted_users)} deleted users`, "suspended_users"),
        createSummaryCard("Archived content", formatNumber(Number(analytics.archived_courses || 0) + Number(analytics.archived_classrooms || 0)), `${formatNumber(Number(analytics.deleted_courses || 0) + Number(analytics.deleted_classrooms || 0))} deleted records`, "archived_content")
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
            const tableCell = document.createElement("td");

            if (cell instanceof Node) {
                tableCell.append(cell);
            } else {
                tableCell.textContent = cell;
            }

            row.append(tableCell);
        });
        body.append(row);
    });

    table.append(head, body);
    container.replaceChildren(table);
}

function getDetailUrl(record) {
    if (!["user", "course", "classroom"].includes(record.record_type)) {
        return "";
    }

    const url = new URL("./detail.html", window.location.href);

    url.searchParams.set("type", record.record_type);
    url.searchParams.set("id", record.record_id);
    return url.href;
}

function getActivityUrl(record) {
    const url = new URL("../activity/index.html", window.location.href);

    url.searchParams.set("query", record.record_id);
    return url.href;
}

function createRecordActions(record) {
    const wrapper = createElement("div", "analytics-action-stack");
    const detailUrl = getDetailUrl(record);
    const activityLink = createElement("a", "secondary-button analytics-table-action", "Activity");

    activityLink.href = getActivityUrl(record);

    if (detailUrl) {
        const detailLink = createElement("a", "primary-button analytics-table-action", "Details");

        detailLink.href = detailUrl;
        wrapper.append(detailLink);
    }

    wrapper.append(activityLink);
    return wrapper;
}

function renderDrilldown(rows) {
    const meta = DRILLDOWN_META[selectedDrilldownKey] || DRILLDOWN_META.users;

    drilldownTitleElement.textContent = meta.title;
    drilldownCopyElement.textContent = meta.copy;

    renderTable(
        drilldownElement,
        ["Record", "Type", "Status", meta.metricLabel, "Updated", "Actions"],
        rows.map((row) => {
            const recordCell = createElement("span", "analytics-record-cell");

            recordCell.append(
                createElement("strong", "submission-name", row.primary_label || row.record_id),
                createElement("span", "course-muted", row.secondary_label || row.record_id)
            );

            return [
                recordCell,
                formatStatus(row.record_type),
                formatStatus(row.status_label),
                formatNumber(row.metric_value),
                formatDateTime(row.updated_at || row.created_at),
                createRecordActions(row),
            ];
        }),
        "No records matched that metric yet."
    );
}

async function loadDrilldown(drilldownKey) {
    if (!drilldownKey) {
        return;
    }

    selectedDrilldownKey = drilldownKey;
    drilldownRefreshButton.disabled = true;
    drilldownElement.replaceChildren(createElement("p", "empty-state", "Loading record details..."));

    const { data, error } = await supabase.rpc("get_admin_platform_analytics_drilldown", {
        metric_input: drilldownKey,
        limit_input: 50,
    });

    if (error) {
        setStatus(error.message || "Metric drill-down could not be loaded.", "error");
        drilldownElement.replaceChildren(createElement("p", "empty-state", "Metric drill-down could not be loaded."));
        drilldownRefreshButton.disabled = false;
        return;
    }

    renderDrilldown(data || []);
    drilldownRefreshButton.disabled = false;
    setStatus("");
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

    if (selectedDrilldownKey) {
        await loadDrilldown(selectedDrilldownKey);
    }

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

summaryElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-drilldown-key]");

    if (!button) {
        return;
    }

    void loadDrilldown(button.dataset.drilldownKey);
});

drilldownRefreshButton.addEventListener("click", () => {
    void loadDrilldown(selectedDrilldownKey);
});

await initializePlatformAnalytics();
