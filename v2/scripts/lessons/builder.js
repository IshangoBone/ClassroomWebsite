import { supabase } from "../../services/supabase/client.js";
import { loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { notifyStatus } from "../utils/ui-components.js";

const params = new URLSearchParams(window.location.search);
const lessonId = params.get("lesson");
const headingElement = qs("[data-lesson-heading]");
const contextElement = qs("[data-lesson-context]");
const statusElement = qs("[data-lesson-status]");
const contentSections = [...document.querySelectorAll("[data-lesson-content]")];
const courseEditorLink = qs("[data-course-editor-link]");
const studentViewLink = qs("[data-student-view-link]");
const modulePosition = qs("[data-module-position]");
const lessonPosition = qs("[data-lesson-position]");
const lessonDetails = qs("[data-lesson-details]");
const contentBlockForm = qs("[data-content-block-form]");
const contentBlockFormHeading = qs("[data-content-block-form-heading]");
const contentBlockSubmit = qs("[data-content-block-submit]");
const cancelContentBlockEditButton = qs("[data-cancel-content-block-edit]");
const contentBlockTypeSelect = qs("[data-content-block-type]");
const contentTitleInput = qs("[data-content-title]");
const textContentField = qs("[data-text-content-field]");
const urlContentField = qs("[data-url-content-field]");
const urlContentLabel = qs("[data-url-content-label]");
const urlContentInput = qs("[data-url-content-input]");
const contentUploadField = qs("[data-content-upload-field]");
const contentUploadLabel = qs("[data-content-upload-label]");
const contentUploadInput = qs("[data-content-upload-input]");
const contentUploadStatus = qs("[data-content-upload-status]");
const resourceLibraryField = qs("[data-resource-library-field]");
const resourceLibrarySelect = qs("[data-resource-library-select]");
const resourceLibraryStatus = qs("[data-resource-library-status]");
const fileTypeField = qs("[data-file-type-field]");
const contentBlockList = qs("[data-content-block-list]");
const inlineDraftList = qs("[data-inline-draft-list]");
const contentEditorCard = qs("#lesson-content-editor");
const closeContentEditorButton = qs("[data-close-content-editor]");
const contentToolButtons = [...document.querySelectorAll("[data-content-tool]")];
const contentToolLabel = qs("[data-content-tool-label]");
const questionForm = qs("[data-question-form]");
const questionFormHeading = qs("[data-question-form-heading]");
const questionSubmit = qs("[data-question-submit]");
const cancelQuestionEditButton = qs("[data-cancel-question-edit]");
const questionList = qs("[data-question-list]");
const questionPreview = qs("[data-question-preview]");
const questionEditorCard = qs("#lesson-question-editor");
const closeQuestionEditorButton = qs("[data-close-question-editor]");
const questionToolButtons = [...document.querySelectorAll("[data-question-tool]")];
const questionToolLabel = qs("[data-question-tool-label]");
const builderCanvas = qs("[data-builder-canvas]");
const builderDropZone = qs("[data-builder-drop-zone]");
const canvasContextElement = qs("[data-canvas-context]");
const canvasTitleElement = qs("[data-canvas-title]");
const canvasObjectiveElement = qs("[data-canvas-objective]");
const canvasOverviewElement = qs("[data-canvas-overview]");
const canvasDurationElement = qs("[data-canvas-duration]");
const correctAnswerField = qs("[data-correct-answer-field]");
const responseRulesField = qs("[data-response-rules-field]");
const questionOptionsField = qs("[data-question-options-field]");
const textFormatButtons = [...document.querySelectorAll("[data-format-action]")];
let loadedContentBlocks = [];
let loadedQuestions = [];
let loadedLessonResources = [];
let currentProfile = null;
let currentLessonContext = null;
const lessonResourceBucket = "lesson-resources";
const maxLessonResourceSize = 50 * 1024 * 1024;
const lessonResourceMimeTypes = new Set([
    "application/pdf",
    "audio/aac",
    "audio/mp4",
    "audio/mpeg",
    "audio/ogg",
    "audio/wav",
    "audio/webm",
    "audio/x-wav",
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/zip",
]);
const questionTypeLabels = {
    short_response: "Short response",
    long_response: "Long response",
    multiple_choice: "Multiple choice",
    select_all_that_apply: "Select all",
    true_false: "True / false",
    rating_scale: "Rating scale",
    fill_in_the_blank: "Fill in the blank",
    matching: "Matching",
    ordering: "Ordering",
};
const contentTypeLabels = {
    text: "Text section",
    link: "External link",
    youtube: "YouTube video",
    slides: "Slides embed",
    image: "Image resource",
    audio: "Audio block",
    file: "File download",
};
const choiceQuestionTypes = ["multiple_choice", "select_all_that_apply"];
const optionQuestionTypes = [...choiceQuestionTypes, "matching", "ordering"];
const textCorrectAnswerTypes = ["short_response", "long_response", "fill_in_the_blank"];
const scalarCorrectAnswerTypes = [...textCorrectAnswerTypes, "true_false", "rating_scale"];
const questionPhases = [
    ["before", "Before lesson"],
    ["during", "During lesson"],
    ["reflection", "Reflection"],
];

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
    notifyStatus(message, tone);
}

function showContent() {
    contentSections.forEach((section) => {
        section.hidden = false;
    });
}

function buildDetailsList(lesson, module, course) {
    const list = createElement("dl", "course-classrooms");
    const details = [
        ["Course", course.title || "Untitled course"],
        ["Module", module.title || "Untitled module"],
        ["Objective", lesson.objective || "No objective added yet."],
        ["Overview", lesson.summary || "No lesson overview added yet."],
        ["Estimated time", lesson.estimated_time || "Not set"],
    ];

    details.forEach(([label, value]) => {
        const row = createElement("div", "classroom-item");
        const term = createElement("dt", "submission-name", label);
        const description = createElement("dd", "course-muted", value);

        row.append(term, description);
        list.append(row);
    });

    return list;
}

function formatContentBlockType(blockType) {
    return ["file", "image", "audio", "link", "slides", "youtube"].includes(blockType) ? blockType : "text";
}

function getContentBlockFormType(contentBlock) {
    if (contentBlock.block_type === "file" && contentBlock.file_type === "image") {
        return "image";
    }

    if (contentBlock.block_type === "file" && contentBlock.file_type === "audio") {
        return "audio";
    }

    return formatContentBlockType(contentBlock.block_type);
}

function getStoredBlockType(formBlockType) {
    return ["file", "image", "audio"].includes(formBlockType) ? "file" : formBlockType;
}

function getDefaultContentBlockTitle(contentBlock) {
    if (contentBlock.title) {
        return contentBlock.title;
    }

    if (contentBlock.block_type === "text") {
        return "Text content";
    }

    if (contentBlock.block_type === "youtube") {
        return "YouTube video";
    }

    if (contentBlock.block_type === "slides") {
        return "Slides";
    }

    if (contentBlock.block_type === "link") {
        return "External link";
    }

    if (contentBlock.file_type === "image") {
        return "Image resource";
    }

    if (contentBlock.file_type === "audio") {
        return "Audio resource";
    }

    return "File resource";
}

function formatFileSize(bytes) {
    if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) {
        return "Size unknown";
    }

    const units = ["B", "KB", "MB", "GB"];
    let size = Number(bytes);
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size >= 10 || unitIndex === 0 ? Math.round(size) : size.toFixed(1)} ${units[unitIndex]}`;
}

function isImageMimeType(mimeType = "") {
    return mimeType.startsWith("image/");
}

function isAudioMimeType(mimeType = "") {
    return mimeType.startsWith("audio/");
}

function isExternalUrl(url = "") {
    return /^https?:\/\//i.test(url);
}

function getResourceDisplayName(resource) {
    return resource.display_name || resource.original_file_name || "Untitled resource";
}

function getResourceFileType(resource) {
    const extension = String(resource.file_extension || "").toLowerCase();

    if (isImageMimeType(resource.mime_type || "")) {
        return "image";
    }

    if (isAudioMimeType(resource.mime_type || "")) {
        return "audio";
    }

    if (["pdf", "docx", "pptx", "zip"].includes(extension)) {
        return extension;
    }

    return "file";
}

function getUploadedFileType(file) {
    if (!file) {
        return "file";
    }

    return getResourceFileType({
        mime_type: file.type,
        file_extension: getFileExtension(file),
    });
}

function getLibraryResourcesForBlockType(blockType) {
    return loadedLessonResources.filter((resource) => {
        const isImage = isImageMimeType(resource.mime_type || "");
        const isAudio = isAudioMimeType(resource.mime_type || "");

        if (blockType === "image") {
            return isImage;
        }

        if (blockType === "audio") {
            return isAudio;
        }

        return !isImage && !isAudio;
    });
}

function setUploadStatus(message = "Optional. PDF, DOCX, PPTX, images, ZIP, and audio up to 50 MB.", tone = "info") {
    contentUploadStatus.textContent = message;
    contentUploadStatus.dataset.tone = tone;
    notifyStatus(message, tone);
}

function populateResourceLibrary(blockType, selectedResourceId = "") {
    const resources = getLibraryResourcesForBlockType(blockType);
    const emptyOption = document.createElement("option");

    emptyOption.value = "";
    emptyOption.textContent = resources.length ? "No library resource selected" : "No matching resources yet";
    resourceLibrarySelect.replaceChildren(emptyOption);

    resources.forEach((resource) => {
        const option = document.createElement("option");
        const type = getResourceFileType(resource).toUpperCase();

        option.value = resource.id;
        option.textContent = `${getResourceDisplayName(resource)} (${type}, ${formatFileSize(resource.file_size)})`;
        resourceLibrarySelect.append(option);
    });

    resourceLibrarySelect.value = selectedResourceId;
    resourceLibraryStatus.textContent = resources.length
        ? "Choose an existing upload, or upload a replacement above."
        : "Uploads you add here will appear in this reusable library.";
}

function getSelectedLessonResource(resourceId) {
    return loadedLessonResources.find((resource) => resource.id === resourceId) || null;
}

function insertTextFormatting(action) {
    const textarea = contentBlockForm.elements["body-text"];
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.slice(start, end);
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const leadingBreak = before && !before.endsWith("\n") ? "\n" : "";
    const trailingBreak = after && !after.startsWith("\n") ? "\n" : "";
    let replacement = "";

    if (action === "heading") {
        replacement = `${leadingBreak}## ${selectedText || "Heading"}${trailingBreak}`;
    } else if (action === "bold") {
        replacement = `**${selectedText || "bold text"}**`;
    } else if (action === "bullet") {
        const lines = (selectedText || "First point\nSecond point")
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => `- ${line}`)
            .join("\n");

        replacement = `${leadingBreak}${lines}${trailingBreak}`;
    } else if (action === "link") {
        replacement = `[${selectedText || "link text"}](https://example.com)`;
    }

    textarea.value = `${before}${replacement}${after}`;
    textarea.focus();
    textarea.setSelectionRange(start, start + replacement.length);
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

function setToolButtonState(buttons, activeValue) {
    buttons.forEach((button) => {
        const isActive = button.dataset.contentTool === activeValue || button.dataset.questionTool === activeValue;

        button.classList.toggle("lesson-tool-button--active", isActive);
        button.setAttribute("aria-pressed", String(isActive));
    });
}

function focusEditor(editorId) {
    const editor = document.getElementById(editorId);

    if (!editor) {
        return;
    }

    editor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function showBuilderEditor(editor) {
    [contentEditorCard, questionEditorCard].forEach((card) => {
        if (card) {
            card.hidden = card !== editor;
        }
    });

    if (editor) {
        editor.hidden = false;
    }
}

function hideBuilderEditors({ scrollToCanvas = true } = {}) {
    [contentEditorCard, questionEditorCard].forEach((card) => {
        if (card) {
            card.hidden = true;
        }
    });
    setToolButtonState([...contentToolButtons, ...questionToolButtons], "");
    if (scrollToCanvas) {
        builderCanvas?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

function openContentTool(blockType = "text") {
    setContentBlockFormMode(blockType);
    showBuilderEditor(contentEditorCard);
    focusEditor("lesson-content-editor");
    contentTitleInput.focus();
}

function openQuestionTool(questionType = "short_response") {
    setQuestionFormMode(questionType);
    showBuilderEditor(questionEditorCard);
    focusEditor("lesson-question-editor");
    questionForm.elements.prompt.focus();
}

function openBuilderTool(toolType, value) {
    if (toolType === "content") {
        openContentTool(value);
        return;
    }

    if (toolType === "question") {
        openQuestionTool(value);
    }
}

function makeEditableText(className, placeholder, tagName = "div") {
    const element = document.createElement(tagName);
    element.className = className;
    element.contentEditable = "true";
    element.dataset.placeholder = placeholder;
    element.setAttribute("role", "textbox");
    element.setAttribute("aria-label", placeholder);
    element.spellcheck = true;
    return element;
}

function createInlineMediaSlot(label = "Add media") {
    const slot = createElement("div", "lesson-inline-media-slot");
    const plusButton = createElement("button", "lesson-inline-plus", "+");
    const labelElement = createElement("span", "", label);
    const menu = createElement("div", "lesson-inline-media-menu");

    [
        ["image", "Image"],
        ["youtube", "YouTube"],
        ["slides", "Slides"],
        ["file", "File"],
    ].forEach(([type, text]) => {
        const button = createElement("button", "", text);
        button.type = "button";
        button.addEventListener("click", () => {
            labelElement.textContent = `${text} placeholder`;
            slot.dataset.mediaType = type;
            menu.hidden = true;
            setStatus(`${text} placeholder added to the draft section.`, "success");
        });
        menu.append(button);
    });

    plusButton.type = "button";
    plusButton.addEventListener("click", () => {
        menu.hidden = !menu.hidden;
    });
    menu.hidden = true;
    slot.append(plusButton, labelElement, menu);
    return slot;
}

function createInlineTextStack(titlePlaceholder = "Click to edit text", bodyPlaceholder = "Click to add a description") {
    const stack = createElement("div", "lesson-inline-text-stack");
    stack.append(
        makeEditableText("lesson-inline-title", titlePlaceholder, "h3"),
        makeEditableText("lesson-inline-body", bodyPlaceholder, "p")
    );
    return stack;
}

function createInlineDraftBlock(button) {
    if (!inlineDraftList) {
        openContentTool(button.dataset.contentTool || "text");
        return;
    }

    const template = button.dataset.layoutTemplate || button.dataset.contentTool || "text";
    const block = createElement("article", `lesson-inline-block lesson-inline-block--${template}`);
    const toolbar = createElement("div", "lesson-inline-toolbar");
    const label = createElement("span", "", "Draft content block");
    const removeButton = createElement("button", "lesson-inline-remove", "Remove");
    const body = createElement("div", "lesson-inline-block-body");

    removeButton.type = "button";
    removeButton.addEventListener("click", () => block.remove());
    toolbar.append(label, removeButton);

    if (template === "divider") {
        body.append(createElement("hr", "lesson-inline-divider"));
    } else if (template === "spacer") {
        body.append(createElement("div", "lesson-inline-spacer"));
    } else if (template === "toc") {
        body.append(createInlineTextStack("Table of contents", "Section links will appear here as you build the lesson."));
    } else if (template === "placeholder") {
        body.append(createInlineMediaSlot("Add a placeholder resource"));
    } else if (template === "carousel" || template === "gallery") {
        body.classList.add("lesson-inline-gallery");
        body.append(
            createInlineMediaSlot("Add media"),
            createInlineMediaSlot("Add media"),
            createInlineMediaSlot("Add media"),
            createInlineMediaSlot("Add media")
        );
    } else if (template === "docs" || template === "forms" || template === "youtube" || template === "slides" || template === "file") {
        const labelByTemplate = {
            docs: "Google Doc",
            file: "file",
            forms: "Google Form",
            slides: "slides",
            youtube: "YouTube video",
        };
        body.append(createInlineMediaSlot(`Add ${labelByTemplate[template] || "resource"}`));
    } else if (template === "image-text") {
        body.classList.add("lesson-inline-two-column");
        body.append(createInlineMediaSlot("Add image, video, or slides"), createInlineTextStack());
    } else if (template === "feature" || template === "image") {
        body.append(createInlineMediaSlot("Add large image, video, or slides"));
    } else if (template === "columns") {
        body.classList.add("lesson-inline-columns");
        body.append(
            createInlineTextStack("Column title", "Column description"),
            createInlineTextStack("Column title", "Column description"),
            createInlineTextStack("Column title", "Column description")
        );
    } else if (template === "link") {
        body.append(createInlineTextStack("Link title", "Paste or describe the resource"));
    } else {
        body.append(createInlineTextStack());
    }

    block.append(toolbar, body);
    contentBlockList?.querySelector(".lesson-page-empty")?.remove();
    inlineDraftList.append(block);
    hideBuilderEditors({ scrollToCanvas: false });
    block.scrollIntoView({ behavior: "smooth", block: "center" });
    block.querySelector("[contenteditable='true']")?.focus();
}

function getBuilderToolFromTransfer(event) {
    try {
        return JSON.parse(event.dataTransfer.getData("application/x-builder-tool") || "{}");
    } catch {
        return {};
    }
}

function setContentBlockFormMode(blockType) {
    const normalizedBlockType = formatContentBlockType(blockType);
    const isText = normalizedBlockType === "text";
    const isSlides = normalizedBlockType === "slides";
    const isYoutube = normalizedBlockType === "youtube";
    const isImage = normalizedBlockType === "image";
    const isAudio = normalizedBlockType === "audio";
    const isFile = normalizedBlockType === "file";
    const supportsUpload = isImage || isAudio || isFile;

    contentBlockTypeSelect.value = normalizedBlockType;
    contentToolLabel.textContent = contentTypeLabels[normalizedBlockType] || "Content";
    setToolButtonState(contentToolButtons, normalizedBlockType);
    textContentField.hidden = !isText;
    urlContentField.hidden = isText;
    contentUploadField.hidden = !supportsUpload;
    resourceLibraryField.hidden = !supportsUpload;
    fileTypeField.hidden = !(isFile || isAudio);
    contentBlockForm.elements["body-text"].required = isText;
    contentBlockForm.elements["content-url"].required = !isText && !supportsUpload;
    contentBlockForm.elements["file-type"].required = isFile || isAudio;
    if (isAudio) {
        contentBlockForm.elements["file-type"].value = "audio";
    }
    contentBlockForm.elements["file-type"].disabled = isAudio;
    contentTitleInput.placeholder = isText ? "What is a computer?" : isYoutube ? "Video title" : isAudio ? "Audio title" : "Resource title";
    urlContentLabel.textContent = isYoutube
        ? "YouTube URL"
        : isSlides
            ? "Slides URL"
            : isImage
                ? "Image URL"
                : isAudio
                    ? "Audio URL"
                    : isFile
                    ? "File URL"
                    : "External URL";
    contentUploadLabel.textContent = isImage ? "Upload image" : isAudio ? "Upload audio" : "Upload file";
    contentUploadInput.accept = isImage
        ? "image/png,image/jpeg,image/webp"
        : isAudio
            ? "audio/aac,audio/mp4,audio/mpeg,audio/ogg,audio/wav,audio/webm"
            : "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/zip";
    setUploadStatus();
    populateResourceLibrary(normalizedBlockType);
    urlContentInput.placeholder = isYoutube
        ? "https://www.youtube.com/watch?v=..."
        : isSlides
            ? "https://docs.google.com/presentation/..."
            : isImage
                ? "https://example.com/image.png"
                : isAudio
                    ? "https://example.com/audio.mp3 or upload below"
                    : isFile
                    ? "https://example.com/worksheet.pdf or upload below"
                    : "https://example.com/resource";
}

function getFileExtension(file) {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (extension) {
        return extension.replace(/[^a-z0-9]/g, "");
    }

    return file.type.split("/").pop() || "file";
}

function getSafeFileName(file) {
    const extension = getFileExtension(file);
    const baseName = file.name
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48) || "lesson-resource";

    return `${Date.now()}-${baseName}.${extension}`;
}

function validateLessonResource(file, blockType) {
    if (!file) {
        return "";
    }

    if (file.size > maxLessonResourceSize) {
        return "Choose a lesson resource smaller than 50 MB.";
    }

    if (!lessonResourceMimeTypes.has(file.type)) {
        return "Choose a PDF, image, Word document, slide deck, ZIP, or audio resource.";
    }

    if (blockType === "image" && !file.type.startsWith("image/")) {
        return "Choose an image file for an image resource.";
    }

    if (blockType === "file" && file.type.startsWith("image/")) {
        return "Use Image resource when uploading an image.";
    }

    if (blockType === "audio" && !file.type.startsWith("audio/")) {
        return "Choose an audio file for an audio block.";
    }

    if (blockType === "file" && file.type.startsWith("audio/")) {
        return "Use Audio block when uploading audio.";
    }

    return "";
}

async function uploadLessonResource(file, title) {
    const storagePath = `${currentProfile.id}/lessons/${lessonId}/${getSafeFileName(file)}`;
    const { error: uploadError } = await supabase.storage
        .from(lessonResourceBucket)
        .upload(storagePath, file, {
            cacheControl: "3600",
            contentType: file.type,
            upsert: false,
        });

    if (uploadError) {
        throw new Error(uploadError.message);
    }

    const { data: fileRecord, error: metadataError } = await supabase
        .from("files")
        .insert({
            owner_user_id: currentProfile.id,
            original_file_name: file.name,
            display_name: title || file.name,
            file_type: "lesson_resource",
            mime_type: file.type,
            file_extension: getFileExtension(file),
            file_size: file.size,
            storage_bucket: lessonResourceBucket,
            storage_path: storagePath,
        })
        .select("id, original_file_name, display_name, mime_type, file_extension, file_size, storage_bucket, storage_path")
        .single();

    if (metadataError) {
        await supabase.storage.from(lessonResourceBucket).remove([storagePath]);
        throw new Error(metadataError.message);
    }

    return fileRecord;
}

async function clearLessonResourceLinks(contentBlockId) {
    const { error } = await supabase
        .from("content_file_links")
        .delete()
        .eq("lesson_content_block_id", contentBlockId)
        .eq("lesson_id", lessonId);

    if (error) {
        throw new Error(error.message);
    }
}

async function linkLessonResource(fileRecord, contentBlockId) {
    const { error } = await supabase
        .from("content_file_links")
        .insert({
            file_id: fileRecord.id,
            lesson_content_block_id: contentBlockId,
            lesson_id: lessonId,
            course_id: currentLessonContext.course.id,
            classroom_id: null,
        });

    if (error) {
        throw new Error(error.message);
    }
}

function getContentBlockTypeLabel(contentBlock) {
    if (contentBlock.block_type === "file" && contentBlock.file_type === "image") {
        return contentBlock.is_visible ? "Image" : "Draft image";
    }

    if (contentBlock.block_type === "file" && contentBlock.file_type === "audio") {
        return contentBlock.is_visible ? "Audio" : "Draft audio";
    }

    if (contentBlock.block_type === "file") {
        return contentBlock.is_visible ? "File" : "Draft file";
    }

    if (contentBlock.block_type === "youtube") {
        return contentBlock.is_visible ? "YouTube" : "Draft YouTube";
    }

    if (contentBlock.block_type === "slides") {
        return contentBlock.is_visible ? "Slides" : "Draft slides";
    }

    if (contentBlock.block_type === "link") {
        return contentBlock.is_visible ? "Link" : "Draft link";
    }

    return contentBlock.is_visible ? "Text" : "Draft text";
}

function resetContentBlockForm() {
    contentBlockForm.reset();
    contentBlockForm.elements["content-block-id"].value = "";
    contentUploadInput.value = "";
    resourceLibrarySelect.value = "";
    setContentBlockFormMode("text");
    contentBlockFormHeading.textContent = "Add lesson content";
    contentBlockSubmit.textContent = "Create content block";
    cancelContentBlockEditButton.hidden = true;
}

function editContentBlock(contentBlock) {
    const blockType = getContentBlockFormType(contentBlock);

    setContentBlockFormMode(blockType);
    showBuilderEditor(contentEditorCard);
    contentBlockForm.elements["content-block-id"].value = contentBlock.id;
    contentBlockForm.elements.title.value = contentBlock.title || "";
    contentBlockForm.elements["body-text"].value = contentBlock.body_text || "";
    contentBlockForm.elements["content-url"].value = contentBlock.file_resource ? "" : contentBlock.file_url || contentBlock.external_url || "";
    contentBlockForm.elements["file-type"].value = contentBlock.file_type || "pdf";
    populateResourceLibrary(blockType, contentBlock.file_resource?.id || "");
    contentBlockFormHeading.textContent = `Edit ${getDefaultContentBlockTitle(contentBlock)}`;
    contentBlockSubmit.textContent = blockType === "text" ? "Save text section" : "Save content block";
    cancelContentBlockEditButton.hidden = false;
    focusEditor("lesson-content-editor");
    contentBlockForm.elements.title.focus();
}

async function deleteContentBlock(contentBlock) {
    const confirmed = window.confirm(
        `Delete content block "${getDefaultContentBlockTitle(contentBlock)}"? This hides it from the lesson while preserving its history.`
    );

    if (!confirmed) {
        return;
    }

    setStatus("Deleting lesson content...");

    const { error } = await supabase
        .from("lesson_content_blocks")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", contentBlock.id)
        .eq("lesson_id", lessonId);

    if (error) {
        setStatus(error.message || "The lesson content could not be deleted.", "error");
        return;
    }

    if (contentBlockForm.elements["content-block-id"].value === contentBlock.id) {
        resetContentBlockForm();
    }

    await loadContentBlocks();
    setStatus("Lesson content deleted.", "success");
}

async function removeFileFromContentBlock(contentBlock) {
    const confirmed = window.confirm(
        `Remove the attached file from "${getDefaultContentBlockTitle(contentBlock)}"? The file stays in your resource library.`
    );

    if (!confirmed) {
        return;
    }

    setStatus("Removing attached file...");

    try {
        await clearLessonResourceLinks(contentBlock.id);
    } catch (error) {
        setStatus(`The file link could not be removed: ${error.message}`, "error");
        return;
    }

    const { error } = await supabase
        .from("lesson_content_blocks")
        .update({ file_url: null })
        .eq("id", contentBlock.id)
        .eq("lesson_id", lessonId);

    if (error) {
        setStatus(error.message || "The attached file could not be removed.", "error");
        return;
    }

    if (contentBlockForm.elements["content-block-id"].value === contentBlock.id) {
        resetContentBlockForm();
    }

    await loadContentBlocks();
    setStatus("File removed from this lesson. It is still available in your resource library.", "success");
}

async function moveContentBlock(contentBlock, direction) {
    const currentIndex = loadedContentBlocks.findIndex((currentBlock) => currentBlock.id === contentBlock.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const targetBlock = loadedContentBlocks[targetIndex];

    if (currentIndex === -1 || !targetBlock) {
        return;
    }

    setStatus("Saving lesson content order...");

    const results = await Promise.all([
        supabase
            .from("lesson_content_blocks")
            .update({ order_index: targetBlock.order_index })
            .eq("id", contentBlock.id)
            .eq("lesson_id", lessonId),
        supabase
            .from("lesson_content_blocks")
            .update({ order_index: contentBlock.order_index })
            .eq("id", targetBlock.id)
            .eq("lesson_id", lessonId),
    ]);
    const failedUpdate = results.find((result) => result.error);

    if (failedUpdate) {
        setStatus(failedUpdate.error.message || "The lesson content order could not be saved.", "error");
        return;
    }

    await loadContentBlocks();
    setStatus("Lesson content order saved.", "success");
}

async function saveContentBlockOrder(list) {
    const orderedIds = [...list.children].map((child) => child.dataset.contentBlockId).filter(Boolean);
    const updates = orderedIds
        .map((id, orderIndex) => ({ id, order_index: orderIndex }))
        .filter((update) => {
            const contentBlock = loadedContentBlocks.find((currentBlock) => currentBlock.id === update.id);
            return contentBlock && contentBlock.order_index !== update.order_index;
        });

    if (!updates.length) {
        return;
    }

    setStatus("Saving lesson content order...");

    const results = await Promise.all(
        updates.map((update) => {
            return supabase
                .from("lesson_content_blocks")
                .update({ order_index: update.order_index })
                .eq("id", update.id)
                .eq("lesson_id", lessonId);
        })
    );
    const failedUpdate = results.find((result) => result.error);

    if (failedUpdate) {
        setStatus(failedUpdate.error.message || "The lesson content order could not be saved.", "error");
        await loadContentBlocks();
        return;
    }

    loadedContentBlocks = loadedContentBlocks.map((contentBlock) => {
        const orderIndex = orderedIds.indexOf(contentBlock.id);
        return orderIndex === -1 ? contentBlock : { ...contentBlock, order_index: orderIndex };
    });
    renderContentBlocks(loadedContentBlocks);
    setStatus("Lesson content order saved.", "success");
}

async function toggleContentBlockVisibility(contentBlock) {
    const nextVisibility = !contentBlock.is_visible;

    setStatus(`${nextVisibility ? "Showing" : "Hiding"} lesson content...`);

    const { error } = await supabase
        .from("lesson_content_blocks")
        .update({ is_visible: nextVisibility })
        .eq("id", contentBlock.id)
        .eq("lesson_id", lessonId);

    if (error) {
        setStatus(error.message || "The lesson content visibility could not be updated.", "error");
        return;
    }

    await loadContentBlocks();
    setStatus(`Lesson content ${nextVisibility ? "shown" : "hidden"}.`, "success");
}

function resetQuestionForm() {
    questionForm.reset();
    questionForm.elements["question-id"].value = "";
    setQuestionFormMode("short_response");
    questionForm.elements["is-required"].checked = false;
    questionForm.elements.points.value = "0";
    questionFormHeading.textContent = "Add draft question";
    questionSubmit.textContent = "Create draft question";
    cancelQuestionEditButton.hidden = true;
}

function updateNewQuestionPointDefault() {
    if (questionForm.elements["question-id"].value) {
        return;
    }

    const pointsInput = questionForm.elements.points;
    const currentPoints = Number(pointsInput.value || 0);
    const isRequired = questionForm.elements["is-required"].checked;

    if (isRequired && currentPoints === 0) {
        pointsInput.value = "1";
    }

    if (!isRequired && currentPoints === 1) {
        pointsInput.value = "0";
    }
}

function hasQuestionAnswerConfig(question) {
    return Boolean(question.correct_answer) || getQuestionOptions(question).length > 0;
}

function getQuestionOptions(question) {
    return [...(question.options || [])].sort((first, second) => first.order_index - second.order_index);
}

function setQuestionFormMode(questionType) {
    const isChoiceQuestion = choiceQuestionTypes.includes(questionType);
    const isOptionQuestion = optionQuestionTypes.includes(questionType);
    const isMatchingQuestion = questionType === "matching";
    const isOrderingQuestion = questionType === "ordering";
    const allowsMultipleCorrectAnswers = questionType === "select_all_that_apply";
    const correctInputs = [...questionOptionsField.querySelectorAll("[name='correct-option']")];
    const matchInputs = [...questionOptionsField.querySelectorAll("[data-match-input]")];
    const correctControls = [...questionOptionsField.querySelectorAll("[data-correct-control]")];
    const correctTextInput = questionForm.elements["correct-text"];
    const correctBooleanInput = questionForm.elements["correct-boolean"];
    const correctRatingInput = questionForm.elements["correct-rating"];
    const usesScalarCorrectAnswer = scalarCorrectAnswerTypes.includes(questionType);
    const usesTextCorrectAnswer = textCorrectAnswerTypes.includes(questionType);
    const usesBooleanCorrectAnswer = questionType === "true_false";
    const usesRatingCorrectAnswer = questionType === "rating_scale";

    questionForm.elements["question-type"].value = questionType;
    questionToolLabel.textContent = questionTypeLabels[questionType] || "Assessment";
    setToolButtonState(questionToolButtons, questionType);
    correctAnswerField.hidden = !usesScalarCorrectAnswer;
    responseRulesField.hidden = !usesTextCorrectAnswer;
    correctTextInput.hidden = !usesTextCorrectAnswer;
    correctBooleanInput.hidden = !usesBooleanCorrectAnswer;
    correctRatingInput.hidden = !usesRatingCorrectAnswer;
    correctTextInput.required = false;
    correctBooleanInput.required = false;
    correctRatingInput.required = false;
    correctAnswerField.querySelector("legend").textContent = usesRatingCorrectAnswer
        ? "Optional correct rating"
        : usesBooleanCorrectAnswer
            ? "Optional correct answer"
            : "Optional sample answer";
    questionOptionsField.hidden = !isOptionQuestion;
    questionOptionsField.querySelector("legend").textContent = isMatchingQuestion
        ? "Matching pairs"
        : isOrderingQuestion
            ? "Correct order"
            : "Answer choices";
    [1, 2, 3, 4].forEach((index) => {
        const optionInput = questionForm.elements[`option-${index}`];
        const matchInput = questionForm.elements[`match-${index}`];

        optionInput.required = isOptionQuestion;
        optionInput.placeholder = isMatchingQuestion
            ? `Prompt ${index}`
            : isOrderingQuestion
                ? `Step ${index}`
                : `Choice ${index}`;
        matchInput.required = isMatchingQuestion;
        matchInput.hidden = !isMatchingQuestion;
        matchInput.placeholder = `Match ${index}`;
    });
    correctControls.forEach((control) => {
        control.hidden = !isChoiceQuestion;
    });
    correctInputs.forEach((input) => {
        input.type = allowsMultipleCorrectAnswers ? "checkbox" : "radio";
    });
    matchInputs.forEach((input) => {
        if (!isMatchingQuestion) {
            input.value = "";
        }
    });

    if (!isChoiceQuestion) {
        correctInputs.forEach((input) => {
            input.checked = false;
        });
    } else if (!allowsMultipleCorrectAnswers) {
        const checkedInputs = correctInputs.filter((input) => input.checked);

        checkedInputs.slice(1).forEach((input) => {
            input.checked = false;
        });
    }

    if (!usesTextCorrectAnswer) {
        correctTextInput.value = "";
        questionForm.elements["min-length"].value = "";
        questionForm.elements["max-length"].value = "";
    }

    if (!usesBooleanCorrectAnswer) {
        correctBooleanInput.value = "";
    }

    if (!usesRatingCorrectAnswer) {
        correctRatingInput.value = "";
    }
}

function getCorrectAnswerInput(formData, questionType) {
    const minLengthRaw = String(formData.get("min-length") || "").trim();
    const maxLengthRaw = String(formData.get("max-length") || "").trim();
    const minLength = minLengthRaw ? Number(minLengthRaw) : null;
    const maxLength = maxLengthRaw ? Number(maxLengthRaw) : null;
    const hasLengthRules = minLength !== null || maxLength !== null;
    const lengthRulePayload = hasLengthRules ? { minLength, maxLength } : {};

    if (
        hasLengthRules &&
        (!Number.isInteger(minLength ?? 0) ||
            !Number.isInteger(maxLength ?? 0) ||
            (minLength !== null && minLength < 0) ||
            (maxLength !== null && maxLength < 0) ||
            (minLength !== null && maxLength !== null && minLength > maxLength))
    ) {
        return { invalid: true, reason: "length" };
    }

    if (textCorrectAnswerTypes.includes(questionType)) {
        const value = String(formData.get("correct-text") || "").trim();
        return value || hasLengthRules ? { type: questionType, value: value || null, ...lengthRulePayload } : null;
    }

    if (questionType === "true_false") {
        const value = String(formData.get("correct-boolean") || "");
        return value ? { type: questionType, value: value === "true" } : null;
    }

    if (questionType === "rating_scale") {
        const rawValue = String(formData.get("correct-rating") || "").trim();
        const value = Number(rawValue);

        if (!rawValue) {
            return null;
        }

        return Number.isInteger(value) && value >= 1 && value <= 5
            ? { type: questionType, value }
            : { invalid: true, reason: "rating" };
    }

    return null;
}

function formatCorrectAnswer(question) {
    const correctAnswer = question.correct_answer;

    if (!correctAnswer || typeof correctAnswer !== "object") {
        return "";
    }

    if (correctAnswer.type === "true_false") {
        return correctAnswer.value ? "True" : "False";
    }

    return String(correctAnswer.value ?? "");
}

function formatLengthRules(question) {
    const correctAnswer = question.correct_answer;

    if (!correctAnswer || typeof correctAnswer !== "object") {
        return "";
    }

    const minLength = correctAnswer.minLength;
    const maxLength = correctAnswer.maxLength;

    if (minLength !== null && minLength !== undefined && maxLength !== null && maxLength !== undefined) {
        return `${minLength}-${maxLength} characters`;
    }

    if (minLength !== null && minLength !== undefined) {
        return `At least ${minLength} characters`;
    }

    if (maxLength !== null && maxLength !== undefined) {
        return `Up to ${maxLength} characters`;
    }

    return "";
}

function getQuestionOptionInputs(formData, questionType) {
    if (!optionQuestionTypes.includes(questionType)) {
        return [];
    }

    const correctIndexes = new Set(formData.getAll("correct-option").map((value) => Number(value)));

    return [1, 2, 3, 4].map((index) => ({
        text: String(formData.get(`option-${index}`) || "").trim(),
        matchText: questionType === "matching" ? String(formData.get(`match-${index}`) || "").trim() : "",
        isCorrect: choiceQuestionTypes.includes(questionType) && correctIndexes.has(index),
    }));
}

function editQuestion(question) {
    questionForm.elements["question-id"].value = question.id;
    questionForm.elements.phase.value = question.phase || "before";
    setQuestionFormMode(question.question_type || "short_response");
    showBuilderEditor(questionEditorCard);
    questionForm.elements.prompt.value = question.prompt || "";
    questionForm.elements["student-instructions"].value = question.student_instructions || "";
    questionForm.elements.hint.value = question.hint || "";
    questionForm.elements.points.value = String(question.points ?? (question.is_required ? 1 : 0));
    questionForm.elements["is-required"].checked = Boolean(question.is_required);
    questionForm.elements["correct-text"].value = textCorrectAnswerTypes.includes(question.question_type)
        ? formatCorrectAnswer(question)
        : "";
    questionForm.elements["correct-boolean"].value = question.question_type === "true_false" && question.correct_answer
        ? String(Boolean(question.correct_answer.value))
        : "";
    questionForm.elements["correct-rating"].value = question.question_type === "rating_scale"
        ? formatCorrectAnswer(question)
        : "";
    questionForm.elements["min-length"].value = textCorrectAnswerTypes.includes(question.question_type)
        ? question.correct_answer?.minLength ?? ""
        : "";
    questionForm.elements["max-length"].value = textCorrectAnswerTypes.includes(question.question_type)
        ? question.correct_answer?.maxLength ?? ""
        : "";
    [1, 2, 3, 4].forEach((index) => {
        const option = getQuestionOptions(question)[index - 1];

        questionForm.elements[`option-${index}`].value = option?.option_text || "";
        questionForm.elements[`match-${index}`].value = option?.match_group || "";
        questionOptionsField.querySelector(`[name='correct-option'][value='${index}']`).checked = Boolean(option?.is_correct);
    });
    questionFormHeading.textContent = "Edit draft question";
    questionSubmit.textContent = "Save draft question";
    cancelQuestionEditButton.hidden = false;
    focusEditor("lesson-question-editor");
    questionForm.elements.prompt.focus();
}

async function saveQuestionOptions(questionId, optionInputs, existingOptions = []) {
    if (!optionInputs.length) {
        return null;
    }

    const existingOptionsByIndex = getQuestionOptions({ options: existingOptions });
    const results = await Promise.all(optionInputs.map((optionInput, index) => {
        const existingOption = existingOptionsByIndex[index];
        const optionPayload = {
            option_text: optionInput.text,
            option_value: `option_${index + 1}`,
            is_correct: optionInput.isCorrect,
            match_group: optionInput.matchText || null,
            order_index: index,
        };

        if (existingOption) {
            return supabase
                .from("question_options")
                .update(optionPayload)
                .eq("id", existingOption.id)
                .eq("question_id", questionId);
        }

        return supabase
            .from("question_options")
            .insert({ question_id: questionId, ...optionPayload });
    }));

    return results.find((result) => result.error)?.error || null;
}

async function deleteQuestion(question) {
    const confirmed = window.confirm(
        `Delete draft question "${question.prompt}"? This hides it from the lesson while preserving its history.`
    );

    if (!confirmed) {
        return;
    }

    setStatus("Deleting draft question...");

    const { error } = await supabase
        .from("questions")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", question.id)
        .eq("lesson_id", lessonId);

    if (error) {
        setStatus(error.message || "The draft question could not be deleted.", "error");
        return;
    }

    if (questionForm.elements["question-id"].value === question.id) {
        resetQuestionForm();
    }

    await loadQuestions();
    setStatus("Draft question deleted.", "success");
}

async function moveQuestion(question, direction) {
    const phaseQuestions = loadedQuestions.filter((currentQuestion) => currentQuestion.phase === question.phase);
    const currentIndex = phaseQuestions.findIndex((currentQuestion) => currentQuestion.id === question.id);
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const targetQuestion = phaseQuestions[targetIndex];

    if (currentIndex === -1 || !targetQuestion) {
        return;
    }

    setStatus("Saving draft question order...");

    const results = await Promise.all([
        supabase
            .from("questions")
            .update({ order_index: targetQuestion.order_index })
            .eq("id", question.id)
            .eq("lesson_id", lessonId),
        supabase
            .from("questions")
            .update({ order_index: question.order_index })
            .eq("id", targetQuestion.id)
            .eq("lesson_id", lessonId),
    ]);
    const failedUpdate = results.find((result) => result.error);

    if (failedUpdate) {
        setStatus(failedUpdate.error.message || "The draft question order could not be saved.", "error");
        return;
    }

    await loadQuestions();
    setStatus("Draft question order saved.", "success");
}

async function saveQuestionOrder(list, phase) {
    const orderedIds = [...list.children].map((child) => child.dataset.questionId).filter(Boolean);
    const updates = orderedIds
        .map((id, orderIndex) => ({ id, order_index: orderIndex }))
        .filter((update) => {
            const question = loadedQuestions.find((currentQuestion) => currentQuestion.id === update.id);
            return question && question.phase === phase && question.order_index !== update.order_index;
        });

    if (!updates.length) {
        return;
    }

    setStatus("Saving draft question order...");

    const results = await Promise.all(
        updates.map((update) => {
            return supabase
                .from("questions")
                .update({ order_index: update.order_index })
                .eq("id", update.id)
                .eq("lesson_id", lessonId);
        })
    );
    const failedUpdate = results.find((result) => result.error);

    if (failedUpdate) {
        setStatus(failedUpdate.error.message || "The draft question order could not be saved.", "error");
        await loadQuestions();
        return;
    }

    loadedQuestions = loadedQuestions.map((question) => {
        const orderIndex = orderedIds.indexOf(question.id);
        return orderIndex === -1 ? question : { ...question, order_index: orderIndex };
    });
    renderQuestions(loadedQuestions);
    renderQuestionPreview(loadedQuestions);
    setStatus("Draft question order saved.", "success");
}

async function toggleQuestionVisibility(question) {
    const nextVisibility = !question.is_visible;

    setStatus(`${nextVisibility ? "Showing" : "Hiding"} draft question...`);

    const { error } = await supabase
        .from("questions")
        .update({ is_visible: nextVisibility })
        .eq("id", question.id)
        .eq("lesson_id", lessonId);

    if (error) {
        setStatus(error.message || "The draft question visibility could not be updated.", "error");
        return;
    }

    await loadQuestions();
    setStatus(`Draft question ${nextVisibility ? "shown" : "hidden"}.`, "success");
}

function renderContentBlocks(contentBlocks) {
    if (!contentBlocks.length) {
        contentBlockList.replaceChildren(
            createElement("p", "empty-state lesson-page-empty", "Start with a content block or insert item from the panel.")
        );
        return;
    }

    const list = createElement("ol", "content-block-list");

    list.addEventListener("dragover", (event) => {
        event.preventDefault();

        const draggingItem = list.querySelector(".content-block-card--dragging");

        if (!draggingItem) {
            return;
        }

        const afterElement = getDragAfterElement(list, event.clientY, "content-block-card", "content-block-card--dragging");

        if (afterElement) {
            list.insertBefore(draggingItem, afterElement);
        } else {
            list.append(draggingItem);
        }
    });

    contentBlocks.forEach((contentBlock, index) => {
        const item = createElement("li", "content-block-card");
        const title = createElement("h3", "content-block-title", getDefaultContentBlockTitle(contentBlock));
        const label = createElement("span", "badge badge--quiet", `${getContentBlockTypeLabel(contentBlock)} ${contentBlock.order_index + 1}`);
        const contentUrl = contentBlock.file_url || contentBlock.external_url || "";
        const isImageResource = contentBlock.block_type === "file" && contentBlock.file_type === "image";
        const attachedResource = contentBlock.file_resource;
        const contentPreview = ["file", "link", "slides", "youtube"].includes(contentBlock.block_type)
            ? createElement("a", "course-muted content-block-body", contentUrl)
            : createElement("p", "course-muted content-block-body", contentBlock.body_text || "");
        const moveUpButton = createElement("button", "secondary-button lesson-action", "Move up");
        const moveDownButton = createElement("button", "secondary-button lesson-action", "Move down");
        const visibilityButton = createElement(
            "button",
            "secondary-button lesson-action",
            contentBlock.is_visible ? "Hide content" : "Show content"
        );
        const editButton = createElement("button", "secondary-button lesson-action", "Edit content");
        const removeFileButton = createElement("button", "secondary-button destructive-button lesson-action", "Remove file");
        const deleteButton = createElement("button", "secondary-button destructive-button lesson-action", "Delete content");
        const actions = createElement("div", "content-block-actions");
        const dragHint = createElement("span", "content-block-drag-hint", "Drag to reorder");

        item.draggable = true;
        item.dataset.contentBlockId = contentBlock.id;
        item.addEventListener("dragstart", (event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", contentBlock.id);
            item.classList.add("content-block-card--dragging");
        });
        item.addEventListener("dragend", async () => {
            item.classList.remove("content-block-card--dragging");
            await saveContentBlockOrder(list);
        });
        if (["file", "link", "slides", "youtube"].includes(contentBlock.block_type)) {
            contentPreview.href = contentUrl || "#";
            contentPreview.target = "_blank";
            contentPreview.rel = "noopener noreferrer";

            if (isImageResource && contentUrl && !attachedResource) {
                const image = createElement("img", "content-block-image-preview");
                image.src = contentUrl;
                image.alt = contentBlock.title || "Lesson image";
                contentPreview.replaceChildren(image);
            } else if (isImageResource && attachedResource) {
                contentPreview.textContent = `${getResourceDisplayName(attachedResource)} (${formatFileSize(attachedResource.file_size)})`;
            } else if (contentBlock.block_type === "file") {
                contentPreview.textContent = attachedResource
                    ? `${getResourceDisplayName(attachedResource)} (${formatFileSize(attachedResource.file_size)})`
                    : contentUrl
                        ? `${contentBlock.file_type?.toUpperCase() || "File"} resource`
                        : "No file attached";
            }
        }

        moveUpButton.type = "button";
        moveUpButton.disabled = index === 0;
        moveUpButton.addEventListener("click", () => moveContentBlock(contentBlock, "up"));
        moveDownButton.type = "button";
        moveDownButton.disabled = index === contentBlocks.length - 1;
        moveDownButton.addEventListener("click", () => moveContentBlock(contentBlock, "down"));
        visibilityButton.type = "button";
        visibilityButton.addEventListener("click", () => toggleContentBlockVisibility(contentBlock));
        editButton.type = "button";
        editButton.addEventListener("click", () => editContentBlock(contentBlock));
        removeFileButton.type = "button";
        removeFileButton.addEventListener("click", () => removeFileFromContentBlock(contentBlock));
        deleteButton.type = "button";
        deleteButton.addEventListener("click", () => deleteContentBlock(contentBlock));
        actions.append(dragHint, moveUpButton, moveDownButton, visibilityButton, editButton);
        if (contentBlock.block_type === "file" && contentUrl) {
            actions.append(removeFileButton);
        }
        actions.append(deleteButton);
        item.append(title, label, contentPreview, actions);
        list.append(item);
    });

    contentBlockList.replaceChildren(list);
}

async function loadContentBlocks() {
    const { data, error } = await supabase
        .from("lesson_content_blocks")
        .select("id, block_type, title, body_text, external_url, file_url, file_type, order_index, is_visible")
        .eq("lesson_id", lessonId)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        contentBlockList.replaceChildren(
            createElement("p", "empty-state", "Lesson content could not be loaded.")
        );
        setStatus("Lesson content could not be loaded.", "error");
        return false;
    }

    const contentBlockIds = data.map((contentBlock) => contentBlock.id);
    const { data: links, error: linksError } = contentBlockIds.length
        ? await supabase
            .from("content_file_links")
            .select("lesson_content_block_id, files(id, original_file_name, display_name, mime_type, file_extension, file_size, storage_bucket, storage_path)")
            .in("lesson_content_block_id", contentBlockIds)
        : { data: [], error: null };

    if (linksError) {
        setStatus("Lesson content loaded, but attached file details could not be loaded.", "error");
    }

    loadedContentBlocks = data.map((contentBlock) => ({
        ...contentBlock,
        file_resource: (links || []).find((link) => link.lesson_content_block_id === contentBlock.id)?.files || null,
    }));
    renderContentBlocks(loadedContentBlocks);
    return true;
}

async function loadLessonResources() {
    const { data, error } = await supabase
        .from("files")
        .select("id, original_file_name, display_name, mime_type, file_extension, file_size, storage_bucket, storage_path, created_at")
        .eq("owner_user_id", currentProfile.id)
        .eq("file_type", "lesson_resource")
        .eq("status", "active")
        .order("created_at", { ascending: false });

    if (error) {
        loadedLessonResources = [];
        resourceLibraryStatus.textContent = "Resource library could not be loaded.";
        return false;
    }

    loadedLessonResources = data || [];
    populateResourceLibrary(contentBlockTypeSelect.value);
    return true;
}

function renderQuestions(questions) {
    if (!questions.length) {
        questionList.replaceChildren(createElement("p", "empty-state", "No draft questions have been added yet."));
        return;
    }

    const sections = questionPhases.map(([phase, phaseTitle]) => {
        const section = createElement("section", "lesson-content question-phase-section");
        const header = createElement("div", "lesson-content-header");
        const heading = createElement("h6", "", phaseTitle);
        const list = createElement("ol", "question-list question-list--reorderable");
        const phaseQuestions = questions
            .filter((question) => question.phase === phase)
            .sort((first, second) => first.order_index - second.order_index);

        header.append(heading);
        section.append(header);

        if (!phaseQuestions.length) {
            section.append(createElement("p", "empty-state empty-state--compact", "No draft questions in this section yet."));
            return section;
        }

        list.addEventListener("dragover", (event) => {
            event.preventDefault();

            const draggingItem = list.querySelector(".question-card--dragging");

            if (!draggingItem) {
                return;
            }

            const afterElement = getDragAfterElement(list, event.clientY, "question-card", "question-card--dragging");

            if (afterElement) {
                list.insertBefore(draggingItem, afterElement);
            } else {
                list.append(draggingItem);
            }
        });

        phaseQuestions.forEach((question) => {
        const item = createElement("li", "question-card");
        const prompt = createElement("h3", "question-prompt", question.prompt);
        const label = createElement("span", "badge badge--quiet", `Draft ${question.order_index + 1}`);
        const typeLabel = createElement(
            "span",
            "badge badge--quiet",
            questionTypeLabels[question.question_type] || "Question"
        );
        const requiredLabel = createElement(
            "span",
            "badge badge--quiet",
            question.is_required ? "Required" : "Optional"
        );
        const pointsLabel = createElement("span", "badge badge--quiet", `${Number(question.points ?? (question.is_required ? 1 : 0))} pt`);
        const instructions = createElement(
            "p",
            "course-muted question-instructions",
            question.student_instructions || "Short response question"
        );
        const hint = createElement("p", "course-muted question-instructions", `Hint: ${question.hint || "None"}`);
        const correctAnswerText = formatCorrectAnswer(question);
        const lengthRulesText = formatLengthRules(question);
        const correctAnswer = createElement("p", "course-muted question-instructions", `Correct answer: ${correctAnswerText}`);
        const lengthRules = createElement("p", "course-muted question-instructions", `Length rule: ${lengthRulesText}`);
        const options = getQuestionOptions(question);
        const optionList = createElement("ol", "question-option-list");
        const phaseIndex = phaseQuestions.findIndex((currentQuestion) => currentQuestion.id === question.id);
        const dragHint = createElement("span", "question-drag-hint", "Drag to reorder");
        const moveUpButton = createElement("button", "secondary-button lesson-action", "Move up");
        const moveDownButton = createElement("button", "secondary-button lesson-action", "Move down");
        const visibilityButton = createElement(
            "button",
            "secondary-button lesson-action",
            question.is_visible ? "Hide question" : "Show question"
        );
        const editButton = createElement("button", "secondary-button lesson-action", "Edit question");
        const deleteButton = createElement(
            "button",
            "secondary-button destructive-button lesson-action",
            "Delete question"
        );
        const actions = createElement("div", "content-block-actions");

        item.draggable = true;
        item.dataset.questionId = question.id;
        item.addEventListener("dragstart", (event) => {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", question.id);
            item.classList.add("question-card--dragging");
        });
        item.addEventListener("dragend", async () => {
            item.classList.remove("question-card--dragging");
            await saveQuestionOrder(list, phase);
        });
        options.forEach((option) => {
            const optionText = question.question_type === "matching" && option.match_group
                ? `${option.option_text} -> ${option.match_group}`
                : option.option_text;
            const optionItem = createElement("li", "", optionText);

            if (option.is_correct) {
                optionItem.append(createElement("span", "badge badge--quiet", "Correct"));
            }
            optionList.append(optionItem);
        });
        moveUpButton.type = "button";
        moveUpButton.disabled = phaseIndex === 0;
        moveUpButton.addEventListener("click", () => moveQuestion(question, "up"));
        moveDownButton.type = "button";
        moveDownButton.disabled = phaseIndex === phaseQuestions.length - 1;
        moveDownButton.addEventListener("click", () => moveQuestion(question, "down"));
        visibilityButton.type = "button";
        visibilityButton.addEventListener("click", () => toggleQuestionVisibility(question));
        editButton.type = "button";
        editButton.addEventListener("click", () => editQuestion(question));
        deleteButton.type = "button";
        deleteButton.addEventListener("click", () => deleteQuestion(question));
        actions.append(dragHint, moveUpButton, moveDownButton, visibilityButton, editButton, deleteButton);
        item.append(prompt, label, typeLabel, requiredLabel, pointsLabel, instructions, hint);
        if (correctAnswerText) {
            item.append(correctAnswer);
        }
        if (lengthRulesText) {
            item.append(lengthRules);
        }
        if (optionQuestionTypes.includes(question.question_type) && options.length) {
            item.append(optionList);
        }
        item.append(actions);
        list.append(item);
        });

        section.append(list);
        return section;
    });

    questionList.replaceChildren(...sections);
}

function renderQuestionPreview(questions) {
    const visibleQuestions = questions.filter((question) => question.is_visible);
    const header = createElement("div", "lesson-content-header");
    const heading = createElement("h6", "", "Student preview");

    header.append(heading);

    if (!visibleQuestions.length) {
        questionPreview.replaceChildren(
            header,
            createElement("p", "empty-state empty-state--compact", "No visible questions are ready for student preview.")
        );
        return;
    }

    const previewSections = questionPhases.map(([phase, phaseTitle]) => {
        const phaseQuestions = visibleQuestions.filter((question) => question.phase === phase);
        const section = createElement("section", "lesson-content");
        const heading = createElement("h3", "course-subheading", phaseTitle);

        section.append(heading);

        if (!phaseQuestions.length) {
            section.append(createElement("p", "empty-state empty-state--compact", "No visible questions in this section."));
            return section;
        }

        phaseQuestions.forEach((question) => {
            const card = createElement("article", "question-card");
            const prompt = createElement("h4", "question-prompt", question.prompt);
            const responseType = question.question_type || "short_response";
            const instructions = createElement(
                "p",
                "course-muted question-instructions",
                question.student_instructions || "Answer in your own words."
            );

            card.append(prompt, instructions);

            if (responseType === "multiple_choice" || responseType === "select_all_that_apply") {
                const options = getQuestionOptions(question);
                const fieldset = createElement("fieldset", "question-preview-options");
                const legend = createElement("legend", "screen-reader-only", "Answer choices");

                fieldset.append(legend);
                if (!options.length) {
                    fieldset.append(
                        createElement("p", "empty-state empty-state--compact", "Answer choices will appear here after options are added.")
                    );
                }

                options.forEach((option) => {
                    const label = createElement("label", "question-preview-option");
                    const input = document.createElement("input");

                    input.type = responseType === "multiple_choice" ? "radio" : "checkbox";
                    input.disabled = true;
                    label.append(input, createElement("span", "", option.option_text));
                    fieldset.append(label);
                });
                card.append(fieldset);
            } else if (responseType === "matching") {
                const options = getQuestionOptions(question);
                const list = createElement("dl", "question-matching-preview");

                if (!options.length) {
                    card.append(createElement("p", "empty-state empty-state--compact", "Matching pairs will appear here after they are added."));
                }

                options.forEach((option) => {
                    list.append(
                        createElement("dt", "", option.option_text),
                        createElement("dd", "", option.match_group || "Match")
                    );
                });
                card.append(list);
            } else if (responseType === "ordering") {
                const options = getQuestionOptions(question);
                const list = createElement("ol", "question-ordering-preview");

                if (!options.length) {
                    card.append(createElement("p", "empty-state empty-state--compact", "Sequence items will appear here after they are added."));
                }

                options.forEach((option) => {
                    list.append(createElement("li", "", option.option_text));
                });
                card.append(list);
            } else if (responseType === "true_false") {
                const fieldset = createElement("fieldset", "question-preview-options");
                const legend = createElement("legend", "screen-reader-only", "True or false answer choices");

                fieldset.append(legend);
                ["True", "False"].forEach((option) => {
                    const label = createElement("label", "question-preview-option");
                    const input = document.createElement("input");

                    input.type = "radio";
                    input.disabled = true;
                    label.append(input, createElement("span", "", option));
                    fieldset.append(label);
                });
                card.append(fieldset);
            } else if (responseType === "rating_scale") {
                const fieldset = createElement("fieldset", "question-preview-options question-rating-scale");
                const legend = createElement("legend", "screen-reader-only", "Rating scale choices");

                fieldset.append(legend);
                [1, 2, 3, 4, 5].forEach((rating) => {
                    const label = createElement("label", "question-preview-option");
                    const input = document.createElement("input");

                    input.type = "radio";
                    input.disabled = true;
                    label.append(input, createElement("span", "", String(rating)));
                    fieldset.append(label);
                });
                card.append(fieldset);
            } else if (responseType === "fill_in_the_blank") {
                const response = document.createElement("input");

                response.className = "question-preview-blank";
                response.type = "text";
                response.placeholder = question.hint ? `Hint: ${question.hint}` : "Student answer";
                response.disabled = true;
                card.append(response);
            } else {
                const response = createElement("textarea", "question-preview-response", "");

                response.rows = responseType === "long_response" ? 5 : 3;
                response.placeholder = question.hint ? `Hint: ${question.hint}` : "Student response";
                response.disabled = true;
                card.append(response);
            }

            section.append(card);
        });

        return section;
    });

    questionPreview.replaceChildren(header, ...previewSections);
}

async function loadQuestions() {
    const { data, error } = await supabase
        .from("questions")
        .select("id, phase, question_type, prompt, student_instructions, hint, correct_answer, points, is_required, order_index, is_visible")
        .eq("lesson_id", lessonId)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        questionList.replaceChildren(createElement("p", "empty-state", "Draft questions could not be loaded."));
        setStatus("Draft questions could not be loaded.", "error");
        return false;
    }

    const questionIds = data.map((question) => question.id);
    const { data: options, error: optionsError } = questionIds.length
        ? await supabase
            .from("question_options")
            .select("id, question_id, option_text, option_value, is_correct, match_group, order_index")
            .in("question_id", questionIds)
            .order("order_index", { ascending: true })
        : { data: [], error: null };

    if (optionsError) {
        setStatus("Draft question options could not be loaded.", "error");
    }

    loadedQuestions = data.map((question) => ({
        ...question,
        options: (options || []).filter((option) => option.question_id === question.id),
    }));
    renderQuestions(loadedQuestions);
    renderQuestionPreview(loadedQuestions);
    return true;
}

async function loadLessonContext() {
    if (!lessonId) {
        headingElement.textContent = "Lesson unavailable";
        setStatus("Open a lesson from course management before using the lesson builder.", "error");
        return null;
    }

    const { data: lesson, error: lessonError } = await supabase
        .from("lessons")
        .select("id, module_id, title, objective, summary, estimated_time, order_index")
        .eq("id", lessonId)
        .is("archived_at", null)
        .single();

    if (lessonError) {
        headingElement.textContent = "Lesson unavailable";
        setStatus("This lesson could not be loaded.", "error");
        return null;
    }

    const { data: module, error: moduleError } = await supabase
        .from("modules")
        .select("id, course_id, title, order_index")
        .eq("id", lesson.module_id)
        .is("archived_at", null)
        .single();

    if (moduleError) {
        headingElement.textContent = "Lesson unavailable";
        setStatus("The module for this lesson could not be loaded.", "error");
        return null;
    }

    const { data: canManage, error: permissionError } = await supabase.rpc("can_manage_course", {
        course_to_check: module.course_id,
    });

    if (permissionError || !canManage) {
        headingElement.textContent = "Lesson unavailable";
        setStatus("You do not have permission to manage this lesson.", "error");
        return null;
    }

    const { data: course, error: courseError } = await supabase
        .from("courses")
        .select("id, title")
        .eq("id", module.course_id)
        .single();

    if (courseError) {
        headingElement.textContent = "Lesson unavailable";
        setStatus("The course for this lesson could not be loaded.", "error");
        return null;
    }

    return { lesson, module, course };
}

async function initializePage() {
    const profile = await loadProtectedProfile({ statusElement });

    if (!profile) {
        return;
    }

    currentProfile = profile;
    const context = await loadLessonContext();

    if (!context) {
        return;
    }

    currentLessonContext = context;
    const { lesson, module, course } = context;

    headingElement.textContent = lesson.title || "Untitled lesson";
    contextElement.textContent = `${course.title || "Untitled course"} / ${module.title || "Untitled module"}`;
    if (canvasContextElement) {
        canvasContextElement.textContent = `${course.title || "Untitled course"} / ${module.title || "Untitled module"}`;
    }
    if (canvasTitleElement) {
        canvasTitleElement.textContent = lesson.title || "Untitled lesson";
    }
    if (canvasObjectiveElement) {
        canvasObjectiveElement.textContent = lesson.objective || "Add an objective so students know what they are working toward.";
    }
    if (canvasOverviewElement) {
        canvasOverviewElement.textContent = lesson.summary || "Add a short overview for this lesson.";
    }
    if (canvasDurationElement) {
        canvasDurationElement.textContent = lesson.estimated_time || "Not set";
    }
    courseEditorLink.href = `../courses/editor.html?course=${encodeURIComponent(course.id)}`;
    courseEditorLink.textContent = "Back to course editor";
    studentViewLink.href = `view.html?lesson=${encodeURIComponent(lesson.id)}`;
    studentViewLink.hidden = false;
    modulePosition.textContent = String(module.order_index + 1);
    lessonPosition.textContent = String(lesson.order_index + 1);
    lessonDetails.replaceChildren(buildDetailsList(lesson, module, course));
    setContentBlockFormMode(contentBlockTypeSelect.value);
    setQuestionFormMode(questionForm.elements["question-type"].value);
    hideBuilderEditors({ scrollToCanvas: false });
    showContent();
    await loadLessonResources();
    const [contentLoaded, questionsLoaded] = await Promise.all([loadContentBlocks(), loadQuestions()]);

    if (contentLoaded && questionsLoaded) {
        setStatus("");
    }
}

contentBlockForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(contentBlockForm);
    const contentBlockId = String(formData.get("content-block-id") || "").trim();
    const blockType = formatContentBlockType(String(formData.get("block-type") || "text"));
    const storedBlockType = getStoredBlockType(blockType);
    const title = String(formData.get("title") || "").trim();
    const bodyText = String(formData.get("body-text") || "").trim();
    const contentUrl = String(formData.get("content-url") || "").trim();
    const uploadedResource = contentUploadInput.files?.[0];
    const selectedResourceId = String(formData.get("resource-library") || "").trim();
    const selectedResource = selectedResourceId ? getSelectedLessonResource(selectedResourceId) : null;
    const resourceValidationError = validateLessonResource(uploadedResource, blockType);
    const fileType = blockType === "audio"
        ? "audio"
        : uploadedResource
        ? getUploadedFileType(uploadedResource)
        : selectedResource
            ? getResourceFileType(selectedResource)
            : String(formData.get("file-type") || "pdf");
    const submitButton = contentBlockForm.querySelector("button[type='submit']");

    if ((blockType === "text" && !bodyText) || (!["text", "file", "image", "audio"].includes(blockType) && !contentUrl)) {
        setStatus(`Enter ${blockType === "text" ? "written content" : "a URL"} before saving.`, "error");
        return;
    }

    if (["file", "image", "audio"].includes(blockType) && !contentUrl && !uploadedResource && !selectedResource) {
        setStatus("Paste a resource URL or choose a file to upload before saving.", "error");
        return;
    }

    if (uploadedResource && selectedResource) {
        setStatus("Choose either a new upload or a resource library item, not both.", "error");
        return;
    }

    if (contentUrl && selectedResource) {
        setStatus("Clear the URL field before attaching a resource library item.", "error");
        return;
    }

    if (selectedResourceId && !selectedResource) {
        setStatus("Choose a valid resource from your library before saving.", "error");
        return;
    }

    if (resourceValidationError) {
        setStatus(resourceValidationError, "error");
        return;
    }

    if (contentBlockId) {
        const contentBlock = loadedContentBlocks.find((currentBlock) => currentBlock.id === contentBlockId);

        if (!contentBlock) {
            setStatus("Choose a content block before saving.", "error");
            return;
        }

        setStatus("Saving lesson content...");
        submitButton.disabled = true;
        let uploadedFileRecord = null;
        let savedFileRecord = selectedResource;
        let savedFileUrl = selectedResource?.storage_path || contentUrl;

        if (uploadedResource) {
            try {
                setStatus("Uploading lesson resource...");
                setUploadStatus(`Uploading ${uploadedResource.name}...`, "info");
                uploadedFileRecord = await uploadLessonResource(uploadedResource, title);
                savedFileRecord = uploadedFileRecord;
                savedFileUrl = uploadedFileRecord.storage_path;
                setUploadStatus(`Uploaded ${uploadedResource.name}.`, "success");
            } catch (error) {
                submitButton.disabled = false;
                setStatus(`Lesson resource upload failed: ${error.message}`, "error");
                return;
            }
        }

        const { error } = await supabase
            .from("lesson_content_blocks")
            .update({
                block_type: storedBlockType,
                title: title || null,
                body_text: blockType === "text" ? bodyText : null,
                external_url: ["link", "slides", "youtube"].includes(blockType) ? contentUrl : null,
                file_url: ["file", "image", "audio"].includes(blockType) ? savedFileUrl : null,
                file_type: blockType === "image" ? "image" : ["file", "audio"].includes(blockType) ? fileType : null,
            })
            .eq("id", contentBlockId)
            .eq("lesson_id", lessonId);

        submitButton.disabled = false;

        if (error) {
            setStatus(error.message || "The lesson content could not be saved.", "error");
            return;
        }

        if (["file", "image", "audio"].includes(blockType)) {
            try {
                await clearLessonResourceLinks(contentBlockId);
                if (savedFileRecord) {
                    await linkLessonResource(savedFileRecord, contentBlockId);
                }
            } catch (error) {
                setStatus(`Lesson content saved, but the file link failed: ${error.message}`, "error");
                return;
            }
        } else if (contentBlock.file_resource) {
            try {
                await clearLessonResourceLinks(contentBlockId);
            } catch (error) {
                setStatus(`Lesson content saved, but the old file link could not be removed: ${error.message}`, "error");
                return;
            }
        }

        resetContentBlockForm();
        await loadLessonResources();
        await loadContentBlocks();
        hideBuilderEditors();
        setStatus("Lesson content saved.", "success");
        return;
    }

    const nextOrder = loadedContentBlocks.reduce(
        (highest, contentBlock) => Math.max(highest, contentBlock.order_index),
        -1
    ) + 1;
    setStatus("Creating lesson content...");
    submitButton.disabled = true;
    let uploadedFileRecord = null;
    let savedFileRecord = selectedResource;
    let savedFileUrl = selectedResource?.storage_path || contentUrl;

    if (uploadedResource) {
        try {
            setStatus("Uploading lesson resource...");
            setUploadStatus(`Uploading ${uploadedResource.name}...`, "info");
            uploadedFileRecord = await uploadLessonResource(uploadedResource, title);
            savedFileRecord = uploadedFileRecord;
            savedFileUrl = uploadedFileRecord.storage_path;
            setUploadStatus(`Uploaded ${uploadedResource.name}.`, "success");
        } catch (error) {
            submitButton.disabled = false;
            setStatus(`Lesson resource upload failed: ${error.message}`, "error");
            return;
        }
    }

    const { data: contentBlock, error } = await supabase.from("lesson_content_blocks").insert({
        lesson_id: lessonId,
        block_type: storedBlockType,
        title: title || null,
        body_text: blockType === "text" ? bodyText : null,
        external_url: ["link", "slides", "youtube"].includes(blockType) ? contentUrl : null,
        file_url: ["file", "image", "audio"].includes(blockType) ? savedFileUrl : null,
        file_type: blockType === "image" ? "image" : ["file", "audio"].includes(blockType) ? fileType : null,
        order_index: nextOrder,
        is_visible: false,
    })
        .select("id")
        .single();

    submitButton.disabled = false;

    if (error) {
        setStatus(error.message || "The lesson content could not be created.", "error");
        return;
    }

    if (savedFileRecord) {
        try {
            await linkLessonResource(savedFileRecord, contentBlock.id);
        } catch (error) {
            setStatus(`Lesson content created, but the file link failed: ${error.message}`, "error");
            return;
        }
    }

    resetContentBlockForm();
    await loadLessonResources();
    await loadContentBlocks();
    hideBuilderEditors();
    setStatus("Lesson content created.", "success");
});

contentBlockTypeSelect.addEventListener("change", () => {
    setContentBlockFormMode(contentBlockTypeSelect.value);
});

contentToolButtons.forEach((button) => {
    button.addEventListener("click", () => {
        createInlineDraftBlock(button);
    });
    button.draggable = true;
    button.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("application/x-builder-tool", JSON.stringify({
            toolType: "content",
            value: button.dataset.contentTool || "text",
            template: button.dataset.layoutTemplate || button.dataset.contentTool || "text",
        }));
    });
});

textFormatButtons.forEach((button) => {
    button.addEventListener("click", () => {
        insertTextFormatting(button.dataset.formatAction || "");
    });
});

contentUploadInput.addEventListener("change", () => {
    const file = contentUploadInput.files?.[0];

    if (!file) {
        setUploadStatus();
        return;
    }

    const blockType = formatContentBlockType(contentBlockTypeSelect.value);
    const validationError = validateLessonResource(file, blockType);

    if (validationError) {
        setUploadStatus(validationError, "error");
        return;
    }

    resourceLibrarySelect.value = "";
    setUploadStatus(`Ready to upload ${file.name} (${formatFileSize(file.size)}).`, "success");
});

resourceLibrarySelect.addEventListener("change", () => {
    if (resourceLibrarySelect.value) {
        contentUploadInput.value = "";
        setUploadStatus("Using a resource from your library for this content block.", "info");
    }
});

cancelContentBlockEditButton.addEventListener("click", () => {
    resetContentBlockForm();
    hideBuilderEditors();
});

questionForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(questionForm);
    const questionId = String(formData.get("question-id") || "").trim();
    const phase = String(formData.get("phase") || "");
    const questionType = String(formData.get("question-type") || "short_response");
    const prompt = String(formData.get("prompt") || "").trim();
    const studentInstructions = String(formData.get("student-instructions") || "").trim();
    const hint = String(formData.get("hint") || "").trim();
    const points = Number(formData.get("points") || 0);
    const isRequired = formData.get("is-required") === "on";
    const correctAnswer = getCorrectAnswerInput(formData, questionType);
    const optionInputs = getQuestionOptionInputs(formData, questionType);
    const submitButton = questionForm.querySelector("button[type='submit']");

    if (!["before", "during", "reflection"].includes(phase) || !prompt) {
        setStatus("Choose a phase and enter a question prompt before saving.", "error");
        return;
    }

    if (!Object.hasOwn(questionTypeLabels, questionType)) {
        setStatus("Choose a supported question type before saving.", "error");
        return;
    }

    if (!Number.isFinite(points) || points < 0) {
        setStatus("Enter a valid non-negative point value before saving.", "error");
        return;
    }

    if (correctAnswer?.invalid && correctAnswer.reason === "length") {
        setStatus("Enter valid response length rules before saving.", "error");
        return;
    }

    if (correctAnswer?.invalid) {
        setStatus("Enter a correct rating from 1 to 5, or leave it blank.", "error");
        return;
    }

    if (optionQuestionTypes.includes(questionType) && optionInputs.some((optionInput) => !optionInput.text)) {
        setStatus("Enter all four option rows before saving this question type.", "error");
        return;
    }

    if (questionType === "matching" && optionInputs.some((optionInput) => !optionInput.matchText)) {
        setStatus("Enter all four matching pairs before saving this question type.", "error");
        return;
    }

    if (choiceQuestionTypes.includes(questionType) && !optionInputs.some((optionInput) => optionInput.isCorrect)) {
        setStatus("Mark at least one correct answer before saving this question type.", "error");
        return;
    }

    if (questionType === "multiple_choice" && optionInputs.filter((optionInput) => optionInput.isCorrect).length > 1) {
        setStatus("Multiple choice questions can only have one correct answer.", "error");
        return;
    }

    if (questionId) {
        const question = loadedQuestions.find((currentQuestion) => currentQuestion.id === questionId);

        if (!question) {
            setStatus("Choose a draft question before saving.", "error");
            return;
        }

        setStatus("Saving draft question...");
        submitButton.disabled = true;

        const { error } = await supabase
            .from("questions")
            .update({
                phase,
                question_type: questionType,
                prompt,
                student_instructions: studentInstructions || null,
                hint: hint || null,
                correct_answer: correctAnswer,
                points,
                is_required: isRequired,
            })
            .eq("id", questionId)
            .eq("lesson_id", lessonId);

        if (error) {
            submitButton.disabled = false;
            setStatus(error.message || "The draft question could not be saved.", "error");
            return;
        }

        const optionError = await saveQuestionOptions(questionId, optionInputs, question.options || []);
        submitButton.disabled = false;

        if (optionError) {
            setStatus(optionError.message || "The answer choices could not be saved.", "error");
            return;
        }

        resetQuestionForm();
        await loadQuestions();
        hideBuilderEditors();
        setStatus("Draft question saved.", "success");
        return;
    }

    const lessonPhaseQuestions = loadedQuestions.filter((question) => question.phase === phase);
    const nextOrder = lessonPhaseQuestions.reduce(
        (highest, question) => Math.max(highest, question.order_index),
        -1
    ) + 1;
    setStatus("Creating draft question...");
    submitButton.disabled = true;

    const { data: createdQuestion, error } = await supabase.from("questions").insert({
        lesson_id: lessonId,
        phase,
        question_type: questionType,
        prompt,
        student_instructions: studentInstructions || null,
        hint: hint || null,
        correct_answer: correctAnswer,
        points,
        is_required: isRequired,
        is_visible: false,
        order_index: nextOrder,
    }).select("id").single();

    if (error) {
        submitButton.disabled = false;
        setStatus(error.message || "The draft question could not be created.", "error");
        return;
    }

    const optionError = await saveQuestionOptions(createdQuestion.id, optionInputs);
    submitButton.disabled = false;

    if (optionError) {
        setStatus(optionError.message || "The answer choices could not be saved.", "error");
        return;
    }

    resetQuestionForm();
    await loadQuestions();
    hideBuilderEditors();
    setStatus("Draft question created.", "success");
});

questionForm.elements["question-type"].addEventListener("change", (event) => {
    const questionId = questionForm.elements["question-id"].value;
    const question = loadedQuestions.find((currentQuestion) => currentQuestion.id === questionId);

    if (question && question.question_type !== event.target.value && hasQuestionAnswerConfig(question)) {
        const confirmed = window.confirm(
            "Changing this question type may ignore existing options or correct-answer data. Continue?"
        );

        if (!confirmed) {
            event.target.value = question.question_type;
            return;
        }
    }

    setQuestionFormMode(event.target.value);
});

questionToolButtons.forEach((button) => {
    button.addEventListener("click", () => {
        openQuestionTool(button.dataset.questionTool || "short_response");
    });
    button.draggable = true;
    button.addEventListener("dragstart", (event) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData("application/x-builder-tool", JSON.stringify({
            toolType: "question",
            value: button.dataset.questionTool || "short_response",
        }));
    });
});

questionForm.elements["is-required"].addEventListener("change", updateNewQuestionPointDefault);
cancelQuestionEditButton.addEventListener("click", () => {
    resetQuestionForm();
    hideBuilderEditors();
});

builderDropZone?.addEventListener("dragover", (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    builderDropZone.classList.add("lesson-page-insert-zone--active");
});

builderDropZone?.addEventListener("dragleave", () => {
    builderDropZone.classList.remove("lesson-page-insert-zone--active");
});

builderDropZone?.addEventListener("drop", (event) => {
    event.preventDefault();
    builderDropZone.classList.remove("lesson-page-insert-zone--active");

    const tool = getBuilderToolFromTransfer(event);
    if (tool.toolType === "content") {
        createInlineDraftBlock({
            dataset: {
                contentTool: tool.value || "text",
                layoutTemplate: tool.template || tool.value || "text",
            },
        });
        return;
    }
    openBuilderTool(tool.toolType, tool.value);
});

closeContentEditorButton?.addEventListener("click", () => {
    resetContentBlockForm();
    hideBuilderEditors();
});

closeQuestionEditorButton?.addEventListener("click", () => {
    resetQuestionForm();
    hideBuilderEditors();
});

await initializePage();
