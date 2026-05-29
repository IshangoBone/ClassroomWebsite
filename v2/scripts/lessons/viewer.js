import { supabase } from "../../services/supabase/client.js";
import { createElement, qs } from "../utils/dom.js";

const params = new URLSearchParams(window.location.search);
const lessonId = params.get("lesson");
const headingElement = qs("[data-lesson-heading]");
const contextElement = qs("[data-lesson-context]");
const statusElement = qs("[data-lesson-status]");
const shellElement = qs("[data-lesson-shell]");
const objectiveElement = qs("[data-lesson-objective]");
const contentRenderer = qs("[data-content-renderer]");
const questionFlow = qs("[data-question-flow]");
const questionPhases = [
    ["before", "Before lesson"],
    ["during", "During lesson"],
    ["reflection", "Reflection"],
];

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
}

function getBlockUrl(contentBlock) {
    return contentBlock.file_url || contentBlock.external_url || "";
}

function isAudioUrl(url) {
    return /\.(mp3|m4a|ogg|wav|webm)(\?.*)?$/i.test(url);
}

function getYouTubeEmbedUrl(url) {
    try {
        const parsedUrl = new URL(url);

        if (parsedUrl.hostname.includes("youtu.be")) {
            const videoId = parsedUrl.pathname.replace("/", "");
            return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
        }

        if (parsedUrl.hostname.includes("youtube.com")) {
            const videoId = parsedUrl.searchParams.get("v") || parsedUrl.pathname.split("/").pop();
            return videoId ? `https://www.youtube.com/embed/${videoId}` : "";
        }
    } catch {
        return "";
    }

    return "";
}

function getSlidesEmbedUrl(url) {
    try {
        const parsedUrl = new URL(url);

        if (parsedUrl.hostname.includes("docs.google.com") && parsedUrl.pathname.includes("/presentation/")) {
            return url.includes("/embed") ? url : url.replace(/\/edit.*$/, "/embed");
        }
    } catch {
        return "";
    }

    return url;
}

function createEmbedFrame(title, src) {
    const wrapper = createElement("div", "lesson-embed-shell");
    const status = createElement("p", "lesson-embed-status", "Loading embedded content...");
    const iframe = document.createElement("iframe");
    const fallback = createElement("p", "lesson-embed-fallback", "If this embed does not load, open it in a new tab.");

    iframe.title = title;
    iframe.src = src;
    iframe.loading = "lazy";
    iframe.allowFullscreen = true;
    iframe.addEventListener("load", () => {
        status.textContent = "Embedded content loaded.";
        status.dataset.state = "loaded";
    });
    iframe.addEventListener("error", () => {
        status.textContent = "Embedded content could not be loaded.";
        status.dataset.state = "error";
    });
    fallback.append(" ", createExternalLink(src, "Open source"));
    wrapper.append(status, iframe, fallback);
    return wrapper;
}

function createExternalLink(url, label = "Open resource") {
    const link = createElement("a", "lesson-resource-link", label);

    link.href = url || "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
}

function createContentBlock(contentBlock) {
    const article = createElement("article", `lesson-render-block lesson-render-block--${contentBlock.block_type}`);
    const title = createElement("h3", "", contentBlock.title || "Untitled content");
    const label = createElement("span", "badge badge--quiet", `Block ${contentBlock.order_index + 1}`);
    const url = getBlockUrl(contentBlock);

    article.append(title, label);

    if (contentBlock.block_type === "text") {
        article.append(createElement("p", "lesson-render-text", contentBlock.body_text || ""));
        return article;
    }

    if (contentBlock.block_type === "youtube") {
        const embedUrl = getYouTubeEmbedUrl(url);
        article.append(embedUrl ? createEmbedFrame(contentBlock.title || "YouTube video", embedUrl) : createExternalLink(url, "Open video"));
        return article;
    }

    if (contentBlock.block_type === "slides") {
        const embedUrl = getSlidesEmbedUrl(url);

        article.append(embedUrl ? createEmbedFrame(contentBlock.title || "Slides", embedUrl) : createExternalLink(url, "Open slides"));
        return article;
    }

    if (contentBlock.block_type === "file" && contentBlock.file_type === "image") {
        const image = createElement("img", "lesson-render-image");

        image.src = url;
        image.alt = contentBlock.title || "Lesson image";
        article.append(image, createExternalLink(url, "Open image"));
        return article;
    }

    if (isAudioUrl(url)) {
        const audio = document.createElement("audio");

        audio.controls = true;
        audio.src = url;
        article.append(audio, createExternalLink(url, "Open audio"));
        return article;
    }

    if (contentBlock.block_type === "link") {
        article.append(createElement("p", "lesson-render-text", "Open this external resource in a new tab."), createExternalLink(url));
        return article;
    }

    article.append(
        createElement("p", "lesson-render-text", `${contentBlock.file_type?.toUpperCase() || "File"} resource`),
        createExternalLink(url, "Download resource")
    );
    return article;
}

function renderContentBlocks(contentBlocks) {
    if (!contentBlocks.length) {
        contentRenderer.replaceChildren(createElement("p", "empty-state", "No visible lesson content is available yet."));
        return;
    }

    contentRenderer.replaceChildren(...contentBlocks.map(createContentBlock));
}

function renderQuestionFlow(questions) {
    const sections = questionPhases.map(([phase, title]) => {
        const phaseQuestions = questions.filter((question) => question.phase === phase);
        const section = createElement("section", "lesson-flow-card");
        const heading = createElement("h3", "", title);

        section.append(heading);

        if (!phaseQuestions.length) {
            section.append(createElement("p", "", "Questions for this section will appear in the full lesson experience."));
            return section;
        }

        const list = createElement("ol", "lesson-flow-question-list");

        phaseQuestions.forEach((question) => {
            const item = createElement("li", "");
            const prompt = createElement("strong", "", question.prompt);
            const instructions = createElement(
                "p",
                "",
                question.student_instructions || (question.is_required ? "Required checkpoint" : "Optional checkpoint")
            );

            item.append(prompt, instructions);
            list.append(item);
        });

        section.append(list);
        return section;
    });

    questionFlow.replaceChildren(...sections);
}

async function loadLessonContext() {
    if (!lessonId) {
        headingElement.textContent = "Lesson unavailable";
        setStatus("Open a lesson from a course before viewing lesson content.", "error");
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

async function loadContentBlocks() {
    const { data, error } = await supabase
        .from("lesson_content_blocks")
        .select("id, block_type, title, body_text, external_url, file_url, file_type, order_index")
        .eq("lesson_id", lessonId)
        .eq("is_visible", true)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    if (error) {
        contentRenderer.replaceChildren(createElement("p", "empty-state", "Lesson content could not be loaded."));
        setStatus("Lesson content could not be loaded.", "error");
        return false;
    }

    renderContentBlocks(data);
    return true;
}

async function loadQuestionFlow() {
    const { data, error } = await supabase
        .from("questions")
        .select("id, phase, prompt, student_instructions, is_required, order_index")
        .eq("lesson_id", lessonId)
        .eq("is_visible", true)
        .is("archived_at", null)
        .order("order_index", { ascending: true });

    renderQuestionFlow(error ? [] : data);
}

async function initializePage() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData.user) {
        window.location.href = "../auth/login.html";
        return;
    }

    const context = await loadLessonContext();

    if (!context) {
        return;
    }

    const { lesson, module, course } = context;

    headingElement.textContent = lesson.title || "Untitled lesson";
    contextElement.textContent = `${course.title || "Untitled course"} / ${module.title || "Untitled module"}`;
    objectiveElement.textContent = lesson.objective || lesson.summary || "No objective has been added for this lesson yet.";
    shellElement.hidden = false;

    await loadQuestionFlow();

    if (await loadContentBlocks()) {
        setStatus("");
    }
}

await initializePage();
