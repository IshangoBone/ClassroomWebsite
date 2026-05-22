import { supabase } from "../../services/supabase/client.js";
import { qs } from "../utils/dom.js";

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

function setStatus(mode, message, tone = "info") {
    const statusElement = qs(`[data-auth-status="${mode}"]`);

    if (!statusElement) {
        return;
    }

    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
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
    googleButton.addEventListener("click", () => {
        setStatus(
            document.body.dataset.authMode || "login",
            "Google sign-in is the next auth polish step once the Google OAuth credentials are connected.",
            "info"
        );
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

        setStatus("login", "Checking your account...", "info");

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setStatus("login", error.message, "error");
            return;
        }

        setStatus("login", "Login worked. Next we’ll route this into the V2 dashboard.", "success");
        loginForm.reset();
    });
}

if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const formData = new FormData(signupForm);
        const fullName = String(formData.get("full-name") || "").trim();
        const email = String(formData.get("email") || "").trim();
        const password = String(formData.get("password") || "");

        if (!fullName || !email || !password) {
            setStatus("signup", "Fill out your full name, email, and password to create the account.", "error");
            return;
        }

        setStatus("signup", "Creating your account...", "info");

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: fullName,
                },
            },
        });

        if (error) {
            setStatus("signup", error.message, "error");
            return;
        }

        setStatus(
            "signup",
            "Account created. Next we’ll connect this into onboarding and confirmation messaging.",
            "success"
        );
        signupForm.reset();
    });
}

setAuthMode(activeMode);
