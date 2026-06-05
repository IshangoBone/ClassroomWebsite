import { supabase } from "../../services/supabase/client.js";
import { createElement } from "./dom.js";

const profilePhotoBucket = "profile-photos";

export function getProfileDisplayName(profile, fallback = "User") {
    const fullName = [profile?.legal_first_name, profile?.legal_last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || profile?.username || profile?.email || fallback;
}

export function getProfileInitials(profile, fallback = "U") {
    const displayName = getProfileDisplayName(profile, fallback);
    const initials = displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");

    return initials || fallback.charAt(0).toUpperCase();
}

export async function getProfilePhotoUrl(profile) {
    const storagePath = profile?.profile_photo_url || (profile?.avatar_type === "uploaded" ? profile?.avatar_key : "");

    if (!storagePath) {
        return "";
    }

    const { data, error } = await supabase.storage
        .from(profilePhotoBucket)
        .createSignedUrl(storagePath, 60 * 60);

    if (error) {
        console.warn("Profile photo could not be loaded:", error.message);
        return "";
    }

    return data?.signedUrl || "";
}

export function createProfileAvatar(profile, className = "profile-avatar", fallback = "User") {
    const avatar = createElement("span", className, getProfileInitials(profile, fallback));
    const displayName = getProfileDisplayName(profile, fallback);

    avatar.setAttribute("aria-label", `${displayName} profile photo`);

    getProfilePhotoUrl(profile).then((photoUrl) => {
        if (!photoUrl) {
            return;
        }

        avatar.textContent = "";
        avatar.style.backgroundImage = `url("${photoUrl}")`;
        avatar.dataset.hasImage = "true";
    });

    return avatar;
}
