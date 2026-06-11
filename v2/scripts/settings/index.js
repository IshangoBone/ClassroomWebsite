import { supabase } from "../../services/supabase/client.js";
import { loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { setStatusMessage } from "../utils/ui-components.js";

const statusElement = qs("[data-settings-status]");
const detailsElement = qs("[data-settings-details]");
const resetButton = qs("[data-password-reset-button]");
const logoutButton = qs("[data-settings-logout-button]");

let currentProfile = null;
let currentEmail = "";

function formatStatus(status) {
    return String(status || "active")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatRole(role) {
    if (role === "supreme_admin") {
        return "Supreme admin";
    }

    if (role === "admin") {
        return "Admin";
    }

    if (role === "teacher") {
        return "Teacher";
    }

    return "Student";
}

function setStatus(message = "", tone = "") {
    setStatusMessage(statusElement, message, tone);
}

function renderDetails(profile, email) {
    const rows = [
        ["Email", email || profile.email || "Not available"],
        ["Username", profile.username ? `@${profile.username}` : "Not set"],
        ["Role", formatRole(profile.platform_role)],
        ["Account status", formatStatus(profile.account_status)],
    ];

    detailsElement.replaceChildren(...rows.map(([label, value]) => {
        const row = createElement("div", "profile-detail-row");
        row.append(
            createElement("dt", "profile-detail-label", label),
            createElement("dd", "profile-detail-value", value)
        );
        return row;
    }));
}

async function sendPasswordReset() {
    if (!currentEmail) {
        setStatus("No email address is available for this account.", "error");
        return;
    }

    resetButton.disabled = true;
    setStatus("Sending password reset email...");

    const redirectTo = `${window.location.origin}${window.location.pathname.replace("/pages/settings/index.html", "/pages/auth/reset-password.html")}`;
    const { error } = await supabase.auth.resetPasswordForEmail(currentEmail, { redirectTo });

    resetButton.disabled = false;

    if (error) {
        setStatus(error.message || "Password reset email could not be sent.", "error");
        return;
    }

    setStatus("Password reset email sent.", "success");
}

async function logOut() {
    logoutButton.disabled = true;
    setStatus("Logging out...");

    const { error } = await supabase.auth.signOut();

    if (error) {
        logoutButton.disabled = false;
        setStatus(error.message || "You could not be logged out.", "error");
        return;
    }

    window.location.href = "../auth/login.html";
}

async function initSettings() {
    const profile = await loadProtectedProfile({
        profileColumns: "id, username, email, platform_role, account_status, profile_completed",
        statusElement,
    });

    if (!profile) {
        return;
    }

    const { data } = await supabase.auth.getUser();

    currentProfile = profile;
    currentEmail = data?.user?.email || profile.email || "";
    renderDetails(currentProfile, currentEmail);
    setStatus("");
}

resetButton.addEventListener("click", sendPasswordReset);
logoutButton.addEventListener("click", logOut);
initSettings();
