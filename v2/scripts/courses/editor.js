import { supabase } from "../../services/supabase/client.js";
import { loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";

const params = new URLSearchParams(window.location.search);
const courseId = params.get("course");
const headingElement = qs("[data-course-heading]");
const statusElement = qs("[data-course-status]");
const contentSections = [...document.querySelectorAll("[data-course-content]")];
const editorForm = qs("[data-course-editor-form]");
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
].join(", ");
const courseThumbnailBucket = "course-public-assets";
const maxCourseThumbnailSize = 10 * 1024 * 1024;
const allowedCourseThumbnailTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
let loadedModules = [];
let loadedLessons = [];
let loadedContentBlocks = [];
let loadedQuestions = [];
let loadedCourse = null;
let currentProfile = null;
let selectedCourseThumbnailUrl = "";
const collapsedModuleIds = new Set();

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function showContent() {
    contentSections.forEach((section) => {
        section.hidden = false;
    });
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
    const visibleQuestions = loadedQuestions.filter((question) => question.is_visible);
    const requiredQuestionPhases = [
        ["before", "before-lesson question"],
        ["during", "during-lesson question"],
        ["reflection", "reflection question"],
    ];

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

        requiredQuestionPhases.forEach(([phase, label]) => {
            const hasQuestion = visibleQuestions.some((question) => question.lesson_id === lesson.id && question.phase === phase);

            if (!hasQuestion) {
                blockers.push(`${lessonLabel} needs a ${label}.`);
            }
        });
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

    const confirmed = window.confirm(
        nextStatus === "published"
            ? "Publish this course? Students with the public link will be able to join without a classroom code. You can choose whether it appears in public discovery."
            : "Unpublish this course? Enrolled students and classrooms keep access, but new public course joins will stop."
    );

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

    const confirmed = window.confirm(
        `Archive "${loadedCourse.title || "this course"}"? It will be hidden from discovery, new students cannot enroll, and existing records will be preserved.`
    );

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

    const confirmed = window.confirm(
        `Delete "${loadedCourse.title || "this course"}"? This is a soft delete: normal app views will hide it, but database records are preserved.`
    );

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
        moduleForm.elements.title.value = module.title || "";
        moduleForm.elements.description.value = module.description || "";
        moduleFormHeading.textContent = `Edit ${module.title}`;
        moduleSubmitButton.textContent = "Save module";
        moduleForm.elements.title.focus();
    } else if (isOpen) {
        moduleForm.reset();
        moduleFormHeading.textContent = "Add module";
        moduleSubmitButton.textContent = "Create module";
        moduleForm.elements.title.focus();
    } else {
        moduleForm.reset();
        moduleFormHeading.textContent = "Add module";
        moduleSubmitButton.textContent = "Create module";
    }
}

function toggleLessonForm(isOpen, module = null) {
    lessonForm.hidden = !isOpen;

    if (isOpen && module) {
        lessonForm.elements["module-id"].value = module.id;
        lessonFormHeading.textContent = `Add lesson to ${module.title}`;
        lessonForm.elements.title.focus();
    } else {
        lessonForm.reset();
        lessonFormHeading.textContent = "Add lesson";
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

async function moveLessonToPosition(moduleId, lessonId, targetIndex) {
    const moduleLessons = loadedLessons
        .filter((lesson) => lesson.module_id === moduleId)
        .sort((firstLesson, secondLesson) => firstLesson.order_index - secondLesson.order_index);
    const currentIndex = moduleLessons.findIndex((lesson) => lesson.id === lessonId);

    if (currentIndex === -1 || currentIndex === targetIndex) {
        return;
    }

    const [lessonToMove] = moduleLessons.splice(currentIndex, 1);
    moduleLessons.splice(targetIndex, 0, lessonToMove);
    await persistLessonOrder(
        moduleId,
        moduleLessons.map((lesson) => lesson.id)
    );
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
    const confirmed = window.confirm(
        `Delete lesson "${lesson.title}"? This hides it from the course while preserving its existing content.`
    );

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

async function deleteModule(module) {
    const confirmed = window.confirm(
        `Delete module "${module.title}"? This hides the module and its lessons while preserving their existing content.`
    );

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

    list.addEventListener("dragover", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const draggingItem = list.querySelector(".lesson-card--dragging");

        if (!draggingItem) {
            return;
        }

        const afterElement = getDragAfterElement(list, event.clientY, "lesson-card", "lesson-card--dragging");

        if (afterElement) {
            list.insertBefore(draggingItem, afterElement);
        } else {
            list.append(draggingItem);
        }
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
        const reorderControls = createElement("div", "lesson-reorder-controls");
        const moveLabel = createElement("span", "course-muted lesson-move-label", "Move to");
        const positionSelect = document.createElement("select");
        const moveButton = createElement("button", "secondary-button lesson-action", "Move");
        const openLessonBuilderLink = createElement("a", "secondary-button lesson-action", "Open lesson builder");
        const deleteLessonButton = createElement("button", "secondary-button destructive-button lesson-action", "Delete lesson");
        const lessonContentBlocks = contentBlocks.filter((contentBlock) => contentBlock.lesson_id === lesson.id);
        const lessonQuestions = questions.filter((question) => question.lesson_id === lesson.id);
        const metaRow = createElement("div", "badge-row lesson-meta-row");
        const contentCountText = lessonContentBlocks.length === 1 ? "1 text section" : `${lessonContentBlocks.length} text sections`;
        const questionCountText = lessonQuestions.length === 1 ? "1 draft question" : `${lessonQuestions.length} draft questions`;
        const contentCount = createElement("span", "badge badge--quiet", contentCountText);
        const questionCount = createElement("span", "badge badge--quiet", questionCountText);

        item.draggable = true;
        item.dataset.lessonId = lesson.id;
        item.addEventListener("dragstart", (event) => {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", lesson.id);
            item.classList.add("lesson-card--dragging");
        });
        item.addEventListener("dragend", async (event) => {
            event.stopPropagation();
            item.classList.remove("lesson-card--dragging");
            await saveLessonOrder(list, module.id);
        });
        openLessonBuilderLink.href = `../lessons/builder.html?lesson=${encodeURIComponent(lesson.id)}`;
        positionSelect.className = "lesson-position-select";
        positionSelect.setAttribute("aria-label", `Move ${lesson.title} to lesson position`);
        lessons.forEach((_, optionIndex) => {
            const option = document.createElement("option");
            option.value = String(optionIndex);
            option.textContent = String(optionIndex + 1);
            positionSelect.append(option);
        });
        positionSelect.value = String(index);
        moveButton.type = "button";
        moveButton.disabled = lessons.length < 2;
        moveButton.addEventListener("click", () => {
            moveLessonToPosition(module.id, lesson.id, Number(positionSelect.value));
        });
        deleteLessonButton.type = "button";
        deleteLessonButton.addEventListener("click", () => deleteLesson(lesson));
        reorderControls.append(moveLabel, positionSelect, moveButton);
        metaRow.append(contentCount, questionCount);
        content.append(title, objective, metaRow);
        headerActions.append(dragHint, reorderControls, label, openLessonBuilderLink, deleteLessonButton);
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

        const draggingItem = list.querySelector(".module-card--dragging");

        if (!draggingItem) {
            return;
        }

        const afterElement = getDragAfterElement(list, event.clientY, "module-card", "module-card--dragging");

        if (afterElement) {
            list.insertBefore(draggingItem, afterElement);
        } else {
            list.append(draggingItem);
        }
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
        const lessonSection = createElement("section", "module-lessons");
        const lessonHeader = createElement("div", "module-lessons-header");
        const lessonHeading = createElement("h4", "", "Lessons");
        const actions = createElement("div", "module-actions");
        const dragHint = createElement("span", "module-drag-hint", "Drag to reorder");
        const toggleModuleButton = createElement("button", "secondary-button lesson-action");
        const editModuleButton = createElement("button", "secondary-button lesson-action", "Edit module");
        const addLessonButton = createElement("button", "secondary-button lesson-action", "Add lesson");
        const deleteModuleButton = createElement("button", "secondary-button destructive-button lesson-action", "Delete module");
        const moduleLessons = lessons.filter((lesson) => lesson.module_id === module.id);
        const isCollapsed = collapsedModuleIds.has(module.id);
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
            item.classList.add("module-card--dragging");
        });
        item.addEventListener("dragend", async () => {
            item.classList.remove("module-card--dragging");
            await saveModuleOrder(list);
        });
        toggleModuleButton.type = "button";
        toggleModuleButton.textContent = isCollapsed ? "Expand module" : "Collapse module";
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
        header.append(content, label);
        actions.append(dragHint, toggleModuleButton, editModuleButton, addLessonButton, deleteModuleButton);
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
            .select("id, module_id, title, objective, summary, estimated_time, order_index")
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
    renderCourseAccess(course);
    showContent();
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

    setStatus("Saving course basics...");

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
    setStatus("Course basics saved.", "success");
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
