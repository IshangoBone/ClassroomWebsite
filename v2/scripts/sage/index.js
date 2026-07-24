import { supabase } from "../../services/supabase/client.js";
import { isTeachingRole, loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { encodeLessonMetadata } from "../utils/lesson-metadata.js";
import {
    INSTRUCTIONAL_STRATEGY_MEMORY,
    getInstructionalStrategySummary,
} from "./instructional-strategies.js";

const statusElement = qs("[data-sage-status]");
const form = qs("[data-sage-slide-form]");
const courseSelect = qs("[data-sage-course-select]");
const moduleSelect = qs("[data-sage-module-select]");
const lessonSelect = qs("[data-sage-lesson-select]");
const lessonFields = qs("[data-sage-lesson-fields]");
const manualFields = qs("[data-sage-manual-fields]");
const selectedLessonPanel = qs("[data-sage-selected-lesson]");
const previewPanel = qs("[data-sage-slide-preview]");
const resetButton = qs("[data-sage-reset]");
const toolButtons = Array.from(document.querySelectorAll("[data-sage-tool]"));
const toolPanels = Array.from(document.querySelectorAll("[data-sage-panel]"));
const plannerForm = qs("[data-sage-planner-form]");
const plannerPreview = qs("[data-sage-planner-preview]");
const plannerResetButton = qs("[data-sage-planner-reset]");
const pdfInput = qs("[data-sage-pdf-input]");
const standardsInput = qs("[data-sage-standards-input]");
const fileNameElement = qs("[data-sage-file-name]");
const standardsFileNameElement = qs("[data-sage-standards-file-name]");
const dropzones = Array.from(document.querySelectorAll("[data-sage-dropzone]"));
const blueprintDialog = qs("[data-sage-blueprint-dialog]");
const blueprintOpenButton = qs("[data-sage-preview-open]");
const blueprintCloseButton = qs("[data-sage-preview-close]");
const blueprintLauncherCopy = qs("[data-sage-preview-launcher-copy]");
const createCourseButton = qs("[data-sage-create-course]");
const createCourseStatus = qs("[data-sage-course-create-status]");
const generateButton = qs("[data-sage-generate-button]");
const generateButtonLabel = qs("[data-sage-generate-label]");
const generateSpinner = qs("[data-sage-generate-spinner]");

const PDFJS_MODULE_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";
const PDFJS_WORKER_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
const MAX_PDF_PAGES = Number.POSITIVE_INFINITY;
const AP_CSA_UNIT_NAMES = new Map([
    ["1", "Using Objects and Methods"],
    ["2", "Selection and Iteration"],
    ["3", "Class Creation"],
    ["4", "Data Collections"],
    ["5", "Classes and Data Structures"],
    ["6", "Array and ArrayList Algorithms"],
    ["7", "2D Array"],
    ["8", "Inheritance"],
    ["9", "Recursion"],
    ["10", "Professional Practice and AP Review"],
]);

let currentProfile = null;
let courses = [];
let modules = [];
let lessons = [];
let currentDeckUrl = "";
let plannerDroppedFile = null;
let standardsDroppedFile = null;
let currentBlueprint = null;

function setPlannerLoading(isLoading) {
    if (generateButton) {
        generateButton.disabled = isLoading;
        generateButton.classList.toggle("is-loading", isLoading);
        generateButton.setAttribute("aria-busy", isLoading ? "true" : "false");
    }
    if (generateButtonLabel) {
        generateButtonLabel.textContent = isLoading
            ? "Building course preview..."
            : "Generate course preview";
    }
    if (generateSpinner) {
        generateSpinner.hidden = !isLoading;
    }
    if (plannerResetButton) {
        plannerResetButton.disabled = isLoading;
    }
    plannerForm?.setAttribute("aria-busy", isLoading ? "true" : "false");
}

function openBlueprintDialog() {
    if (!blueprintDialog || !currentBlueprint) {
        return;
    }

    if (typeof blueprintDialog.showModal === "function") {
        if (!blueprintDialog.open) {
            blueprintDialog.showModal();
        }
    } else {
        blueprintDialog.setAttribute("open", "");
    }
}

function closeBlueprintDialog() {
    if (!blueprintDialog) {
        return;
    }

    if (typeof blueprintDialog.close === "function" && blueprintDialog.open) {
        blueprintDialog.close();
    } else {
        blueprintDialog.removeAttribute("open");
    }
}

function setBlueprintAvailable(isAvailable) {
    if (blueprintOpenButton) {
        blueprintOpenButton.disabled = !isAvailable;
    }
    if (blueprintLauncherCopy) {
        blueprintLauncherCopy.textContent = isAvailable
            ? "Your generated modules, lessons, standards alignments, and instructional strategies are ready to review."
            : "Upload both source PDFs and generate the course to open its module and lesson map.";
    }
    if (createCourseButton) {
        createCourseButton.disabled = !isAvailable;
        createCourseButton.textContent = "Create course";
    }
    if (createCourseStatus) {
        createCourseStatus.textContent = isAvailable
            ? "Review the generated structure, then create it as a draft course."
            : "Generate a course map before creating the draft course.";
        delete createCourseStatus.dataset.tone;
    }
}

function setCreateCourseStatus(message, tone = "") {
    if (!createCourseStatus) {
        return;
    }
    createCourseStatus.textContent = message;
    if (tone) {
        createCourseStatus.dataset.tone = tone;
    } else {
        delete createCourseStatus.dataset.tone;
    }
}

function inferBlueprintSubject(blueprint) {
    const context = `${blueprint.title} ${blueprint.source} ${blueprint.modules.map((module) => module.title).join(" ")}`;
    if (isComputingCourse(context)) {
        return "Computer Science";
    }
    if (/\b(personal finance|financial|money management|credit|investing)\b/i.test(context)) {
        return "Personal Finance";
    }
    return "General Studies";
}

function buildSavedCourseDescription(blueprint) {
    const subject = detectCourseSubject(
        `${blueprint.title} ${blueprint.modules.map((module) => module.title).join(" ")}`,
    );

    const descriptions = {
        personalFinance: "Students learn to make informed financial decisions through earning, budgeting, credit, taxes, insurance, investing, and career planning. The course emphasizes practical application, risk evaluation, and long-term financial well-being.",
        english: "Students strengthen reading, writing, discussion, vocabulary, and evidence-based analysis across a range of texts. Lessons emphasize clear communication, thoughtful interpretation, and effective use of evidence.",
        computing: "Students develop computational thinking through programming, problem-solving, debugging, data, and collaborative projects. The course emphasizes designing, testing, and explaining solutions.",
        math: "Students build mathematical reasoning through concepts, models, calculations, and real-world applications. Lessons emphasize accurate problem-solving, clear justification, and connections among representations.",
        science: "Students investigate scientific concepts through evidence, models, inquiry, and analysis. The course emphasizes explaining phenomena, evaluating information, and applying ideas to real-world situations.",
        socialStudies: "Students examine people, events, institutions, and ideas through evidence and discussion. Lessons emphasize historical context, civic reasoning, source analysis, and informed conclusions.",
        general: "Students develop essential knowledge and skills through focused, standards-aligned lessons. The course combines clear explanations, practical applications, discussion, and reflection.",
    };

    return descriptions[subject] || descriptions.general;
}

function buildSavedLessonSummary(lesson) {
    return encodeLessonMetadata({
        ...lesson,
        overview: createConciseLessonOverview(lesson.title, lesson.overview),
    });
}

function buildSavedModuleDescription(module) {
    const existingOverview = String(module.overview || "").trim();
    if (existingOverview && !/^\d+\s+(?:planned\s+)?lessons?\.?$/i.test(existingOverview)) {
        return /[.!?]$/.test(existingOverview) ? existingOverview : `${existingOverview}.`;
    }

    const topics = module.lessons
        .map((lesson) => stripGeneratedOrderingPrefix(lesson.title).toLowerCase())
        .filter(Boolean)
        .slice(0, 3);

    if (!topics.length) {
        return `This module develops practical understanding of ${stripGeneratedOrderingPrefix(module.title).toLowerCase()}.`;
    }

    const topicPhrase = topics.length === 1
        ? topics[0]
        : `${topics.slice(0, -1).join(", ")}${topics.length > 2 ? "," : ""} and ${topics.at(-1)}`;
    return `This module develops understanding of ${topicPhrase}.`;
}

async function createCourseFromBlueprint() {
    if (!currentProfile || !currentBlueprint || !createCourseButton) {
        setCreateCourseStatus("Generate a course map and make sure your teacher profile is loaded first.", "error");
        return;
    }

    createCourseButton.disabled = true;
    createCourseButton.textContent = "Creating course...";
    setCreateCourseStatus("Creating the draft course...", "");

    try {
        const { data: course, error: courseError } = await supabase
            .from("courses")
            .insert({
                owner_user_id: currentProfile.id,
                title: currentBlueprint.title,
                description: buildSavedCourseDescription(currentBlueprint),
                subject_area: inferBlueprintSubject(currentBlueprint),
                tags: ["course-planner", "standards-aligned"],
                estimated_length: `${currentBlueprint.stats[0]?.[1] || currentBlueprint.modules.reduce((sum, module) => sum + module.lessons.length, 0)} class days`,
            })
            .select("id")
            .single();

        if (courseError || !course?.id) {
            throw courseError || new Error("The draft course could not be created.");
        }

        setCreateCourseStatus(`Creating ${currentBlueprint.modules.length} modules...`);
        const { data: savedModules, error: modulesError } = await supabase
            .from("modules")
            .insert(currentBlueprint.modules.map((module, index) => ({
                course_id: course.id,
                title: stripGeneratedOrderingPrefix(module.title),
                description: buildSavedModuleDescription(module),
                order_index: index,
            })))
            .select("id, order_index");

        if (modulesError || !savedModules?.length) {
            throw modulesError || new Error("The course modules could not be created.");
        }

        const moduleIdsByOrder = new Map(
            savedModules.map((module) => [Number(module.order_index), module.id]),
        );
        const lessonsToInsert = currentBlueprint.modules.flatMap((module, moduleIndex) => {
            const moduleId = moduleIdsByOrder.get(moduleIndex);
            return module.lessons.map((lesson, lessonIndex) => ({
                module_id: moduleId,
                title: stripGeneratedOrderingPrefix(lesson.title),
                objective: lesson.objective || null,
                summary: buildSavedLessonSummary(lesson) || null,
                estimated_time: "1 class day",
                order_index: lessonIndex,
            }));
        });

        if (lessonsToInsert.some((lesson) => !lesson.module_id)) {
            throw new Error("A generated module could not be matched to its lessons.");
        }

        setCreateCourseStatus(`Creating ${lessonsToInsert.length} one-day lessons...`);
        const { error: lessonsError } = await supabase
            .from("lessons")
            .insert(lessonsToInsert);
        if (lessonsError) {
            throw lessonsError;
        }

        setCreateCourseStatus("Course created. Opening the course editor...", "success");
        createCourseButton.textContent = "Course created";
        window.location.href = `../../courses/editor.html?course=${encodeURIComponent(course.id)}#content`;
    } catch (error) {
        console.error(error);
        createCourseButton.disabled = false;
        createCourseButton.textContent = "Try creating course again";
        setCreateCourseStatus(
            error.message || "The course could not be created. Your generated preview is still available.",
            "error",
        );
    }
}

function setInlineStatus(message, tone = "") {
    if (!statusElement) {
        return;
    }

    statusElement.textContent = message;

    if (tone) {
        statusElement.dataset.tone = tone;
    } else {
        delete statusElement.dataset.tone;
    }
}

function getAvailableTool(toolName) {
    const requestedTool = String(toolName || "").replace("#", "").trim();
    if (toolPanels.length === 1) {
        return toolPanels[0].dataset.sagePanel || "planner";
    }

    return toolPanels.some((panel) => panel.dataset.sagePanel === requestedTool) ? requestedTool : "planner";
}

function getRequestedToolFromHash() {
    return getAvailableTool(window.location.hash.slice(1));
}

function selectTool(toolName, shouldSyncHash = true) {
    const selectedTool = getAvailableTool(toolName || "planner");

    toolButtons.forEach((button) => {
        const isActive = button.dataset.sageTool === selectedTool;
        button.classList.toggle("is-active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });

    toolPanels.forEach((panel) => {
        panel.hidden = panel.dataset.sagePanel !== selectedTool;
    });

    setInlineStatus(
        selectedTool === "slides"
            ? "Slide Deck Generator ready."
            : "Course Blueprint Planner ready.",
        "success",
    );

    if (shouldSyncHash && window.location.hash !== `#${selectedTool}`) {
        window.history.replaceState(null, "", `#${selectedTool}`);
    }
}

function formatDuration(value) {
    if (!value) {
        return "";
    }

    const normalized = String(value).trim();
    return /^\d+$/.test(normalized) ? `${normalized} minutes` : normalized;
}

function getMode() {
    if (!form) {
        return "manual";
    }

    return new FormData(form).get("sourceMode") || "lesson";
}

function sortByOrderThenTitle(first, second) {
    const firstOrder = Number(first.order_index) || 0;
    const secondOrder = Number(second.order_index) || 0;

    if (firstOrder !== secondOrder) {
        return firstOrder - secondOrder;
    }

    return String(first.title || "").localeCompare(String(second.title || ""));
}

function getCourseModules(courseId) {
    return modules
        .filter((module) => module.course_id === courseId)
        .sort(sortByOrderThenTitle);
}

function getModuleLessons(moduleId) {
    return lessons
        .filter((lesson) => lesson.module_id === moduleId)
        .sort(sortByOrderThenTitle);
}

function getSelectedCourse() {
    return courses.find((course) => course.id === courseSelect?.value) || null;
}

function getSelectedModule() {
    return modules.find((module) => module.id === moduleSelect?.value) || null;
}

function getSelectedLesson() {
    return lessons.find((lesson) => lesson.id === lessonSelect?.value) || null;
}

function renderSelectOptions(select, items, placeholder, getLabel) {
    if (!select) {
        return;
    }

    select.replaceChildren(createElement("option", "", placeholder));
    select.options[0].value = "";

    items.forEach((item) => {
        const option = createElement("option", "", getLabel(item));
        option.value = item.id;
        select.append(option);
    });
}

function renderCourses() {
    renderSelectOptions(courseSelect, courses, courses.length ? "Select a course" : "No courses found", (course) => course.title || "Untitled course");
    renderModuleOptions();
}

function renderModuleOptions() {
    const courseId = courseSelect?.value || "";
    const courseModules = courseId ? getCourseModules(courseId) : [];

    renderSelectOptions(
        moduleSelect,
        courseModules,
        courseId ? (courseModules.length ? "Select a module" : "No modules found") : "Select a course first",
        (module) => module.title || "Untitled module",
    );
    renderLessonOptions();
}

function renderLessonOptions() {
    const moduleId = moduleSelect?.value || "";
    const moduleLessons = moduleId ? getModuleLessons(moduleId) : [];

    renderSelectOptions(
        lessonSelect,
        moduleLessons,
        moduleId ? (moduleLessons.length ? "Select a lesson" : "No lessons found") : "Select a module first",
        (lesson) => lesson.title || "Untitled lesson",
    );
    renderSelectedLesson();
}

function renderSelectedLesson() {
    if (!selectedLessonPanel) {
        return;
    }

    const course = getSelectedCourse();
    const module = getSelectedModule();
    const lesson = getSelectedLesson();

    if (!lesson) {
        selectedLessonPanel.replaceChildren("Select a lesson to preview the details SAGE will use.");
        return;
    }

    const title = createElement("h3", "", lesson.title || "Untitled lesson");
    const meta = createElement(
        "p",
        "",
        `${course?.title || "Course"}${module?.title ? ` / ${module.title}` : ""}${lesson.estimated_time ? ` / ${formatDuration(lesson.estimated_time)}` : ""}`,
    );
    const objective = createElement("p", "", lesson.objective || "No objective has been added yet.");
    const overview = createElement("p", "", lesson.summary || "No overview has been added yet.");

    selectedLessonPanel.replaceChildren(title, meta, objective, overview);
}

function renderMode() {
    const isManual = getMode() === "manual";

    if (lessonFields) {
        lessonFields.hidden = isManual;
    }

    if (manualFields) {
        manualFields.hidden = !isManual;
    }

    setInlineStatus(
        isManual
            ? "Manual presentation details are ready."
            : "Select a course, module, and lesson to start from existing BrainKernl content.",
        "success",
    );
}

function getManualBrief(formData) {
    return {
        sourceLabel: "Manual lesson details",
        courseTitle: "Custom presentation",
        title: String(formData.get("manualTitle") || "").trim(),
        objective: String(formData.get("manualObjective") || "").trim(),
        overview: String(formData.get("manualOverview") || "").trim(),
        duration: formatDuration(formData.get("manualDuration")),
    };
}

function getLessonBrief() {
    const course = getSelectedCourse();
    const module = getSelectedModule();
    const lesson = getSelectedLesson();

    return {
        sourceLabel: "Existing BrainKernl lesson",
        courseTitle: course?.title || "Course",
        moduleTitle: module?.title || "",
        title: lesson?.title || "",
        objective: lesson?.objective || "",
        overview: lesson?.summary || "",
        duration: formatDuration(lesson?.estimated_time),
    };
}

function validateBrief(brief, mode) {
    if (mode === "lesson" && !getSelectedLesson()) {
        return "Choose the course, module, and lesson you want SAGE to use.";
    }

    if (!brief.title) {
        return "Add a presentation title.";
    }

    if (!brief.objective && !brief.overview) {
        return "Add an objective or overview so SAGE has enough lesson context.";
    }

    return "";
}

function buildSlideOutline(brief, settings) {
    const count = Number(settings.slideCount) || 10;
    const baseSlides = [
        `Title and purpose: ${brief.title}`,
        `Today's target: ${brief.objective || "Introduce the main learning goal"}`,
        "Warm-up question to activate prior knowledge",
        "Core concept explanation with a clear visual model",
        "Teacher-guided example connected to the lesson context",
        "Student quick check for understanding",
        "Common misconception and how to correct it",
        "Practice prompt that prepares students for the BrainKernl lesson",
        "Wrap-up summary and student transition",
        "Next step: complete the lesson activity and questions",
    ];

    if (count <= baseSlides.length) {
        return baseSlides.slice(0, count);
    }

    return [
        ...baseSlides,
        ...Array.from({ length: count - baseSlides.length }, (_, index) => `Extension slide ${index + 1}: deepen practice or discussion`),
    ];
}

function escapeXml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function sanitizeFileName(value = "sage-slide-deck") {
    return String(value)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "sage-slide-deck";
}

function splitText(value = "", maxLength = 120) {
    const words = String(value).replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
    const lines = [];
    let currentLine = "";

    words.forEach((word) => {
        const candidate = currentLine ? `${currentLine} ${word}` : word;
        if (candidate.length > maxLength && currentLine) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = candidate;
        }
    });

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines.length ? lines : ["Add lesson context before presenting."];
}

function makeDeckSlides(brief, settings) {
    const outline = buildSlideOutline(brief, settings);
    const contextLine = [brief.courseTitle, brief.moduleTitle, brief.title].filter(Boolean).join(" / ");
    const overviewLines = splitText(brief.overview || "Use this presentation to introduce the lesson before students complete their BrainKernl work.", 110);
    const objectiveLines = splitText(brief.objective || "Students will connect the key lesson ideas to the activity that follows.", 100);

    const slides = [
        {
            eyebrow: "BrainKernl SAGE AI",
            title: brief.title,
            subtitle: contextLine,
            body: [
                brief.objective || "Lesson objective will be discussed in class.",
                `${settings.gradeLevel} / ${brief.duration || settings.durationFallback}`,
            ],
        },
        {
            eyebrow: "Lesson target",
            title: "Students know what to focus on",
            subtitle: brief.title,
            body: objectiveLines,
        },
        {
            eyebrow: "Lesson overview",
            title: "The lesson builds from context to application",
            subtitle: brief.moduleTitle || brief.courseTitle,
            body: overviewLines,
        },
    ];

    outline.slice(2).forEach((item, index) => {
        slides.push({
            eyebrow: `Teaching move ${index + 1}`,
            title: item.replace(/^.*?:\s*/, ""),
            subtitle: brief.title,
            body: [
                "Connect this idea to the lesson objective.",
                settings.quickChecks ? "Ask one quick check question before moving on." : "Keep the explanation concise and classroom-ready.",
                settings.lessonBridge ? "Tie the slide back to the BrainKernl lesson students will complete afterward." : "Use a concrete example students can explain back.",
            ],
        });
    });

    return slides.slice(0, Number(settings.slideCount) || slides.length);
}

function crc32(bytes) {
    let crc = -1;

    for (let index = 0; index < bytes.length; index += 1) {
        let value = (crc ^ bytes[index]) & 0xff;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
        }
        crc = (crc >>> 8) ^ value;
    }

    return (crc ^ -1) >>> 0;
}

function writeUint16(bytes, value) {
    bytes.push(value & 0xff, (value >>> 8) & 0xff);
}

function writeUint32(bytes, value) {
    bytes.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
}

function makeZip(files) {
    const encoder = new TextEncoder();
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const now = new Date();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

    files.forEach((file) => {
        const nameBytes = encoder.encode(file.path);
        const contentBytes = typeof file.content === "string" ? encoder.encode(file.content) : file.content;
        const checksum = crc32(contentBytes);
        const localHeader = [];

        writeUint32(localHeader, 0x04034b50);
        writeUint16(localHeader, 20);
        writeUint16(localHeader, 0);
        writeUint16(localHeader, 0);
        writeUint16(localHeader, dosTime);
        writeUint16(localHeader, dosDate);
        writeUint32(localHeader, checksum);
        writeUint32(localHeader, contentBytes.length);
        writeUint32(localHeader, contentBytes.length);
        writeUint16(localHeader, nameBytes.length);
        writeUint16(localHeader, 0);

        localParts.push(new Uint8Array(localHeader), nameBytes, contentBytes);

        const centralHeader = [];
        writeUint32(centralHeader, 0x02014b50);
        writeUint16(centralHeader, 20);
        writeUint16(centralHeader, 20);
        writeUint16(centralHeader, 0);
        writeUint16(centralHeader, 0);
        writeUint16(centralHeader, dosTime);
        writeUint16(centralHeader, dosDate);
        writeUint32(centralHeader, checksum);
        writeUint32(centralHeader, contentBytes.length);
        writeUint32(centralHeader, contentBytes.length);
        writeUint16(centralHeader, nameBytes.length);
        writeUint16(centralHeader, 0);
        writeUint16(centralHeader, 0);
        writeUint16(centralHeader, 0);
        writeUint16(centralHeader, 0);
        writeUint32(centralHeader, 0);
        writeUint32(centralHeader, offset);
        centralParts.push(new Uint8Array(centralHeader), nameBytes);

        offset += localHeader.length + nameBytes.length + contentBytes.length;
    });

    const centralSize = centralParts.reduce((total, part) => total + part.length, 0);
    const end = [];
    writeUint32(end, 0x06054b50);
    writeUint16(end, 0);
    writeUint16(end, 0);
    writeUint16(end, files.length);
    writeUint16(end, files.length);
    writeUint32(end, centralSize);
    writeUint32(end, offset);
    writeUint16(end, 0);

    return new Blob([...localParts, ...centralParts, new Uint8Array(end)], {
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
}

function emu(inches) {
    return Math.round(inches * 914400);
}

function pptTextBox(id, name, text, left, top, width, height, options = {}) {
    const color = options.color || "1D3760";
    const fontSize = Math.round((options.fontSize || 20) * 100);
    const bold = options.bold ? ' b="1"' : "";
    const paragraphs = Array.isArray(text) ? text : String(text).split("\n");
    const paragraphXml = paragraphs.map((line) => `
        <a:p>
          <a:pPr marL="0" indent="0"/>
          <a:r>
            <a:rPr lang="en-US" sz="${fontSize}"${bold}>
              <a:solidFill><a:srgbClr val="${color}"/></a:solidFill>
              <a:latin typeface="Aptos"/>
            </a:rPr>
            <a:t>${escapeXml(line)}</a:t>
          </a:r>
          <a:endParaRPr lang="en-US" sz="${fontSize}"/>
        </a:p>`).join("");

    return `
      <p:sp>
        <p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${emu(left)}" y="${emu(top)}"/><a:ext cx="${emu(width)}" cy="${emu(height)}"/></a:xfrm>
          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
          <a:noFill/><a:ln><a:noFill/></a:ln>
        </p:spPr>
        <p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0"/><a:lstStyle/>${paragraphXml}</p:txBody>
      </p:sp>`;
}

function pptShape(id, name, left, top, width, height, fill = "F7FAFF", line = "DBE4F1") {
    return `
      <p:sp>
        <p:nvSpPr><p:cNvPr id="${id}" name="${escapeXml(name)}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr>
          <a:xfrm><a:off x="${emu(left)}" y="${emu(top)}"/><a:ext cx="${emu(width)}" cy="${emu(height)}"/></a:xfrm>
          <a:prstGeom prst="roundRect"><a:avLst/></a:prstGeom>
          <a:solidFill><a:srgbClr val="${fill}"/></a:solidFill>
          <a:ln w="12700"><a:solidFill><a:srgbClr val="${line}"/></a:solidFill></a:ln>
        </p:spPr>
      </p:sp>`;
}

function makeSlideXml(slide, index, total, brief) {
    const footer = [brief.courseTitle, brief.moduleTitle, brief.title].filter(Boolean).join(" / ");
    const bodyLines = slide.body.flatMap((line) => splitText(line, 82)).slice(0, 8);

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      ${pptShape(2, "Header band", 0.55, 0.5, 12.25, 0.55, "EAF1FB", "EAF1FB")}
      ${pptTextBox(3, "Course context", `${brief.courseTitle} / ${brief.moduleTitle || "Module"} / ${brief.title}`, 0.75, 0.65, 10.7, 0.24, { fontSize: 10, bold: true, color: "4D6FA8" })}
      ${pptTextBox(4, "Eyebrow", slide.eyebrow, 0.75, 1.25, 4.5, 0.28, { fontSize: 12, bold: true, color: "4D6FA8" })}
      ${pptTextBox(5, "Slide title", slide.title, 0.75, 1.65, 7.9, 1.0, { fontSize: index === 0 ? 40 : 32, bold: true, color: "10294C" })}
      ${pptTextBox(6, "Slide subtitle", slide.subtitle || brief.moduleTitle || brief.courseTitle, 0.75, 2.65, 8.8, 0.5, { fontSize: 18, bold: true, color: "49617F" })}
      ${pptShape(7, "Content card", 0.75, 3.35, 11.8, 2.6, "F7FAFF", "DBE4F1")}
      ${pptTextBox(8, "Slide body", bodyLines.map((line) => `• ${line}`), 1.05, 3.7, 10.9, 1.85, { fontSize: 18, color: "1D3760" })}
      ${pptTextBox(9, "Deck footer", footer, 0.75, 7.08, 9.8, 0.22, { fontSize: 9, color: "5A6D87" })}
      ${pptTextBox(10, "Slide number", `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`, 11.55, 7.08, 1.05, 0.22, { fontSize: 9, bold: true, color: "5A6D87" })}
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function makeNotesSlideXml(slide) {
    const notes = [
        slide.subtitle,
        ...slide.body,
    ].filter(Boolean).slice(0, 4);
    const paragraphs = notes.map((note) => `<a:p><a:r><a:t>${escapeXml(note)}</a:t></a:r></a:p>`).join("");

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm/></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="0"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody><a:bodyPr/><a:lstStyle/>${paragraphs || "<a:p/>"}</p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:notes>`;
}

function makePptxBlob(brief, settings) {
    const slides = makeDeckSlides(brief, settings);
    const slideOverrides = slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("");
    const notesOverrides = slides.map((_, index) => `<Override PartName="/ppt/notesSlides/notesSlide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`).join("");
    const slideIds = slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 6}"/>`).join("");
    const slideRels = slides.map((_, index) => `<Relationship Id="rId${index + 6}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${index + 1}.xml"/>`).join("");
    const slideLayoutRels = slides.map((_, index) => ({
        path: `ppt/slides/_rels/slide${index + 1}.xml.rels`,
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${index + 1}.xml"/></Relationships>`,
    }));
    const notesSlideRels = slides.map((_, index) => ({
        path: `ppt/notesSlides/_rels/notesSlide${index + 1}.xml.rels`,
        content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${index + 1}.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="../notesMasters/notesMaster1.xml"/></Relationships>`,
    }));
    const files = [
        {
            path: "[Content_Types].xml",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/><Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/><Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>${slideOverrides}${notesOverrides}<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/></Types>`,
        },
        {
            path: "_rels/.rels",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`,
        },
        {
            path: "docProps/core.xml",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${escapeXml(brief.title)}</dc:title><dc:creator>BrainKernl SAGE AI</dc:creator><cp:lastModifiedBy>BrainKernl SAGE AI</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified></cp:coreProperties>`,
        },
        {
            path: "docProps/app.xml",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><ap:Properties xmlns:ap="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><ap:Application>BrainKernl</ap:Application><ap:PresentationFormat>Widescreen</ap:PresentationFormat><ap:Slides>${slides.length}</ap:Slides><ap:Notes>${slides.length}</ap:Notes><ap:HiddenSlides>0</ap:HiddenSlides><ap:SharedDoc>false</ap:SharedDoc><ap:DocSecurity>0</ap:DocSecurity></ap:Properties>`,
        },
        {
            path: "ppt/presentation.xml",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId2"/></p:sldMasterIdLst><p:notesMasterIdLst><p:notesMasterId r:id="rId3"/></p:notesMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="wide"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:defaultTextStyle></p:presentation>`,
        },
        {
            path: "ppt/_rels/presentation.xml.rels",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesMaster" Target="notesMasters/notesMaster1.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps" Target="presProps.xml"/><Relationship Id="rId5" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles" Target="tableStyles.xml"/>${slideRels}</Relationships>`,
        },
        {
            path: "ppt/presProps.xml",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:showPr showAnimation="1"><p:present/></p:showPr><p:clrMru><a:srgbClr val="10294C"/><a:srgbClr val="3569D9"/><a:srgbClr val="F7FAFF"/></p:clrMru></p:presentationPr>`,
        },
        {
            path: "ppt/tableStyles.xml",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`,
        },
        {
            path: "ppt/notesMasters/notesMaster1.xml",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:notesMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:notesMaster>`,
        },
        {
            path: "ppt/notesMasters/_rels/notesMaster1.xml.rels",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`,
        },
        {
            path: "ppt/slideMasters/slideMaster1.xml",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:effectLst/></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>`,
        },
        {
            path: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>`,
        },
        {
            path: "ppt/slideLayouts/slideLayout1.xml",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`,
        },
        {
            path: "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>`,
        },
        {
            path: "ppt/theme/theme1.xml",
            content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="BrainKernl"><a:themeElements><a:clrScheme name="BrainKernl"><a:dk1><a:srgbClr val="10294C"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1D3760"/></a:dk2><a:lt2><a:srgbClr val="F7FAFF"/></a:lt2><a:accent1><a:srgbClr val="3569D9"/></a:accent1><a:accent2><a:srgbClr val="2F7D5B"/></a:accent2><a:accent3><a:srgbClr val="D7A43B"/></a:accent3><a:accent4><a:srgbClr val="A33B32"/></a:accent4><a:accent5><a:srgbClr val="4D6FA8"/></a:accent5><a:accent6><a:srgbClr val="DBE4F1"/></a:accent6><a:hlink><a:srgbClr val="3569D9"/></a:hlink><a:folHlink><a:srgbClr val="4D6FA8"/></a:folHlink></a:clrScheme><a:fontScheme name="BrainKernl"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme><a:fmtScheme name="BrainKernl"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`,
        },
        ...slideLayoutRels,
        ...slides.map((slide, index) => ({
            path: `ppt/slides/slide${index + 1}.xml`,
            content: makeSlideXml(slide, index, slides.length, brief),
        })),
        ...notesSlideRels,
        ...slides.map((slide, index) => ({
            path: `ppt/notesSlides/notesSlide${index + 1}.xml`,
            content: makeNotesSlideXml(slide),
        })),
    ];

    return {
        blob: makeZip(files),
        slideCount: slides.length,
    };
}

function createBriefRow(label, value) {
    const row = createElement("article", "sage-brief-row");
    row.append(createElement("span", "", label), createElement("strong", "", value || "Not provided"));
    return row;
}

function getSelectedGradeLevels(formData) {
    const grades = formData.getAll("gradeLevel").map((grade) => String(grade).trim()).filter(Boolean);
    return grades.length ? grades.join(", ") : "Teacher selected";
}

function renderEmptyPreview() {
    if (!previewPanel) {
        return;
    }

    const emptyState = createElement("div", "sage-empty-state");
    emptyState.append(
        createElement("p", "eyebrow", "Preview"),
        createElement("h3", "", "Presentation deck will appear here"),
        createElement("p", "", "Fill in the lesson source and settings, then generate a downloadable PPTX."),
    );
    previewPanel.replaceChildren(emptyState);
}

function getCheckedValues(formData, name) {
    return formData.getAll(name).map((value) => String(value).trim()).filter(Boolean);
}

function setPlannerFileName(file) {
    if (!fileNameElement) {
        return;
    }

    const dropzone = fileNameElement.closest("[data-sage-dropzone]");
    dropzone?.classList.toggle("has-file", Boolean(file));
    fileNameElement.textContent = file ? file.name : "Required PDF. Drag and drop here, or click to browse.";
}

function setStandardsFileName(file) {
    if (!standardsFileNameElement) {
        return;
    }

    const dropzone = standardsFileNameElement.closest("[data-sage-dropzone]");
    dropzone?.classList.toggle("has-file", Boolean(file));
    standardsFileNameElement.textContent = file
        ? file.name
        : "Required PDF. Upload state, national, AP, or district standards.";
}

function getPlannerTitle(formData, file) {
    const enteredTitle = String(formData.get("courseTitle") || "").trim();
    if (enteredTitle) {
        return enteredTitle;
    }

    if (!file?.name) {
        return "New course blueprint";
    }

    return file.name
        .replace(/\.pdf$/i, "")
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function loadPdfJs() {
    try {
        const pdfjs = await import(PDFJS_MODULE_URL);
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
        return pdfjs;
    } catch (error) {
        console.error(error);
        throw new Error("Could not load the PDF reader. Check your internet connection, then try again.");
    }
}

function pageItemsToLines(items) {
    const rows = new Map();

    items.forEach((item) => {
        const text = String(item.str || "").trim();
        if (!text) {
            return;
        }

        const x = Number(item.transform?.[4]) || 0;
        const y = Math.round(Number(item.transform?.[5]) || 0);
        const key = String(y);

        if (!rows.has(key)) {
            rows.set(key, []);
        }

        rows.get(key).push({ x, text });
    });

    return Array.from(rows.entries())
        .sort((first, second) => Number(second[0]) - Number(first[0]))
        .map(([rowY, parts]) => {
            const sortedParts = parts.sort((first, second) => first.x - second.x);
            return {
                x: Math.min(...sortedParts.map((part) => part.x)),
                y: Number(rowY),
                text: sortedParts
                    .map((part) => part.text)
                    .join(" ")
                    .replace(/\s+/g, " ")
                    .trim(),
            };
        })
        .filter((line) => line.text);
}

async function readPdfText(file) {
    const pdfjs = await loadPdfJs();
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pagesRead = Math.min(pdf.numPages, MAX_PDF_PAGES);
    const pageLines = [];
    const layoutLines = [];

    for (let pageNumber = 1; pageNumber <= pagesRead; pageNumber += 1) {
        if (pageNumber === 1 || pageNumber % 25 === 0 || pageNumber === pagesRead) {
            const percent = Math.round((pageNumber / pagesRead) * 100);
            setInlineStatus(`Reading the complete PDF: page ${pageNumber} of ${pagesRead} (${percent}%)...`, "success");
        }

        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const lines = pageItemsToLines(textContent.items || []);
        pageLines.push(...lines.map((line) => line.text));
        layoutLines.push(...lines.map((line) => ({ ...line, page: pageNumber })));
    }

    return {
        text: pageLines.join("\n"),
        layoutLines,
        pagesRead,
        totalPages: pdf.numPages,
        truncated: pdf.numPages > pagesRead,
    };
}

function normalizePdfLines(text) {
    const lines = String(text || "")
        .split(/\n+/)
        .map((line) => line.replace(/\s+/g, " ").trim())
        .filter((line) => line.length > 2)
        .filter((line) => !/^\d+$/.test(line))
        .filter((line) => !/^©|college board|course and exam description$/i.test(line));

    return lines.filter((line, index) => index === 0 || line !== lines[index - 1]);
}

function isNoiseLine(line) {
    return /^(unit|topic|practice|skill|skills|course content|course at a glance|plan|teach|required course content)$/i.test(line)
        || /class periods|ap exam weighting|exam weighting|table of contents|assessment overview/i.test(line)
        || /^[~≈]\d/.test(line)
        || line.length > 140;
}

function cleanTitle(value) {
    return String(value || "")
        .replace(/\s+/g, " ")
        .replace(/\s+[\d,.-]+%.*$/i, "")
        .replace(/\s+class periods?.*$/i, "")
        .trim();
}

function stripGeneratedOrderingPrefix(value) {
    return String(value || "")
        .replace(/^\s*\d{1,3}\s*\|\s*/i, "")
        .replace(/^\s*(?:module|chapter|unit)\s+\d{1,3}\s*[:|.-]\s*/i, "")
        .replace(/^\s*\d{1,3}(?:\.\d{1,3})+\s*[:|.-]\s*/i, "")
        .trim();
}

function titleToSentence(value) {
    return cleanTitle(value)
        .replace(/\bAPI\b/g, "application programming interfaces")
        .replace(/\s+/g, " ")
        .toLowerCase();
}

function shortenSentence(value, maxLength = 120) {
    const sentence = String(value || "").replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+/)[0] || "";
    if (sentence.length <= maxLength) {
        return sentence;
    }

    const shortened = sentence.slice(0, maxLength + 1).replace(/\s+\S*$/, "").replace(/[,:;.\s]+$/, "");
    return `${shortened}.`;
}

function createTopicSpecificLessonOverview(title) {
    const topic = titleToSentence(title).replace(/[?.!]+$/, "");
    const stepMatch = topic.match(/^step\s+\d+\s*:\s*(.+)$/i);

    if (stepMatch) {
        return `Practice how to ${stepMatch[1]} and explain how this step supports a complete financial plan.`;
    }
    if (/\bfinancial services?\b/i.test(topic)) {
        return "Examine how banks, credit unions, payment tools, and other financial services support everyday financial planning.";
    }
    if (/\bfinancial planning process\b/i.test(topic)) {
        return "Examine the complete financial planning process and how its connected steps support informed decisions.";
    }
    if (/^(what is|introduction to|introducing)\b/i.test(topic)) {
        return `Define ${topic.replace(/^(what is|introduction to|introducing)\s+/i, "")}, identify its key features, and connect it to an everyday example.`;
    }
    if (/\b(type|types|compare|contrast|option|choice|alternative)\b/i.test(topic)) {
        return `Compare the major features of ${topic} and determine which option best fits a realistic situation.`;
    }
    if (/\b(calculate|calculation|rate|interest|tax|cost|income|budget|statement|record)\b/i.test(topic)) {
        return `Apply ${topic} to complete and explain a realistic financial calculation or recordkeeping task.`;
    }
    if (/\b(plan|planning|strategy|goal|decision|process|step)\b/i.test(topic)) {
        return `Develop and justify an approach to ${topic} using priorities, evidence, and realistic constraints.`;
    }
    if (/\b(law|right|regulation|policy|contract|protection)\b/i.test(topic)) {
        return `Interpret the key requirements of ${topic} and explain how they affect individual rights and responsibilities.`;
    }
    if (/\b(risk|insurance|credit|debt|fraud|identity)\b/i.test(topic)) {
        return `Evaluate the benefits, costs, warning signs, and risks associated with ${topic} in a realistic scenario.`;
    }

    const approaches = [
        `Explore ${topic} through a focused example and guided application.`,
        `Analyze ${topic} and explain its importance in real-world contexts.`,
        `Connect ${topic} to an authentic problem or decision.`,
        `Investigate ${topic} using examples, evidence, and reflection.`,
    ];
    return approaches[stableTextHash(title) % approaches.length];
}

function createTopicSpecificLearningTarget(title) {
    const topic = titleToSentence(title).replace(/[?.!]+$/, "");
    const stepMatch = topic.match(/^step\s+\d+\s*:\s*(.+)$/i);

    if (stepMatch) {
        return `I can ${stepMatch[1]} and explain why this step is necessary in the financial planning process.`;
    }
    if (/\bfinancial services?\b/i.test(topic)) {
        return "I can compare services from financial institutions and select the best option for a specific financial need.";
    }
    if (/\bfinancial planning process\b/i.test(topic)) {
        return "I can sequence the financial planning process and apply each step to a personal financial scenario.";
    }
    if (/^(what is|introduction to|introducing)\b/i.test(topic)) {
        const concept = topic.replace(/^(what is|introduction to|introducing)\s+/i, "");
        return `I can define ${concept}, identify its main features, and explain why it matters.`;
    }
    if (/\b(type|types|compare|contrast|option|choice|alternative)\b/i.test(topic)) {
        return `I can compare ${topic} and justify which option best meets a stated need.`;
    }
    if (/\b(calculate|calculation|rate|interest|tax|cost|income|budget|statement|record)\b/i.test(topic)) {
        return `I can accurately apply ${topic} and explain what the result means in a realistic situation.`;
    }
    if (/\b(plan|planning|strategy|goal|decision|process)\b/i.test(topic)) {
        return `I can create a realistic approach to ${topic} and justify my choices using evidence.`;
    }
    if (/\b(law|right|regulation|policy|contract|protection)\b/i.test(topic)) {
        return `I can explain how ${topic} affects a person's rights, choices, and responsibilities.`;
    }
    if (/\b(risk|insurance|credit|debt|fraud|identity)\b/i.test(topic)) {
        return `I can assess the benefits and risks of ${topic} and recommend a responsible course of action.`;
    }

    const targets = [
        `I can analyze ${topic} and support my conclusions with a relevant example.`,
        `I can explain the key ideas in ${topic} and apply them to a realistic situation.`,
        `I can evaluate ${topic} and justify a decision using accurate evidence.`,
        `I can demonstrate my understanding of ${topic} through a clear, practical application.`,
    ];
    return targets[stableTextHash(title) % targets.length];
}

function createTopicSpecificObjective(title) {
    const topic = titleToSentence(title).replace(/[?.!]+$/, "");
    const stepMatch = topic.match(/^step\s+\d+\s*:\s*(.+)$/i);

    if (stepMatch) {
        return `Students will ${stepMatch[1]} for a sample household and justify the information or choices they used.`;
    }
    if (/\bfinancial services?\b/i.test(topic)) {
        return "Students will compare financial institutions and services, then recommend an appropriate option for a stated consumer need.";
    }
    if (/\bfinancial planning process\b/i.test(topic)) {
        return "Students will sequence the financial planning process and apply its steps to a realistic personal finance scenario.";
    }
    if (/^(what is|introduction to|introducing)\b/i.test(topic)) {
        const concept = topic.replace(/^(what is|introduction to|introducing)\s+/i, "");
        return `Students will define ${concept}, identify its essential features, and illustrate it with an accurate example.`;
    }
    if (/\b(type|types|compare|contrast|option|choice|alternative)\b/i.test(topic)) {
        return `Students will compare ${topic} using relevant criteria and defend the best option for a given scenario.`;
    }
    if (/\b(calculate|calculation|rate|interest|tax|cost|income|budget|statement|record)\b/i.test(topic)) {
        return `Students will accurately apply ${topic}, show their process, and interpret the result in context.`;
    }
    if (/\b(plan|planning|strategy|goal|decision|process)\b/i.test(topic)) {
        return `Students will create a realistic ${topic} response and justify its priorities, evidence, and constraints.`;
    }
    if (/\b(law|right|regulation|policy|contract|protection)\b/i.test(topic)) {
        return `Students will analyze a scenario involving ${topic} and explain the resulting rights and responsibilities.`;
    }
    if (/\b(risk|insurance|credit|debt|fraud|identity)\b/i.test(topic)) {
        return `Students will evaluate a scenario involving ${topic} and recommend a responsible action supported by evidence.`;
    }

    const objectives = [
        `Students will analyze ${topic} and support a conclusion with an accurate example.`,
        `Students will explain the key ideas in ${topic} and apply them to a realistic situation.`,
        `Students will evaluate ${topic} and justify a decision using relevant evidence.`,
        `Students will demonstrate understanding of ${topic} by completing a practical application.`,
    ];
    return objectives[stableTextHash(title) % objectives.length];
}

function createTopicSpecificEssentialQuestion(title) {
    const topic = titleToSentence(title).replace(/[?.!]+$/, "");
    const stepMatch = topic.match(/^step\s+\d+\s*:\s*(.+)$/i);

    if (stepMatch) {
        return `Why must a person ${stepMatch[1]} before moving forward with a financial plan?`;
    }
    if (/\bfinancial services?\b/i.test(topic)) {
        return "How should a consumer decide which financial institution or service best meets a specific need?";
    }
    if (/\bfinancial planning process\b/i.test(topic)) {
        return "How do the steps of the financial planning process work together to improve financial decisions?";
    }
    if (/^(what is|introduction to|introducing)\b/i.test(topic)) {
        const concept = topic.replace(/^(what is|introduction to|introducing)\s+/i, "");
        return `What makes ${concept} important in everyday life, and how can we recognize it in practice?`;
    }
    if (/\b(type|types|compare|contrast|option|choice|alternative)\b/i.test(topic)) {
        return `Which differences among ${topic} matter most when choosing the best option, and why?`;
    }
    if (/\b(calculate|calculation|rate|interest|tax|cost|income|budget|statement|record)\b/i.test(topic)) {
        return `How can an accurate understanding of ${topic} change a person's financial choices?`;
    }
    if (/\b(plan|planning|strategy|goal|decision|process)\b/i.test(topic)) {
        return `What makes an approach to ${topic} realistic, responsible, and likely to succeed?`;
    }
    if (/\b(law|right|regulation|policy|contract|protection)\b/i.test(topic)) {
        return `How does ${topic} balance individual choice with rights, responsibilities, and protection?`;
    }
    if (/\b(risk|insurance|credit|debt|fraud|identity)\b/i.test(topic)) {
        return `How can a person weigh the benefits and risks of ${topic} before taking action?`;
    }

    const questions = [
        `How does ${topic} influence the decisions people make in real-world situations?`,
        `What evidence is most useful when evaluating ${topic}, and why?`,
        `When might ${topic} be especially important, and what factors should guide a response?`,
        `How can understanding ${topic} help someone make a more informed decision?`,
    ];
    return questions[stableTextHash(title) % questions.length];
}

function createTopicSpecificAssessment(title) {
    const topic = titleToSentence(title).replace(/[?.!]+$/, "");
    const stepMatch = topic.match(/^step\s+\d+\s*:\s*(.+)$/i);

    if (stepMatch) {
        return `Complete the “${stepMatch[1]}” portion of a sample financial plan and provide a brief justification.`;
    }
    if (/\b(type|types|compare|contrast|option|choice|alternative|service)\b/i.test(topic)) {
        return `Complete a comparison chart for ${topic} and submit a one-paragraph recommendation.`;
    }
    if (/\b(calculate|calculation|rate|interest|tax|cost|income|budget|statement|record)\b/i.test(topic)) {
        return `Solve a realistic ${topic} problem, show the process, and interpret the result.`;
    }
    if (/\b(plan|planning|strategy|goal|decision|process)\b/i.test(topic)) {
        return `Create a short ${topic} product and annotate the evidence behind two key choices.`;
    }
    if (/\b(law|right|regulation|policy|contract|protection|risk|insurance|credit|debt|fraud|identity)\b/i.test(topic)) {
        return `Analyze a ${topic} scenario and write an evidence-based recommendation.`;
    }
    return `Complete a brief application of ${topic} and explain the reasoning used.`;
}

function createConciseLessonOverview(title, proposedOverview = "") {
    const proposed = shortenSentence(proposedOverview);
    const isGeneric = /^students (?:build|will (?:learn|understand|explore))\b/i.test(proposed)
        || /\bvocabulary, examples, and guided practice\b/i.test(proposed);
    return proposed && !isGeneric
        ? proposed
        : createTopicSpecificLessonOverview(title);
}

function makeLessonBlueprint(topic) {
    const title = cleanTitle(topic.title || topic);

    return {
        number: topic.number || "",
        title,
        overview: createTopicSpecificLessonOverview(title),
        objective: createTopicSpecificObjective(title),
        learningTarget: createTopicSpecificLearningTarget(title),
        essentialQuestion: createTopicSpecificEssentialQuestion(title),
        assessment: createTopicSpecificAssessment(title),
    };
}

function extractUnitNames(lines) {
    const units = new Map(AP_CSA_UNIT_NAMES);

    lines.forEach((line, index) => {
        const inlineMatch = line.match(/^unit\s+(\d{1,2})\s+(.+)$/i);
        if (inlineMatch) {
            units.set(inlineMatch[1], cleanTitle(inlineMatch[2]));
            return;
        }

        const unitOnlyMatch = line.match(/^unit\s+(\d{1,2})$/i);
        if (unitOnlyMatch) {
            const nextLine = cleanTitle(lines[index + 1] || "");
            if (nextLine && !isNoiseLine(nextLine)) {
                units.set(unitOnlyMatch[1], nextLine);
            }
        }
    });

    return units;
}

function shouldJoinTopicContinuation(line) {
    if (!line || isNoiseLine(line)) {
        return false;
    }

    return !/^(\d{1,2})\.(\d{1,2})\s+/.test(line)
        && !/^unit\s+\d{1,2}\b/i.test(line)
        && !/^\d\.[A-Z]\b/.test(line)
        && !/^[A-Z]\./.test(line);
}

function extractNumberedTopics(lines) {
    const topics = [];
    const seen = new Set();

    lines.forEach((line, index) => {
        const match = line.match(/^(\d{1,2})\.(\d{1,2})\s+(.+)$/);
        if (!match) {
            return;
        }

        const unit = match[1];
        const number = `${match[1]}.${match[2]}`;
        const titleParts = [match[3]];

        for (let lookahead = index + 1; lookahead < Math.min(lines.length, index + 4); lookahead += 1) {
            const nextLine = lines[lookahead];
            if (!shouldJoinTopicContinuation(nextLine)) {
                break;
            }

            titleParts.push(nextLine);
            if (titleParts.join(" ").length > 90) {
                break;
            }
        }

        const title = cleanTitle(titleParts.join(" "));
        if (!title || seen.has(number) || isNoiseLine(title)) {
            return;
        }

        seen.add(number);
        topics.push({ unit, number, title });
    });

    return topics;
}

function extractGenericModules(lines) {
    const modules = [];
    let currentModule = null;

    lines.forEach((line) => {
        const moduleMatch = line.match(/^(chapter|unit|module|part)\s+(\d{1,2})[:.\s-]+(.+)$/i);
        const lessonMatch = line.match(/^(lesson|topic)\s+(\d{1,2}(?:\.\d{1,2})?)[:.\s-]+(.+)$/i);

        if (moduleMatch && !isNoiseLine(line)) {
            currentModule = {
                number: moduleMatch[2],
                title: `${moduleMatch[1][0].toUpperCase()}${moduleMatch[1].slice(1).toLowerCase()} ${moduleMatch[2]}: ${cleanTitle(moduleMatch[3])}`,
                lessons: [],
            };
            modules.push(currentModule);
            return;
        }

        if (lessonMatch && currentModule && !isNoiseLine(line)) {
            currentModule.lessons.push(makeLessonBlueprint({
                number: lessonMatch[2],
                title: lessonMatch[3],
            }));
        }
    });

    return modules.filter((module) => module.lessons.length);
}

function stripTocPageNumber(value) {
    return cleanTitle(String(value || "").replace(/\s+\d{1,4}\s*$/, ""));
}

function coalesceTocLayoutLines(layoutLines) {
    const combined = [];
    let pending = null;

    const flush = () => {
        if (pending) {
            combined.push(pending);
            pending = null;
        }
    };

    layoutLines.forEach((line) => {
        const text = String(line.text || "").replace(/\s+/g, " ").trim();
        if (!text || /^Page\s+[ivxlcdm]+$/i.test(text)) {
            return;
        }

        const startsEntry = /^\d{1,2}\s*\||^\d{1,2}\.\s+/.test(text);
        if (startsEntry) {
            flush();
            pending = { ...line, text };
        } else if (pending && line.page <= pending.page + 1 && Math.abs(line.x - pending.x) <= 35) {
            pending.text = `${pending.text} ${text}`.replace(/\s+/g, " ").trim();
            pending.page = line.page;
        } else {
            flush();
        }

        if (pending && /\s\d{1,4}\s*$/.test(pending.text)) {
            flush();
        }
    });
    flush();
    return combined;
}

function extractTableOfContentsModules(pdfText) {
    const layoutLines = Array.isArray(pdfText?.layoutLines) ? pdfText.layoutLines : [];
    const contentsLine = layoutLines.find((line) => /^contents$/i.test(String(line.text || "").trim()));
    if (!contentsLine) {
        return [];
    }

    const tocLines = coalesceTocLayoutLines(
        layoutLines.filter((line) => line.page >= contentsLine.page && line.page <= contentsLine.page + 30),
    );
    const modules = [];
    let currentModule = null;
    let currentSection = null;
    let moduleIndent = null;

    const addLesson = (title, number, sectionTitle = "", extra = {}) => {
        const cleanedTitle = stripTocPageNumber(title);
        if (!currentModule || !cleanedTitle || currentModule.lessonTitles.has(cleanedTitle.toLowerCase())) {
            return -1;
        }

        currentModule.lessonTitles.add(cleanedTitle.toLowerCase());
        currentModule.lessons.push({
            ...makeLessonBlueprint({ number, title: cleanedTitle }),
            sectionTitle,
            ...extra,
        });
        return currentModule.lessons.length - 1;
    };

    const flushSection = () => {
        currentSection = null;
    };

    tocLines.forEach((line) => {
        const moduleMatch = line.text.match(/^(\d{1,2})\s*\|\s*(.+?)\s+(\d{1,4})\s*$/);
        if (moduleMatch) {
            flushSection();
            moduleIndent = moduleIndent === null ? line.x : Math.min(moduleIndent, line.x);
            currentModule = {
                number: moduleMatch[1],
                title: stripGeneratedOrderingPrefix(stripTocPageNumber(moduleMatch[2])),
                sourcePage: Number(moduleMatch[3]),
                lessons: [],
                lessonTitles: new Set(),
            };
            modules.push(currentModule);
            return;
        }

        const entryMatch = line.text.match(/^(\d{1,2})\.\s+(.+?)\s+(\d{1,4})\s*$/);
        if (!entryMatch || !currentModule || moduleIndent === null) {
            return;
        }

        const indent = line.x - moduleIndent;
        if (indent >= 28) {
            if (currentSection) {
                currentSection.hasChildren = true;
            }
            addLesson(
                entryMatch[2],
                `${currentModule.number}.${currentModule.lessons.length + 1}`,
                currentSection?.title || "",
            );
        } else {
            flushSection();
            const sectionTitle = stripTocPageNumber(entryMatch[2]);
            const introductionIndex = addLesson(
                sectionTitle,
                entryMatch[1],
                "",
                { isSectionIntroduction: true },
            );
            currentSection = {
                number: entryMatch[1],
                title: sectionTitle,
                hasChildren: false,
                introductionIndex,
            };
        }
    });
    flushSection();

    return modules
        .filter((module) => module.lessons.length)
        .map(({ lessonTitles, ...module }) => module);
}

function buildModulesFromPdf(lines, pdfText = null) {
    const tocModules = extractTableOfContentsModules(pdfText);
    if (tocModules.length >= 2) {
        return tocModules;
    }

    const unitNames = extractUnitNames(lines);
    const numberedTopics = extractNumberedTopics(lines);

    if (numberedTopics.length) {
        const grouped = new Map();
        numberedTopics.forEach((topic) => {
            if (!grouped.has(topic.unit)) {
                grouped.set(topic.unit, {
                    number: topic.unit,
                    title: `Unit ${topic.unit}: ${unitNames.get(topic.unit) || `Module ${topic.unit}`}`,
                    lessons: [],
                });
            }

            grouped.get(topic.unit).lessons.push(makeLessonBlueprint(topic));
        });

        return Array.from(grouped.values());
    }

    const genericModules = extractGenericModules(lines);
    if (genericModules.length) {
        return genericModules;
    }

    const fallbackTitles = lines
        .filter((line) => !isNoiseLine(line))
        .filter((line) => /^[A-Z0-9]/.test(line))
        .slice(0, 12);

    return [{
        number: "1",
        title: "Module 1: Course Foundations",
        lessons: fallbackTitles.length
            ? fallbackTitles.map((title, index) => makeLessonBlueprint({ number: `1.${index + 1}`, title }))
            : [makeLessonBlueprint({ number: "1.1", title: "Course introduction" })],
    }];
}

function normalizeBookHeading(value) {
    return String(value || "")
        .toLowerCase()
        .replace(/^\d{1,2}(?:\.\d{1,2})?\s*[|.)-]?\s*/, "")
        .replace(/\s+\d{1,4}\s*$/, "")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function attachTextbookEvidence(modules, pdfText) {
    const layoutLines = Array.isArray(pdfText?.layoutLines) ? pdfText.layoutLines : [];
    if (!layoutLines.length) {
        return modules;
    }

    const contentsPage = layoutLines.find((line) => /^contents$/i.test(String(line.text || "").trim()))?.page || 1;
    const bodyStartPage = contentsPage + 31;
    const targets = new Map();
    modules.forEach((module, moduleIndex) => {
        module.lessons.forEach((lesson, lessonIndex) => {
            const key = normalizeBookHeading(lesson.title);
            if (key.length >= 5) {
                if (!targets.has(key)) {
                    targets.set(key, []);
                }
                targets.get(key).push({ moduleIndex, lessonIndex });
            }
        });
    });

    const pageText = new Map();
    const evidencePages = new Map();
    layoutLines.forEach((line) => {
        if (line.page < bodyStartPage) {
            return;
        }

        if (!pageText.has(line.page)) {
            pageText.set(line.page, []);
        }
        pageText.get(line.page).push(line.text);

        const heading = normalizeBookHeading(line.text);
        if (targets.has(heading)) {
            targets.get(heading).forEach(({ moduleIndex, lessonIndex }) => {
                const key = `${moduleIndex}:${lessonIndex}`;
                if (!evidencePages.has(key)) {
                    evidencePages.set(key, line.page);
                }
            });
        }
    });

    return modules.map((module, moduleIndex) => ({
        ...module,
        lessons: module.lessons.map((lesson, lessonIndex) => {
            const evidencePage = evidencePages.get(`${moduleIndex}:${lessonIndex}`);
            if (!evidencePage) {
                return lesson;
            }

            const evidenceText = [
                ...(pageText.get(evidencePage) || []),
                ...(pageText.get(evidencePage + 1) || []),
            ].join(" ").replace(/\s+/g, " ").trim().slice(0, 6000);
            return {
                ...lesson,
                evidencePage,
                evidenceText,
            };
        }),
    }));
}

function applyPacing(modules) {
    return modules.map((module, moduleIndex) => {
        const lessons = module.lessons.map((lesson, lessonIndex) => ({
            ...lesson,
            number: `${moduleIndex + 1}.${lessonIndex + 1}`,
            plannedDays: 1,
        }));

        return {
            ...module,
            number: String(moduleIndex + 1),
            lessons,
            plannedDays: lessons.length,
        };
    });
}

function extractStandards(lines) {
    const standards = [];
    const seen = new Set();

    lines.forEach((line, index) => {
        const pfrMatch = line.match(/^(PFR\s*-\s*\d+\s*\.\s*\d+)\s*[:—-]?\s*(.*)$/i);
        const genericMatch = line.match(/^([A-Z]{2,8}(?:[.-][A-Z0-9]{1,12}){1,6})\s*[:—-]?\s+(.{12,})$/);
        const match = pfrMatch || genericMatch;
        if (!match) {
            return;
        }

        const code = match[1].replace(/\s+/g, "").toUpperCase();
        if (seen.has(code)) {
            return;
        }

        const descriptionParts = [String(match[2] || "").trim()].filter(Boolean);
        for (let lookahead = index + 1; lookahead < Math.min(lines.length, index + 4); lookahead += 1) {
            const nextLine = lines[lookahead];
            if (/^PFR\s*-\s*\d+\s*\.\s*\d+/i.test(nextLine)
                || /^Domain\b|^Core Standard\b|^Personal Financial Responsibility Course Framework/i.test(nextLine)) {
                break;
            }
            descriptionParts.push(nextLine);
        }

        seen.add(code);
        standards.push({
            code,
            description: cleanTitle(descriptionParts.join(" ")),
        });
    });

    return standards.slice(0, 80);
}

const ALIGNMENT_STOP_WORDS = new Set([
    "about", "after", "against", "among", "and", "are", "can", "course", "describe",
    "examine", "explain", "financial", "from", "have", "into", "lesson", "make",
    "personal", "students", "that", "the", "their", "these", "this", "through",
    "under", "using", "various", "what", "when", "with", "your",
]);

function alignmentTokens(value) {
    return Array.from(new Set(
        String(value || "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .split(/\s+/)
            .filter((token) => token.length >= 4 && !ALIGNMENT_STOP_WORDS.has(token)),
    ));
}

function getLessonStandardMatches(lesson, standards) {
    const titleTokens = alignmentTokens(`${lesson.title} ${lesson.sectionTitle || ""}`);
    const evidenceTokens = alignmentTokens(lesson.evidenceText || "");
    return standards
        .map((standard) => {
            const standardTokens = alignmentTokens(standard.description);
            const titleOverlap = titleTokens.filter((token) => standardTokens.some((standardToken) =>
                standardToken === token
                || (token.length >= 6 && standardToken.startsWith(token))
                || (standardToken.length >= 6 && token.startsWith(standardToken))
            ));
            const evidenceOverlap = evidenceTokens.filter((token) => standardTokens.some((standardToken) =>
                standardToken === token
                || (token.length >= 7 && standardToken.startsWith(token))
                || (standardToken.length >= 7 && token.startsWith(standardToken))
            ));
            const titlePhrase = String(standard.description || "").toLowerCase().includes(String(lesson.title || "").toLowerCase())
                ? 6
                : 0;
            return {
                standard,
                score: (titleOverlap.length * 6) + Math.min(4, evidenceOverlap.length) + titlePhrase,
            };
        })
        .filter((match) => match.score > 0)
        .sort((first, second) => second.score - first.score);
}

function selectStandardsAlignedLessons(modules, standards, maximumLessons) {
    const limit = Math.max(1, Number(maximumLessons) || 180);
    const candidates = [];

    modules.forEach((module, moduleIndex) => {
        module.lessons.forEach((lesson, lessonIndex) => {
            const matches = getLessonStandardMatches(lesson, standards);
            candidates.push({
                key: `${moduleIndex}:${lessonIndex}`,
                moduleIndex,
                lessonIndex,
                score: matches[0]?.score || 0,
                standards: matches.slice(0, 2).map((match) => match.standard),
            });
        });
    });

    if (candidates.length <= limit) {
        return modules.map((module, moduleIndex) => ({
            ...module,
            lessons: module.lessons.map((lesson, lessonIndex) => {
                const candidate = candidates.find((item) =>
                    item.moduleIndex === moduleIndex && item.lessonIndex === lessonIndex
                );
                return { ...lesson, standards: candidate?.standards || [] };
            }),
        }));
    }

    const selectedKeys = new Set();
    const moduleCoverageKeys = new Set();
    modules.forEach((module, moduleIndex) => {
        const bestInModule = candidates
            .filter((candidate) => candidate.moduleIndex === moduleIndex)
            .sort((first, second) =>
                second.score - first.score || first.lessonIndex - second.lessonIndex
            )[0];
        if (bestInModule) {
            selectedKeys.add(bestInModule.key);
            moduleCoverageKeys.add(bestInModule.key);
        }
    });

    candidates
        .slice()
        .sort((first, second) =>
            second.score - first.score
            || first.moduleIndex - second.moduleIndex
            || first.lessonIndex - second.lessonIndex
        )
        .forEach((candidate) => {
            if (selectedKeys.size < limit) {
                selectedKeys.add(candidate.key);
            }
        });

    const sequenceRequiredKeys = new Set();
    modules.forEach((module, moduleIndex) => {
        const introductionKeys = new Map();
        module.lessons.forEach((lesson, lessonIndex) => {
            if (lesson.isSectionIntroduction) {
                introductionKeys.set(
                    String(lesson.title || "").trim().toLowerCase(),
                    `${moduleIndex}:${lessonIndex}`,
                );
            }
        });

        module.lessons.forEach((lesson, lessonIndex) => {
            const lessonKey = `${moduleIndex}:${lessonIndex}`;
            if (!selectedKeys.has(lessonKey) || !lesson.sectionTitle) {
                return;
            }
            const introductionKey = introductionKeys.get(
                String(lesson.sectionTitle).trim().toLowerCase(),
            );
            if (introductionKey) {
                selectedKeys.add(introductionKey);
                sequenceRequiredKeys.add(introductionKey);
            }
        });

        const sequenceGroups = new Map();
        module.lessons.forEach((lesson, lessonIndex) => {
            const match = String(lesson.title || "").match(/^(Step|Phase|Stage)\s+(\d+)\s*[:.)-]/i);
            if (!match) {
                return;
            }
            const groupKey = `${match[1].toLowerCase()}:${lesson.sectionTitle || "module"}`;
            if (!sequenceGroups.has(groupKey)) {
                sequenceGroups.set(groupKey, []);
            }
            sequenceGroups.get(groupKey).push({
                step: Number(match[2]),
                key: `${moduleIndex}:${lessonIndex}`,
            });
        });

        sequenceGroups.forEach((group) => {
            const selectedSteps = group.filter((item) => selectedKeys.has(item.key));
            if (!selectedSteps.length) {
                return;
            }
            group
                .sort((first, second) => first.step - second.step)
                .forEach((item) => {
                    selectedKeys.add(item.key);
                    sequenceRequiredKeys.add(item.key);
                });

            const firstStepKey = group[0]?.key;
            const firstStepCandidate = candidates.find((candidate) => candidate.key === firstStepKey);
            const firstStepLesson = firstStepCandidate
                ? modules[firstStepCandidate.moduleIndex]?.lessons[firstStepCandidate.lessonIndex]
                : null;
            const introductionKey = introductionKeys.get(
                String(firstStepLesson?.sectionTitle || "").trim().toLowerCase(),
            );
            if (introductionKey) {
                selectedKeys.add(introductionKey);
                sequenceRequiredKeys.add(introductionKey);
            }
        });
    });

    if (selectedKeys.size > limit) {
        candidates
            .slice()
            .sort((first, second) =>
                first.score - second.score
                || second.moduleIndex - first.moduleIndex
                || second.lessonIndex - first.lessonIndex
            )
            .forEach((candidate) => {
                if (selectedKeys.size <= limit) {
                    return;
                }
                if (!sequenceRequiredKeys.has(candidate.key) && !moduleCoverageKeys.has(candidate.key)) {
                    selectedKeys.delete(candidate.key);
                }
            });
    }

    return modules
        .map((module, moduleIndex) => ({
            ...module,
            lessons: module.lessons
                .map((lesson, lessonIndex) => {
                    const candidate = candidates.find((item) =>
                        item.moduleIndex === moduleIndex && item.lessonIndex === lessonIndex
                    );
                    return selectedKeys.has(candidate?.key)
                        ? { ...lesson, standards: candidate?.standards || [] }
                        : null;
                })
                .filter(Boolean),
        }))
        .filter((module) => module.lessons.length);
}

function stableTextHash(value) {
    return Array.from(String(value || "")).reduce(
        (hash, character) => ((hash * 31) + character.charCodeAt(0)) >>> 0,
        2166136261,
    );
}

function isComputingCourse(context) {
    return /\b(computer science|computing|programming|java|python|javascript|coding|algorithm|software development)\b/i.test(context);
}

const SUBJECT_STRATEGY_PROFILES = {
    personalFinance: {
        pattern: /\b(personal finance|financial literacy|money|budget|banking|credit|debt|insurance|invest|tax|career planning)\b/i,
        preferred: [
            "Anticipation Guides", "Interest Surveys, Questionnaires, and Interviews", "KWL",
            "Think-Alouds", "Word Sorts", "Annotation", "Guest Speakers", "Jigsaw",
            "Text-Dependent Questions", "Word Grids/Semantic Feature Analysis",
            "Collaborative Conversations", "Debate", "Exit Slips", "RAFT Writing",
            "Response Writing", "Socratic Seminar", "Split-Page Notetaking", "Take 6",
            "Writing Frames and Templates", "Opinionnaire",
        ],
    },
    english: {
        pattern: /\b(english|language arts|ela|literature|reading|writing|novel|poetry|grammar|rhetoric|composition)\b/i,
        preferred: [
            "Read-Alouds", "Shades of Meaning", "Shared Reading", "Text Impressions",
            "Vocabulary Cards", "Annotation", "Close Reading", "Directed Reading-Thinking Activity",
            "Fishbowl Discussions", "Generative Reading", "Read-Write-Pair-Share",
            "Reciprocal Teaching", "Text-Dependent Questions", "Text Structures",
            "Collaborative Conversations", "Debate", "Found Poems", "Independent Reading",
            "Questioning the Author", "RAFT Writing", "Readers' Theatre", "Response Writing",
            "Socratic Seminar", "Student Booktalks", "Writing Frames and Templates",
        ],
    },
    computing: {
        pattern: /\b(computer science|computing|programming|java|python|javascript|coding|algorithm|software development)\b/i,
        preferred: [
            "Code Tracing", "Create a Plan", "Error Analysis", "Identify a Subtask",
            "Look for a Pattern", "Marking the Text", "Pair Programming", "Predict and Confirm",
            "Simplify the Problem", "Think Aloud", "Unplugged Activities", "Using Manipulatives",
            "Diagramming", "Quickwrite", "Vocabulary Organizer",
        ],
    },
    math: {
        pattern: /\b(mathematics|math|algebra|geometry|calculus|statistics|trigonometry)\b/i,
        preferred: [
            "Adjunct Displays", "Think-Alouds", "Vocabulary Cards", "Word Sorts",
            "Conversation Roundtable", "Modeling Comprehension", "Text Structures",
            "Word Grids/Semantic Feature Analysis", "Exit Slips", "Mnemonics",
            "Split-Page Notetaking", "Take 6", "Writing Frames and Templates",
        ],
    },
    science: {
        pattern: /\b(science|biology|chemistry|physics|earth science|anatomy|environmental)\b/i,
        preferred: [
            "Adjunct Displays", "KWL", "Student Questions for Purposeful Learning",
            "Think-Alouds", "Vocabulary Cards", "Word Sorts", "Annotation",
            "Generative Reading", "Jigsaw", "Text-Dependent Questions", "Text Structures",
            "Word Grids/Semantic Feature Analysis", "Collaborative Conversations",
            "Exit Slips", "Split-Page Notetaking", "Take 6", "Writing Frames and Templates",
        ],
    },
    socialStudies: {
        pattern: /\b(history|social studies|government|civics|economics|geography|political science)\b/i,
        preferred: [
            "Anticipation Guides", "Adjunct Displays", "Annotation", "Close Reading",
            "Fishbowl Discussions", "Jigsaw", "Text-Dependent Questions", "Text Structures",
            "Collaborative Conversations", "Debate", "Questioning the Author", "RAFT Writing",
            "Response Writing", "Socratic Seminar", "Writing Frames and Templates", "Opinionnaire",
        ],
    },
};

function detectCourseSubject(context) {
    if (isComputingCourse(context)) {
        return "computing";
    }

    return Object.entries(SUBJECT_STRATEGY_PROFILES)
        .find(([subject, profile]) => subject !== "computing" && profile.pattern.test(context))?.[0]
        || "general";
}

function getAvailableInstructionalStrategies(context, subject = detectCourseSubject(context)) {
    const includeProgrammingStrategies = subject === "computing";
    const preferredNames = new Set(SUBJECT_STRATEGY_PROFILES[subject]?.preferred || []);
    const strategies = INSTRUCTIONAL_STRATEGY_MEMORY.collections
        .filter((collection) =>
            includeProgrammingStrategies
            || collection.id !== "ap-csa-ced-instructional-strategies"
        )
        .flatMap((collection) =>
            collection.categories.flatMap((category) =>
                category.strategies.map((strategy) => ({
                    ...strategy,
                    category: category.name,
                    sourceId: collection.id,
                }))
            )
        );

    if (!preferredNames.size) {
        return strategies;
    }

    const subjectStrategies = strategies.filter((strategy) => preferredNames.has(strategy.name));
    return subjectStrategies.length ? subjectStrategies : strategies;
}

function getStrategyTopicBonus(lessonText, strategyName, subject) {
    const rules = [
        [/\b(term|vocabulary|definition|language)\b/i, /\b(vocabulary|word|shades|terms)\b/i],
        [/\b(compare|contrast|alternative|option|choice)\b/i, /\b(grid|sort|debate|opinion|display)\b/i],
        [/\b(law|rights|regulation|contract|policy)\b/i, /\b(close reading|annotation|text-dependent|socratic)\b/i],
        [/\b(career|employment|profession|job)\b/i, /\b(guest speaker|interview|interest survey|raft)\b/i],
        [/\b(calculate|formula|interest|rate|budget|statement)\b/i, /\b(think-aloud|modeling|split-page|take 6)\b/i],
        [/\b(decision|trade-off|goal|plan|strategy)\b/i, /\b(anticipation|opinionnaire|question|think-aloud|raft)\b/i],
        [/\b(risk|insurance|credit|debt|fraud)\b/i, /\b(case|debate|close reading|question|conversation)\b/i],
        [/\b(code|program|algorithm|array|class|method|loop)\b/i, /\b(code|programming|trace|subtask|problem|error|predict)\b/i],
    ];

    const topicScore = rules.reduce(
        (score, [lessonPattern, strategyPattern]) =>
            score + (lessonPattern.test(lessonText) && strategyPattern.test(strategyName) ? 8 : 0),
        0,
    );
    const subjectPreferred = SUBJECT_STRATEGY_PROFILES[subject]?.preferred.includes(strategyName) ? 6 : 0;
    return topicScore + subjectPreferred;
}

function assignInstructionalStrategies(modules, context, shouldAssign) {
    if (!shouldAssign) {
        return modules.map((module) => ({
            ...module,
            lessons: module.lessons.map((lesson) => ({ ...lesson, instructionalStrategies: [] })),
        }));
    }

    const subject = detectCourseSubject(context);
    const availableStrategies = getAvailableInstructionalStrategies(context, subject);
    let previousStrategyName = "";

    return modules.map((module, moduleIndex) => ({
        ...module,
        lessons: module.lessons.map((lesson, lessonIndex) => {
            const lessonText = `${lesson.title} ${lesson.sectionTitle || ""}`;
            const lessonTokens = alignmentTokens(lessonText);
            const rankedStrategies = availableStrategies
                .map((strategy) => {
                    const strategyText = `${strategy.name} ${strategy.summary} ${(strategy.platformUses || []).join(" ")}`;
                    const strategyTokens = alignmentTokens(strategyText);
                    const overlap = lessonTokens.filter((token) =>
                        strategyTokens.some((strategyToken) =>
                            strategyToken === token
                            || (token.length >= 6 && strategyToken.startsWith(token))
                            || (strategyToken.length >= 6 && token.startsWith(strategyToken))
                        )
                    ).length;
                    return {
                        strategy,
                        score: (overlap * 3) + getStrategyTopicBonus(lessonText, strategy.name, subject),
                    };
                })
                .sort((first, second) =>
                    second.score - first.score
                    || first.strategy.name.localeCompare(second.strategy.name)
                );
            const topScore = rankedStrategies[0]?.score || 0;
            const relevantPool = topScore > 0
                ? rankedStrategies
                    .filter((candidate) => candidate.score >= Math.max(1, topScore - 3))
                    .slice(0, 10)
                : rankedStrategies;
            const pool = relevantPool.length ? relevantPool : rankedStrategies;
            const seed = stableTextHash(`${context}:${moduleIndex}:${lessonIndex}:${lesson.title}`);
            let selected = pool[seed % pool.length]?.strategy;

            if (selected?.name === previousStrategyName && pool.length > 1) {
                selected = pool[(seed + 1) % pool.length]?.strategy;
            }
            previousStrategyName = selected?.name || "";

            return {
                ...lesson,
                instructionalStrategies: selected ? [{
                    name: selected.name,
                    category: selected.category,
                    sourceId: selected.sourceId,
                }] : [],
            };
        }),
    }));
}

function normalizeAiBlueprint(data, settings) {
    const modules = Array.isArray(data?.modules) ? data.modules : [];
    if (!modules.length) {
        throw new Error("The course planner returned no modules.");
    }

    const normalizedModules = modules.map((module, moduleIndex) => ({
        number: String(module.number || moduleIndex + 1),
        title: stripGeneratedOrderingPrefix(String(module.title || `Module ${moduleIndex + 1}`)),
        overview: String(module.overview || ""),
        plannedDays: Math.max(1, Number(module.plannedDays) || 1),
        lessons: (Array.isArray(module.lessons) ? module.lessons : []).map((lesson, lessonIndex) => ({
            number: String(lesson.number || `${moduleIndex + 1}.${lessonIndex + 1}`),
                title: stripGeneratedOrderingPrefix(String(lesson.title || `Lesson ${lessonIndex + 1}`)),
            plannedDays: Math.max(1, Number(lesson.plannedDays) || 1),
            overview: createTopicSpecificLessonOverview(String(lesson.title || `Lesson ${lessonIndex + 1}`)),
            objective: createTopicSpecificObjective(String(lesson.title || `Lesson ${lessonIndex + 1}`)),
            learningTarget: createTopicSpecificLearningTarget(String(lesson.title || `Lesson ${lessonIndex + 1}`)),
            essentialQuestion: createTopicSpecificEssentialQuestion(String(lesson.title || `Lesson ${lessonIndex + 1}`)),
            assessment: createTopicSpecificAssessment(String(lesson.title || `Lesson ${lessonIndex + 1}`)),
            standards: (Array.isArray(lesson.standards) ? lesson.standards : []).map((standard) => ({
                code: String(standard.code || "Standard"),
                description: String(standard.description || ""),
            })),
        })),
    }));
    const standards = extractStandards(normalizePdfLines(settings.standardsText.text));
    const cappedModules = applyPacing(
        selectStandardsAlignedLessons(normalizedModules, standards, settings.days),
    );
    const strategyContext = `${settings.title} ${settings.fileName} ${cappedModules.map((module) => module.title).join(" ")}`;
    const assignedModules = assignInstructionalStrategies(
        cappedModules,
        strategyContext,
        settings.includeInstructionalStrategies,
    );
    const lessonCount = assignedModules.reduce((sum, module) => sum + module.lessons.length, 0);

    return {
        title: settings.title,
        source: settings.fileName,
        standardsSource: settings.standardsFileName,
        grades: settings.grades.length ? settings.grades.join(", ") : "Not selected",
        pacingStyle: settings.pacingStyle,
        notes: settings.notes,
        includeEssentialQuestions: settings.includeEssentialQuestions,
        includeLearningTargets: settings.includeLearningTargets,
        includeAssessmentPlan: settings.includeAssessmentPlan,
        pdfMeta: settings.pdfText,
        standardsMeta: settings.standardsText,
        modules: assignedModules,
        stats: [
            ["Class days", settings.days],
            ["Modules", assignedModules.length],
            ["Lessons", lessonCount],
            ["Source pages", settings.pdfText.pagesRead + settings.standardsText.pagesRead],
        ],
        outputs: [
            "Analyzed the textbook sequence and scope",
            "Mapped course standards to individual lessons",
            "Generated objectives, learning targets, and essential questions",
            "Balanced lesson and module pacing across available class days",
            "Added assessment recommendations and alignment rationale",
            settings.includeInstructionalStrategies
                ? "Assigned varied, subject-appropriate instructional strategies"
                : "Left instructional strategy assignment off",
        ],
        reviewDays: 0,
        rationale: String(data.rationale || ""),
        warnings: Array.isArray(data.warnings) ? data.warnings.map(String) : [],
        strategySources: INSTRUCTIONAL_STRATEGY_MEMORY.sources,
        strategyCategories: getInstructionalStrategySummary(),
    };
}

async function generateAiBlueprint(settings) {
    const { data, error } = await supabase.functions.invoke("course-blueprint", {
        body: {
            title: settings.title,
            classDays: settings.days,
            grades: settings.grades,
            pacingStyle: settings.pacingStyle,
            planningNotes: settings.notes,
            options: {
                includeEssentialQuestions: settings.includeEssentialQuestions,
                includeLearningTargets: settings.includeLearningTargets,
                includeAssessmentPlan: settings.includeAssessmentPlan,
                includeInstructionalStrategies: settings.includeInstructionalStrategies,
            },
            textbook: {
                fileName: settings.fileName,
                pagesRead: settings.pdfText.pagesRead,
                totalPages: settings.pdfText.totalPages,
                text: settings.pdfText.text,
                tocModules: extractTableOfContentsModules(settings.pdfText).map((module) => ({
                    number: module.number,
                    title: module.title,
                    sourcePage: module.sourcePage,
                    lessons: module.lessons.map((lesson) => ({
                        number: lesson.number,
                        title: lesson.title,
                        sectionTitle: lesson.sectionTitle || "",
                    })),
                })),
            },
            standards: {
                fileName: settings.standardsFileName,
                pagesRead: settings.standardsText.pagesRead,
                totalPages: settings.standardsText.totalPages,
                text: settings.standardsText.text,
            },
        },
    });

    if (error) {
        throw error;
    }

    return normalizeAiBlueprint(data?.blueprint, settings);
}

function buildBlueprintPreview({ title, days, grades, pacingStyle, notes, includeEssentialQuestions, includeLearningTargets, includeAssessmentPlan, includeInstructionalStrategies, fileName, standardsFileName, pdfText, standardsText }) {
    const lines = normalizePdfLines(pdfText.text);
    const standards = extractStandards(normalizePdfLines(standardsText.text));
    const candidateModules = attachTextbookEvidence(buildModulesFromPdf(lines, pdfText), pdfText)
        .map((module) => ({
            ...module,
            title: stripGeneratedOrderingPrefix(module.title),
            lessons: module.lessons.map((lesson) => ({
                ...lesson,
                title: stripGeneratedOrderingPrefix(lesson.title),
            })),
        }));
    const pacedModules = applyPacing(selectStandardsAlignedLessons(candidateModules, standards, days));
    const modules = assignInstructionalStrategies(
        pacedModules,
        `${title} ${fileName} ${pacedModules.map((module) => module.title).join(" ")}`,
        includeInstructionalStrategies,
    );
    const lessonCount = modules.reduce((sum, module) => sum + module.lessons.length, 0);

    return {
        title,
        source: fileName || "Uploaded PDF",
        standardsSource: standardsFileName || "Uploaded standards PDF",
        grades: grades.length ? grades.join(", ") : "Not selected",
        pacingStyle,
        notes,
        modules,
        includeEssentialQuestions,
        includeLearningTargets,
        includeAssessmentPlan,
        pdfMeta: pdfText,
        standardsMeta: standardsText,
        stats: [
            ["Class days", days],
            ["Modules", modules.length],
            ["Lessons", lessonCount],
            ["Source pages", pdfText.pagesRead + standardsText.pagesRead],
        ],
        outputs: [
            `Scanned all ${pdfText.totalPages} textbook pages`,
            "Preserved the textbook's table-of-contents sequence",
            `Selected the ${lessonCount} most standards-aligned textbook topics`,
            "Assigned exactly one class day to every selected lesson",
            standards.length
                ? `Matched lessons to ${standards.length} detected standards`
                : "Standards uploaded; AI analysis is needed for semantic alignment",
            includeLearningTargets ? "Generated objectives and I can learning targets" : "Generated lesson objectives",
            includeEssentialQuestions ? "Generated essential questions for bell ringers" : "Generated lesson overviews",
            includeAssessmentPlan ? "Included assessment and check-for-understanding placeholders" : "Kept assessment planning light",
            includeInstructionalStrategies
                ? "Assigned varied, subject-appropriate instructional strategies"
                : "Left instructional strategy assignment off",
        ],
        strategySources: INSTRUCTIONAL_STRATEGY_MEMORY.sources,
        strategyCategories: getInstructionalStrategySummary(),
        reviewDays: 0,
    };
}

function renderLessonBlueprintField(container, label, value) {
    const field = createElement("article");
    field.append(createElement("span", "", label), createElement("p", "", value));
    container.append(field);
}

function renderBlueprintPreview(blueprint) {
    if (!plannerPreview) {
        return;
    }

    const header = createElement("div", "sage-preview-header");
    const headingGroup = createElement("div");
    headingGroup.append(
        createElement("p", "eyebrow", "Generated Blueprint Preview"),
        createElement("h3", "", blueprint.title),
        createElement("p", "", `Sources: ${blueprint.source} + ${blueprint.standardsSource}`),
    );
    header.append(headingGroup, createElement("span", "badge badge--quiet", blueprint.grades));

    const stats = createElement("div", "sage-planner-stats");
    blueprint.stats.forEach(([label, value]) => {
        const card = createElement("article");
        card.append(createElement("span", "", label), createElement("strong", "", String(value)));
        stats.append(card);
    });

    const outputCard = createElement("article", "sage-brief-card sage-brief-card--wide");
    outputCard.append(createElement("h4", "", "What SAGE will build"));
    const outputList = createElement("ul", "sage-planner-list");
    blueprint.outputs.forEach((item) => {
        outputList.append(createElement("li", "", item));
    });
    outputCard.append(outputList);

    const unitCard = createElement("article", "sage-brief-card sage-brief-card--wide");
    unitCard.append(createElement("h4", "", "Detected course map"));
    const moduleList = createElement("div", "sage-blueprint-modules");

    if (!blueprint.modules.length) {
        moduleList.append(createElement("p", "sage-blueprint-message", "No modules were detected. Try a clearer PDF export or add more planning notes."));
    }

    blueprint.modules.forEach((module) => {
        const moduleCard = createElement("section", "sage-blueprint-module");
        const moduleHeader = createElement("div", "sage-blueprint-module__header");
        moduleHeader.append(
            createElement("h5", "", module.title),
            createElement("span", "sage-blueprint-module__meta", `${module.plannedDays} days · ${module.lessons.length} lessons`),
        );

        const lessonsWrap = createElement("div", "sage-blueprint-lessons");
        module.lessons.forEach((lesson) => {
            const lessonCard = createElement("article", "sage-blueprint-lesson");
            const lessonTop = createElement("div", "sage-blueprint-lesson__top");
            const lessonTitle = createElement("div", "sage-blueprint-lesson__title");
            lessonTitle.append(
                createElement("span", "sage-blueprint-lesson__number", lesson.number || "Lesson"),
                createElement("strong", "", lesson.title),
            );
            lessonTop.append(lessonTitle, createElement("span", "sage-blueprint-lesson__days", `${lesson.plannedDays} day${lesson.plannedDays === 1 ? "" : "s"}`));

            const lessonGrid = createElement("div", "sage-blueprint-lesson-grid");
            renderLessonBlueprintField(lessonGrid, "Objective", lesson.objective);
            if (blueprint.includeLearningTargets) {
                renderLessonBlueprintField(lessonGrid, "I can", lesson.learningTarget);
            }
            if (blueprint.includeEssentialQuestions) {
                renderLessonBlueprintField(lessonGrid, "Essential question", lesson.essentialQuestion);
            }
            renderLessonBlueprintField(lessonGrid, "Overview", lesson.overview);
            if (lesson.standards?.length) {
                renderLessonBlueprintField(
                    lessonGrid,
                    "Standards alignment",
                    lesson.standards
                        .map((standard) => `${standard.code}${standard.description ? ` — ${standard.description}` : ""}`)
                        .join("\n"),
                );
            }
            if (blueprint.includeAssessmentPlan && lesson.assessment) {
                renderLessonBlueprintField(lessonGrid, "Assessment evidence", lesson.assessment);
            }
            if (lesson.instructionalStrategies?.length) {
                renderLessonBlueprintField(
                    lessonGrid,
                    "Instructional strategy",
                    lesson.instructionalStrategies.map((strategy) => strategy.name).join(", "),
                );
            }

            lessonCard.append(lessonTop, lessonGrid);
            lessonsWrap.append(lessonCard);
        });

        moduleCard.append(moduleHeader, lessonsWrap);
        moduleList.append(moduleCard);
    });
    unitCard.append(moduleList);

    const strategyCard = createElement("article", "sage-brief-card sage-brief-card--wide sage-strategy-memory");
    strategyCard.append(
        createElement("h4", "", "Instructional strategy memory"),
        createElement(
            "p",
            "",
            `${blueprint.strategySources.length} research-informed strategy sources are available when lessons are generated.`,
        ),
    );

    const sourceList = createElement("ul", "sage-planner-list");
    blueprint.strategySources.forEach((source) => {
        sourceList.append(createElement(
            "li",
            "",
            `${source.title}${source.authors ? ` by ${source.authors}` : ""} (${source.publisher}${source.year ? `, ${source.year}` : ""})`,
        ));
    });
    strategyCard.append(sourceList);

    const strategyList = createElement("div", "sage-strategy-memory-list");
    blueprint.strategyCategories.forEach((category) => {
        const categoryCard = createElement("section", "sage-strategy-memory-item");
        categoryCard.append(createElement("strong", "", category.name), createElement("p", "", category.purpose));

        const tags = createElement("div", "sage-strategy-memory-tags");
        category.strategies.forEach((strategyName) => {
            tags.append(createElement("span", "", strategyName));
        });
        categoryCard.append(tags);
        strategyList.append(categoryCard);
    });
    strategyCard.append(strategyList);

    const note = createElement("div", "sage-export-note");
    note.append(
        createElement("strong", "", "Next build step"),
        createElement("span", "", blueprint.pdfMeta.truncated
            ? `This preview used the first ${blueprint.pdfMeta.pagesRead} pages. Next, we can add a Create Course button that turns this blueprint into BrainKernl modules and lessons.`
            : "Next, we can add a Create Course button that turns this blueprint into BrainKernl modules and lessons."),
    );

    plannerPreview.replaceChildren(header, stats, outputCard, unitCard, strategyCard, note);
    setBlueprintAvailable(true);
    openBlueprintDialog();
}

function renderEmptyPlannerPreview() {
    if (!plannerPreview) {
        return;
    }

    const emptyState = createElement("div", "sage-empty-state");
    emptyState.append(
        createElement("p", "eyebrow", "Blueprint Preview"),
        createElement("h3", "", "Course structure will appear here"),
        createElement("p", "", "Upload a PDF and add pacing details to preview the course map SAGE will create."),
    );

    plannerPreview.replaceChildren(emptyState);
}

async function handlePlannerSubmit(event) {
    event.preventDefault();

    const formData = new FormData(plannerForm);
    const file = pdfInput?.files?.[0] || plannerDroppedFile;
    const standardsFile = standardsInput?.files?.[0] || standardsDroppedFile;
    const days = Math.max(1, Number(formData.get("classDays")) || 180);

    if (!file) {
        setInlineStatus("Upload a course PDF before generating a blueprint.", "error");
        return;
    }

    if (!standardsFile) {
        setInlineStatus("Upload the course standards PDF before generating a blueprint.", "error");
        return;
    }

    setPlannerLoading(true);
    setInlineStatus("Reading textbook PDF...", "success");

    try {
        const pdfText = await readPdfText(file);
        setInlineStatus("Reading standards PDF...", "success");
        const standardsText = await readPdfText(standardsFile);
        const settings = {
            title: getPlannerTitle(formData, file),
            days,
            grades: getCheckedValues(formData, "plannerGradeLevel"),
            pacingStyle: String(formData.get("pacingStyle") || "balanced"),
            notes: String(formData.get("planningNotes") || "").trim(),
            includeEssentialQuestions: formData.get("includeEssentialQuestions") === "on",
            includeLearningTargets: formData.get("includeLearningTargets") === "on",
            includeAssessmentPlan: formData.get("includeAssessmentPlan") === "on",
            includeInstructionalStrategies: formData.get("includeInstructionalStrategies") === "on",
            fileName: file.name,
            standardsFileName: standardsFile.name,
            pdfText,
            standardsText,
        };

        setInlineStatus("SAGE is aligning the textbook, standards, and pacing...", "success");
        try {
            currentBlueprint = await generateAiBlueprint(settings);
            setInlineStatus("AI course blueprint generated from both source PDFs.", "success");
        } catch (aiError) {
            console.warn("AI blueprint generation unavailable; using local extraction.", aiError);
            currentBlueprint = buildBlueprintPreview(settings);
            setInlineStatus(
                "Local preview generated. Deploy/configure the course-blueprint function for full AI standards alignment.",
                "warning",
            );
        }
        renderBlueprintPreview(currentBlueprint);
    } catch (error) {
        console.error(error);
        setInlineStatus(error.message || "Could not read that PDF. Try another export or a smaller file.", "error");
    } finally {
        setPlannerLoading(false);
    }
}

function renderPreview(brief, settings) {
    if (!previewPanel) {
        return;
    }

    const outline = buildSlideOutline(brief, settings);
    const header = createElement("div", "sage-preview-header");
    const headingGroup = createElement("div", "");
    headingGroup.append(createElement("p", "eyebrow", "Presentation brief"), createElement("h3", "", brief.title));
    header.append(headingGroup, createElement("span", "badge badge--quiet", `${settings.slideCount} slides`));

    const summary = createElement("div", "sage-brief-card");
    summary.append(
        createBriefRow("Source", brief.sourceLabel),
        createBriefRow("Course", brief.courseTitle),
        createBriefRow("Module", brief.moduleTitle || "Not selected"),
        createBriefRow("Duration", brief.duration || settings.durationFallback),
        createBriefRow("Grade level", settings.gradeLevel),
        createBriefRow("Style", settings.deckStyle),
    );

    const context = createElement("article", "sage-brief-card sage-brief-card--wide");
    context.append(
        createElement("h4", "", "Lesson context"),
        createElement("p", "", brief.objective || "No objective provided."),
        createElement("p", "", brief.overview || "No overview provided."),
    );

    const outlineList = createElement("ol", "sage-slide-outline");
    outline.forEach((item) => {
        outlineList.append(createElement("li", "", item));
    });

    const options = createElement("article", "sage-brief-card sage-brief-card--wide");
    options.append(
        createElement("h4", "", "Deck options"),
        createElement(
            "p",
            "",
            [
                settings.speakerNotes ? "speaker notes" : "",
                settings.quickChecks ? "quick checks" : "",
                settings.lessonBridge ? "BrainKernl lesson bridge" : "",
            ].filter(Boolean).join(", ") || "No extras selected.",
        ),
        createElement("p", "", settings.teacherNotes ? `Teacher notes: ${settings.teacherNotes}` : "No extra teacher notes added."),
    );

    if (currentDeckUrl) {
        URL.revokeObjectURL(currentDeckUrl);
    }
    const deck = makePptxBlob(brief, settings);
    currentDeckUrl = URL.createObjectURL(deck.blob);
    const fileName = `${sanitizeFileName(`${brief.courseTitle}-${brief.moduleTitle || "module"}-${brief.title}`)}.pptx`;
    const downloadLink = createElement("a", "primary-button", "Download PPTX");
    downloadLink.href = currentDeckUrl;
    downloadLink.download = fileName;

    const exportNote = createElement("div", "sage-export-note");
    exportNote.append(
        createElement("strong", "", "PPTX ready to download"),
        createElement("span", "", `${deck.slideCount} slides generated with course, module, lesson, and slide number on every slide.`),
        downloadLink,
    );

    previewPanel.replaceChildren(header, summary, context, createElement("h4", "sage-outline-heading", "Suggested slide flow"), outlineList, options, exportNote);
}

function handleSubmit(event) {
    event.preventDefault();

    const formData = new FormData(form);
    const mode = getMode();
    const brief = mode === "manual" ? getManualBrief(formData) : getLessonBrief();
    const validationMessage = validateBrief(brief, mode);

    if (validationMessage) {
        setInlineStatus(validationMessage, "error");
        return;
    }

    renderPreview(brief, {
        gradeLevel: getSelectedGradeLevels(formData),
        slideCount: String(formData.get("slideCount") || "10"),
        deckStyle: String(formData.get("deckStyle") || "clear and teacher-led"),
        teacherNotes: String(formData.get("teacherNotes") || "").trim(),
        speakerNotes: formData.get("speakerNotes") === "on",
        quickChecks: formData.get("quickChecks") === "on",
        lessonBridge: formData.get("lessonBridge") === "on",
        durationFallback: "Teacher selected",
    });

    setInlineStatus("Downloadable PPTX is ready.", "success");
}

async function loadTeachingCourses(profileId) {
    const { data, error } = await supabase
        .from("courses")
        .select("id, title, description, subject_area, estimated_length, status")
        .eq("owner_user_id", profileId)
        .neq("status", "deleted")
        .order("updated_at", { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
}

async function loadModules(courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("modules")
        .select("id, course_id, title, order_index, created_at")
        .in("course_id", courseIds)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        throw error;
    }

    return data || [];
}

async function loadLessons(moduleIds) {
    if (!moduleIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("lessons")
        .select("id, module_id, title, objective, summary, estimated_time, order_index")
        .in("module_id", moduleIds)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        throw error;
    }

    return data || [];
}

function bindEvents() {
    toolButtons.forEach((button) => {
        button.addEventListener("click", () => {
            selectTool(button.dataset.sageTool);
        });
    });

    window.addEventListener("hashchange", () => {
        selectTool(getRequestedToolFromHash(), false);
    });

    form?.addEventListener("change", (event) => {
        if (event.target.name === "sourceMode") {
            renderMode();
        }
    });

    courseSelect?.addEventListener("change", renderModuleOptions);
    moduleSelect?.addEventListener("change", renderLessonOptions);
    lessonSelect?.addEventListener("change", renderSelectedLesson);
    form?.addEventListener("submit", handleSubmit);
    resetButton?.addEventListener("click", () => {
        if (currentDeckUrl) {
            URL.revokeObjectURL(currentDeckUrl);
            currentDeckUrl = "";
        }
        form.reset();
        renderMode();
        renderCourses();
        renderEmptyPreview();
    });

    plannerForm?.addEventListener("submit", handlePlannerSubmit);
    plannerResetButton?.addEventListener("click", () => {
        plannerDroppedFile = null;
        standardsDroppedFile = null;
        currentBlueprint = null;
        plannerForm?.reset();
        setPlannerFileName(null);
        setStandardsFileName(null);
        renderEmptyPlannerPreview();
        setBlueprintAvailable(false);
        closeBlueprintDialog();
        setInlineStatus("Course Blueprint Planner ready.", "success");
    });
    pdfInput?.addEventListener("change", () => {
        plannerDroppedFile = null;
        setPlannerFileName(pdfInput.files?.[0] || null);
    });
    standardsInput?.addEventListener("change", () => {
        standardsDroppedFile = null;
        setStandardsFileName(standardsInput.files?.[0] || null);
    });
    blueprintOpenButton?.addEventListener("click", openBlueprintDialog);
    blueprintCloseButton?.addEventListener("click", closeBlueprintDialog);
    createCourseButton?.addEventListener("click", createCourseFromBlueprint);
    blueprintDialog?.addEventListener("click", (event) => {
        if (event.target === blueprintDialog) {
            closeBlueprintDialog();
        }
    });

    dropzones.forEach((dropzone) => {
        ["dragenter", "dragover"].forEach((eventName) => {
            dropzone.addEventListener(eventName, (event) => {
                event.preventDefault();
                dropzone.classList.add("is-dragging");
            });
        });

        ["dragleave", "drop"].forEach((eventName) => {
            dropzone.addEventListener(eventName, (event) => {
                event.preventDefault();
                dropzone.classList.remove("is-dragging");
            });
        });

        dropzone.addEventListener("drop", (event) => {
            const file = Array.from(event.dataTransfer?.files || []).find((candidate) => candidate.type === "application/pdf" || candidate.name.toLowerCase().endsWith(".pdf"));

            if (!file) {
                setInlineStatus("Drop a PDF file into that source area.", "error");
                return;
            }

            const isStandards = dropzone.dataset.sageDropzone === "standards";
            const targetInput = isStandards ? standardsInput : pdfInput;
            if (isStandards) {
                standardsDroppedFile = file;
                setStandardsFileName(file);
            } else {
                plannerDroppedFile = file;
                setPlannerFileName(file);
            }

            if (targetInput && window.DataTransfer) {
                const transfer = new DataTransfer();
                transfer.items.add(file);
                targetInput.files = transfer.files;
            }
        });
    });
}

async function init() {
    try {
        currentProfile = await loadProtectedProfile({
            statusElement,
        });

        if (!currentProfile) {
            return;
        }

        if (!isTeachingRole(currentProfile.platform_role)) {
            window.location.href = "/v2/pages/dashboard/index.html";
            return;
        }

        if (form) {
            setInlineStatus("Loading your courses and lessons...");
            courses = await loadTeachingCourses(currentProfile.id);
            modules = await loadModules(courses.map((course) => course.id));
            lessons = await loadLessons(modules.map((module) => module.id));
            renderCourses();
            renderMode();
        }
        renderEmptyPlannerPreview();
        selectTool(getRequestedToolFromHash(), false);
        setInlineStatus(form ? "Slide Deck Generator ready." : "Course Structure Planner ready.", "success");
    } catch (error) {
        console.error(error);
        setInlineStatus(error.message || "SAGE AI tools could not be loaded.", "error");
    }
}

bindEvents();
init();
