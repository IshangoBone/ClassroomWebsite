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
let loadedCourse = null;
let currentProfile = null;
let selectedCourseThumbnailUrl = "";
const collapsedModuleIds = new Set();
let hasAppliedInitialModuleCollapse = false;
let dragAutoScrollFrame = null;
let dragAutoScrollSpeed = 0;
let isReorderDragActive = false;
let activeReorderDrag = null;
const validCourseTabs = new Set(["setup", "content", "announcements", "gradebook"]);

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
    button.title = label;
    button.setAttribute("aria-label", label);
    button.append(createModuleIcon(iconName));

    return button;
}

function createModuleIconLink(iconName, label, href, modifiers = []) {
    const modifierClasses = modifiers.map((modifier) => ` module-icon-button--${modifier}`).join("");
    const link = createElement("a", `module-icon-button${modifierClasses}`);

    link.href = href;
    link.title = label;
    link.setAttribute("aria-label", label);
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
        const objective = createElement(
            "p",
            "course-muted",
            lesson.summary || lesson.objective || "No lesson overview added yet."
        );
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
        content.append(title, objective, metaRow);
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

    if (modules) {
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
});
saveAnnouncementDraftButton.addEventListener("click", () => {
    setStatus("Announcement drafts are ready in the editor. Publishing storage will be connected next.", "info");
});

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
