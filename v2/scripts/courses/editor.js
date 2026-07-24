import { supabase } from "../../services/supabase/client.js";
import { loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { createModalShell, notifyStatus } from "../utils/ui-components.js";

const params = new URLSearchParams(window.location.search);
const courseId = params.get("course");
const headingElement = qs("[data-course-heading]");
const statusElement = qs("[data-course-status]");
const contentSections = [...document.querySelectorAll("[data-course-content]")];
const tabButtons = [...document.querySelectorAll("[data-teacher-course-tab-button]")];
const tabPanels = [...document.querySelectorAll("[data-teacher-course-tab-panel]")];
const announcementForm = qs("[data-teacher-announcement-form]");
const saveAnnouncementDraftButton = qs("[data-save-announcement-draft]");
const publishAnnouncementButton = qs("[data-publish-announcement]");
const cancelAnnouncementEditButton = qs("[data-cancel-announcement-edit]");
const announcementList = qs("[data-teacher-announcement-list]");
const editorForm = qs("[data-course-editor-form]");
const pacingForm = qs("[data-course-pacing-form]");
const moduleCount = qs("[data-module-count]");
const lessonCount = qs("[data-lesson-count]");
const moduleList = qs("[data-module-list]");
const moduleForm = qs("[data-module-form]");
const moduleFormHeading = qs("[data-module-form-heading]");
const moduleSubmitButton = qs("[data-module-submit]");
const addModuleButton = qs("[data-toggle-module-form]");
const cancelModuleButton = qs("[data-cancel-module-form]");
const lessonForm = qs("[data-lesson-form]");
const lessonFormHeading = qs("[data-lesson-form-heading]");
const cancelLessonButton = qs("[data-cancel-lesson-form]");
const lessonFormHome = document.createComment("lesson form home");
const courseVisibility = qs("[data-course-visibility]");
const publicCourseCopy = qs("[data-public-course-copy]");
const courseDiscoverySelect = qs("[data-course-discovery-select]");
const toggleCourseVisibilityButton = qs("[data-toggle-course-visibility]");
const copyPublicCourseLinkButton = qs("[data-copy-public-course-link]");
const coursePreviewLink = qs("[data-course-preview-link]");
const archiveCourseButton = qs("[data-archive-course]");
const deleteCourseButton = qs("[data-delete-course]");
const courseClassroomList = qs("[data-course-classroom-list]");
const courseClassroomForm = qs("[data-course-classroom-form]");
const courseClassroomFormHeading = qs("[data-course-classroom-form-heading]");
const courseClassroomFormCopy = qs("[data-course-classroom-form-copy]");
const courseClassroomSubmitButton = qs("[data-course-classroom-submit]");
const addCourseClassroomButton = qs("[data-toggle-course-classroom-form]");
const cancelCourseClassroomButton = qs("[data-cancel-course-classroom-form]");
const courseThumbnailInput = editorForm.elements["course-thumbnail"];
const courseThumbnailPreview = qs("[data-course-thumbnail-preview]");
const courseThumbnailPreviewImage = qs("[data-course-thumbnail-preview-image]");
const courseThumbnailPreviewName = qs("[data-course-thumbnail-preview-name]");

lessonForm.after(lessonFormHome);

const courseSelectColumns = [
    "id",
    "owner_user_id",
    "title",
    "description",
    "subject_area",
    "estimated_length",
    "thumbnail_url",
    "thumbnail_type",
    "status",
    "is_publicly_discoverable",
    "lesson_release_mode",
    "lesson_release_start_date",
    "lesson_release_interval_days",
].join(", ");
const courseThumbnailBucket = "course-public-assets";
const maxCourseThumbnailSize = 10 * 1024 * 1024;
const allowedCourseThumbnailTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const dragAutoScrollEdge = 82;
const dragAutoScrollMaxSpeed = 18;
let loadedModules = [];
let loadedLessons = [];
let loadedContentBlocks = [];
let loadedQuestions = [];
let loadedAnnouncements = [];
let loadedCourseClassrooms = [];
let loadedCourse = null;
let currentProfile = null;
let selectedCourseThumbnailUrl = "";
let editingAnnouncementId = "";
const collapsedModuleIds = new Set();
let hasAppliedInitialModuleCollapse = false;
let dragAutoScrollFrame = null;
let dragAutoScrollSpeed = 0;
let isReorderDragActive = false;
let activeReorderDrag = null;
let courseClassroomInsights = new Map();
let courseClassroomInsightsWarning = false;
const validCourseTabs = new Set(["setup", "content", "announcements", "classrooms", "gradebook"]);

function getCourseTabStorageKey() {
    return `brainkernl:teacher-course-tab:${courseId || "new"}`;
}

function getInitialTabName() {
    const hashTab = window.location.hash.replace(/^#/, "");

    if (validCourseTabs.has(hashTab)) {
        return hashTab;
    }

    const storedTab = window.localStorage.getItem(getCourseTabStorageKey());
    return validCourseTabs.has(storedTab) ? storedTab : "setup";
}

const moduleActionIcons = {
    chevron: '<path d="m6 9 6 6 6-6"></path>',
    edit: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"></path>',
    hammer: '<path d="m15 12-8.5 8.5a2.12 2.12 0 0 1-3-3L12 9"></path><path d="M17.64 15 22 10.64"></path><path d="m20.91 11.7-1.25-1.25a2.12 2.12 0 0 1 0-3l.39-.39-3.11-3.11-.39.39a2.12 2.12 0 0 1-3 0L12.3 3.09 8 7.39l1.25 1.25a2.12 2.12 0 0 1 0 3l-.39.39 3.11 3.11.39-.39a2.12 2.12 0 0 1 3 0l1.25 1.25"></path>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>',
    unlock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>',
    plus: '<path d="M12 5v14"></path><path d="M5 12h14"></path>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"></path><path d="M22 2 11 13"></path>',
    trash: '<path d="M3 6h18"></path><path d="M8 6V4h8v2"></path><path d="M19 6l-1 14H6L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path>',
};

function createModuleIcon(name) {
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 24 24");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");
    icon.innerHTML = moduleActionIcons[name] || "";
    return icon;
}

function createModuleIconButton(iconName, label, modifiers = []) {
    const modifierClasses = modifiers.map((modifier) => ` module-icon-button--${modifier}`).join("");
    const button = createElement("button", `module-icon-button${modifierClasses}`);

    button.type = "button";
    button.setAttribute("aria-label", label);
    button.dataset.tooltip = label;
    button.append(createModuleIcon(iconName));

    return button;
}

function createModuleIconLink(iconName, label, href, modifiers = []) {
    const modifierClasses = modifiers.map((modifier) => ` module-icon-button--${modifier}`).join("");
    const link = createElement("a", `module-icon-button${modifierClasses}`);

    link.href = href;
    link.setAttribute("aria-label", label);
    link.dataset.tooltip = label;
    link.append(createModuleIcon(iconName));

    return link;
}

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
    notifyStatus(message, tone);
}

function confirmInApp({ title, message, confirmLabel = "Confirm", destructive = false } = {}) {
    return new Promise((resolve) => {
        const previousFocus = document.activeElement;
        const body = createElement("p", "", message || "Are you sure you want to continue?");
        const cancelButton = createElement("button", "secondary-button", "Cancel");
        const confirmButton = createElement(
            "button",
            destructive ? "secondary-button destructive-button" : "primary-button",
            confirmLabel
        );
        let overlay = null;
        let settled = false;

        function close(value) {
            if (settled) {
                return;
            }

            settled = true;
            document.removeEventListener("keydown", handleKeydown);
            overlay?.remove();
            previousFocus?.focus?.();
            resolve(value);
        }

        function handleKeydown(event) {
            if (event.key === "Escape") {
                close(false);
            }
        }

        cancelButton.type = "button";
        confirmButton.type = "button";
        cancelButton.addEventListener("click", () => close(false));
        confirmButton.addEventListener("click", () => close(true));

        overlay = createModalShell({
            title,
            body,
            actions: [cancelButton, confirmButton],
        });
        overlay.addEventListener("click", (event) => {
            if (event.target === overlay) {
                close(false);
            }
        });

        document.body.append(overlay);
        document.addEventListener("keydown", handleKeydown);
        cancelButton.focus();
    });
}

function showContent() {
    contentSections.forEach((section) => {
        section.hidden = false;
    });
}

function setActiveTab(tabName) {
    const nextTabName = validCourseTabs.has(tabName) ? tabName : "setup";

    tabButtons.forEach((button) => {
        const isActive = button.dataset.teacherCourseTabButton === nextTabName;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-selected", String(isActive));
    });

    tabPanels.forEach((panel) => {
        panel.hidden = panel.dataset.teacherCourseTabPanel !== nextTabName;
    });

    window.localStorage.setItem(getCourseTabStorageKey(), nextTabName);
    if (window.location.hash !== `#${nextTabName}`) {
        window.history.replaceState(null, "", `#${nextTabName}`);
    }
}

function fillCourseForm(course) {
    editorForm.elements.title.value = course.title || "";
    editorForm.elements["subject-area"].value = course.subject_area || "";
    editorForm.elements["estimated-length"].value = course.estimated_length || "";
    editorForm.elements.description.value = course.description || "";

    if (course.thumbnail_url) {
        courseThumbnailPreviewImage.src = course.thumbnail_url;
        courseThumbnailPreviewName.textContent = "Current course thumbnail";
        courseThumbnailPreview.hidden = false;
    }
}

function fillPacingForm(course) {
    if (!pacingForm) {
        return;
    }

    pacingForm.elements["pacing-enabled"].checked = course.lesson_release_mode === "daily";
    pacingForm.elements["release-start-date"].value = course.lesson_release_start_date || "";
    pacingForm.elements["release-interval-days"].value = String(course.lesson_release_interval_days || 1);
}

function getFileExtension(file) {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension) {
        return extension.replace(/[^a-z0-9]/g, "");
    }

    return file.type.split("/").pop() || "image";
}

function getSafeFileName(file, fallbackName) {
    const extension = getFileExtension(file);
    const baseName = file.name
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || fallbackName;

    return `${Date.now()}-${baseName}.${extension}`;
}

function clearCourseThumbnailPreview() {
    if (selectedCourseThumbnailUrl) {
        URL.revokeObjectURL(selectedCourseThumbnailUrl);
        selectedCourseThumbnailUrl = "";
    }

    if (!loadedCourse?.thumbnail_url) {
        courseThumbnailPreview.hidden = true;
        courseThumbnailPreviewImage.removeAttribute("src");
        courseThumbnailPreviewName.textContent = "";
        return;
    }

    courseThumbnailPreviewImage.src = loadedCourse.thumbnail_url;
    courseThumbnailPreviewName.textContent = "Current course thumbnail";
    courseThumbnailPreview.hidden = false;
}

function validateCourseThumbnail(file) {
    if (!file) {
        return "";
    }

    if (!allowedCourseThumbnailTypes.has(file.type)) {
        return "Choose a PNG, JPEG, WebP, or GIF course thumbnail.";
    }

    if (file.size > maxCourseThumbnailSize) {
        return "Choose a course thumbnail smaller than 10 MB.";
    }

    return "";
}

function showCourseThumbnailPreview(file) {
    clearCourseThumbnailPreview();

    if (!file) {
        return;
    }

    selectedCourseThumbnailUrl = URL.createObjectURL(file);
    courseThumbnailPreviewImage.src = selectedCourseThumbnailUrl;
    courseThumbnailPreviewName.textContent = file.name;
    courseThumbnailPreview.hidden = false;
}

async function uploadCourseThumbnail(file) {
    const storagePath = `${currentProfile.id}/courses/${courseId}/${getSafeFileName(file, "course-thumbnail")}`;
    const { error: uploadError } = await supabase.storage
        .from(courseThumbnailBucket)
        .upload(storagePath, file, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false,
        });

    if (uploadError) {
        throw new Error(uploadError.message);
    }

    const { data: urlData } = supabase.storage
        .from(courseThumbnailBucket)
        .getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    const { error: metadataError } = await supabase
        .from("files")
        .insert({
            owner_user_id: currentProfile.id,
            original_file_name: file.name,
            display_name: "Course thumbnail",
            file_type: "course_thumbnail",
            mime_type: file.type,
            file_extension: getFileExtension(file),
            file_size: file.size,
            storage_bucket: courseThumbnailBucket,
            storage_path: storagePath,
            public_url: publicUrl,
        });

    if (metadataError) {
        await supabase.storage.from(courseThumbnailBucket).remove([storagePath]);
        throw new Error(metadataError.message);
    }

    return publicUrl;
}

function getPublicCourseUrl(course) {
    const url = new URL("../dashboard/index.html", window.location.href);
    url.searchParams.set("courseJoin", course.id);

    return url.href;
}

function getClassroomInviteUrl(inviteToken) {
    const url = new URL("../dashboard/index.html", window.location.href);
    url.searchParams.set("classroomInvite", inviteToken);

    return url.href;
}

function createJoinCode() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const values = new Uint32Array(6);
    window.crypto.getRandomValues(values);

    return `CTC-${[...values].map((value) => alphabet[value % alphabet.length]).join("")}`;
}

function createInviteToken() {
    const values = new Uint8Array(18);
    window.crypto.getRandomValues(values);

    return btoa(String.fromCharCode(...values))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
}

function formatClassroomName(classroom) {
    return classroom.period_block
        ? `${classroom.name} - ${classroom.period_block}`
        : classroom.name || "Untitled class";
}

function formatLatestClassroomActivity(value) {
    if (!value) {
        return "No submissions yet";
    }

    return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function formatCourseStatus(status) {
    const labels = {
        archived: "Archived",
        deleted: "Deleted",
        draft: "Draft",
        private: "Private",
        published: "Public",
    };

    return labels[status] || "Private";
}

function formatAnnouncementDate(dateLike) {
    if (!dateLike) {
        return "Not published";
    }

    return new Date(dateLike).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function getProfileDisplayName(profile) {
    const fullName = [profile?.legal_first_name, profile?.legal_last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return fullName || profile?.username || "Course teacher";
}

function resetAnnouncementForm() {
    announcementForm.reset();
    cancelAnnouncementEditButton.hidden = true;
    publishAnnouncementButton.textContent = "Publish announcement";
    saveAnnouncementDraftButton.textContent = "Save draft";
    announcementForm.removeAttribute("data-editing-announcement");
}

function getAnnouncementFormValues() {
    const title = String(announcementForm.elements["announcement-title"]?.value || "").trim();
    const message = String(announcementForm.elements["announcement-message"]?.value || "").trim();

    return { title, message };
}

function editAnnouncement(announcement) {
    editingAnnouncementId = announcement.id;
    renderAnnouncements();

    const editTitle = announcementList?.querySelector(`[data-announcement-edit-title="${announcement.id}"]`);
    editTitle?.focus();
}

function renderAnnouncements(announcements = loadedAnnouncements) {
    if (!announcementList) {
        return;
    }

    if (!announcements.length) {
        announcementList.replaceChildren(createElement("p", "empty-state", "No announcements yet. Post an update when students need to know what is happening next."));
        return;
    }

    const list = createElement("ol", "announcement-list");

    announcements.forEach((announcement) => {
        const item = createElement("li", "announcement-card");
        const isEditing = editingAnnouncementId === announcement.id;
        const header = createElement("div", "announcement-card-header");
        const titleGroup = createElement("div");
        const title = createElement("h3", "", announcement.title || "Untitled announcement");
        const meta = createElement(
            "p",
            "announcement-meta",
            `From ${announcement.author_user_id === currentProfile?.id ? getProfileDisplayName(currentProfile) : "Course teacher"} · ${announcement.status === "published" ? "Posted" : "Draft saved"} ${formatAnnouncementDate(announcement.published_at || announcement.updated_at || announcement.created_at)}`
        );
        const statusBadge = createElement(
            "span",
            announcement.status === "published" ? "badge" : "badge badge--quiet",
            announcement.status === "published" ? "Published" : "Draft"
        );
        const message = createElement("p", "announcement-message", announcement.message || "");
        const actions = createElement("div", "announcement-actions");

        titleGroup.append(title, meta);
        header.append(titleGroup, statusBadge);

        if (isEditing) {
            const editForm = createElement("form", "announcement-inline-editor");
            const titleField = createElement("label", "field-label", "Announcement title");
            const titleInput = createElement("input");
            const messageField = createElement("label", "field-label", "Announcement message");
            const messageInput = createElement("textarea");
            const inlineActions = createElement("div", "announcement-inline-actions");
            const cancelButton = createElement("button", "secondary-button", "Cancel");
            const saveButton = createElement("button", "primary-button", "Save changes");

            titleInput.type = "text";
            titleInput.required = true;
            titleInput.value = announcement.title || "";
            titleInput.dataset.announcementEditTitle = announcement.id;
            messageInput.required = true;
            messageInput.rows = 4;
            messageInput.value = announcement.message || "";
            cancelButton.type = "button";
            saveButton.type = "submit";

            cancelButton.addEventListener("click", () => {
                editingAnnouncementId = "";
                renderAnnouncements();
            });
            editForm.addEventListener("submit", (event) => {
                event.preventDefault();
                updateAnnouncementFromInline(announcement, titleInput.value, messageInput.value);
            });

            titleField.append(titleInput);
            messageField.append(messageInput);
            inlineActions.append(cancelButton, saveButton);
            editForm.append(titleField, messageField, inlineActions);
            item.append(header, editForm);
            list.append(item);
            return;
        }

        if (announcement.status === "draft") {
            const publishButton = createModuleIconButton("send", "Publish announcement");

            publishButton.type = "button";
            publishButton.addEventListener("click", () => publishAnnouncementDraft(announcement.id));
            actions.append(publishButton);
        }

        const editButton = createModuleIconButton("edit", "Edit announcement");
        const deleteButton = createModuleIconButton("trash", "Delete announcement", ["danger"]);

        editButton.type = "button";
        deleteButton.type = "button";
        editButton.addEventListener("click", () => editAnnouncement(announcement));
        deleteButton.addEventListener("click", () => archiveAnnouncement(announcement));
        actions.append(editButton, deleteButton);

        item.append(header, message, actions);
        list.append(item);
    });

    announcementList.replaceChildren(list);
}

async function loadAnnouncements() {
    const { data, error } = await supabase
        .from("course_announcements")
        .select("id, course_id, author_user_id, title, message, status, published_at, created_at, updated_at")
        .eq("course_id", courseId)
        .is("archived_at", null)
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false });

    if (error) {
        announcementList?.replaceChildren(createElement("p", "empty-state", "Announcements could not be loaded."));
        setStatus(error.message || "Announcements could not be loaded.", "error");
        return null;
    }

    loadedAnnouncements = data || [];
    renderAnnouncements();
    return loadedAnnouncements;
}

async function updateAnnouncementFromInline(announcement, titleValue, messageValue) {
    const title = String(titleValue || "").trim();
    const message = String(messageValue || "").trim();
    const isPublished = announcement.status === "published";

    if (!title || !message) {
        setStatus("Enter an announcement title and message before saving.", "error");
        return;
    }

    setStatus("Saving announcement...");

    const { error } = await supabase
        .from("course_announcements")
        .update({
            title,
            message,
            status: announcement.status,
            published_at: isPublished ? announcement.published_at || new Date().toISOString() : null,
        })
        .eq("id", announcement.id);

    if (error) {
        setStatus(error.message || "Announcement could not be saved.", "error");
        return;
    }

    editingAnnouncementId = "";
    await loadAnnouncements();
    setStatus("Announcement saved.", "success");
}

async function saveAnnouncement(status = "published") {
    const { title, message } = getAnnouncementFormValues();
    const isPublished = status === "published";

    if (!title || !message) {
        setStatus("Enter an announcement title and message before saving.", "error");
        return;
    }

    setStatus(isPublished ? "Publishing announcement..." : "Saving announcement draft...");

    const { error } = await supabase
        .from("course_announcements")
        .insert({
            course_id: courseId,
            author_user_id: currentProfile.id,
            title,
            message,
            status,
            published_at: isPublished ? new Date().toISOString() : null,
        });

    if (error) {
        setStatus(error.message || "Announcement could not be saved.", "error");
        return;
    }

    resetAnnouncementForm();
    await loadAnnouncements();
    setStatus(isPublished ? "Announcement published." : "Announcement draft saved.", "success");
}

async function publishAnnouncementDraft(announcementId) {
    setStatus("Publishing announcement...");

    const { error } = await supabase
        .from("course_announcements")
        .update({
            status: "published",
            published_at: new Date().toISOString(),
        })
        .eq("id", announcementId);

    if (error) {
        setStatus(error.message || "Announcement could not be published.", "error");
        return;
    }

    await loadAnnouncements();
    setStatus("Announcement published.", "success");
}

async function archiveAnnouncement(announcement) {
    const confirmed = await confirmInApp({
        title: "Delete announcement?",
        message: `Delete "${announcement.title || "this announcement"}"?`,
        confirmLabel: "Delete",
        destructive: true,
    });

    if (!confirmed) {
        return;
    }

    if (editingAnnouncementId === announcement.id) {
        editingAnnouncementId = "";
    }

    setStatus("Deleting announcement...");

    const { error } = await supabase
        .from("course_announcements")
        .delete()
        .eq("id", announcement.id);

    if (error) {
        setStatus(error.message || "Announcement could not be deleted.", "error");
        return;
    }

    await loadAnnouncements();
    setStatus("Announcement deleted.", "success");
}

function resetCourseClassroomFormText() {
    courseClassroomFormHeading.textContent = "Create class";
    courseClassroomFormCopy.textContent = "Create one class period for this course. Students can join with the class code or invite link.";
    courseClassroomSubmitButton.textContent = "Create class";
}

function toggleCourseClassroomForm(isOpen, classroom = null) {
    courseClassroomForm.hidden = !isOpen;
    addCourseClassroomButton.hidden = isOpen;

    if (!isOpen) {
        courseClassroomForm.reset();
        courseClassroomForm.elements["classroom-id"].value = "";
        resetCourseClassroomFormText();
        return;
    }

    courseClassroomForm.reset();
    courseClassroomForm.elements["classroom-id"].value = "";

    if (classroom) {
        courseClassroomForm.elements["classroom-id"].value = classroom.id;
        courseClassroomForm.elements.name.value = classroom.name || "";
        courseClassroomForm.elements.period_block.value = classroom.period_block || "";
        courseClassroomForm.elements.school_year.value = classroom.school_year || "";
        courseClassroomFormHeading.textContent = `Edit ${formatClassroomName(classroom)}`;
        courseClassroomFormCopy.textContent = "Update the class name, period, or school year shown in the teacher workspace.";
        courseClassroomSubmitButton.textContent = "Save class details";
    } else {
        resetCourseClassroomFormText();
    }

    courseClassroomForm.elements.name.focus();
}

function getCourseClassroomInsights(classroomId) {
    return courseClassroomInsights.get(classroomId) || {
        activeStudents: 0,
        draftSubmissions: 0,
        latestActivityAt: "",
        submittedSubmissions: 0,
    };
}

function createClassroomMetric(label, value) {
    const metric = createElement("article", "class-hub-metric");

    metric.append(
        createElement("strong", "", value),
        createElement("span", "", label)
    );
    return metric;
}

async function copyClassroomText(text, successMessage, fallbackPrefix) {
    try {
        await navigator.clipboard.writeText(text);
        setStatus(successMessage, "success");
    } catch (error) {
        setStatus(`${fallbackPrefix}: ${text}`, "success");
    }
}

async function generateCourseClassroomJoinCode(classroom) {
    if (classroom.join_code) {
        const confirmed = await confirmInApp({
            title: "Replace join code?",
            message: `Replace the join code for "${formatClassroomName(classroom)}"?`,
            confirmLabel: "Replace code",
        });

        if (!confirmed) {
            return;
        }
    }

    const joinCode = createJoinCode();
    setStatus("Generating join code...");

    const { error } = await supabase
        .from("classrooms")
        .update({ join_code: joinCode })
        .eq("id", classroom.id)
        .eq("course_id", courseId);

    if (error) {
        setStatus(error.message || "Join code could not be generated.", "error");
        return;
    }

    await loadCourseClassrooms();
    setStatus(`Join code generated: ${joinCode}`, "success");
}

async function copyCourseClassroomInviteLink(classroom) {
    let inviteToken = classroom.invite_token;

    if (!inviteToken) {
        inviteToken = createInviteToken();
        setStatus("Creating invite link...");

        const { error } = await supabase
            .from("classrooms")
            .update({ invite_token: inviteToken })
            .eq("id", classroom.id)
            .eq("course_id", courseId);

        if (error) {
            setStatus(error.message || "Invite link could not be created.", "error");
            return;
        }

        await loadCourseClassrooms();
    }

    copyClassroomText(getClassroomInviteUrl(inviteToken), "Invite link copied.", "Copy this invite link");
}

async function toggleCourseClassroomJoining(classroom) {
    const nextJoinState = !classroom.join_enabled;
    setStatus(nextJoinState ? "Opening classroom joining..." : "Closing classroom joining...");

    const { error } = await supabase
        .from("classrooms")
        .update({ join_enabled: nextJoinState })
        .eq("id", classroom.id)
        .eq("course_id", courseId);

    if (error) {
        setStatus(error.message || "Joining status could not be changed.", "error");
        return;
    }

    await loadCourseClassrooms();
    setStatus(nextJoinState ? "Classroom joining opened." : "Classroom joining closed.", "success");
}

async function archiveCourseClassroom(classroom) {
    const confirmed = await confirmInApp({
        title: "Archive classroom?",
        message: `Archive "${formatClassroomName(classroom)}"? Students will not be able to join or submit new work.`,
        confirmLabel: "Archive",
    });

    if (!confirmed) {
        return;
    }

    setStatus("Archiving classroom...");

    const { error } = await supabase
        .from("classrooms")
        .update({ status: "archived", join_enabled: false })
        .eq("id", classroom.id)
        .eq("course_id", courseId);

    if (error) {
        setStatus(error.message || "The classroom could not be archived.", "error");
        return;
    }

    toggleCourseClassroomForm(false);
    await loadCourseClassrooms();
    setStatus("Classroom archived.", "success");
}

async function deleteCourseClassroom(classroom) {
    const confirmed = await confirmInApp({
        title: "Delete classroom?",
        message: `Delete "${formatClassroomName(classroom)}"?`,
        confirmLabel: "Delete",
        destructive: true,
    });

    if (!confirmed) {
        return;
    }

    setStatus("Deleting classroom...");

    const { error } = await supabase
        .from("classrooms")
        .update({ status: "deleted" })
        .eq("id", classroom.id)
        .eq("course_id", courseId);

    if (error) {
        setStatus(error.message || "The classroom could not be deleted.", "error");
        return;
    }

    toggleCourseClassroomForm(false);
    await loadCourseClassrooms();
    setStatus("Classroom deleted.", "success");
}

function renderCourseClassrooms(classrooms = loadedCourseClassrooms) {
    if (!courseClassroomList) {
        return;
    }

    loadedCourseClassrooms = classrooms || [];

    if (!loadedCourseClassrooms.length) {
        courseClassroomList.replaceChildren(
            createElement("p", "empty-state", "No classrooms are attached to this course yet.")
        );
        return;
    }

    const list = createElement("ul", "managed-classroom-list");

    loadedCourseClassrooms.forEach((classroom) => {
        const isArchived = classroom.status === "archived";
        const insights = getCourseClassroomInsights(classroom.id);
        const item = createElement("li", "managed-classroom-card");
        const header = createElement("div", "class-hub-card-header");
        const copy = createElement("div", "class-hub-card-copy");
        const title = createElement("h3", "course-title", formatClassroomName(classroom));
        const details = createElement(
            "p",
            "course-muted",
            [classroom.school_year, isArchived ? "Archived" : classroom.join_enabled ? "Joining open" : "Joining closed"]
                .filter(Boolean)
                .join(" | ") || "Class details not set yet."
        );
        const badge = createElement("span", "badge badge--quiet", classroom.status || "active");
        const metrics = createElement("div", "class-hub-metrics");
        const access = createElement("div", "class-hub-access");
        const actions = createElement("div", "managed-classroom-actions managed-classroom-actions--primary");
        const settings = createElement("details", "managed-classroom-settings");
        const settingsSummary = createElement("summary", "", "Class settings");
        const settingsActions = createElement("div", "managed-classroom-settings-actions");
        const editButton = createElement("button", "secondary-button lesson-action", "Edit details");
        const joinButton = createElement("button", "secondary-button lesson-action", classroom.join_code ? "Copy join code" : "Generate join code");
        const inviteButton = createElement("button", "secondary-button lesson-action", "Copy invite link");
        const rosterLink = createElement("a", "primary-button lesson-action", "Open roster");
        const reviewLink = createElement("a", "secondary-button lesson-action", "Review work");
        const regenerateButton = createElement("button", "secondary-button lesson-action", "Regenerate code");
        const archiveButton = createElement("button", "secondary-button lesson-action", "Archive");
        const joinToggleButton = createElement("button", "secondary-button lesson-action", classroom.join_enabled ? "Close joining" : "Open joining");
        const deleteButton = createElement("button", "secondary-button destructive-button lesson-action", "Delete");

        item.classList.toggle("managed-classroom-card--archived", isArchived);
        copy.append(title, details);
        header.append(copy, badge);
        metrics.append(
            createClassroomMetric("students", String(insights.activeStudents)),
            createClassroomMetric("submitted", String(insights.submittedSubmissions)),
            createClassroomMetric("drafts", String(insights.draftSubmissions)),
            createClassroomMetric("latest activity", formatLatestClassroomActivity(insights.latestActivityAt))
        );
        access.append(
            createElement("p", "managed-classroom-join-code", classroom.join_code ? `Join code: ${classroom.join_code}` : "No join code generated yet."),
            createElement(
                "p",
                classroom.join_enabled && !isArchived ? "managed-classroom-join-state" : "managed-classroom-join-state managed-classroom-join-state--closed",
                isArchived ? "Archived classes are view-only" : classroom.join_enabled ? "Students can join this class" : "Joining is closed"
            ),
            createElement("p", "managed-classroom-invite-state", classroom.invite_token ? "Invite link ready" : "No invite link created yet.")
        );

        editButton.type = "button";
        editButton.disabled = isArchived;
        editButton.addEventListener("click", () => toggleCourseClassroomForm(true, classroom));
        joinButton.type = "button";
        joinButton.disabled = isArchived;
        joinButton.addEventListener("click", () => {
            if (classroom.join_code) {
                copyClassroomText(classroom.join_code, "Join code copied.", "Copy this join code");
                return;
            }

            generateCourseClassroomJoinCode(classroom);
        });
        inviteButton.type = "button";
        inviteButton.disabled = isArchived;
        inviteButton.addEventListener("click", () => copyCourseClassroomInviteLink(classroom));
        rosterLink.href = `../classrooms/roster.html?classroom=${encodeURIComponent(classroom.id)}`;
        reviewLink.href = `../submissions/index.html?classroom=${encodeURIComponent(classroom.id)}`;
        regenerateButton.type = "button";
        regenerateButton.hidden = !classroom.join_code || isArchived;
        regenerateButton.addEventListener("click", () => generateCourseClassroomJoinCode(classroom));
        archiveButton.type = "button";
        archiveButton.hidden = isArchived;
        archiveButton.addEventListener("click", () => archiveCourseClassroom(classroom));
        joinToggleButton.type = "button";
        joinToggleButton.disabled = isArchived;
        joinToggleButton.addEventListener("click", () => toggleCourseClassroomJoining(classroom));
        deleteButton.type = "button";
        deleteButton.addEventListener("click", () => deleteCourseClassroom(classroom));

        actions.append(rosterLink, reviewLink, joinButton, inviteButton);
        settingsActions.append(joinToggleButton, editButton, regenerateButton, archiveButton, deleteButton);
        settings.append(settingsSummary, settingsActions);
        item.append(header, metrics, access, actions, settings);
        list.append(item);
    });

    courseClassroomList.replaceChildren(list);
}

async function loadCourseClassroomInsights(classrooms) {
    const classroomIds = classrooms.map((classroom) => classroom.id);

    courseClassroomInsights = new Map();
    courseClassroomInsightsWarning = false;

    if (!classroomIds.length) {
        return;
    }

    const [enrollmentResult, submissionResult] = await Promise.all([
        supabase
            .from("enrollments")
            .select("classroom_id, enrollment_status")
            .in("classroom_id", classroomIds)
            .eq("enrollment_type", "classroom"),
        supabase
            .from("lesson_submissions")
            .select("classroom_id, status, submitted_at, updated_at")
            .in("classroom_id", classroomIds),
    ]);

    if (enrollmentResult.error || submissionResult.error) {
        courseClassroomInsightsWarning = true;
        setStatus("Classrooms loaded, but roster/submission summaries could not be loaded.", "warning");
        return;
    }

    classroomIds.forEach((classroomId) => {
        courseClassroomInsights.set(classroomId, getCourseClassroomInsights(classroomId));
    });

    (enrollmentResult.data || []).forEach((enrollment) => {
        const insights = getCourseClassroomInsights(enrollment.classroom_id);

        if (enrollment.enrollment_status === "active") {
            insights.activeStudents += 1;
        }

        courseClassroomInsights.set(enrollment.classroom_id, insights);
    });

    (submissionResult.data || []).forEach((submission) => {
        const insights = getCourseClassroomInsights(submission.classroom_id);
        const activityAt = submission.submitted_at || submission.updated_at;

        if (submission.status === "submitted") {
            insights.submittedSubmissions += 1;
        }

        if (submission.status === "draft") {
            insights.draftSubmissions += 1;
        }

        if (activityAt && (!insights.latestActivityAt || new Date(activityAt) > new Date(insights.latestActivityAt))) {
            insights.latestActivityAt = activityAt;
        }

        courseClassroomInsights.set(submission.classroom_id, insights);
    });
}

async function loadCourseClassrooms() {
    if (!courseClassroomList) {
        return [];
    }

    const { data, error } = await supabase
        .from("classrooms")
        .select("id, name, period_block, school_year, status, display_order, join_code, join_enabled, invite_token, created_at")
        .eq("course_id", courseId)
        .neq("status", "deleted")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

    if (error) {
        courseClassroomList.replaceChildren(createElement("p", "empty-state", "Classrooms could not be loaded."));
        setStatus(error.message || "Classroom information could not be loaded.", "error");
        return null;
    }

    await loadCourseClassroomInsights(data || []);
    renderCourseClassrooms(data || []);
    return loadedCourseClassrooms;
}

async function handleCourseClassroomSubmit(event) {
    event.preventDefault();

    const formData = new FormData(courseClassroomForm);
    const classroomId = String(formData.get("classroom-id") || "").trim();
    const name = String(formData.get("name") || "").trim();
    const periodBlock = String(formData.get("period_block") || "").trim();
    const schoolYear = String(formData.get("school_year") || "").trim();
    const nextDisplayOrder = loadedCourseClassrooms.reduce(
        (highest, classroom) => Math.max(highest, Number(classroom.display_order) || 0),
        -1
    ) + 1;

    if (!name) {
        setStatus("Enter a classroom name before saving.", "error");
        return;
    }

    setStatus(classroomId ? "Saving class details..." : "Creating class...");
    courseClassroomSubmitButton.disabled = true;

    const { error } = classroomId
        ? await supabase
            .from("classrooms")
            .update({
                name,
                period_block: periodBlock || null,
                school_year: schoolYear || null,
            })
            .eq("id", classroomId)
            .eq("course_id", courseId)
        : await supabase
            .from("classrooms")
            .insert({
                course_id: courseId,
                owner_teacher_id: currentProfile.id,
                name,
                period_block: periodBlock || null,
                school_year: schoolYear || null,
                display_order: nextDisplayOrder,
            });

    courseClassroomSubmitButton.disabled = false;

    if (error) {
        setStatus(error.message || `The class could not be ${classroomId ? "updated" : "created"}.`, "error");
        return;
    }

    toggleCourseClassroomForm(false);
    await loadCourseClassrooms();
    setStatus(classroomId ? "Class details saved." : "Class created.", "success");
}

function getPublishingBlockers() {
    const blockers = [];
    const visibleContentBlocks = loadedContentBlocks.filter((contentBlock) => contentBlock.is_visible);

    if (!loadedCourse?.title?.trim()) {
        blockers.push("Course title is required.");
    }

    if (!loadedCourse?.description?.trim()) {
        blockers.push("Course description is required.");
    }

    if (!loadedCourse?.subject_area?.trim()) {
        blockers.push("Subject area is required.");
    }

    if (!loadedCourse?.estimated_length?.trim()) {
        blockers.push("Estimated course length is required.");
    }

    if (!loadedModules.length) {
        blockers.push("Add at least one module.");
    }

    if (!loadedLessons.length) {
        blockers.push("Add at least one lesson.");
    }

    if (!visibleContentBlocks.length) {
        blockers.push("Add at least one visible lesson content block.");
    }

    loadedLessons.forEach((lesson) => {
        const lessonLabel = lesson.title || "Untitled lesson";

        if (!lesson.objective?.trim()) {
            blockers.push(`${lessonLabel} needs an objective.`);
        }

        if (!lesson.summary?.trim()) {
            blockers.push(`${lessonLabel} needs a lesson overview.`);
        }

        if (!lesson.estimated_time?.trim()) {
            blockers.push(`${lessonLabel} needs an estimated time.`);
        }
    });

    return blockers;
}

function renderCourseAccess(course) {
    const isPublished = course.status === "published";
    const isArchived = course.status === "archived";
    const isDeleted = course.status === "deleted";
    const isDiscoverable = Boolean(course.is_publicly_discoverable);
    courseVisibility.textContent = formatCourseStatus(course.status);

    if (isArchived) {
        publicCourseCopy.textContent = "This archived course is hidden from discovery. Existing records are preserved for review.";
    } else if (isDeleted) {
        publicCourseCopy.textContent = "This course is hidden from normal app views.";
    } else {
        if (isPublished && isDiscoverable) {
            publicCourseCopy.textContent = "Students can find this course in discovery and join from the public course link.";
        } else if (isPublished) {
            publicCourseCopy.textContent = "Students can join from the public course link, but this course is hidden from public discovery.";
        } else {
            publicCourseCopy.textContent = "Students cannot join this course from a public link while it is private.";
        }
    }

    courseDiscoverySelect.value = isDiscoverable ? "listed" : "hidden";
    courseDiscoverySelect.disabled = !isPublished || isArchived || isDeleted;
    toggleCourseVisibilityButton.textContent = isPublished ? "Make private" : "Publish course";
    toggleCourseVisibilityButton.disabled = isArchived || isDeleted;
    copyPublicCourseLinkButton.disabled = !isPublished;
    coursePreviewLink.href = `preview.html?course=${encodeURIComponent(course.id)}`;
    archiveCourseButton.disabled = isArchived || isDeleted;
    deleteCourseButton.disabled = isDeleted;
}

async function copyPublicCourseLink() {
    if (!loadedCourse || loadedCourse.status !== "published") {
        setStatus("Publish the course before copying a public course link.", "error");
        return;
    }

    const courseUrl = getPublicCourseUrl(loadedCourse);

    try {
        await navigator.clipboard.writeText(courseUrl);
        setStatus("Public course link copied.", "success");
    } catch (error) {
        setStatus(`Copy this public course link: ${courseUrl}`, "success");
    }
}

async function toggleCourseVisibility() {
    if (!loadedCourse) {
        setStatus("Course information is still loading.", "error");
        return;
    }

    if (loadedCourse.status === "archived" || loadedCourse.status === "deleted") {
        setStatus("Archived or deleted courses cannot be published from this page.", "error");
        renderCourseAccess(loadedCourse);
        return;
    }

    const nextStatus = loadedCourse.status === "published" ? "private" : "published";

    if (nextStatus === "published") {
        const blockers = getPublishingBlockers();

        if (blockers.length) {
            setStatus(`Course cannot be published yet. ${blockers.join(" ")}`, "error");
            return;
        }
    }

    const confirmed = await confirmInApp({
        title: nextStatus === "published" ? "Publish course?" : "Make course private?",
        message: nextStatus === "published"
            ? "Students with the public link will be able to join without a classroom code. You can choose whether it appears in public discovery."
            : "Enrolled students and classrooms keep access, but new public course joins will stop.",
        confirmLabel: nextStatus === "published" ? "Publish course" : "Make private",
    });

    if (!confirmed) {
        return;
    }

    setStatus(nextStatus === "published" ? "Publishing course..." : "Making course private...");
    toggleCourseVisibilityButton.disabled = true;

    const { data: course, error } = await supabase
        .from("courses")
        .update({ status: nextStatus })
        .eq("id", courseId)
        .select(courseSelectColumns)
        .single();

    toggleCourseVisibilityButton.disabled = false;

    if (error) {
        setStatus(error.message || "Course access could not be updated.", "error");
        return;
    }

    loadedCourse = course;
    headingElement.textContent = course.title || "Untitled course";
    fillCourseForm(course);
    renderCourseAccess(course);
    setStatus(nextStatus === "published" ? "Course published." : "Course is private.", "success");
}

async function updateDiscoveryListing() {
    if (!loadedCourse) {
        setStatus("Course information is still loading.", "error");
        return;
    }

    if (loadedCourse.status !== "published") {
        setStatus("Publish the course before changing public discovery.", "error");
        renderCourseAccess(loadedCourse);
        return;
    }

    const shouldList = courseDiscoverySelect.value === "listed";
    setStatus(shouldList ? "Listing course in discovery..." : "Hiding course from discovery...");
    courseDiscoverySelect.disabled = true;

    const { data: course, error } = await supabase
        .from("courses")
        .update({ is_publicly_discoverable: shouldList })
        .eq("id", courseId)
        .select(courseSelectColumns)
        .single();

    if (error) {
        setStatus(error.message || "Discovery listing could not be updated.", "error");
        renderCourseAccess(loadedCourse);
        return;
    }

    loadedCourse = course;
    fillCourseForm(course);
    renderCourseAccess(course);
    setStatus(shouldList ? "Course is listed in discovery." : "Course is hidden from discovery.", "success");
}

async function archiveCourse() {
    if (!loadedCourse) {
        setStatus("Course information is still loading.", "error");
        return;
    }

    const confirmed = await confirmInApp({
        title: "Archive course?",
        message: `"${loadedCourse.title || "This course"}" will be hidden from discovery, new students cannot enroll, and existing records will be preserved.`,
        confirmLabel: "Archive course",
    });

    if (!confirmed) {
        return;
    }

    setStatus("Archiving course...");
    archiveCourseButton.disabled = true;

    const { data: course, error } = await supabase
        .from("courses")
        .update({ status: "archived" })
        .eq("id", courseId)
        .select(courseSelectColumns)
        .single();

    if (error) {
        archiveCourseButton.disabled = false;
        setStatus(error.message || "Course could not be archived.", "error");
        return;
    }

    loadedCourse = course;
    renderCourseAccess(course);
    setStatus("Course archived. Historical records are still available to manage.", "success");
}

async function deleteCourse() {
    if (!loadedCourse) {
        setStatus("Course information is still loading.", "error");
        return;
    }

    const confirmed = await confirmInApp({
        title: "Delete course?",
        message: `This will delete "${loadedCourse.title || "this course"}" from normal course views.`,
        confirmLabel: "Delete",
        destructive: true,
    });

    if (!confirmed) {
        return;
    }

    setStatus("Deleting course...");
    deleteCourseButton.disabled = true;

    const { error } = await supabase
        .from("courses")
        .update({ status: "deleted" })
        .eq("id", courseId);

    if (error) {
        deleteCourseButton.disabled = false;
        setStatus(error.message || "Course could not be deleted.", "error");
        return;
    }

    window.location.href = "../dashboard/index.html";
}

function toggleModuleForm(isOpen, module = null) {
    moduleForm.hidden = !isOpen;
    addModuleButton.hidden = isOpen;

    if (isOpen && module) {
        moduleForm.elements["module-id"].value = module.id;
        moduleForm.elements["module-id"].defaultValue = module.id;
        moduleForm.elements.title.value = module.title || "";
        moduleForm.elements.description.value = module.description || "";
        moduleFormHeading.textContent = `Edit ${module.title}`;
        moduleSubmitButton.textContent = "Save module";
        moduleForm.elements.title.focus();
    } else if (isOpen) {
        moduleForm.reset();
        moduleForm.elements["module-id"].value = "";
        moduleForm.elements["module-id"].defaultValue = "";
        moduleFormHeading.textContent = "Add module";
        moduleSubmitButton.textContent = "Create module";
        toggleLessonForm(false);
        moduleForm.elements.title.focus();
    } else {
        moduleForm.reset();
        moduleForm.elements["module-id"].value = "";
        moduleForm.elements["module-id"].defaultValue = "";
        moduleFormHeading.textContent = "Add module";
        moduleSubmitButton.textContent = "Create module";
    }
}

function resetLessonFormPlacement() {
    if (lessonFormHome.parentNode) {
        lessonFormHome.parentNode.insertBefore(lessonForm, lessonFormHome.nextSibling);
    }
}

function moveLessonFormToModule(module) {
    if (collapsedModuleIds.has(module.id)) {
        collapsedModuleIds.delete(module.id);
        renderModules(loadedModules, loadedLessons, loadedContentBlocks, loadedQuestions);
    }

    const moduleCard = [...moduleList.querySelectorAll("[data-module-id]")]
        .find((card) => card.dataset.moduleId === module.id);
    const lessonSection = moduleCard?.querySelector(".module-lessons");

    if (lessonSection) {
        lessonSection.append(lessonForm);
    } else {
        resetLessonFormPlacement();
    }
}

function toggleLessonForm(isOpen, module = null) {
    lessonForm.hidden = !isOpen;

    if (isOpen && module) {
        moveLessonFormToModule(module);
        lessonForm.elements["module-id"].value = module.id;
        lessonFormHeading.textContent = `Add lesson to ${module.title}`;
        lessonForm.scrollIntoView({ behavior: "smooth", block: "center" });
        lessonForm.elements.title.focus();
    } else {
        lessonForm.reset();
        lessonFormHeading.textContent = "Add lesson";
        resetLessonFormPlacement();
    }
}

function getDragAfterElement(container, y, itemClass, draggingClass) {
    const draggableElements = [...container.children].filter((child) => {
        return child.classList.contains(itemClass) && !child.classList.contains(draggingClass);
    });

    return draggableElements.reduce(
        (closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;

            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            }

            return closest;
        },
        { offset: Number.NEGATIVE_INFINITY, element: null }
    ).element;
}

function placeDraggingItemFromPointer(list, clientY, itemClass, draggingClass) {
    const draggingItem = list.querySelector(`.${draggingClass}`);

    if (!draggingItem) {
        return;
    }

    const firstItem = [...list.children].find((child) => {
        return child.classList.contains(itemClass) && !child.classList.contains(draggingClass);
    });
    const listBox = list.getBoundingClientRect();

    if (clientY < listBox.top) {
        if (firstItem) {
            list.insertBefore(draggingItem, firstItem);
        }
        return;
    }

    if (clientY > listBox.bottom) {
        list.append(draggingItem);
        return;
    }

    const afterElement = getDragAfterElement(list, clientY, itemClass, draggingClass);

    if (afterElement) {
        list.insertBefore(draggingItem, afterElement);
    } else {
        list.append(draggingItem);
    }
}

function stopDragAutoScroll() {
    if (dragAutoScrollFrame) {
        window.cancelAnimationFrame(dragAutoScrollFrame);
    }

    dragAutoScrollFrame = null;
    dragAutoScrollSpeed = 0;
}

function runDragAutoScroll() {
    if (!dragAutoScrollSpeed) {
        dragAutoScrollFrame = null;
        return;
    }

    window.scrollBy({ top: dragAutoScrollSpeed, behavior: "auto" });
    dragAutoScrollFrame = window.requestAnimationFrame(runDragAutoScroll);
}

function updateDragAutoScroll(clientY) {
    const viewportHeight = window.innerHeight;
    let nextSpeed = 0;

    if (clientY < dragAutoScrollEdge) {
        const strength = (dragAutoScrollEdge - clientY) / dragAutoScrollEdge;
        nextSpeed = -Math.max(6, Math.round(strength * dragAutoScrollMaxSpeed));
    } else if (clientY > viewportHeight - dragAutoScrollEdge) {
        const strength = (clientY - (viewportHeight - dragAutoScrollEdge)) / dragAutoScrollEdge;
        nextSpeed = Math.max(6, Math.round(strength * dragAutoScrollMaxSpeed));
    }

    dragAutoScrollSpeed = nextSpeed;

    if (nextSpeed && !dragAutoScrollFrame) {
        dragAutoScrollFrame = window.requestAnimationFrame(runDragAutoScroll);
    } else if (!nextSpeed) {
        stopDragAutoScroll();
    }
}

function handleReorderDragOver(event) {
    if (isReorderDragActive) {
        updateDragAutoScroll(event.clientY);

        if (activeReorderDrag) {
            placeDraggingItemFromPointer(
                activeReorderDrag.list,
                event.clientY,
                activeReorderDrag.itemClass,
                activeReorderDrag.draggingClass
            );
        }
    }
}

function startReorderDrag(options = null) {
    if (isReorderDragActive) {
        return;
    }

    activeReorderDrag = options;
    isReorderDragActive = true;
    document.addEventListener("dragover", handleReorderDragOver);
    document.addEventListener("drop", stopReorderDrag, { once: true });
}

function stopReorderDrag() {
    if (!isReorderDragActive) {
        return;
    }

    isReorderDragActive = false;
    activeReorderDrag = null;
    document.removeEventListener("dragover", handleReorderDragOver);
    stopDragAutoScroll();
}

async function persistLessonOrder(moduleId, orderedIds) {
    const updates = orderedIds
        .map((id, orderIndex) => ({ id, order_index: orderIndex }))
        .filter((update) => {
            const lesson = loadedLessons.find((currentLesson) => currentLesson.id === update.id);
            return lesson && lesson.module_id === moduleId && lesson.order_index !== update.order_index;
        });

    if (!updates.length) {
        return;
    }

    setStatus("Saving lesson order...");

    let failedUpdate = null;

    for (const update of updates) {
        const result = await supabase.from("lessons").update({ order_index: update.order_index }).eq("id", update.id);

        if (result.error) {
            failedUpdate = result;
            break;
        }
    }

    if (failedUpdate) {
        setStatus(failedUpdate.error.message || "The lesson order could not be saved.", "error");
        await loadModules();
        return;
    }

    loadedLessons = loadedLessons.map((lesson) => {
        const orderIndex = orderedIds.indexOf(lesson.id);
        return orderIndex === -1 ? lesson : { ...lesson, order_index: orderIndex };
    });
    renderModules(loadedModules, loadedLessons, loadedContentBlocks, loadedQuestions);
    setStatus("Lesson order saved.", "success");
}

async function saveLessonOrder(list, moduleId) {
    const orderedIds = [...list.querySelectorAll(".lesson-card")].map((child) => child.dataset.lessonId).filter(Boolean);
    await persistLessonOrder(moduleId, orderedIds);
}

async function saveModuleOrder(list) {
    const orderedIds = [...list.children].map((child) => child.dataset.moduleId).filter(Boolean);
    const updates = orderedIds
        .map((id, orderIndex) => ({ id, order_index: orderIndex }))
        .filter((update) => {
            const module = loadedModules.find((currentModule) => currentModule.id === update.id);
            return module && module.order_index !== update.order_index;
        });

    if (!updates.length) {
        return;
    }

    setStatus("Saving module order...");

    const results = await Promise.all(
        updates.map((update) => {
            return supabase.from("modules").update({ order_index: update.order_index }).eq("id", update.id);
        })
    );
    const failedUpdate = results.find((result) => result.error);

    if (failedUpdate) {
        setStatus(failedUpdate.error.message || "The module order could not be saved.", "error");
        await loadModules();
        return;
    }

    loadedModules = orderedIds
        .map((id, orderIndex) => {
            const module = loadedModules.find((currentModule) => currentModule.id === id);
            return module ? { ...module, order_index: orderIndex } : null;
        })
        .filter(Boolean);
    renderModules(loadedModules, loadedLessons, loadedContentBlocks, loadedQuestions);
    setStatus("Module order saved.", "success");
}

async function deleteLesson(lesson) {
    const confirmed = await confirmInApp({
        title: "Delete lesson?",
        message: `This will delete "${lesson.title}" from this module.`,
        confirmLabel: "Delete",
        destructive: true,
    });

    if (!confirmed) {
        return;
    }

    setStatus("Deleting lesson...");

    const { error } = await supabase
        .from("lessons")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", lesson.id);

    if (error) {
        setStatus(error.message || "The lesson could not be deleted.", "error");
        return;
    }

    await loadModules();
    setStatus("Lesson deleted.", "success");
}

async function toggleLessonLock(lesson) {
    const nextLockState = !lesson.is_locked;

    setStatus(`${nextLockState ? "Locking" : "Unlocking"} lesson...`);

    const { error } = await supabase
        .from("lessons")
        .update({ is_locked: nextLockState })
        .eq("id", lesson.id);

    if (error) {
        setStatus(error.message || "The lesson lock could not be updated.", "error");
        return;
    }

    await loadModules();
    setStatus(`Lesson ${nextLockState ? "locked" : "unlocked"}.`, "success");
}

async function deleteModule(module) {
    const confirmed = await confirmInApp({
        title: "Delete module?",
        message: `This will delete "${module.title}" and its lessons from this course.`,
        confirmLabel: "Delete",
        destructive: true,
    });

    if (!confirmed) {
        return;
    }

    setStatus("Deleting module...");

    const { error } = await supabase
        .from("modules")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", module.id);

    if (error) {
        setStatus(error.message || "The module could not be deleted.", "error");
        return;
    }

    await loadModules();
    setStatus("Module deleted.", "success");
}

function renderLessons(module, lessons, contentBlocks, questions) {
    if (!lessons.length) {
        return createElement("p", "empty-state empty-state--compact", "No lessons in this module yet.");
    }

    const list = createElement("ol", "lesson-list lesson-list--reorderable");
    let savedDropOrder = false;

    list.addEventListener("dragover", (event) => {
        event.preventDefault();
        placeDraggingItemFromPointer(list, event.clientY, "lesson-card", "lesson-card--dragging");
    });

    list.addEventListener("drop", async (event) => {
        event.preventDefault();
        placeDraggingItemFromPointer(list, event.clientY, "lesson-card", "lesson-card--dragging");
        stopReorderDrag();
        savedDropOrder = true;
        await saveLessonOrder(list, module.id);
    });

    lessons.forEach((lesson, index) => {
        const item = createElement("li", "lesson-card");
        const header = createElement("div", "lesson-card-header");
        const content = createElement("div");
        const title = createElement("h5", "lesson-title", lesson.title);
        const labelText = lesson.estimated_time
            ? `Lesson ${lesson.order_index + 1} | ${lesson.estimated_time}`
            : `Lesson ${lesson.order_index + 1}`;
        const label = createElement("span", "badge badge--quiet", labelText);
        const headerActions = createElement("div", "lesson-header-actions");
        const dragHint = createElement("span", "lesson-drag-hint", "Drag to reorder");
        const lessonActionGroup = createElement("div", "lesson-action-group");
        const openLessonBuilderLink = createModuleIconLink(
            "hammer",
            `Open builder for ${lesson.title}`,
            `../lessons/builder.html?lesson=${encodeURIComponent(lesson.id)}`,
            ["primary", "lesson"]
        );
        const toggleLessonLockButton = createModuleIconButton(
            lesson.is_locked ? "unlock" : "lock",
            lesson.is_locked ? `Unlock ${lesson.title}` : `Lock ${lesson.title}`,
            ["lesson"]
        );
        const deleteLessonButton = createModuleIconButton("trash", `Delete ${lesson.title}`, ["danger", "lesson"]);
        const lessonContentBlocks = contentBlocks.filter((contentBlock) => contentBlock.lesson_id === lesson.id);
        const lessonQuestions = questions.filter((question) => question.lesson_id === lesson.id);
        const metaRow = createElement("div", "badge-row lesson-meta-row");
        const contentCountText = lessonContentBlocks.length === 1 ? "1 text section" : `${lessonContentBlocks.length} text sections`;
        const questionCountText = lessonQuestions.length === 1 ? "1 draft question" : `${lessonQuestions.length} draft questions`;
        const contentCount = createElement("span", "badge badge--quiet", contentCountText);
        const questionCount = createElement("span", "badge badge--quiet", questionCountText);
        const lockStatus = createElement(
            "span",
            lesson.is_locked ? "badge lesson-lock-badge lesson-lock-badge--locked" : "badge lesson-lock-badge",
            lesson.is_locked ? "Locked" : "Open"
        );

        item.draggable = true;
        item.dataset.lessonId = lesson.id;
        item.addEventListener("dragstart", (event) => {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", lesson.id);
            savedDropOrder = false;
            startReorderDrag({
                list,
                itemClass: "lesson-card",
                draggingClass: "lesson-card--dragging",
            });
            item.classList.add("lesson-card--dragging");
        });
        item.addEventListener("dragend", async (event) => {
            event.stopPropagation();
            stopReorderDrag();
            item.classList.remove("lesson-card--dragging");

            if (!savedDropOrder) {
                await saveLessonOrder(list, module.id);
            }
        });
        toggleLessonLockButton.type = "button";
        toggleLessonLockButton.addEventListener("click", () => toggleLessonLock(lesson));
        deleteLessonButton.type = "button";
        deleteLessonButton.addEventListener("click", () => deleteLesson(lesson));
        metaRow.append(contentCount, questionCount, lockStatus);
        content.append(title, metaRow);
        lessonActionGroup.append(openLessonBuilderLink, toggleLessonLockButton, deleteLessonButton);
        headerActions.append(dragHint, label, lessonActionGroup);
        header.append(content, headerActions);
        item.append(header);
        list.append(item);
    });

    return list;
}

function renderModules(modules, lessons, contentBlocks, questions) {
    if (!modules.length) {
        moduleList.replaceChildren(createElement("p", "empty-state", "No modules have been created yet."));
        return;
    }

    const list = createElement("ol", "module-list module-list--reorderable");

    list.addEventListener("dragover", (event) => {
        event.preventDefault();
        placeDraggingItemFromPointer(list, event.clientY, "module-card", "module-card--dragging");
    });

    modules.forEach((module) => {
        const item = createElement("li", "module-card");
        const header = createElement("div", "module-card-header");
        const content = createElement("div");
        const title = createElement("h3", "course-title", module.title);
        const description = createElement(
            "p",
            "course-muted",
            module.description || "No module description added yet."
        );
        const label = createElement("span", "badge badge--quiet", `Module ${module.order_index + 1}`);
        const headerControls = createElement("div", "module-header-controls");
        const lessonSection = createElement("section", "module-lessons");
        const lessonHeader = createElement("div", "module-lessons-header");
        const lessonHeading = createElement("h4", "", "Lessons");
        const actions = createElement("div", "module-actions module-actions--icons");
        const dragHint = createElement("span", "module-drag-hint", "Drag to reorder");
        const moduleLessons = lessons
            .filter((lesson) => lesson.module_id === module.id)
            .sort((firstLesson, secondLesson) => firstLesson.order_index - secondLesson.order_index);
        const isCollapsed = collapsedModuleIds.has(module.id);
        const toggleModuleButton = createModuleIconButton(
            "chevron",
            isCollapsed ? "Expand module" : "Collapse module",
            ["collapse"]
        );
        const editModuleButton = createModuleIconButton("edit", "Edit module");
        const addLessonButton = createModuleIconButton("plus", "Add lesson", ["primary"]);
        const deleteModuleButton = createModuleIconButton("trash", "Delete module", ["danger"]);
        const lessonCountLabel = moduleLessons.length === 1 ? "1 lesson hidden." : `${moduleLessons.length} lessons hidden.`;

        item.draggable = true;
        item.dataset.moduleId = module.id;
        item.classList.toggle("module-card--collapsed", isCollapsed);
        item.addEventListener("dragstart", (event) => {
            if (event.target.closest(".lesson-card")) {
                return;
            }

            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", module.id);
            startReorderDrag({
                list,
                itemClass: "module-card",
                draggingClass: "module-card--dragging",
            });
            item.classList.add("module-card--dragging");
        });
        item.addEventListener("dragend", async () => {
            stopReorderDrag();
            item.classList.remove("module-card--dragging");
            await saveModuleOrder(list);
        });
        toggleModuleButton.setAttribute("aria-expanded", String(!isCollapsed));
        toggleModuleButton.addEventListener("click", () => {
            if (isCollapsed) {
                collapsedModuleIds.delete(module.id);
            } else {
                collapsedModuleIds.add(module.id);
            }

            renderModules(loadedModules, loadedLessons, loadedContentBlocks, loadedQuestions);
        });
        editModuleButton.type = "button";
        editModuleButton.addEventListener("click", () => toggleModuleForm(true, module));
        addLessonButton.type = "button";
        addLessonButton.addEventListener("click", () => toggleLessonForm(true, module));
        deleteModuleButton.type = "button";
        deleteModuleButton.addEventListener("click", () => deleteModule(module));
        content.append(title, description);
        headerControls.append(label, toggleModuleButton);
        header.append(content, headerControls);
        actions.append(dragHint, addLessonButton, editModuleButton, deleteModuleButton);
        lessonHeader.append(lessonHeading, actions);
        lessonSection.append(lessonHeader);
        item.append(header, lessonSection);

        if (isCollapsed) {
            lessonSection.append(createElement("p", "module-collapse-summary", lessonCountLabel));
        } else {
            lessonSection.append(renderLessons(module, moduleLessons, contentBlocks, questions));
        }

        list.append(item);
    });

    moduleList.replaceChildren(list);
}

async function loadModules() {
    const { data: modules, error } = await supabase
        .from("modules")
        .select("id, title, description, order_index")
        .eq("course_id", courseId)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        moduleList.replaceChildren(createElement("p", "empty-state", "Modules could not be loaded."));
        setStatus("Module information could not be loaded.", "error");
        return null;
    }

    let lessons = [];
    let contentBlocks = [];
    let questions = [];

    if (modules.length) {
        const { data, error: lessonsError } = await supabase
            .from("lessons")
            .select("id, module_id, title, objective, summary, estimated_time, order_index, is_locked")
            .in("module_id", modules.map((module) => module.id))
            .is("archived_at", null)
            .order("order_index", { ascending: true });

        if (lessonsError) {
            moduleList.replaceChildren(createElement("p", "empty-state", "Lessons could not be loaded."));
            setStatus("Lesson information could not be loaded.", "error");
            return null;
        }

        lessons = data;

        if (lessons.length) {
            const { data: lessonContent, error: contentError } = await supabase
                .from("lesson_content_blocks")
                .select("id, lesson_id, block_type, title, body_text, order_index, is_visible")
                .in("lesson_id", lessons.map((lesson) => lesson.id))
                .is("archived_at", null)
                .order("order_index", { ascending: true });

            if (contentError) {
                moduleList.replaceChildren(createElement("p", "empty-state", "Lesson content could not be loaded."));
                setStatus("Lesson content could not be loaded.", "error");
                return null;
            }

            contentBlocks = lessonContent;

            const { data: lessonQuestions, error: questionsError } = await supabase
                .from("questions")
                .select("id, lesson_id, phase, prompt, student_instructions, order_index, is_visible")
                .in("lesson_id", lessons.map((lesson) => lesson.id))
                .is("archived_at", null)
                .order("order_index", { ascending: true });

            if (questionsError) {
                moduleList.replaceChildren(createElement("p", "empty-state", "Draft questions could not be loaded."));
                setStatus("Draft questions could not be loaded.", "error");
                return null;
            }

            questions = lessonQuestions;
        }
    }

    loadedModules = modules;
    loadedLessons = lessons;
    loadedContentBlocks = contentBlocks;
    loadedQuestions = questions;

    if (!hasAppliedInitialModuleCollapse) {
        collapsedModuleIds.clear();
        modules.forEach((module) => collapsedModuleIds.add(module.id));
        hasAppliedInitialModuleCollapse = true;
    }

    renderModules(modules, lessons, contentBlocks, questions);
    renderCourseAccess(loadedCourse);
    moduleCount.textContent = String(modules.length);
    lessonCount.textContent = String(lessons.length);
    return modules;
}

async function confirmCourseManagement() {
    if (!courseId) {
        setStatus("Choose a course from the dashboard before opening course management.", "error");
        return null;
    }

    const { data: canManage, error } = await supabase.rpc("can_manage_course", {
        course_to_check: courseId,
    });

    if (error || !canManage) {
        setStatus("You do not have permission to manage this course.", "error");
        return null;
    }

    const { data: course, error: courseError } = await supabase
        .from("courses")
        .select(courseSelectColumns)
        .eq("id", courseId)
        .single();

    if (courseError) {
        setStatus("This course could not be loaded.", "error");
        return null;
    }

    return course;
}

async function initializePage() {
    const profile = await loadProtectedProfile({ statusElement });

    if (!profile) {
        return;
    }

    currentProfile = profile;
    const course = await confirmCourseManagement();

    if (!course) {
        headingElement.textContent = "Course unavailable";
        return;
    }

    headingElement.textContent = course.title || "Untitled course";
    loadedCourse = course;
    fillCourseForm(course);
    fillPacingForm(course);
    renderCourseAccess(course);
    showContent();
    setActiveTab(getInitialTabName());
    const modules = await loadModules();
    const announcements = await loadAnnouncements();
    const classrooms = await loadCourseClassrooms();

    if (modules && announcements && classrooms && !courseClassroomInsightsWarning) {
        setStatus("");
    }
}

editorForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(editorForm);
    const courseThumbnail = courseThumbnailInput?.files?.[0];
    const courseThumbnailError = validateCourseThumbnail(courseThumbnail);
    const changes = {
        title: String(formData.get("title") || "").trim(),
        subject_area: String(formData.get("subject-area") || "").trim(),
        estimated_length: String(formData.get("estimated-length") || "").trim(),
        description: String(formData.get("description") || "").trim() || null,
    };

    if (!changes.title || !changes.subject_area || !changes.estimated_length || !changes.description) {
        setStatus("Enter a title, description, subject area, and estimated length before saving.", "error");
        return;
    }

    if (courseThumbnailError) {
        setStatus(courseThumbnailError, "error");
        return;
    }

    setStatus("Saving course setup...");

    if (courseThumbnail) {
        try {
            setStatus("Uploading course thumbnail...");
            changes.thumbnail_url = await uploadCourseThumbnail(courseThumbnail);
            changes.thumbnail_type = "uploaded";
        } catch (error) {
            setStatus(`Course thumbnail upload failed: ${error.message}`, "error");
            return;
        }
    }

    const { data: course, error } = await supabase
        .from("courses")
        .update(changes)
        .eq("id", courseId)
        .select(courseSelectColumns)
        .single();

    if (error) {
        setStatus(error.message, "error");
        return;
    }

    headingElement.textContent = course.title;
    loadedCourse = course;
    courseThumbnailInput.value = "";
    renderCourseAccess(course);
    fillCourseForm(course);
    fillPacingForm(course);
    setStatus("Course setup saved.", "success");
});

pacingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(pacingForm);
    const isEnabled = formData.get("pacing-enabled") === "on";
    const releaseStartDate = String(formData.get("release-start-date") || "").trim();
    const releaseIntervalDays = Number(formData.get("release-interval-days") || 1);

    if (!Number.isInteger(releaseIntervalDays) || releaseIntervalDays < 1 || releaseIntervalDays > 30) {
        setStatus("Choose an unlock interval from 1 to 30 days.", "error");
        return;
    }

    setStatus("Saving lesson pacing...");

    const { data: course, error } = await supabase
        .from("courses")
        .update({
            lesson_release_mode: isEnabled ? "daily" : "all_available",
            lesson_release_start_date: releaseStartDate || null,
            lesson_release_interval_days: releaseIntervalDays,
        })
        .eq("id", courseId)
        .select(courseSelectColumns)
        .single();

    if (error) {
        setStatus(error.message || "Lesson pacing could not be saved.", "error");
        return;
    }

    loadedCourse = course;
    fillPacingForm(course);
    setStatus(isEnabled ? "Lesson pacing saved. Students will unlock lessons over time." : "Lesson pacing disabled. Lessons are available unless manually locked.", "success");
});

if (courseThumbnailInput) {
    courseThumbnailInput.addEventListener("change", () => {
        const file = courseThumbnailInput.files?.[0];
        const validationError = validateCourseThumbnail(file);

        if (validationError) {
            courseThumbnailInput.value = "";
            clearCourseThumbnailPreview();
            setStatus(validationError, "error");
            return;
        }

        showCourseThumbnailPreview(file);
        setStatus(file ? "Course thumbnail ready to upload when you save." : "", "info");
    });
}

toggleCourseVisibilityButton.addEventListener("click", toggleCourseVisibility);
courseDiscoverySelect.addEventListener("change", updateDiscoveryListing);
copyPublicCourseLinkButton.addEventListener("click", copyPublicCourseLink);
archiveCourseButton.addEventListener("click", archiveCourse);
deleteCourseButton.addEventListener("click", deleteCourse);
tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.teacherCourseTabButton));
});
announcementForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveAnnouncement("published");
});
saveAnnouncementDraftButton.addEventListener("click", () => {
    saveAnnouncement("draft");
});
cancelAnnouncementEditButton.addEventListener("click", resetAnnouncementForm);
addCourseClassroomButton.addEventListener("click", () => toggleCourseClassroomForm(true));
cancelCourseClassroomButton.addEventListener("click", () => toggleCourseClassroomForm(false));
courseClassroomForm.addEventListener("submit", handleCourseClassroomSubmit);

moduleForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(moduleForm);
    const moduleId = String(formData.get("module-id") || "");
    const title = String(formData.get("title") || "").trim();
    const description = String(formData.get("description") || "").trim();
    const submitButton = moduleForm.querySelector("button[type='submit']");

    if (!title) {
        setStatus("Enter a module title before saving.", "error");
        return;
    }

    if (moduleId) {
        setStatus("Saving module...");
        submitButton.disabled = true;

        const { error } = await supabase
            .from("modules")
            .update({
                title,
                description: description || null,
            })
            .eq("id", moduleId);

        submitButton.disabled = false;

        if (error) {
            setStatus(error.message || "The module could not be saved.", "error");
            return;
        }

        toggleModuleForm(false);
        await loadModules();
        setStatus("Module saved.", "success");
        return;
    }

    const modules = await loadModules();

    if (!modules) {
        return;
    }

    const nextOrder = modules.reduce((highest, module) => Math.max(highest, module.order_index), -1) + 1;
    setStatus("Creating module...");
    submitButton.disabled = true;

    const { error } = await supabase.from("modules").insert({
        course_id: courseId,
        title,
        description: description || null,
        order_index: nextOrder,
    });

    submitButton.disabled = false;

    if (error) {
        setStatus(error.message || "The module could not be created.", "error");
        return;
    }

    toggleModuleForm(false);
    await loadModules();
    setStatus("Module created.", "success");
});

lessonForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(lessonForm);
    const moduleId = String(formData.get("module-id") || "");
    const title = String(formData.get("title") || "").trim();
    const objective = String(formData.get("objective") || "").trim();
    const summary = String(formData.get("summary") || "").trim();
    const estimatedTime = String(formData.get("estimated-time") || "").trim();
    const submitButton = lessonForm.querySelector("button[type='submit']");
    const module = loadedModules.find((currentModule) => currentModule.id === moduleId);

    if (!module || !title) {
        setStatus("Choose a module and enter a lesson title before saving.", "error");
        return;
    }

    const moduleLessons = loadedLessons.filter((lesson) => lesson.module_id === moduleId);
    const nextOrder = moduleLessons.reduce((highest, lesson) => Math.max(highest, lesson.order_index), -1) + 1;
    setStatus("Creating lesson...");
    submitButton.disabled = true;

    const { error } = await supabase.from("lessons").insert({
        module_id: moduleId,
        title,
        objective: objective || null,
        summary: summary || null,
        estimated_time: estimatedTime || null,
        order_index: nextOrder,
    });

    submitButton.disabled = false;

    if (error) {
        setStatus(error.message || "The lesson could not be created.", "error");
        return;
    }

    toggleLessonForm(false);
    await loadModules();
    setStatus("Lesson created.", "success");
});

addModuleButton.addEventListener("click", () => toggleModuleForm(true));
cancelModuleButton.addEventListener("click", () => toggleModuleForm(false));
cancelLessonButton.addEventListener("click", () => toggleLessonForm(false));

await initializePage();
