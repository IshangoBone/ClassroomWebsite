import { supabase } from "../../services/supabase/client.js";

export function isPlatformAdmin(role) {
    return role === "admin" || role === "supreme_admin";
}

export function isActiveProfile(profile) {
    return profile?.account_status === "active";
}

function applyStatus(statusElement, message, tone = "error") {
    if (!statusElement) {
        return;
    }

    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

export async function loadProtectedProfile({
    loginPath = "../auth/login.html",
    onboardingPath = "../auth/onboarding.html",
    profileColumns = "id, profile_completed, platform_role, account_status",
    requireAdmin = false,
    statusElement = null,
    inactiveMessage = "Your account is not active. Please contact support if you need access.",
    adminMessage = "This page is only available to active platform admins.",
    profileMessage = "Your profile could not be loaded. Please sign in again.",
} = {}) {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
        window.location.href = loginPath;
        return null;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select(profileColumns)
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();

    if (profileError || !profile) {
        applyStatus(statusElement, profileMessage);
        return null;
    }

    if (!profile.profile_completed) {
        window.location.href = onboardingPath;
        return null;
    }

    if (!isActiveProfile(profile)) {
        applyStatus(statusElement, inactiveMessage);
        return null;
    }

    if (requireAdmin && !isPlatformAdmin(profile.platform_role)) {
        applyStatus(statusElement, adminMessage);
        return null;
    }

    return profile;
}
