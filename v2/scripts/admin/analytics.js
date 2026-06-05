import { supabase } from "../../services/supabase/client.js";
import { isPlatformAdmin, loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { notifyStatus } from "../utils/ui-components.js";

const statusElement = qs("[data-platform-analytics-status]");
const shellElements = [...document.querySelectorAll("[data-platform-analytics-shell]")];
const summaryElement = qs("[data-platform-analytics-summary]");
const growthElement = qs("[data-platform-growth]");
const growthTrendElement = qs("[data-platform-growth-trend]");
const teachersElement = qs("[data-platform-teachers]");
const coursesElement = qs("[data-platform-courses]");
const drilldownElement = qs("[data-platform-drilldown]");
const drilldownTitleElement = qs("[data-platform-drilldown-title]");
const drilldownCopyElement = qs("[data-platform-drilldown-copy]");
const drilldownRefreshButton = qs("[data-platform-drilldown-refresh]");
const statusBreakdownElement = qs("[data-platform-status-breakdown]");
const moderationElement = qs("[data-platform-moderation]");
const submissionHealthElement = qs("[data-platform-submission-health]");
const submissionsActionButton = qs("[data-platform-submissions-action]");
const copySummaryButton = qs("[data-platform-copy-summary]");
const downloadSummaryButton = qs("[data-platform-download-summary]");
const exportPreviewElement = qs("[data-platform-export-preview]");
const rangeControlElement = qs("[data-platform-range-control]");
const growthCopyElement = qs("[data-platform-growth-copy]");

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
let selectedRangeDays = 7;
let latestAnalytics = null;

function getRangeLabel() {
    return `last ${selectedRangeDays} days`;
}

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
    notifyStatus(message, tone);
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function formatPercent(value) {
    return `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function getPercent(part, total) {
    if (!Number(total || 0)) {
        return 0;
    }

    return (Number(part || 0) / Number(total || 0)) * 100;
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

function getAnalyticsExport() {
    if (!latestAnalytics) {
        return null;
    }

    return {
        generated_at: new Date().toISOString(),
        range_days: selectedRangeDays,
        metrics: latestAnalytics,
    };
}

function isAdminRole(role) {
    return isPlatformAdmin(role);
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
        createSummaryCard("New users", formatNumber(analytics.new_users_this_week), getRangeLabel(), "new_users"),
        createSummaryCard("New courses", formatNumber(analytics.new_courses_this_month), getRangeLabel(), "new_courses"),
        createSummaryCard("New classrooms", formatNumber(analytics.new_classrooms_this_month), getRangeLabel(), "new_classrooms"),
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

function getBreakdownValue(analytics, rows, analyticsKey, rowKey = "") {
    if (analyticsKey in analytics) {
        return Number(analytics[analyticsKey] || 0);
    }

    return Number(rows.find((row) => row.key === rowKey)?.value || 0);
}

function createBreakdownBar(label, value, total, tone = "info") {
    const item = createElement("div", "analytics-breakdown-row");
    const labelElement = createElement("span", "analytics-breakdown-label", label);
    const valueElement = createElement("strong", "analytics-breakdown-value", formatNumber(value));
    const track = createElement("span", "analytics-breakdown-track");
    const fill = createElement("span", `analytics-breakdown-fill analytics-breakdown-fill--${tone}`);
    const percent = total > 0 ? Math.round((Number(value || 0) / total) * 100) : 0;

    fill.style.width = `${percent}%`;
    track.append(fill);
    item.append(labelElement, valueElement, track, createElement("span", "course-muted", `${percent}%`));
    return item;
}

function createBreakdownCard(title, rows) {
    const card = createElement("article", "analytics-breakdown-card");
    const total = rows.reduce((sum, row) => sum + Number(row.value || 0), 0);

    card.append(
        createElement("h3", "analytics-breakdown-title", title),
        createElement("p", "course-muted", `${formatNumber(total)} total records`)
    );

    rows.forEach((row) => {
        card.append(createBreakdownBar(row.label, row.value, total, row.tone));
    });

    return card;
}

function createTrendStat(label, value, detail, tone = "info") {
    const card = createElement("article", `analytics-trend-stat analytics-trend-stat--${tone}`);
    const displayValue = typeof value === "string" ? value : formatNumber(value);

    card.append(
        createElement("span", "summary-label", label),
        createElement("strong", "summary-value summary-value--small", displayValue),
        createElement("span", "course-muted", detail)
    );
    return card;
}

function createTrendPolyline(rows, key, maxValue, width, height, padding) {
    const usableWidth = width - (padding * 2);
    const usableHeight = height - (padding * 2);
    const denominator = Math.max(maxValue, 1);

    return rows.map((row, index) => {
        const x = rows.length > 1
            ? padding + ((usableWidth / (rows.length - 1)) * index)
            : padding + (usableWidth / 2);
        const y = padding + usableHeight - ((Number(row[key] || 0) / denominator) * usableHeight);

        return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
}

function createTrendChart(rows) {
    const width = 720;
    const height = 260;
    const padding = 34;
    const maxValue = Math.max(
        1,
        ...rows.flatMap((row) => [
            Number(row.new_users || 0),
            Number(row.active_users || 0),
        ])
    );
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const activeLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    const newUserLine = document.createElementNS("http://www.w3.org/2000/svg", "polyline");

    svg.setAttribute("class", "analytics-trend-chart");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `${selectedRangeDays} day growth trend for new users and active users`);

    [0, 0.5, 1].forEach((ratio) => {
        const y = padding + ((height - padding * 2) * ratio);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");

        line.setAttribute("x1", String(padding));
        line.setAttribute("x2", String(width - padding));
        line.setAttribute("y1", String(y));
        line.setAttribute("y2", String(y));
        line.setAttribute("class", "analytics-trend-gridline");
        svg.append(line);
    });

    activeLine.setAttribute("points", createTrendPolyline(rows, "active_users", maxValue, width, height, padding));
    activeLine.setAttribute("class", "analytics-trend-line analytics-trend-line--active");
    newUserLine.setAttribute("points", createTrendPolyline(rows, "new_users", maxValue, width, height, padding));
    newUserLine.setAttribute("class", "analytics-trend-line analytics-trend-line--new");
    svg.append(activeLine, newUserLine);

    const labelInterval = rows.length > 60 ? 14 : rows.length > 14 ? 5 : 1;

    rows.forEach((row, index) => {
        if (index !== 0 && index !== rows.length - 1 && index % labelInterval !== 0) {
            return;
        }

        const usableWidth = width - (padding * 2);
        const x = rows.length > 1
            ? padding + ((usableWidth / (rows.length - 1)) * index)
            : padding + (usableWidth / 2);
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");

        label.setAttribute("x", String(x));
        label.setAttribute("y", String(height - 8));
        label.setAttribute("class", "analytics-trend-axis-label");
        label.textContent = formatDate(row.day);
        svg.append(label);
    });

    return svg;
}

function renderGrowthTrend(rows) {
    if (!rows.length) {
        growthTrendElement.replaceChildren(createElement("p", "empty-state", "No growth activity has been recorded yet."));
        return;
    }

    const totalNewUsers = rows.reduce((sum, row) => sum + Number(row.new_users || 0), 0);
    const totalActiveSignals = rows.reduce((sum, row) => sum + Number(row.active_users || 0), 0);
    const peakActive = rows.reduce((max, row) => Math.max(max, Number(row.active_users || 0)), 0);
    const legend = createElement("div", "analytics-trend-legend");
    const stats = createElement("div", "analytics-trend-stats");

    legend.append(
        createElement("span", "analytics-trend-key analytics-trend-key--new", "New users"),
        createElement("span", "analytics-trend-key analytics-trend-key--active", "Active users")
    );
    stats.append(
        createTrendStat("New users", totalNewUsers, getRangeLabel(), "new"),
        createTrendStat("Active user signals", totalActiveSignals, "daily total", "active"),
        createTrendStat("Peak active day", peakActive, "highest day")
    );

    growthTrendElement.replaceChildren(legend, createTrendChart(rows), stats);
}

function renderStatusBreakdowns(analytics) {
    const rows = analytics.status_breakdown_json || [];
    const users = [
        { label: "Active", value: getBreakdownValue(analytics, rows, "active_users", "users_active"), tone: "success" },
        { label: "Suspended", value: getBreakdownValue(analytics, rows, "suspended_users", "users_suspended"), tone: "warning" },
        { label: "Deleted", value: getBreakdownValue(analytics, rows, "deleted_users", "users_deleted"), tone: "danger" },
    ];
    const courses = [
        { label: "Published", value: getBreakdownValue(analytics, rows, "published_courses", "courses_published"), tone: "success" },
        { label: "Private", value: getBreakdownValue(analytics, rows, "private_courses", "courses_private"), tone: "info" },
        { label: "Draft", value: getBreakdownValue(analytics, rows, "draft_courses"), tone: "info" },
        { label: "Archived", value: getBreakdownValue(analytics, rows, "archived_courses", "courses_archived"), tone: "warning" },
        { label: "Deleted", value: getBreakdownValue(analytics, rows, "deleted_courses"), tone: "danger" },
    ];
    const classrooms = [
        { label: "Active", value: getBreakdownValue(analytics, rows, "active_classrooms", "classrooms_active"), tone: "success" },
        { label: "Archived", value: getBreakdownValue(analytics, rows, "archived_classrooms", "classrooms_archived"), tone: "warning" },
        { label: "Deleted", value: getBreakdownValue(analytics, rows, "deleted_classrooms"), tone: "danger" },
    ];

    statusBreakdownElement.replaceChildren(
        createBreakdownCard("Users", users),
        createBreakdownCard("Courses", courses),
        createBreakdownCard("Classrooms", classrooms)
    );
}

function renderModerationSignals(analytics) {
    renderTable(
        moderationElement,
        ["Signal", "Count", "Review note", "Actions"],
        [
            [
                "Suspended users",
                formatNumber(analytics.suspended_users),
                "Accounts currently blocked from normal platform use.",
                createModerationActions("suspended_users"),
            ],
            [
                "Deleted users",
                formatNumber(analytics.deleted_users),
                "Soft-deleted account records preserved for admin review.",
                createModerationActions(),
            ],
            [
                "Archived courses",
                formatNumber(analytics.archived_courses),
                "Courses hidden from discovery and active student workflows.",
                createModerationActions("archived_content"),
            ],
            [
                "Archived classrooms",
                formatNumber(analytics.archived_classrooms),
                "Classrooms removed from active teaching workflows.",
                createModerationActions("archived_content"),
            ],
            [
                "Deleted courses",
                formatNumber(analytics.deleted_courses),
                "Soft-deleted course records preserved for audit history.",
                createModerationActions("deleted_content"),
            ],
            [
                "Deleted classrooms",
                formatNumber(analytics.deleted_classrooms),
                "Soft-deleted classroom records preserved for audit history.",
                createModerationActions("deleted_content"),
            ],
        ],
        "No moderation signals are available yet."
    );
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

function createRecordLinkCell(label, detail, recordType, recordId) {
    const wrapper = createElement("span", "analytics-record-cell");
    const detailUrl = getDetailUrl({ record_type: recordType, record_id: recordId });
    const title = detailUrl
        ? createElement("a", "submission-name", label)
        : createElement("strong", "submission-name", label);

    if (detailUrl) {
        title.href = detailUrl;
    }

    wrapper.append(title);

    if (detail) {
        wrapper.append(createElement("span", "course-muted", detail));
    }

    return wrapper;
}

function createDrilldownButton(label, drilldownKey) {
    const button = createElement("button", "secondary-button analytics-table-action", label);

    button.type = "button";
    button.dataset.drilldownKey = drilldownKey;
    return button;
}

function createProgressCell(value, detail) {
    const wrapper = createElement("span", "analytics-progress-cell");
    const progress = document.createElement("progress");
    const safeValue = Math.max(0, Math.min(100, Number(value || 0)));

    progress.max = 100;
    progress.value = safeValue;
    wrapper.append(
        createElement("strong", "submission-name", formatPercent(safeValue)),
        progress,
        createElement("span", "course-muted", detail)
    );
    return wrapper;
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

function createModerationActions(drilldownKey = "") {
    const wrapper = createElement("div", "analytics-action-stack");
    const moderationLink = createElement("a", "secondary-button analytics-table-action", "Moderation");

    moderationLink.href = "./moderation.html";

    if (drilldownKey) {
        wrapper.append(createDrilldownButton("Records", drilldownKey));
    }

    wrapper.append(moderationLink);
    return wrapper;
}

function getDrilldownCopy(meta) {
    if (["new_users", "new_courses", "new_classrooms"].includes(selectedDrilldownKey)) {
        return meta.copy.replace(/last (7|30) days/, getRangeLabel());
    }

    return meta.copy;
}

function renderDrilldown(rows) {
    const meta = DRILLDOWN_META[selectedDrilldownKey] || DRILLDOWN_META.users;

    drilldownTitleElement.textContent = meta.title;
    drilldownCopyElement.textContent = getDrilldownCopy(meta);

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
        range_days_input: selectedRangeDays,
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
    renderGrowthTrend(rows);

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

function renderSubmissionHealth(analytics) {
    const totalSubmissions = Number(analytics.total_submissions || 0);
    const submittedSubmissions = Number(analytics.submitted_submissions || 0);
    const draftSubmissions = Number(analytics.draft_submissions || 0);
    const draftRate = getPercent(draftSubmissions, totalSubmissions);
    const stats = createElement("div", "analytics-trend-stats");
    const tableShell = createElement("div", "analytics-table-shell");

    stats.append(
        createTrendStat("Submitted", submittedSubmissions, "turned in", "active"),
        createTrendStat("Drafts", draftSubmissions, "in progress", draftRate > 35 ? "new" : "info"),
        createTrendStat("Completion", formatPercent(analytics.completion_rate), "submitted work")
    );

    renderTable(
        tableShell,
        ["Signal", "Value", "Share", "Review"],
        [
            [
                "Submitted work",
                formatNumber(submittedSubmissions),
                formatPercent(getPercent(submittedSubmissions, totalSubmissions)),
                "Student work that has been turned in.",
            ],
            [
                "Draft work",
                formatNumber(draftSubmissions),
                formatPercent(draftRate),
                "In-progress student work that may need teacher follow-up.",
            ],
            [
                "Completion rate",
                formatPercent(analytics.completion_rate),
                "Submitted / total",
                draftRate > 35 ? "Draft share is elevated." : "Submission mix looks steady.",
            ],
            [
                "Engagement points",
                formatNumber(analytics.engagement_points),
                "All time",
                "Total points earned across student submissions.",
            ],
        ],
        "No submission health data has been recorded yet."
    );

    submissionHealthElement.replaceChildren(
        stats,
        tableShell
    );
}

function renderTeachers(rows) {
    renderTable(
        teachersElement,
        ["Teacher", "Email", "Courses", "Classrooms", "Submitted work", "Actions"],
        rows.map((row) => [
            createRecordLinkCell(row.display_name || "Unnamed teacher", row.email || "-", "user", row.id),
            row.email || "-",
            formatNumber(row.course_count),
            formatNumber(row.classroom_count),
            formatNumber(row.submitted_count),
            createRecordActions({ record_type: "user", record_id: row.id }),
        ]),
        "No teacher activity has been recorded yet."
    );
}

function renderCourses(rows) {
    renderTable(
        coursesElement,
        ["Course", "Status", "Owner", "Completion", "Submissions", "Actions"],
        rows.map((row) => [
            createRecordLinkCell(row.title || "Untitled course", row.owner_email || "-", "course", row.id),
            row.status || "-",
            row.owner_email || "-",
            createProgressCell(row.completion_rate, `${formatNumber(row.enrollment_count)} enrollments`),
            `${formatNumber(row.submitted_count)} submitted / ${formatNumber(row.draft_count)} draft`,
            createRecordActions({ record_type: "course", record_id: row.id }),
        ]),
        "No course activity has been recorded yet."
    );
}

function buildSummaryText(exportPayload) {
    const analytics = exportPayload.metrics;
    const archivedContent = Number(analytics.archived_courses || 0) + Number(analytics.archived_classrooms || 0);
    const deletedContent = Number(analytics.deleted_courses || 0) + Number(analytics.deleted_classrooms || 0);

    return [
        `Platform analytics summary (${getRangeLabel()})`,
        `Generated: ${formatDateTime(exportPayload.generated_at)}`,
        "",
        `Users: ${formatNumber(analytics.total_users)} total, ${formatNumber(analytics.active_users)} active, ${formatNumber(analytics.suspended_users)} suspended`,
        `Courses: ${formatNumber(analytics.total_courses)} total, ${formatNumber(analytics.published_courses)} published`,
        `Classrooms: ${formatNumber(analytics.total_classrooms)} total, ${formatNumber(analytics.active_classrooms)} active`,
        `Submissions: ${formatNumber(analytics.total_submissions)} total, ${formatNumber(analytics.submitted_submissions)} submitted, ${formatNumber(analytics.draft_submissions)} drafts`,
        `Completion rate: ${formatPercent(analytics.completion_rate)}`,
        `Engagement points: ${formatNumber(analytics.engagement_points)}`,
        `Moderation: ${formatNumber(archivedContent)} archived records, ${formatNumber(deletedContent)} deleted content records`,
    ].join("\n");
}

function hideExportPreview() {
    exportPreviewElement.hidden = true;
    exportPreviewElement.replaceChildren();
}

function showExportPreview(text) {
    const label = createElement("strong", "submission-name", "Analytics summary");
    const copy = createElement("p", "section-copy", "Copy was blocked by the browser. The summary text is selected below.");
    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.readOnly = true;
    exportPreviewElement.replaceChildren(label, copy, textarea);
    exportPreviewElement.hidden = false;
    textarea.focus();
    textarea.select();
}

async function writeTextToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return;
        } catch (error) {
            // Fall through to the textarea copy path when browser permissions block Clipboard API.
        }
    }

    const textarea = document.createElement("textarea");

    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "-999px";
    document.body.append(textarea);
    textarea.select();

    const didCopy = document.execCommand("copy");

    textarea.remove();

    if (!didCopy) {
        throw new Error("Clipboard copy was blocked.");
    }
}

async function copyAnalyticsSummary() {
    const exportPayload = getAnalyticsExport();

    if (!exportPayload) {
        setStatus("Analytics must finish loading before copying a summary.", "error");
        return;
    }

    const summaryText = buildSummaryText(exportPayload);

    try {
        await writeTextToClipboard(summaryText);
        hideExportPreview();
        setStatus("Analytics summary copied.");
    } catch (error) {
        showExportPreview(summaryText);
        setStatus("Copy was blocked. The analytics summary is selected below.", "error");
    }
}

function downloadAnalyticsSummary() {
    const exportPayload = getAnalyticsExport();

    if (!exportPayload) {
        setStatus("Analytics must finish loading before downloading a summary.", "error");
        return;
    }

    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");

    link.href = URL.createObjectURL(blob);
    link.download = `platform-analytics-${selectedRangeDays}d.json`;
    link.click();
    URL.revokeObjectURL(link.href);
    hideExportPreview();
    setStatus("Analytics JSON downloaded.");
}

async function loadCurrentProfile() {
    return loadProtectedProfile({
        requireAdmin: true,
        statusElement,
        adminMessage: "Platform analytics are only available to active platform admins.",
    });
}

async function loadPlatformAnalytics() {
    setStatus(`Loading platform analytics for the ${getRangeLabel()}...`);

    const { data, error } = await supabase.rpc("get_admin_platform_analytics", {
        range_days_input: selectedRangeDays,
    });

    if (error) {
        setStatus(error.message || "Platform analytics could not be loaded.", "error");
        return;
    }

    const analytics = data?.[0];

    if (!analytics) {
        setStatus("No platform analytics were returned.", "error");
        return;
    }

    latestAnalytics = analytics;
    renderSummary(analytics);
    growthCopyElement.textContent = `Recent signup and active-user signals for the ${getRangeLabel()}.`;
    renderGrowth(analytics.growth_7d_json || []);
    renderSubmissionHealth(analytics);
    renderTeachers(analytics.top_teachers_json || []);
    renderCourses(analytics.top_courses_json || []);
    renderStatusBreakdowns(analytics);
    renderModerationSignals(analytics);

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

moderationElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-drilldown-key]");

    if (!button) {
        return;
    }

    void loadDrilldown(button.dataset.drilldownKey);
});

submissionsActionButton.addEventListener("click", () => {
    void loadDrilldown("submissions");
});

copySummaryButton.addEventListener("click", () => {
    void copyAnalyticsSummary();
});

downloadSummaryButton.addEventListener("click", downloadAnalyticsSummary);

rangeControlElement.addEventListener("click", (event) => {
    const button = event.target.closest("[data-range-days]");

    if (!button) {
        return;
    }

    selectedRangeDays = Number(button.dataset.rangeDays || 7);
    rangeControlElement.querySelectorAll("[data-range-days]").forEach((rangeButton) => {
        rangeButton.setAttribute("aria-pressed", String(rangeButton === button));
    });
    void loadPlatformAnalytics();
});

drilldownRefreshButton.addEventListener("click", () => {
    void loadDrilldown(selectedDrilldownKey);
});

await initializePlatformAnalytics();
