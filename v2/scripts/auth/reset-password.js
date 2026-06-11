import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";
import { notifyStatus } from "../utils/ui-components.js";

const resetForm = qs("[data-reset-password-form]");
const statusElement = qs("[data-reset-password-status]");
let feedback = null;

function createFeedback() {
    if (feedback) {
        return feedback;
    }

    const shell = createElement("div", "auth-feedback-shell");
    const panel = createElement("section", "auth-feedback-panel");
    const icon = createElement("div", "auth-feedback-icon");
    const title = createElement("h3", "auth-feedback-title");
    const message = createElement("p", "auth-feedback-message");
    const action = createElement("a", "secondary-button auth-feedback-close", "Return to login");

    shell.hidden = true;
    shell.dataset.authFeedback = "true";
    shell.setAttribute("role", "status");
    shell.setAttribute("aria-live", "polite");
    panel.setAttribute("aria-label", "Password reset status");
    icon.setAttribute("aria-hidden", "true");
    action.href = "./login.html";

    panel.append(icon, title, message, action);
    shell.append(panel);
    document.body.append(shell);

    feedback = { shell, title, message, action };
    return feedback;
}

function showFeedback({ title, message, tone = "info", loading = false, actionHidden = false }) {
    const popup = createFeedback();

    popup.shell.hidden = false;
    popup.shell.dataset.tone = tone;
    popup.shell.dataset.loading = String(loading);
    popup.title.textContent = title;
    popup.message.textContent = message;
    popup.action.hidden = actionHidden;
}

function hideFeedback() {
    if (!feedback) {
        return;
    }

    feedback.shell.hidden = true;
    feedback.shell.dataset.loading = "false";
}

function setStatus(message, tone = "info") {
    if (!statusElement) {
        return;
    }

    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
    notifyStatus(message, tone, {
        toast: true,
        duration: tone === "info" ? 3000 : undefined,
    });
}

function setFormBusy(isBusy) {
    const button = qs("button[type='submit']", resetForm);

    [...resetForm.elements].forEach((element) => {
        element.disabled = isBusy;
    });

    if (!button) {
        return;
    }

    if (!button.dataset.defaultText) {
        button.dataset.defaultText = button.textContent;
    }

    button.dataset.loading = String(isBusy);
    button.textContent = isBusy ? "Saving password..." : button.dataset.defaultText;
}

function readAuthRedirectError() {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));

    return url.searchParams.get("error_description")
        || hashParams.get("error_description")
        || url.searchParams.get("error")
        || hashParams.get("error");
}

function cleanResetUrl() {
    if (!window.history.replaceState) {
        return;
    }

    window.history.replaceState({}, document.title, window.location.pathname);
}

const redirectError = readAuthRedirectError();

if (redirectError) {
    setStatus(redirectError, "error");
    showFeedback({
        title: "Reset link issue",
        message: redirectError,
        tone: "error",
    });
    cleanResetUrl();
} else {
    setStatus("Enter a new password to finish resetting your account.", "info");
}

resetForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(resetForm);
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (!password || !confirmPassword) {
        setStatus("Enter and confirm your new password.", "error");
        return;
    }

    if (password.length < 6) {
        setStatus("Use at least 6 characters for your new password.", "error");
        return;
    }

    if (password !== confirmPassword) {
        setStatus("The passwords do not match yet.", "error");
        return;
    }

    setFormBusy(true);
    showFeedback({
        title: "Saving password",
        message: "Updating your account with the new password.",
        loading: true,
        actionHidden: true,
    });
    setStatus("Saving your new password...", "info");

    const { error } = await supabase.auth.updateUser({ password });

    setFormBusy(false);

    if (error) {
        hideFeedback();
        setStatus(error.message, "error");
        return;
    }

    resetForm.reset();
    cleanResetUrl();
    showFeedback({
        title: "Password updated",
        message: "Your password has been reset. You can now log in with the new password.",
        tone: "success",
    });
    setStatus("Password updated. You can now log in.", "success");
});
