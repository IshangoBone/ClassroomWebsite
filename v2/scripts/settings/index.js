import { supabase } from "../../services/supabase/client.js";
import { loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { createProfileAvatar, getProfileDisplayName } from "../utils/profile-images.js";
import { setStatusMessage } from "../utils/ui-components.js";

const statusElement = qs("[data-settings-status]");
const detailsElement = qs("[data-settings-details]");
const editProfileButton = qs("[data-edit-profile-button]");
const cancelProfileEditButton = qs("[data-cancel-profile-edit-button]");
const profileForm = qs("[data-settings-profile-form]");
const avatarPreviewElement = qs("[data-settings-avatar-preview]");
const profilePhotoInput = profileForm.elements["profile-photo"];
const usernameInput = profileForm.elements.username;
const profilePhotoPreview = qs("[data-settings-photo-preview]");
const profilePhotoPreviewImage = qs("[data-settings-photo-preview-image]");
const profilePhotoPreviewName = qs("[data-settings-photo-preview-name]");
const resetButton = qs("[data-password-reset-button]");
const logoutButton = qs("[data-settings-logout-button]");
const profilePhotoBucket = "profile-photos";
const maxProfilePhotoSize = 10 * 1024 * 1024;
const allowedProfilePhotoTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const usernamePattern = /^[A-Za-z0-9]{3,40}$/;

let currentProfile = null;
let currentEmail = "";
let selectedProfilePhotoUrl = "";

function keepUsernameAlphanumeric(input) {
    const sanitized = String(input.value || "").replace(/[^A-Za-z0-9]/g, "");
    if (input.value !== sanitized) {
        input.value = sanitized;
    }
}

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
        ["Display name", getProfileDisplayName(profile, "Not set")],
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

function getFileExtension(file) {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension) {
        return extension.replace(/[^a-z0-9]/g, "");
    }

    return file.type.split("/").pop() || "image";
}

function getSafeFileName(file) {
    const extension = getFileExtension(file);
    const baseName = file.name
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "profile-photo";

    return `${Date.now()}-${baseName}.${extension}`;
}

function normalizeUsername(value) {
    return String(value || "")
        .trim()
        .replace(/^@+/, "")
        .replace(/\s+/g, "");
}

function validateProfilePhoto(file) {
    if (!file) {
        return "";
    }

    if (!allowedProfilePhotoTypes.has(file.type)) {
        return "Choose a PNG, JPEG, WebP, or GIF profile photo.";
    }

    if (file.size > maxProfilePhotoSize) {
        return "Choose a profile photo smaller than 10 MB.";
    }

    return "";
}

function clearProfilePhotoPreview() {
    if (selectedProfilePhotoUrl) {
        URL.revokeObjectURL(selectedProfilePhotoUrl);
        selectedProfilePhotoUrl = "";
    }

    profilePhotoPreview.hidden = true;
    profilePhotoPreviewImage.removeAttribute("src");
    profilePhotoPreviewName.textContent = "";
}

function showProfilePhotoPreview(file) {
    clearProfilePhotoPreview();

    if (!file) {
        return;
    }

    selectedProfilePhotoUrl = URL.createObjectURL(file);
    profilePhotoPreviewImage.src = selectedProfilePhotoUrl;
    profilePhotoPreviewName.textContent = file.name;
    profilePhotoPreview.hidden = false;
}

function renderAvatarPreview(profile) {
    avatarPreviewElement.replaceChildren(createProfileAvatar(profile, "profile-avatar profile-avatar--hero", "User"));
}

function populateProfileForm(profile) {
    profileForm.elements["legal-first-name"].value = profile.legal_first_name || "";
    profileForm.elements["legal-last-name"].value = profile.legal_last_name || "";
    profileForm.elements.username.value = profile.username || "";
    profilePhotoInput.value = "";
    clearProfilePhotoPreview();
    renderAvatarPreview(profile);
}

function setProfileEditorOpen(isOpen) {
    if (isOpen && !currentProfile) {
        return;
    }

    profileForm.hidden = !isOpen;
    editProfileButton.textContent = isOpen ? "Close editor" : "Edit profile";

    if (isOpen) {
        populateProfileForm(currentProfile);
        profileForm.elements["legal-first-name"].focus();
        setStatus("");
    }
}

async function uploadProfilePhoto(file, profile) {
    const storagePath = `${profile.id}/profile/${getSafeFileName(file)}`;
    const { error: uploadError } = await supabase.storage
        .from(profilePhotoBucket)
        .upload(storagePath, file, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false,
        });

    if (uploadError) {
        throw new Error(uploadError.message);
    }

    const { error: metadataError } = await supabase
        .from("files")
        .insert({
            owner_user_id: profile.id,
            original_file_name: file.name,
            display_name: "Profile photo",
            file_type: "profile_photo",
            mime_type: file.type,
            file_extension: getFileExtension(file),
            file_size: file.size,
            storage_bucket: profilePhotoBucket,
            storage_path: storagePath,
        });

    if (metadataError) {
        await supabase.storage.from(profilePhotoBucket).remove([storagePath]);
        throw new Error(metadataError.message);
    }

    return storagePath;
}

async function saveProfile(event) {
    event.preventDefault();

    const profilePhoto = profilePhotoInput.files?.[0];
    const profilePhotoError = validateProfilePhoto(profilePhoto);
    const profileUpdates = {
        legal_first_name: String(profileForm.elements["legal-first-name"].value || "").trim(),
        legal_last_name: String(profileForm.elements["legal-last-name"].value || "").trim(),
        username: normalizeUsername(profileForm.elements.username.value),
    };

    if (!profileUpdates.legal_first_name || !profileUpdates.legal_last_name || !profileUpdates.username) {
        setStatus("Add your name and username before saving.", "error");
        return;
    }

    if (!usernamePattern.test(profileUpdates.username)) {
        setStatus("Username must be 3–40 characters and contain only letters and numbers.", "error");
        return;
    }

    if (profilePhotoError) {
        setStatus(profilePhotoError, "error");
        return;
    }

    profileForm.querySelectorAll("button, input").forEach((control) => {
        control.disabled = true;
    });
    setStatus(profilePhoto ? "Uploading your profile photo..." : "Saving your profile...", "info");

    if (profilePhoto) {
        try {
            const storagePath = await uploadProfilePhoto(profilePhoto, currentProfile);
            profileUpdates.avatar_type = "uploaded";
            profileUpdates.avatar_key = storagePath;
            profileUpdates.profile_photo_url = storagePath;
        } catch (error) {
            profileForm.querySelectorAll("button, input").forEach((control) => {
                control.disabled = false;
            });
            setStatus(`Profile photo upload failed: ${error.message}`, "error");
            return;
        }
    }

    const { data: updatedProfile, error } = await supabase
        .from("profiles")
        .update(profileUpdates)
        .eq("id", currentProfile.id)
        .select("id, username, email, legal_first_name, legal_last_name, profile_photo_url, avatar_type, avatar_key, platform_role, account_status, profile_completed")
        .single();

    profileForm.querySelectorAll("button, input").forEach((control) => {
        control.disabled = false;
    });

    if (error?.code === "23505") {
        setStatus("That username is already in use. Choose another username.", "error");
        return;
    }

    if (error?.code === "23514") {
        setStatus("Username must contain only letters and numbers.", "error");
        return;
    }

    if (error) {
        setStatus(error.message || "Profile changes could not be saved.", "error");
        return;
    }

    currentProfile = updatedProfile;
    renderDetails(currentProfile, currentEmail);
    populateProfileForm(currentProfile);
    setProfileEditorOpen(false);
    setStatus("Profile updated.", "success");
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
        profileColumns: "id, username, email, legal_first_name, legal_last_name, profile_photo_url, avatar_type, avatar_key, platform_role, account_status, profile_completed",
        statusElement,
    });

    if (!profile) {
        return;
    }

    const { data } = await supabase.auth.getUser();

    currentProfile = profile;
    currentEmail = data?.user?.email || profile.email || "";
    renderDetails(currentProfile, currentEmail);
    populateProfileForm(currentProfile);
    setStatus("");
}

editProfileButton.addEventListener("click", () => {
    setProfileEditorOpen(profileForm.hidden);
});
cancelProfileEditButton.addEventListener("click", () => {
    setProfileEditorOpen(false);
});
profilePhotoInput.addEventListener("change", () => {
    const file = profilePhotoInput.files?.[0];
    const validationError = validateProfilePhoto(file);

    if (validationError) {
        profilePhotoInput.value = "";
        clearProfilePhotoPreview();
        setStatus(validationError, "error");
        return;
    }

    showProfilePhotoPreview(file);
    setStatus(file ? "Profile photo ready to upload when you save." : "", "info");
});
profileForm.addEventListener("submit", saveProfile);
usernameInput.addEventListener("input", () => keepUsernameAlphanumeric(usernameInput));
resetButton.addEventListener("click", sendPasswordReset);
logoutButton.addEventListener("click", logOut);
initSettings();
