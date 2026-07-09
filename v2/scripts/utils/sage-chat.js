import { supabase } from "../../services/supabase/client.js";
import { createElement } from "./dom.js";

const answerRequestPattern = /\b(answer|answers|give me|tell me|solve it|do it for me|what is it)\b/i;
const stuckPattern = /\b(stuck|confused|don't understand|dont understand|help|hint|explain)\b/i;
const settingsCache = new Map();

function getPageContext() {
    const params = new URLSearchParams(window.location.search);
    const heading = document.querySelector("h1")?.textContent?.trim();
    const title = heading || document.title.replace(/^BrainKernl\s*\|\s*/, "") || "Current page";

    return {
        classroomId: params.get("classroom") || "",
        courseId: params.get("course") || "",
        lessonId: params.get("lesson") || "",
        pagePath: window.location.pathname,
        pageTitle: title,
        url: window.location.href,
    };
}

function getFallbackSageReply(message, context) {
    if (answerRequestPattern.test(message)) {
        return `I can help you get there, but I want you to try one step first. Tell me what you have already tried on ${context.pageTitle}, and I will guide you from there. If you still want the direct answer after that, I can explain it and your teacher will be able to review that request.`;
    }

    if (stuckPattern.test(message)) {
        return `Let's slow it down. What part of ${context.pageTitle} feels unclear right now? If you share your attempt or the exact line you are working on, I can point out the next move without taking the thinking away from you.`;
    }

    return `I can help with ${context.pageTitle}. Start by telling me what you are trying to understand or what you have already tried, and I will guide you like a tutor instead of just jumping to the final answer.`;
}

async function getSageReply(message, context, settings) {
    const { data, error } = await supabase.functions.invoke("sage-chat", {
        body: {
            message,
            context,
            settings: {
                direct_answers_enabled: settings.direct_answers_enabled,
                test_mode_enabled: settings.test_mode_enabled,
            },
        },
    });

    if (error || !data?.reply) {
        throw error || new Error("SAGE response was empty.");
    }

    return data.reply;
}

function getSignal(message) {
    if (answerRequestPattern.test(message)) {
        return {
            signal_type: "answer_request",
            summary: "Student asked SAGE for a direct answer.",
            severity: "medium",
            teacher_action: "pending",
        };
    }

    if (stuckPattern.test(message)) {
        return {
            signal_type: "productive_struggle",
            summary: "Student asked SAGE for help while working through confusion.",
            severity: "low",
            teacher_action: "pending",
        };
    }

    return null;
}

async function getClassroomSettings(classroomId) {
    if (!classroomId) {
        return { sage_chat_enabled: true, direct_answers_enabled: true, test_mode_enabled: false };
    }

    if (settingsCache.has(classroomId)) {
        return settingsCache.get(classroomId);
    }

    const { data, error } = await supabase
        .from("sage_classroom_settings")
        .select("sage_chat_enabled, direct_answers_enabled, test_mode_enabled")
        .eq("classroom_id", classroomId)
        .maybeSingle();

    if (error) {
        console.warn("SAGE settings lookup failed", error);
    }

    const settings = data || { sage_chat_enabled: true, direct_answers_enabled: true, test_mode_enabled: false };
    settingsCache.set(classroomId, settings);
    return settings;
}

function getConversationStorageKey(profileId, context) {
    const contextId = context.classroomId || "no-classroom";
    const lessonId = context.lessonId || context.pagePath;
    return `ctc:sage-conversation:${profileId}:${contextId}:${lessonId}`;
}

function appendMessage(messageList, sender, text) {
    const item = createElement("li", `sage-chat-message sage-chat-message--${sender}`);
    const label = createElement("span", "sage-chat-message-label", sender === "student" ? "You" : "SAGE");
    const body = createElement("p", "sage-chat-message-body", text);

    item.append(label, body);
    messageList.append(item);
    messageList.scrollTop = messageList.scrollHeight;
}

async function getOrCreateConversation(profile, context) {
    if (!context.classroomId) {
        return "";
    }

    const storageKey = getConversationStorageKey(profile.id, context);
    const storedConversationId = window.localStorage.getItem(storageKey);

    if (storedConversationId) {
        return storedConversationId;
    }

    let query = supabase
        .from("sage_conversations")
        .select("id")
        .eq("classroom_id", context.classroomId)
        .eq("student_profile_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(1);

    if (context.lessonId) {
        query = query.eq("lesson_id", context.lessonId);
    }

    const { data: existingRows, error: existingError } = await query;

    if (existingError) {
        throw existingError;
    }

    const existingConversationId = existingRows?.[0]?.id;

    if (existingConversationId) {
        window.localStorage.setItem(storageKey, existingConversationId);
        return existingConversationId;
    }

    const insertPayload = {
        classroom_id: context.classroomId,
        lesson_id: context.lessonId || null,
        student_profile_id: profile.id,
        status: "active",
        last_message_at: new Date().toISOString(),
    };
    const { data: conversation, error: insertError } = await supabase
        .from("sage_conversations")
        .insert(insertPayload)
        .select("id")
        .single();

    if (insertError) {
        throw insertError;
    }

    window.localStorage.setItem(storageKey, conversation.id);
    return conversation.id;
}

async function persistExchange(profile, context, studentMessage, sageMessage, signal) {
    const conversationId = await getOrCreateConversation(profile, context);

    if (!conversationId) {
        return false;
    }

    const screenContext = {
        classroom_id: context.classroomId || null,
        course_id: context.courseId || null,
        lesson_id: context.lessonId || null,
        page_path: context.pagePath,
        page_title: context.pageTitle,
    };

    const { error: messageError } = await supabase.from("sage_messages").insert([
        {
            conversation_id: conversationId,
            sender_type: "student",
            message_text: studentMessage,
            screen_context: screenContext,
        },
        {
            conversation_id: conversationId,
            sender_type: "sage",
            message_text: sageMessage,
            screen_context: screenContext,
        },
    ]);

    if (messageError) {
        throw messageError;
    }

    if (signal) {
        const { error: signalError } = await supabase
            .from("sage_conversation_signals")
            .insert({
                conversation_id: conversationId,
                ...signal,
            });

        if (signalError) {
            throw signalError;
        }
    }

    return true;
}

function setPanelState(root, isOpen) {
    root.classList.toggle("sage-chat--open", isOpen);
    root.querySelector("[data-sage-toggle]")?.setAttribute("aria-expanded", String(isOpen));
}

export function renderSageChat(profile) {
    if (!profile || document.querySelector("[data-sage-chat-root]")) {
        return;
    }

    const root = createElement("aside", "sage-chat");
    const toggle = createElement("button", "sage-chat-toggle");
    const panel = createElement("section", "sage-chat-panel");
    const header = createElement("div", "sage-chat-header");
    const titleGroup = createElement("div", "sage-chat-title-group");
    const eyebrow = createElement("span", "sage-chat-eyebrow", "SAGE");
    const title = createElement("strong", "sage-chat-title", "Ask for guidance");
    const closeButton = createElement("button", "sage-chat-close", "Close");
    const messages = createElement("ol", "sage-chat-messages");
    const form = createElement("form", "sage-chat-form");
    const input = createElement("textarea", "sage-chat-input");
    const sendButton = createElement("button", "sage-chat-send", "Send");
    const note = createElement("p", "sage-chat-note");

    root.dataset.sageChatRoot = "true";
    toggle.type = "button";
    toggle.dataset.sageToggle = "true";
    toggle.setAttribute("aria-label", "Open SAGE chat");
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "S";

    panel.setAttribute("aria-label", "SAGE chat");
    titleGroup.append(eyebrow, title);
    closeButton.type = "button";
    header.append(titleGroup, closeButton);

    appendMessage(
        messages,
        "sage",
        "Hi, I’m SAGE. Ask me what you are working on, and I’ll help you think through it step by step."
    );

    input.rows = 2;
    input.placeholder = "Ask SAGE a question...";
    sendButton.type = "submit";
    note.textContent = "SAGE guides your thinking. Direct answer requests can be reviewed by your teacher.";

    form.append(input, sendButton);
    panel.append(header, messages, form, note);
    root.append(toggle, panel);
    document.body.append(root);

    toggle.addEventListener("click", () => {
        const shouldOpen = !root.classList.contains("sage-chat--open");
        setPanelState(root, shouldOpen);
        if (shouldOpen) {
            input.focus();
        }
    });

    closeButton.addEventListener("click", () => {
        setPanelState(root, false);
        toggle.focus();
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const studentMessage = input.value.trim();

        if (!studentMessage) {
            return;
        }

        const context = getPageContext();
        const settings = await getClassroomSettings(context.classroomId);

        if (!settings.sage_chat_enabled) {
            input.value = "";
            appendMessage(messages, "student", studentMessage);
            appendMessage(
                messages,
                "sage",
                "SAGE chat is turned off for this class right now. Keep working from the lesson directions, or ask your teacher for help."
            );
            note.textContent = "SAGE chat is disabled for this classroom.";
            return;
        }

        let sageMessage = "";
        const signal = getSignal(studentMessage);

        input.value = "";
        appendMessage(messages, "student", studentMessage);
        note.textContent = "SAGE is thinking...";

        try {
            sageMessage = await getSageReply(studentMessage, context, settings);
        } catch (error) {
            console.warn("SAGE AI response failed, using local guidance", error);
            sageMessage = getFallbackSageReply(studentMessage, context);
            note.textContent = "SAGE is using local guidance because the AI service is not reachable yet.";
        }

        appendMessage(messages, "sage", sageMessage);
        if (note.textContent === "SAGE is thinking...") {
            note.textContent = "Saving SAGE chat context...";
        }

        try {
            const wasPersisted = await persistExchange(profile, context, studentMessage, sageMessage, signal);
            note.textContent = wasPersisted
                ? "Saved to SAGE review for this classroom."
                : "This page does not have classroom context, so this chat is local only.";
        } catch (error) {
            console.warn("SAGE chat persistence failed", error);
            note.textContent = "SAGE could not save this chat yet, but you can keep using the guidance here.";
        }
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && root.classList.contains("sage-chat--open")) {
            setPanelState(root, false);
            toggle.focus();
        }
    });
}
