import { supabase } from "../../services/supabase/client.js";
import { qs } from "../utils/dom.js";

const onboardingForm = qs("[data-onboarding-form]");
const statusElement = qs("[data-onboarding-status]");
const profilePhotoInput = onboardingForm.elements["profile-photo"];
const profilePhotoPreview = qs("[data-profile-photo-preview]");
const profilePhotoPreviewImage = qs("[data-profile-photo-preview-image]");
const profilePhotoPreviewName = qs("[data-profile-photo-preview-name]");
const profilePhotoBucket = "profile-photos";
const maxProfilePhotoSize = 10 * 1024 * 1024;
const allowedProfilePhotoTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
let selectedProfilePhotoUrl = "";

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function fillForm(profile) {
    onboardingForm.elements["legal-first-name"].value = profile.legal_first_name || "";
    onboardingForm.elements["legal-last-name"].value = profile.legal_last_name || "";
    onboardingForm.elements.username.value = profile.username || "";
    onboardingForm.elements["date-of-birth"].value = profile.date_of_birth || "";

    if (profile.avatar_type === "default") {
        onboardingForm.elements["avatar-key"].value = profile.avatar_key || "bolt";
    }
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

function clearProfilePhotoPreview() {
    if (selectedProfilePhotoUrl) {
        URL.revokeObjectURL(selectedProfilePhotoUrl);
        selectedProfilePhotoUrl = "";
    }

    profilePhotoPreview.hidden = true;
    profilePhotoPreviewImage.removeAttribute("src");
    profilePhotoPreviewName.textContent = "";
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

async function loadProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
        window.location.href = "./login.html";
        return null;
    }

    const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, legal_first_name, legal_last_name, username, date_of_birth, avatar_type, avatar_key, profile_completed")
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
    return { authUser: authData.user, profile };
}

const loadedSession = await loadProfile();

if (profilePhotoInput) {
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
}

if (loadedSession) {
    onboardingForm.addEventListener("submit", async (event) => {
        event.preventDefault();

        const formData = new FormData(onboardingForm);
        const profilePhoto = profilePhotoInput?.files?.[0];
        const profilePhotoError = validateProfilePhoto(profilePhoto);
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

        if (profilePhotoError) {
            setStatus(profilePhotoError, "error");
            return;
        }

        setStatus("Saving your profile...", "info");

        if (profilePhoto) {
            try {
                setStatus("Uploading your profile photo...", "info");
                const storagePath = await uploadProfilePhoto(profilePhoto, loadedSession.profile);
                profileUpdates.avatar_type = "uploaded";
                profileUpdates.avatar_key = storagePath;
                profileUpdates.profile_photo_url = storagePath;
            } catch (error) {
                setStatus(`Profile photo upload failed: ${error.message}`, "error");
                return;
            }
        }

        const { data: updatedProfile, error } = await supabase
            .from("profiles")
            .update(profileUpdates)
            .eq("auth_user_id", loadedSession.authUser.id)
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
