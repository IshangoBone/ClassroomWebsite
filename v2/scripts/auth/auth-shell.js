import { supabase } from "../../services/supabase/client.js";
import { supabaseConfig } from "../../services/supabase/config.js";
import { createElement, qs } from "../utils/dom.js";
import { notifyStatus } from "../utils/ui-components.js";

const authModes = {
    login: {
        title: "Welcome back",
        copy: "Use your email and password, or switch to sign up if this is your first time in CodeTheCurrent.",
    },
    signup: {
        title: "Create your account",
        copy: "Set up your account here, then we’ll carry you into onboarding and profile setup next.",
    },
};

const activeMode = document.body.dataset.authMode || "login";
const toggleButtons = [...document.querySelectorAll("[data-auth-switch]")];
const panels = [...document.querySelectorAll("[data-auth-panel]")];
const googleButton = qs("[data-google-button]");
const headingElement = qs(".auth-card-title");
const copyElement = qs(".auth-card-copy");
const loginForm = qs("[data-login-form]");
const signupForm = qs("[data-signup-form]");
let authFeedback = null;
const googleOAuthEnabled = supabaseConfig.googleOAuthEnabled === true;
const googleOAuthDisabledMessage = [
    "Google sign-in is not enabled for this Supabase project yet.",
    "Enable Google OAuth in Supabase, then set googleOAuthEnabled to true in config.js.",
].join(" ");

function getLoginRedirectUrl() {
    const redirectUrl = new URL("./login.html", window.location.href);
    redirectUrl.searchParams.set("confirmed", "1");
    return redirectUrl.href;
}

function isDuplicateSignupResponse(data) {
    return data?.user
        && Array.isArray(data.user.identities)
        && data.user.identities.length === 0;
}

function getAuthFeedback() {
    if (authFeedback) {
        return authFeedback;
    }

    const shell = createElement("div", "auth-feedback-shell");
    const panel = createElement("section", "auth-feedback-panel");
    const icon = createElement("div", "auth-feedback-icon");
    const title = createElement("h3", "auth-feedback-title");
    const message = createElement("p", "auth-feedback-message");
    const closeButton = createElement("button", "secondary-button auth-feedback-close", "Close");

    shell.dataset.authFeedback = "true";
    shell.hidden = true;
    shell.setAttribute("role", "status");
    shell.setAttribute("aria-live", "polite");
    panel.setAttribute("aria-label", "Authentication status");
    icon.setAttribute("aria-hidden", "true");
    closeButton.type = "button";
    closeButton.addEventListener("click", () => hideAuthFeedback());

    panel.append(icon, title, message, closeButton);
    shell.append(panel);
    document.body.append(shell);

    authFeedback = { shell, panel, icon, title, message, closeButton };
    return authFeedback;
}

function showAuthFeedback({ title, message, tone = "info", loading = false, dismissible = false }) {
    const feedback = getAuthFeedback();

    feedback.shell.hidden = false;
    feedback.shell.dataset.tone = tone;
    feedback.shell.dataset.loading = String(loading);
    feedback.title.textContent = title;
    feedback.message.textContent = message;
    feedback.closeButton.hidden = !dismissible;
}

function hideAuthFeedback() {
    if (!authFeedback) {
        return;
    }

    authFeedback.shell.hidden = true;
    authFeedback.shell.dataset.loading = "false";
}

function setFormBusy(form, isBusy, label) {
    if (!form) {
        return;
    }

    const button = qs("button[type='submit']", form);

    [...form.elements].forEach((element) => {
        element.disabled = isBusy;
    });

    if (!button) {
        return;
    }

    if (!button.dataset.defaultText) {
        button.dataset.defaultText = button.textContent;
    }

    button.dataset.loading = String(isBusy);
    button.textContent = isBusy ? label : button.dataset.defaultText;
}

async function logAuthActivity(actionType, profile, mode) {
    const { error } = await supabase.rpc("log_activity", {
        action_type_input: actionType,
        target_type_input: "user",
        target_id_input: profile.id,
        metadata_json_input: {
            source: "auth_shell",
            mode,
            profile_completed: profile.profile_completed,
        },
    });

    if (error) {
        console.warn("Activity logging failed:", error.message);
    }
}

async function continueFromAuth(user, mode) {
    const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, profile_completed")
        .eq("auth_user_id", user.id)
        .maybeSingle();

    if (error) {
        hideAuthFeedback();
        setFormBusy(loginForm, false);
        setFormBusy(signupForm, false);
        setStatus(mode, "Your account is ready, but profile setup could not be loaded yet.", "error");
        return;
    }

    if (!profile) {
        hideAuthFeedback();
        setFormBusy(loginForm, false);
        setFormBusy(signupForm, false);
        setStatus(mode, "Your account is ready, but its profile record has not been created yet.", "error");
        return;
    }

    await logAuthActivity("user_login", profile, mode);

    window.location.href = profile.profile_completed
        ? "../dashboard/index.html"
        : "./onboarding.html";
}

function setStatus(mode, message, tone = "info") {
    const statusElement = qs(`[data-auth-status="${mode}"]`);

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

function clearInactiveStatuses(mode) {
    ["login", "signup"]
        .filter((item) => item !== mode)
        .forEach((item) => {
            const statusElement = qs(`[data-auth-status="${item}"]`);

            if (!statusElement) {
                return;
            }

            statusElement.textContent = "";
            statusElement.dataset.tone = "info";
        });
}

function cleanAuthUrl() {
    if (!window.history.replaceState) {
        return;
    }

    const cleanUrl = new URL(window.location.href);
    const hashParams = new URLSearchParams(cleanUrl.hash.replace(/^#/, ""));
    const shouldClearHash = hashParams.has("type")
        || hashParams.has("error")
        || hashParams.has("error_description")
        || hashParams.has("access_token")
        || hashParams.has("refresh_token");

    [
        "confirmed",
        "error",
        "error_code",
        "error_description",
        "type",
    ].forEach((param) => cleanUrl.searchParams.delete(param));

    window.history.replaceState(
        {},
        document.title,
        cleanUrl.pathname + cleanUrl.search + (shouldClearHash ? "" : cleanUrl.hash)
    );
}

function handleAuthRedirectState() {
    const url = new URL(window.location.href);
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    const authError = url.searchParams.get("error_description")
        || hashParams.get("error_description")
        || url.searchParams.get("error")
        || hashParams.get("error");
    const isConfirmed = url.searchParams.get("confirmed") === "1"
        || url.searchParams.get("type") === "signup"
        || hashParams.get("type") === "signup";

    if (authError) {
        setAuthMode("login");
        setStatus("login", authError, "error");
        showAuthFeedback({
            title: "Confirmation link issue",
            message: authError,
            tone: "error",
            dismissible: true,
        });
        cleanAuthUrl();
        return;
    }

    if (!isConfirmed) {
        return;
    }

    setAuthMode("login");
    setStatus("login", "Your account has been confirmed. You can now sign in.", "success");
    showAuthFeedback({
        title: "Account confirmed",
        message: "Your email is confirmed. Sign in to finish setting up your workspace.",
        tone: "success",
        dismissible: true,
    });
    cleanAuthUrl();
}

function setAuthMode(mode) {
    document.body.dataset.authMode = mode;

    toggleButtons.forEach((button) => {
        const isActive = button.dataset.authSwitch === mode;
        button.setAttribute("aria-selected", String(isActive));
        button.dataset.active = String(isActive);
    });

    panels.forEach((panel) => {
        panel.hidden = panel.dataset.authPanel !== mode;
    });

    headingElement.textContent = authModes[mode].title;
    copyElement.textContent = authModes[mode].copy;

    clearInactiveStatuses(mode);
}

toggleButtons.forEach((button) => {
    button.addEventListener("click", () => {
        setAuthMode(button.dataset.authSwitch);
    });
});

if (googleButton) {
    googleButton.addEventListener("click", async () => {
        const mode = document.body.dataset.authMode || "login";

        if (!googleOAuthEnabled) {
            setStatus(mode, googleOAuthDisabledMessage, "error");
            return;
        }

        setStatus(mode, "Opening Google sign-in...", "info");

        const { error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: new URL("./onboarding.html", window.location.href).href,
            },
        });

        if (error) {
            setStatus(mode, error.message, "error");
        }
    });
}

if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const formData = new FormData(loginForm);
        const email = String(formData.get("email") || "").trim();
        const password = String(formData.get("password") || "");

        if (!email || !password) {
            setStatus("login", "Enter both your email and password before logging in.", "error");
            return;
        }

        setFormBusy(loginForm, true, "Logging in...");
        showAuthFeedback({
            title: "Logging you in",
            message: "Checking your account and loading your workspace.",
            loading: true,
        });
        setStatus("login", "Checking your account...", "info");

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setFormBusy(loginForm, false);
            hideAuthFeedback();
            setStatus("login", error.message, "error");
            return;
        }

        showAuthFeedback({
            title: "Login successful",
            message: "Your account is ready. Opening your workspace now.",
            tone: "success",
            loading: true,
        });
        setStatus("login", "Login worked. Loading your profile...", "success");
        await continueFromAuth(data.user, "login");
    });
}

if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const formData = new FormData(signupForm);
        const email = String(formData.get("email") || "").trim();
        const password = String(formData.get("password") || "");

        if (!email || !password) {
            setStatus("signup", "Fill out your email and password to create the account.", "error");
            return;
        }

        setFormBusy(signupForm, true, "Creating account...");
        showAuthFeedback({
            title: "Creating your account",
            message: "Setting up your login and preparing your profile.",
            loading: true,
        });
        setStatus("signup", "Creating your account...", "info");

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: getLoginRedirectUrl(),
            },
        });

        if (error) {
            setFormBusy(signupForm, false);
            hideAuthFeedback();
            setStatus("signup", error.message, "error");
            return;
        }

        setFormBusy(signupForm, false);

        if (isDuplicateSignupResponse(data)) {
            showAuthFeedback({
                title: "Account already exists",
                message: "This email already has an account. Log in instead, or reset your password if you need help getting back in.",
                tone: "error",
                dismissible: true,
            });
            setStatus("signup", "This account already exists. Switch to Log In to continue.", "error");
            return;
        }

        signupForm.reset();

        if (!data.session) {
            showAuthFeedback({
                title: "Account created",
                message: "Check your email to confirm your account, then log in to finish setup.",
                tone: "success",
                dismissible: true,
            });
            setStatus(
                "signup",
                "Account created. Check your email to confirm your account, then log in to finish setup.",
                "success"
            );
            return;
        }

        showAuthFeedback({
            title: "Account created",
            message: "Your account is ready. Opening profile setup now.",
            tone: "success",
            loading: true,
        });
        setStatus("signup", "Account created. Loading profile setup...", "success");
        await continueFromAuth(data.user, "signup");
    });
}

setAuthMode(activeMode);
handleAuthRedirectState();
