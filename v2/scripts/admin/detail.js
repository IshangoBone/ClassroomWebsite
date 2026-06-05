import { supabase } from "../../services/supabase/client.js";
import { isPlatformAdmin, loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { notifyStatus } from "../utils/ui-components.js";

const detailParams = new URLSearchParams(window.location.search);
const statusElement = qs("[data-admin-detail-status]");
const shellElement = qs("[data-admin-detail-shell]");
const typeElement = qs("[data-admin-detail-type]");
const titleElement = qs("[data-admin-detail-title]");
const copyElement = qs("[data-admin-detail-copy]");
const summaryElement = qs("[data-admin-detail-summary]");
const detailGridElement = qs("[data-admin-detail-grid]");
const activityLink = qs("[data-admin-detail-activity]");

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
    notifyStatus(message, tone);
}

function formatShortId(id) {
    return id ? id.slice(0, 8) : "-";
}

function formatStatus(status = "") {
    return String(status || "")
        .replaceAll("_", " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function isAdminRole(role) {
    return isPlatformAdmin(role);
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

function formatValue(value) {
    if (value === null || value === undefined || value === "") {
        return "-";
    }

    if (typeof value === "boolean") {
        return value ? "Yes" : "No";
    }

    return String(value);
}

function createSummaryCard(label, value) {
    const card = createElement("article", "summary-card");

    card.append(
        createElement("span", "summary-label", label),
        createElement("strong", "summary-value summary-value--small", formatValue(value))
    );
    return card;
}

function renderDetail(record) {
    const detail = record.detail_json || {};
    const activityUrl = new URL("../activity/index.html", window.location.href);

    activityUrl.searchParams.set("query", record.record_id);
    typeElement.textContent = `${formatStatus(record.record_type)} Detail`;
    titleElement.textContent = record.primary_label || `${record.record_type} ${formatShortId(record.record_id)}`;
    copyElement.textContent = record.secondary_label || `Record ID: ${record.record_id}`;
    activityLink.href = activityUrl.href;

    summaryElement.replaceChildren(
        createSummaryCard("Status", formatStatus(record.status_label)),
        createSummaryCard("Activity records", record.activity_count),
        createSummaryCard("Created", formatDate(record.created_at)),
        createSummaryCard("Updated", formatDate(record.updated_at))
    );

    const rows = Object.entries(detail).map(([key, value]) => {
        const item = createElement("article", "admin-detail-card");
        const label = createElement("span", "summary-label", key.replaceAll("_", " "));
        const content = createElement("strong", "admin-detail-value", formatValue(value));

        item.append(label, content);
        return item;
    });

    detailGridElement.replaceChildren(...rows);
}

async function loadCurrentProfile() {
    return loadProtectedProfile({
        requireAdmin: true,
        statusElement,
        adminMessage: "Admin record details are only available to active platform admins.",
    });
}

async function initializeDetailPage() {
    const recordType = detailParams.get("type");
    const recordId = detailParams.get("id");
    const profile = await loadCurrentProfile();

    if (!profile) {
        return;
    }

    if (!recordType || !recordId) {
        setStatus("Open a record from admin search before viewing details.", "error");
        return;
    }

    setStatus("Loading record details...");

    const { data, error } = await supabase.rpc("get_admin_record_detail", {
        record_type_input: recordType,
        record_id_input: recordId,
    });

    if (error) {
        setStatus(error.message || "Record details could not be loaded.", "error");
        return;
    }

    const record = data?.[0];

    if (!record) {
        setStatus("No matching admin record was found.", "error");
        return;
    }

    shellElement.hidden = false;
    renderDetail(record);
    setStatus("");
}

await initializeDetailPage();
