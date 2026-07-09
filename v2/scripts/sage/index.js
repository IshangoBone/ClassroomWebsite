import { supabase } from "../../services/supabase/client.js";
import { isTeachingRole, loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { setStatusMessage } from "../utils/ui-components.js";

const statusElement = qs("[data-sage-status]");
const classroomSelect = qs("[data-sage-classroom-select]");
const classroomSummary = qs("[data-sage-classroom-summary]");
const settingsForm = qs("[data-sage-settings-form]");
const saveState = qs("[data-sage-save-state]");
const insightsClassroomSelect = qs("[data-sage-insights-classroom]");
const insightsSummary = qs("[data-sage-insights-summary]");
const insightsPatterns = qs("[data-sage-insights-patterns]");
const insightsStudents = qs("[data-sage-insights-students]");
const generatorForm = qs("[data-sage-generator-form]");
const generatorClassroomSelect = qs("[data-sage-generator-classroom]");
const generatorClassroomSummary = qs("[data-sage-generator-classroom-summary]");
const generatorPreviewButton = qs("[data-sage-generator-preview]");
const reviewFilters = qs("[data-sage-review-filters]");
const reviewClassroomSelect = qs("[data-sage-review-filters] select[name='classroom']");
const conversationList = qs("[data-sage-conversation-list]");
const conversationDetail = qs("[data-sage-conversation-detail]");
const reviewStats = {
    total: qs("[data-sage-review-stat='total']"),
    answers: qs("[data-sage-review-stat='answers']"),
    review: qs("[data-sage-review-stat='review']"),
};

let currentProfile = null;
let courses = [];
let classrooms = [];
let conversations = [];
let profileSignals = [];
let selectedConversationId = "";
let settingsPersistence = "remote";
let conversationDataNotice = "";
let profileSignalDataNotice = "";
let settingsByClassroomId = new Map();

const defaultSettings = {
    sageChat: true,
    directAnswers: true,
    testMode: false,
    conversationReview: true,
};

function settingKey(classroomId) {
    return `ctc:sage:classroom-settings:${classroomId}`;
}

function getSettings(classroomId) {
    if (settingsByClassroomId.has(classroomId)) {
        return settingsByClassroomId.get(classroomId);
    }

    try {
        return {
            ...defaultSettings,
            ...JSON.parse(window.localStorage.getItem(settingKey(classroomId)) || "{}"),
        };
    } catch {
        return { ...defaultSettings };
    }
}

function serializeSettings(settings) {
    return {
        sageChat: Boolean(settings.sageChat),
        directAnswers: Boolean(settings.directAnswers),
        testMode: Boolean(settings.testMode),
        conversationReview: Boolean(settings.conversationReview),
    };
}

function mapRemoteSettings(row) {
    return {
        sageChat: Boolean(row.sage_chat_enabled),
        directAnswers: Boolean(row.direct_answers_enabled),
        testMode: Boolean(row.test_mode_enabled),
        conversationReview: Boolean(row.conversation_review_enabled),
    };
}

function mapSettingsToRemoteRow(classroomId, settings) {
    return {
        classroom_id: classroomId,
        sage_chat_enabled: Boolean(settings.sageChat),
        direct_answers_enabled: Boolean(settings.directAnswers),
        test_mode_enabled: Boolean(settings.testMode),
        conversation_review_enabled: Boolean(settings.conversationReview),
        updated_by: currentProfile?.id || null,
    };
}

function cacheLocalSettings(classroomId, settings) {
    window.localStorage.setItem(settingKey(classroomId), JSON.stringify(settings));
}

function setSaveState(message, tone = "") {
    if (!saveState) {
        return;
    }

    saveState.textContent = message;

    if (tone) {
        saveState.dataset.tone = tone;
    } else {
        delete saveState.dataset.tone;
    }
}

async function loadClassroomSettings() {
    settingsByClassroomId = new Map();

    classrooms.forEach((classroom) => {
        settingsByClassroomId.set(classroom.id, getSettings(classroom.id));
    });

    if (!classrooms.length) {
        return;
    }

    const { data, error } = await supabase
        .from("sage_classroom_settings")
        .select("classroom_id, sage_chat_enabled, direct_answers_enabled, test_mode_enabled, conversation_review_enabled")
        .in("classroom_id", classrooms.map((classroom) => classroom.id));

    if (error) {
        settingsPersistence = "local";
        setSaveState("Local fallback");
        return;
    }

    settingsPersistence = "remote";
    (data || []).forEach((row) => {
        settingsByClassroomId.set(row.classroom_id, {
            ...defaultSettings,
            ...mapRemoteSettings(row),
        });
    });
}

async function saveSettings(classroomId, settings) {
    const savedSettings = serializeSettings(settings);
    settingsByClassroomId.set(classroomId, savedSettings);

    if (settingsPersistence === "remote") {
        const { error } = await supabase
            .from("sage_classroom_settings")
            .upsert(mapSettingsToRemoteRow(classroomId, savedSettings), { onConflict: "classroom_id" });

        if (!error) {
            setSaveState("Settings saved", "success");
            return;
        }

        settingsPersistence = "local";
    }

    cacheLocalSettings(classroomId, savedSettings);
    setSaveState("Settings saved locally", "success");
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

function getClassroomLabel(classroom) {
    const period = classroom.period_block ? ` - ${classroom.period_block}` : "";
    return `${classroom.name}${period}`;
}

function getCourseTitle(courseId) {
    return courses.find((course) => course.id === courseId)?.title || "Course";
}

async function loadTeachingCourses(profileId) {
    const { data, error } = await supabase
        .from("courses")
        .select("id, title, status")
        .eq("owner_user_id", profileId)
        .neq("status", "deleted")
        .order("updated_at", { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
}

async function loadManagedClassrooms(profileId, courseIds) {
    if (!courseIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("classrooms")
        .select("id, course_id, name, period_block, status, join_enabled, display_order")
        .eq("owner_teacher_id", profileId)
        .in("course_id", courseIds)
        .neq("status", "deleted")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });

    if (error) {
        throw error;
    }

    return data || [];
}

function uniqueValues(values) {
    return [...new Set(values.filter(Boolean))];
}

function mapById(items) {
    return new Map((items || []).map((item) => [item.id, item]));
}

async function fetchByIds(tableName, ids, columns) {
    const uniqueIds = uniqueValues(ids);

    if (!uniqueIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from(tableName)
        .select(columns)
        .in("id", uniqueIds);

    if (error) {
        throw error;
    }

    return data || [];
}

async function fetchMessages(conversationIds) {
    const uniqueIds = uniqueValues(conversationIds);

    if (!uniqueIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("sage_messages")
        .select("id, conversation_id, sender_type, message_text, created_at")
        .in("conversation_id", uniqueIds)
        .order("created_at", { ascending: true });

    if (error) {
        throw error;
    }

    return data || [];
}

async function fetchSignals(conversationIds) {
    const uniqueIds = uniqueValues(conversationIds);

    if (!uniqueIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from("sage_conversation_signals")
        .select("id, conversation_id, signal_type, summary, severity, teacher_action, created_at")
        .in("conversation_id", uniqueIds)
        .order("created_at", { ascending: true });

    if (error) {
        throw error;
    }

    return data || [];
}

function groupBy(items, key) {
    return (items || []).reduce((groups, item) => {
        const groupKey = item[key];
        if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
        }
        groups.get(groupKey).push(item);
        return groups;
    }, new Map());
}

function getProfileName(profile) {
    if (!profile) {
        return "Student";
    }

    const fullName = [profile.legal_first_name, profile.legal_last_name].filter(Boolean).join(" ").trim();
    return fullName || profile.username || profile.email || "Student";
}

function formatConversationTime(conversation) {
    const value = conversation.last_message_at || conversation.started_at;

    if (!value) {
        return "No messages yet";
    }

    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value));
}

function normalizeStatus(status) {
    return String(status || "needs_review").replaceAll("-", "_");
}

function statusLabel(status) {
    const labels = {
        active: "Active",
        needs_review: "Needs review",
        reviewed: "Reviewed",
        archived: "Archived",
    };

    return labels[normalizeStatus(status)] || "Needs review";
}

function normalizeSignal(signal) {
    return String(signal || "other").replaceAll("-", "_");
}

function getLastMessage(messages, senderType) {
    return [...messages].reverse().find((message) => message.sender_type === senderType);
}

function summarizeSignal(signals) {
    if (!signals.length) {
        return "No learning signal has been recorded yet.";
    }

    return signals
        .map((signal) => `${getSignalLabel(signal.signal_type)}: ${signal.summary}`)
        .join(" ");
}

function mapSignal(signal) {
    return {
        id: signal.id,
        type: normalizeSignal(signal.signal_type),
        label: getSignalLabel(signal.signal_type),
        summary: signal.summary,
        severity: signal.severity || "info",
        teacherAction: signal.teacher_action || "pending",
    };
}

function mapProfileSignal(row, context) {
    const classroom = context.classroomsById.get(row.classroom_id);
    const lesson = context.lessonsById.get(row.lesson_id);
    const profile = context.profilesById.get(row.student_profile_id);

    return {
        id: row.id,
        classroomId: row.classroom_id,
        classroomName: classroom ? getClassroomLabel(classroom) : "Classroom",
        student: getProfileName(profile),
        studentProfileId: row.student_profile_id,
        lesson: lesson?.title || "General SAGE activity",
        type: normalizeSignal(row.signal_type),
        label: getSignalLabel(row.signal_type),
        summary: row.summary,
        evidence: row.evidence || "",
        confidence: row.confidence || "medium",
        createdAt: row.created_at,
    };
}

function mapConversationRow(row, context) {
    const messages = context.messagesByConversation.get(row.id) || [];
    const signals = context.signalsByConversation.get(row.id) || [];
    const primarySignal = signals.find((signal) => signal.teacher_action === "pending") || signals[0];
    const studentMessage = getLastMessage(messages, "student");
    const sageMessage = getLastMessage(messages, "sage");
    const classroom = context.classroomsById.get(row.classroom_id);
    const lesson = context.lessonsById.get(row.lesson_id);
    const profile = context.profilesById.get(row.student_profile_id);

    return {
        id: row.id,
        classroomId: row.classroom_id,
        classroomName: classroom ? getClassroomLabel(classroom) : "Classroom",
        student: getProfileName(profile),
        studentProfileId: row.student_profile_id,
        lesson: lesson?.title || "SAGE chat",
        signal: normalizeSignal(primarySignal?.signal_type),
        status: normalizeStatus(row.status),
        time: formatConversationTime(row),
        question: studentMessage?.message_text || "No student message has been recorded yet.",
        response: sageMessage?.message_text || "No SAGE response has been recorded yet.",
        teacherSignal: summarizeSignal(signals),
        signals: signals.map(mapSignal),
        primarySignalId: primarySignal?.id || "",
        primarySignalAction: primarySignal?.teacher_action || "",
    };
}

async function loadSageProfileSignals() {
    profileSignalDataNotice = "";

    if (!classrooms.length) {
        return [];
    }

    const classroomIds = classrooms.map((classroom) => classroom.id);
    const { data, error } = await supabase
        .from("sage_student_profile_signals")
        .select("id, student_profile_id, classroom_id, lesson_id, signal_type, summary, evidence, confidence, created_at")
        .in("classroom_id", classroomIds)
        .order("created_at", { ascending: false })
        .limit(150);

    if (error) {
        profileSignalDataNotice = "SAGE Insights are ready. Apply the latest SAGE migration to load profile signals.";
        console.warn("SAGE profile signals unavailable:", error);
        return [];
    }

    const signalRows = data || [];

    if (!signalRows.length) {
        return [];
    }

    const [profileRows, lessonRows] = await Promise.all([
        fetchByIds("profiles", signalRows.map((signal) => signal.student_profile_id), "id, username, legal_first_name, legal_last_name, email"),
        fetchByIds("lessons", signalRows.map((signal) => signal.lesson_id), "id, title"),
    ]);

    return signalRows.map((signal) => mapProfileSignal(signal, {
        classroomsById: mapById(classrooms),
        profilesById: mapById(profileRows),
        lessonsById: mapById(lessonRows),
    }));
}

async function loadSageConversations() {
    conversationDataNotice = "";

    if (!classrooms.length) {
        return [];
    }

    const classroomIds = classrooms.map((classroom) => classroom.id);
    const { data, error } = await supabase
        .from("sage_conversations")
        .select("id, classroom_id, lesson_id, student_profile_id, status, started_at, last_message_at, reviewed_at")
        .in("classroom_id", classroomIds)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(75);

    if (error) {
        conversationDataNotice = "Conversation review is ready. Apply the SAGE migration to load live conversations.";
        console.warn("SAGE conversation review unavailable:", error);
        return [];
    }

    const conversationRows = data || [];

    if (!conversationRows.length) {
        return [];
    }

    const conversationIds = conversationRows.map((conversation) => conversation.id);
    const [profileRows, lessonRows, messageRows, signalRows] = await Promise.all([
        fetchByIds("profiles", conversationRows.map((conversation) => conversation.student_profile_id), "id, username, legal_first_name, legal_last_name, email"),
        fetchByIds("lessons", conversationRows.map((conversation) => conversation.lesson_id), "id, title"),
        fetchMessages(conversationIds),
        fetchSignals(conversationIds),
    ]);

    return conversationRows.map((conversation) => mapConversationRow(conversation, {
        classroomsById: mapById(classrooms),
        profilesById: mapById(profileRows),
        lessonsById: mapById(lessonRows),
        messagesByConversation: groupBy(messageRows, "conversation_id"),
        signalsByConversation: groupBy(signalRows, "conversation_id"),
    }));
}

function renderClassroomOptions() {
    classroomSelect.replaceChildren();

    if (!classrooms.length) {
        const emptyOption = createElement("option", "", "No classrooms available yet");
        emptyOption.value = "";
        classroomSelect.append(emptyOption);
        classroomSelect.disabled = true;
        settingsForm.hidden = true;
        classroomSummary.textContent = "Create a classroom first, then return here to tune SAGE for that class.";
        return;
    }

    classrooms.forEach((classroom) => {
        const option = createElement("option", "", `${getClassroomLabel(classroom)} (${getCourseTitle(classroom.course_id)})`);
        option.value = classroom.id;
        classroomSelect.append(option);
    });

    classroomSelect.disabled = false;
    settingsForm.hidden = false;
    applySelectedClassroom();
}

function renderInsightsClassroomOptions() {
    if (!insightsClassroomSelect) {
        return;
    }

    const currentValue = insightsClassroomSelect.value || "all";
    insightsClassroomSelect.replaceChildren();

    const allOption = createElement("option", "", "All classrooms");
    allOption.value = "all";
    insightsClassroomSelect.append(allOption);

    classrooms.forEach((classroom) => {
        const option = createElement("option", "", `${getClassroomLabel(classroom)} (${getCourseTitle(classroom.course_id)})`);
        option.value = classroom.id;
        insightsClassroomSelect.append(option);
    });

    insightsClassroomSelect.value = [...insightsClassroomSelect.options].some((option) => option.value === currentValue)
        ? currentValue
        : "all";
}

function renderGeneratorClassroomOptions() {
    if (!generatorClassroomSelect) {
        return;
    }

    const currentValue = generatorClassroomSelect.value;
    generatorClassroomSelect.replaceChildren();

    const emptyOption = createElement("option", "", classrooms.length ? "Choose a classroom" : "No classrooms available yet");
    emptyOption.value = "";
    generatorClassroomSelect.append(emptyOption);

    classrooms.forEach((classroom) => {
        const option = createElement("option", "", `${getClassroomLabel(classroom)} (${getCourseTitle(classroom.course_id)})`);
        option.value = classroom.id;
        generatorClassroomSelect.append(option);
    });

    generatorClassroomSelect.value = [...generatorClassroomSelect.options].some((option) => option.value === currentValue)
        ? currentValue
        : "";
    generatorClassroomSelect.disabled = !classrooms.length;
    renderGeneratorClassroomSummary();
}

function renderGeneratorClassroomSummary() {
    if (!generatorClassroomSelect || !generatorClassroomSummary) {
        return;
    }

    const classroom = classrooms.find((item) => item.id === generatorClassroomSelect.value);

    if (!classroom) {
        generatorClassroomSummary.textContent = "Select a classroom to preview the class context SAGE will use.";
        return;
    }

    const signals = profileSignals.filter((signal) => signal.classroomId === classroom.id);
    const supportSignals = signals.filter((signal) => ["support_need", "misconception", "answer_request"].includes(signal.type));
    const strengthSignals = signals.filter((signal) => ["strength", "engagement"].includes(signal.type));
    const signalSummary = signals.length
        ? `${signals.length} profile signal${signals.length === 1 ? "" : "s"}, ${supportSignals.length} support need${supportSignals.length === 1 ? "" : "s"}, ${strengthSignals.length} strength signal${strengthSignals.length === 1 ? "" : "s"}`
        : "No saved SAGE profile signals yet";

    generatorClassroomSummary.textContent = `${getClassroomLabel(classroom)} | ${getCourseTitle(classroom.course_id)} | ${signalSummary}.`;
}

function previewGeneratorWorkflow() {
    if (!generatorForm) {
        return;
    }

    const formData = new FormData(generatorForm);
    const classroomId = formData.get("classroom");
    const topic = String(formData.get("topic") || "").trim();
    const objective = String(formData.get("objective") || "").trim();

    if (!classroomId || !topic || !objective) {
        setInlineStatus("Choose a classroom, lesson topic, and shared objective before preparing the SAGE generator workflow.", "error");
        return;
    }

    renderGeneratorClassroomSummary();
    setInlineStatus(`SAGE Lesson Generator workflow staged for "${topic}". Next step is connecting the teacher-reviewed draft endpoint.`, "success");
}

function renderClassroomSummary(classroom) {
    const courseTitle = getCourseTitle(classroom.course_id);
    const status = classroom.status || "active";
    const joinState = classroom.join_enabled ? "Joining open" : "Joining closed";

    classroomSummary.replaceChildren(
        createElement("strong", "", getClassroomLabel(classroom)),
        createElement("span", "", `${courseTitle} | ${status} | ${joinState}`)
    );
}

function applySelectedClassroom() {
    const classroom = classrooms.find((item) => item.id === classroomSelect.value);

    if (!classroom) {
        return;
    }

    const settings = getSettings(classroom.id);
    [...settingsForm.elements].forEach((element) => {
        if (element.name && Object.prototype.hasOwnProperty.call(settings, element.name)) {
            element.checked = Boolean(settings[element.name]);
        }
    });
    renderClassroomSummary(classroom);
    setSaveState(settingsPersistence === "remote" ? "Settings loaded" : "Local fallback");
}

function readFormSettings() {
    return [...settingsForm.elements].reduce((settings, element) => {
        if (element.name) {
            settings[element.name] = Boolean(element.checked);
        }
        return settings;
    }, {});
}

function bindEvents() {
    classroomSelect.addEventListener("change", applySelectedClassroom);
    insightsClassroomSelect?.addEventListener("change", renderSageInsights);
    generatorClassroomSelect?.addEventListener("change", renderGeneratorClassroomSummary);
    generatorPreviewButton?.addEventListener("click", previewGeneratorWorkflow);
    settingsForm.addEventListener("change", async () => {
        const classroomId = classroomSelect.value;

        if (!classroomId) {
            return;
        }

        setSaveState("Saving settings...");

        try {
            await saveSettings(classroomId, readFormSettings());
        } catch (error) {
            cacheLocalSettings(classroomId, readFormSettings());
            setSaveState("Settings saved locally", "success");
        }
    });

    reviewFilters?.addEventListener("change", renderConversationReview);
    conversationList?.addEventListener("click", (event) => {
        const cardButton = event.target.closest("[data-sage-conversation-id]");

        if (cardButton) {
            selectedConversationId = cardButton.dataset.sageConversationId;
            renderConversationReview();
        }
    });
    conversationDetail?.addEventListener("click", async (event) => {
        const reviewButton = event.target.closest("[data-sage-mark-reviewed]");
        const profileSignalButton = event.target.closest("[data-sage-add-profile-signal]");

        if (!reviewButton && !profileSignalButton) {
            return;
        }

        if (profileSignalButton) {
            const signalId = profileSignalButton.dataset.sageAddProfileSignal;

            if (!signalId) {
                return;
            }

            profileSignalButton.disabled = true;
            profileSignalButton.textContent = "Adding...";

            try {
                await addSignalToStudentProfile(signalId);
                renderConversationReview();
            } catch (error) {
                setInlineStatus(error.message || "Could not add this signal to the student profile.", "error");
                renderConversationReview();
            }
            return;
        }

        const conversationId = reviewButton.dataset.sageMarkReviewed;

        reviewButton.disabled = true;
        reviewButton.textContent = "Saving...";

        try {
            await markConversationReviewed(conversationId);
            selectedConversationId = conversationId;
            renderConversationReview();
        } catch (error) {
            setInlineStatus(error.message || "Could not mark this conversation reviewed.", "error");
            renderConversationReview();
        }
    });
}

function getFilteredProfileSignals() {
    const classroomFilter = insightsClassroomSelect?.value || "all";

    return profileSignals.filter((signal) => classroomFilter === "all" || signal.classroomId === classroomFilter);
}

function countBy(items, key) {
    return items.reduce((counts, item) => {
        const value = item[key] || "other";
        counts.set(value, (counts.get(value) || 0) + 1);
        return counts;
    }, new Map());
}

function getTopItems(counts, limit = 4) {
    return [...counts.entries()]
        .sort((first, second) => second[1] - first[1])
        .slice(0, limit);
}

function renderInsightMetric(label, value) {
    const article = createElement("article", "");
    article.append(
        createElement("span", "", label),
        createElement("strong", "", String(value))
    );
    return article;
}

function renderInsightListItem(title, detail, badgeText = "") {
    const item = createElement("div", "sage-insights-list-item");
    const copy = createElement("div");
    copy.append(
        createElement("strong", "", title),
        createElement("span", "", detail)
    );
    item.append(copy);

    if (badgeText) {
        item.append(createElement("span", "badge badge--quiet", badgeText));
    }

    return item;
}

function renderSageInsights() {
    if (!insightsSummary || !insightsPatterns || !insightsStudents) {
        return;
    }

    const signals = getFilteredProfileSignals();
    insightsSummary.replaceChildren();
    insightsPatterns.replaceChildren();
    insightsStudents.replaceChildren();

    if (profileSignalDataNotice) {
        insightsPatterns.append(createElement("p", "sage-empty-state", profileSignalDataNotice));
        insightsStudents.append(createElement("p", "sage-empty-state", "Once profile signals exist, recent student summaries will appear here."));
        insightsSummary.append(
            renderInsightMetric("Profile signals", 0),
            renderInsightMetric("Students", 0),
            renderInsightMetric("Support needs", 0),
            renderInsightMetric("Strengths", 0)
        );
        return;
    }

    const studentCount = new Set(signals.map((signal) => signal.studentProfileId)).size;
    const supportCount = signals.filter((signal) => ["answer_request", "misconception", "support_need", "productive_struggle"].includes(signal.type)).length;
    const strengthCount = signals.filter((signal) => signal.type === "strength" || signal.type === "engagement").length;

    insightsSummary.append(
        renderInsightMetric("Profile signals", signals.length),
        renderInsightMetric("Students", studentCount),
        renderInsightMetric("Support needs", supportCount),
        renderInsightMetric("Strengths", strengthCount)
    );

    if (!signals.length) {
        insightsPatterns.append(createElement("p", "sage-empty-state", "No SAGE profile signals yet. Add useful signals from Conversation Review to start building insights."));
        insightsStudents.append(createElement("p", "sage-empty-state", "Recent student signals will appear here after teachers add them to profiles."));
        return;
    }

    getTopItems(countBy(signals, "type")).forEach(([type, count]) => {
        insightsPatterns.append(renderInsightListItem(getSignalLabel(type), `${count} signal${count === 1 ? "" : "s"} captured`, "Pattern"));
    });

    signals.slice(0, 6).forEach((signal) => {
        insightsStudents.append(renderInsightListItem(
            signal.student,
            `${signal.label} in ${signal.lesson}: ${signal.summary}`,
            signal.classroomName
        ));
    });
}

function renderReviewClassroomOptions() {
    if (!reviewClassroomSelect) {
        return;
    }

    const currentValue = reviewClassroomSelect.value || "all";
    reviewClassroomSelect.replaceChildren();

    const allOption = createElement("option", "", "All classrooms");
    allOption.value = "all";
    reviewClassroomSelect.append(allOption);

    classrooms.forEach((classroom) => {
        const option = createElement("option", "", `${getClassroomLabel(classroom)} (${getCourseTitle(classroom.course_id)})`);
        option.value = classroom.id;
        reviewClassroomSelect.append(option);
    });

    reviewClassroomSelect.value = [...reviewClassroomSelect.options].some((option) => option.value === currentValue)
        ? currentValue
        : "all";
}

function getSignalLabel(signal) {
    const labels = {
        answer_request: "Answer request",
        "answer-request": "Answer request",
        misconception: "Misconception",
        safety: "Safety flag",
        productive_struggle: "Productive struggle",
        "productive-struggle": "Productive struggle",
        engagement: "Engagement",
        other: "Other signal",
    };

    return labels[normalizeSignal(signal)] || labels[signal] || signal;
}

function getFilteredConversations() {
    const formData = new FormData(reviewFilters);
    const classroomFilter = formData.get("classroom") || "all";
    const signalFilter = formData.get("signal") || "all";
    const statusFilter = formData.get("status") || "all";

    return conversations.filter((conversation) => {
        const matchesClassroom = classroomFilter === "all" || conversation.classroomId === classroomFilter;
        const matchesSignal = signalFilter === "all" || conversation.signal === normalizeSignal(signalFilter);
        const matchesStatus = statusFilter === "all" || conversation.status === normalizeStatus(statusFilter);

        return matchesClassroom && matchesSignal && matchesStatus;
    });
}

function renderReviewStats(filteredConversations) {
    if (reviewStats.total) {
        reviewStats.total.textContent = String(filteredConversations.length);
    }

    if (reviewStats.answers) {
        reviewStats.answers.textContent = String(filteredConversations.filter((conversation) => conversation.signal === "answer_request").length);
    }

    if (reviewStats.review) {
        reviewStats.review.textContent = String(filteredConversations.filter((conversation) => conversation.status === "needs_review").length);
    }
}

async function markConversationReviewed(conversationId) {
    const reviewedAt = new Date().toISOString();
    const { error } = await supabase
        .from("sage_conversations")
        .update({
            status: "reviewed",
            reviewed_at: reviewedAt,
            reviewed_by: currentProfile.id,
        })
        .eq("id", conversationId);

    if (error) {
        throw error;
    }

    const { error: signalError } = await supabase
        .from("sage_conversation_signals")
        .update({
            teacher_action: "reviewed",
            reviewed_at: reviewedAt,
            reviewed_by: currentProfile.id,
        })
        .eq("conversation_id", conversationId)
        .eq("teacher_action", "pending");

    if (signalError) {
        throw signalError;
    }

    conversations = conversations.map((conversation) => conversation.id === conversationId
        ? { ...conversation, status: "reviewed" }
        : conversation);
    setInlineStatus("Conversation marked reviewed.", "success");
}

async function addSignalToStudentProfile(signalId) {
    const { error } = await supabase.rpc("add_sage_signal_to_student_profile", {
        signal_to_add: signalId,
    });

    if (error) {
        throw error;
    }

    conversations = await loadSageConversations();
    profileSignals = await loadSageProfileSignals();
    renderSageInsights();
    setInlineStatus("SAGE signal added to the student profile.", "success");
}

function renderConversationCard(conversation) {
    const card = createElement("button", "sage-conversation-card");
    card.type = "button";
    card.dataset.sageConversationId = conversation.id;
    card.setAttribute("aria-pressed", String(conversation.id === selectedConversationId));

    const header = createElement("span", "sage-conversation-card-header");
    header.append(
        createElement("strong", "", conversation.student),
        createElement("span", "badge badge--quiet", getSignalLabel(conversation.signal))
    );

    card.append(
        header,
        createElement("span", "sage-conversation-meta", `${conversation.classroomName} | ${conversation.lesson}`),
        createElement("span", "sage-conversation-question", conversation.question),
        createElement("span", "sage-conversation-time", `${conversation.time} | ${statusLabel(conversation.status)}`)
    );

    return card;
}

function renderConversationDetail(conversation) {
    conversationDetail.replaceChildren();

    if (!conversation) {
        conversationDetail.append(
            createElement("p", "eyebrow", "Conversation detail"),
            createElement("h3", "", "Select a conversation"),
            createElement("p", "", "Choose a student chat to review what was asked, how SAGE responded, and what signal should be added to the student profile later.")
        );
        return;
    }

    const heading = createElement("div", "sage-conversation-detail-heading");
    heading.append(
        createElement("div", "", ""),
        createElement("span", "badge badge--quiet", statusLabel(conversation.status))
    );
    heading.firstElementChild.append(
        createElement("p", "eyebrow", getSignalLabel(conversation.signal)),
        createElement("h3", "", `${conversation.student} | ${conversation.lesson}`)
    );

    const questionBlock = createElement("div", "sage-conversation-detail-block");
    questionBlock.append(
        createElement("strong", "", "Student asked"),
        createElement("p", "", conversation.question)
    );

    const responseBlock = createElement("div", "sage-conversation-detail-block");
    responseBlock.append(
        createElement("strong", "", "SAGE response summary"),
        createElement("p", "", conversation.response)
    );

    const signalBlock = createElement("div", "sage-conversation-detail-block sage-conversation-detail-block--signal");
    signalBlock.append(
        createElement("strong", "", "Profile signal to consider"),
        createElement("p", "", conversation.teacherSignal)
    );

    const actions = createElement("div", "sage-conversation-actions");
    const reviewedButton = createElement("button", "secondary-button", conversation.status === "reviewed" ? "Reviewed" : "Mark reviewed");
    reviewedButton.type = "button";
    reviewedButton.dataset.sageMarkReviewed = conversation.id;
    reviewedButton.disabled = conversation.status === "reviewed";

    actions.append(reviewedButton);

    const profileButton = createElement("button", "primary-button", "Add signal to profile");
    profileButton.type = "button";
    profileButton.dataset.sageAddProfileSignal = conversation.primarySignalId;
    profileButton.disabled = !conversation.primarySignalId || conversation.primarySignalAction === "profile_added";

    if (conversation.primarySignalAction === "profile_added") {
        profileButton.textContent = "Added to profile";
    }

    actions.append(profileButton);

    conversationDetail.append(heading, questionBlock, responseBlock, signalBlock, actions);
}

function renderConversationReview() {
    if (!conversationList || !conversationDetail || !reviewFilters) {
        return;
    }

    const filteredConversations = getFilteredConversations();
    renderReviewStats(filteredConversations);
    conversationList.replaceChildren();

    if (!filteredConversations.length) {
        const emptyMessage = conversations.length
            ? "No SAGE conversations match these filters yet."
            : "No SAGE conversations have been recorded yet. Once students chat with SAGE, reviews will appear here.";
        conversationList.append(createElement("p", "sage-empty-state", emptyMessage));
        renderConversationDetail(null);
        return;
    }

    if (!filteredConversations.some((conversation) => conversation.id === selectedConversationId)) {
        selectedConversationId = filteredConversations[0].id;
    }

    filteredConversations.forEach((conversation) => {
        conversationList.append(renderConversationCard(conversation));
    });

    renderConversationDetail(filteredConversations.find((conversation) => conversation.id === selectedConversationId));
}

async function init() {
    currentProfile = await loadProtectedProfile({
        statusElement,
        inactiveMessage: "Your account is not active. Please contact support before using SAGE.",
    });

    if (!currentProfile) {
        return;
    }

    if (!isTeachingRole(currentProfile.platform_role)) {
        setStatusMessage(statusElement, "SAGE teacher tools are only available to teachers and admins.", "error");
        classroomSelect.disabled = true;
        settingsForm.hidden = true;
        return;
    }

    try {
        courses = await loadTeachingCourses(currentProfile.id);
        classrooms = await loadManagedClassrooms(currentProfile.id, courses.map((course) => course.id));
        await loadClassroomSettings();
        renderClassroomOptions();
        renderInsightsClassroomOptions();
        renderGeneratorClassroomOptions();
        profileSignals = await loadSageProfileSignals();
        renderGeneratorClassroomSummary();
        renderSageInsights();
        conversations = await loadSageConversations();
        renderReviewClassroomOptions();
        renderConversationReview();
        bindEvents();
        setInlineStatus(conversationDataNotice || "SAGE teacher tools loaded.", "success");
    } catch (error) {
        setStatusMessage(statusElement, error.message || "SAGE tools could not be loaded.", "error");
    }
}

init();
