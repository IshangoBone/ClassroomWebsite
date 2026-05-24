import { supabase } from "../../services/supabase/client.js";
import { qs } from "../utils/dom.js";

const onboardingForm = qs("[data-onboarding-form]");
const statusElement = qs("[data-onboarding-status]");

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function fillForm(profile) {
    onboardingForm.elements["legal-first-name"].value = profile.legal_first_name || "";
    onboardingForm.elements["legal-last-name"].value = profile.legal_last_name || "";
    onboardingForm.elements.username.value = profile.username || "";
    onboardingForm.elements["date-of-birth"].value = profile.date_of_birth || "";
    onboardingForm.elements["avatar-key"].value = profile.avatar_key || "bolt";
}

async function loadProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
        window.location.href = "./login.html";
        return null;
    }

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("legal_first_name, legal_last_name, username, date_of_birth, avatar_key, profile_completed")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();

    if (error || !profile) {
        setStatus("We could not load your profile setup. Please try again after signing in.", "error");
        return null;
    }

    if (profile.profile_completed) {
        window.location.href = "../dashboard/index.html";
        return null;
    }

    fillForm(profile);
    return authData.user;
}

const user = await loadProfile();

if (user) {
    onboardingForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const formData = new FormData(onboardingForm);
        const profileUpdates = {
            legal_first_name: String(formData.get("legal-first-name") || "").trim(),
            legal_last_name: String(formData.get("legal-last-name") || "").trim(),
            username: String(formData.get("username") || "").trim(),
            date_of_birth: String(formData.get("date-of-birth") || ""),
            avatar_type: "default",
            avatar_key: String(formData.get("avatar-key") || "bolt"),
            profile_completed: true,
        };

        if (!profileUpdates.legal_first_name || !profileUpdates.legal_last_name || !profileUpdates.username) {
            setStatus("Complete your name and choose a username before continuing.", "error");
            return;
        }

        setStatus("Saving your profile...", "info");

        const { data: updatedProfile, error } = await supabase
            .from("profiles")
            .update(profileUpdates)
            .eq("auth_user_id", user.id)
            .select("profile_completed")
            .single();

        if (error?.code === "23505") {
            setStatus("That username is already in use. Choose another username.", "error");
            return;
        }

        if (error) {
            setStatus(error.message, "error");
            return;
        }

        if (!updatedProfile.profile_completed) {
            setStatus("Your profile could not be completed. Please try again.", "error");
            return;
        }

        setStatus("Profile complete. Opening your dashboard...", "success");
        window.location.href = "../dashboard/index.html";
    });
}
