import { loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { setStatusMessage } from "../utils/ui-components.js";

const STORAGE_KEY = "ctc-code-space-project";
const INSTRUCTIONS_WIDTH_KEY = "ctc-code-space-instructions-width";
const FILES_WIDTH_KEY = "ctc-code-space-files-width";
const CONSOLE_HEIGHT_KEY = "ctc-code-space-console-height";
const EDITOR_ZOOM_KEY = "ctc-code-space-editor-zoom";
const INDENT = "    ";
const MIN_INSTRUCTIONS_WIDTH = 220;
const MAX_INSTRUCTIONS_WIDTH = 520;
const MIN_FILES_WIDTH = 140;
const MAX_FILES_WIDTH = 360;
const MIN_CONSOLE_HEIGHT = 72;
const DEFAULT_CONSOLE_HEIGHT = 240;
const MIN_EDITOR_ZOOM = 70;
const MAX_EDITOR_ZOOM = 150;
const DEFAULT_EDITOR_ZOOM = 100;

const starterFiles = [
    {
        name: "Main.java",
        language: "Java",
        content: [
            "public class Main {",
            "    public static void main(String[] args) {",
            "        String student = \"BrainKernl\";",
            "        System.out.println(\"Welcome, \" + student + \"!\");",
            "",
            "        for (int step = 1; step <= 3; step++) {",
            "            System.out.println(\"Step \" + step + \": keep building.\");",
            "        }",
            "    }",
            "}",
        ].join("\n"),
    },
    {
        name: "notes.txt",
        language: "Text",
        content: "Use this space for lesson notes, pseudocode, or teacher directions.",
    },
];

const workspace = qs("[data-code-workspace]");
const statusElement = qs("[data-code-status]");
const fileListElement = qs("[data-code-file-list]");
const activeFileElement = qs("[data-code-active-file]");
const languageElement = qs("[data-code-language]");
const saveStateElement = qs("[data-code-save-state]");
const editorElement = qs("[data-code-editor]");
const highlightElement = qs("[data-code-highlight]");
const lineNumbersElement = qs("[data-code-lines]");
const consoleElement = qs("[data-code-console]");
const runButton = qs("[data-code-run]");
const resetButton = qs("[data-code-reset]");
const newFileButton = qs("[data-code-new-file]");
const clearConsoleButton = qs("[data-code-clear-console]");
const instructionsResizer = qs("[data-code-instructions-resizer]");
const filesResizer = qs("[data-code-files-resizer]");
const consoleResizer = qs("[data-code-console-resizer]");
const consolePanel = qs(".code-console-panel");
const filePanel = qs(".code-file-panel");
const suggestionsElement = qs("[data-code-suggestions]");
const zoomOutButton = qs("[data-code-zoom-out]");
const zoomInButton = qs("[data-code-zoom-in]");
const zoomLevelElement = qs("[data-code-zoom-level]");

let files = [];
let activeFileName = "Main.java";
let saveTimeout = null;
let activeSuggestionIndex = 0;
let visibleSuggestions = [];
let editorZoom = DEFAULT_EDITOR_ZOOM;

const javaSuggestions = [
    {
        label: "System.out.println",
        detail: "Print a line to the console",
        insertText: "System.out.println();",
        cursorOffset: -2,
        matches: ["sys", "sout", "print", "println", "system"],
    },
    {
        label: "System.out.print",
        detail: "Print without a new line",
        insertText: "System.out.print();",
        cursorOffset: -2,
        matches: ["sys", "print", "system"],
    },
    {
        label: "for loop",
        detail: "Repeat code a set number of times",
        insertText: "for (int i = 0; i < 10; i++) {\n    \n}",
        cursorOffset: -2,
        matches: ["for", "loop"],
    },
    {
        label: "if statement",
        detail: "Run code when a condition is true",
        insertText: "if () {\n    \n}",
        cursorOffset: -7,
        matches: ["if"],
    },
    {
        label: "String",
        detail: "Text value",
        insertText: "String ",
        cursorOffset: 0,
        matches: ["str", "string"],
    },
    {
        label: "int",
        detail: "Whole number",
        insertText: "int ",
        cursorOffset: 0,
        matches: ["int", "number"],
    },
    {
        label: "double",
        detail: "Decimal number",
        insertText: "double ",
        cursorOffset: 0,
        matches: ["double", "decimal"],
    },
    {
        label: "boolean",
        detail: "true or false value",
        insertText: "boolean ",
        cursorOffset: 0,
        matches: ["bool", "boolean"],
    },
    {
        label: "public static void main",
        detail: "Java program entry point",
        insertText: "public static void main(String[] args) {\n    \n}",
        cursorOffset: -2,
        matches: ["main", "psvm", "public"],
    },
];

const javaKeywords = new Set([
    "abstract",
    "assert",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "default",
    "do",
    "else",
    "enum",
    "extends",
    "final",
    "finally",
    "for",
    "goto",
    "if",
    "implements",
    "import",
    "instanceof",
    "interface",
    "native",
    "new",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "sealed",
    "static",
    "strictfp",
    "super",
    "switch",
    "synchronized",
    "this",
    "throw",
    "throws",
    "transient",
    "try",
    "var",
    "void",
    "volatile",
    "while",
]);

const javaTypes = new Set([
    "boolean",
    "byte",
    "char",
    "double",
    "float",
    "int",
    "long",
    "short",
    "Boolean",
    "Character",
    "Double",
    "Integer",
    "Long",
    "Math",
    "Object",
    "String",
    "System",
]);

function cloneStarterFiles() {
    return starterFiles.map((file) => ({ ...file }));
}

function setStatus(message = "", tone = "") {
    setStatusMessage(statusElement, message, tone);
}

function clampNumber(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function setInstructionsWidth(width) {
    const nextWidth = clampNumber(width, MIN_INSTRUCTIONS_WIDTH, MAX_INSTRUCTIONS_WIDTH);

    workspace.style.setProperty("--code-instructions-width", `${nextWidth}px`);
    localStorage.setItem(INSTRUCTIONS_WIDTH_KEY, String(nextWidth));
    instructionsResizer?.setAttribute("aria-valuenow", String(nextWidth));
}

function loadInstructionsWidth() {
    const savedWidth = Number(localStorage.getItem(INSTRUCTIONS_WIDTH_KEY));

    if (Number.isFinite(savedWidth)) {
        setInstructionsWidth(savedWidth);
    }
}

function setFilesWidth(width) {
    const nextWidth = clampNumber(width, MIN_FILES_WIDTH, MAX_FILES_WIDTH);

    workspace.style.setProperty("--code-files-width", `${nextWidth}px`);
    localStorage.setItem(FILES_WIDTH_KEY, String(nextWidth));
    filesResizer?.setAttribute("aria-valuenow", String(nextWidth));
}

function loadFilesWidth() {
    const savedWidth = Number(localStorage.getItem(FILES_WIDTH_KEY));

    if (Number.isFinite(savedWidth)) {
        setFilesWidth(savedWidth);
    }
}

function setEditorZoom(nextZoom) {
    editorZoom = clampNumber(nextZoom, MIN_EDITOR_ZOOM, MAX_EDITOR_ZOOM);
    const fontSizeRem = 0.95 * (editorZoom / 100);

    workspace.style.setProperty("--code-editor-font-size", `${fontSizeRem.toFixed(3)}rem`);
    localStorage.setItem(EDITOR_ZOOM_KEY, String(editorZoom));

    if (zoomLevelElement) {
        zoomLevelElement.textContent = `${editorZoom}%`;
    }

    if (zoomOutButton) {
        zoomOutButton.disabled = editorZoom <= MIN_EDITOR_ZOOM;
    }

    if (zoomInButton) {
        zoomInButton.disabled = editorZoom >= MAX_EDITOR_ZOOM;
    }
}

function loadEditorZoom() {
    const savedZoom = Number(localStorage.getItem(EDITOR_ZOOM_KEY));

    setEditorZoom(Number.isFinite(savedZoom) ? savedZoom : DEFAULT_EDITOR_ZOOM);
}

function getMaxConsoleHeight() {
    const workArea = qs(".code-work-area");

    if (!workArea) {
        return 520;
    }

    return Math.max(220, Math.min(620, workArea.getBoundingClientRect().height - 160));
}

function setConsoleHeight(height, mode = "custom") {
    const maxHeight = getMaxConsoleHeight();
    const nextHeight = clampNumber(height, MIN_CONSOLE_HEIGHT, maxHeight);

    workspace.style.setProperty("--code-console-height", `${nextHeight}px`);
    localStorage.setItem(CONSOLE_HEIGHT_KEY, String(nextHeight));
    consoleResizer?.setAttribute("aria-valuemax", String(Math.round(maxHeight)));
    consoleResizer?.setAttribute("aria-valuenow", String(Math.round(nextHeight)));

    if (consolePanel) {
        consolePanel.dataset.minimized = String(mode === "minimized");
    }
}

function loadConsoleHeight() {
    const savedHeight = Number(localStorage.getItem(CONSOLE_HEIGHT_KEY));

    setConsoleHeight(Number.isFinite(savedHeight) ? savedHeight : DEFAULT_CONSOLE_HEIGHT);
}

function getLanguageForFile(name) {
    if (name.endsWith(".java")) {
        return "Java";
    }

    if (name.endsWith(".js")) {
        return "JavaScript";
    }

    if (name.endsWith(".html")) {
        return "HTML";
    }

    if (name.endsWith(".css")) {
        return "CSS";
    }

    return "Text";
}

function getActiveFile() {
    return files.find((file) => file.name === activeFileName) || files[0];
}

function loadProject() {
    try {
        const savedProject = JSON.parse(localStorage.getItem(STORAGE_KEY));

        if (Array.isArray(savedProject?.files) && savedProject.files.length) {
            files = savedProject.files;
            activeFileName = savedProject.activeFileName || files[0].name;
            ensureJavaStarterFile();
            return;
        }
    } catch (error) {
        console.warn("Code Space project could not be loaded:", error);
    }

    files = cloneStarterFiles();
    activeFileName = files[0].name;
}

function ensureJavaStarterFile() {
    if (files.some((file) => file.name.endsWith(".java"))) {
        return;
    }

    files = [...cloneStarterFiles(), ...files];
    activeFileName = "Main.java";
}

function saveProject() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        activeFileName,
        files,
    }));

    saveStateElement.textContent = "Saved locally";
}

function queueSave() {
    saveStateElement.textContent = "Saving...";
    window.clearTimeout(saveTimeout);
    saveTimeout = window.setTimeout(saveProject, 220);
}

function renderLineNumbers() {
    const lineCount = Math.max(1, editorElement.value.split("\n").length);
    const numbers = Array.from({ length: lineCount }, (_, index) => String(index + 1));

    lineNumbersElement.textContent = numbers.join("\n");
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function wrapCodeToken(className, value) {
    return `<span class="${className}">${escapeHtml(value)}</span>`;
}

function readQuotedToken(source, startIndex, quote) {
    let index = startIndex + 1;
    let isEscaped = false;

    while (index < source.length) {
        const char = source[index];

        if (isEscaped) {
            isEscaped = false;
        } else if (char === "\\") {
            isEscaped = true;
        } else if (char === quote) {
            index += 1;
            break;
        }

        index += 1;
    }

    return source.slice(startIndex, index);
}

function getNextNonSpace(source, index) {
    let cursor = index;

    while (/\s/.test(source[cursor] || "")) {
        cursor += 1;
    }

    return source[cursor] || "";
}

function highlightJavaCode(source) {
    let highlighted = "";
    let index = 0;

    while (index < source.length) {
        const char = source[index];
        const nextChar = source[index + 1] || "";

        if (char === "/" && nextChar === "/") {
            const endIndex = source.indexOf("\n", index);
            const comment = endIndex === -1 ? source.slice(index) : source.slice(index, endIndex);

            highlighted += wrapCodeToken("code-token-comment", comment);
            index += comment.length;
            continue;
        }

        if (char === "/" && nextChar === "*") {
            const endIndex = source.indexOf("*/", index + 2);
            const comment = endIndex === -1 ? source.slice(index) : source.slice(index, endIndex + 2);

            highlighted += wrapCodeToken("code-token-comment", comment);
            index += comment.length;
            continue;
        }

        if (char === "\"" || char === "'") {
            const value = readQuotedToken(source, index, char);

            highlighted += wrapCodeToken("code-token-string", value);
            index += value.length;
            continue;
        }

        if (/\d/.test(char)) {
            const match = source.slice(index).match(/^\d+(?:\.\d+)?(?:[fFdDlL])?/);
            const number = match?.[0] || char;

            highlighted += wrapCodeToken("code-token-number", number);
            index += number.length;
            continue;
        }

        if (/[A-Za-z_$]/.test(char)) {
            const match = source.slice(index).match(/^[A-Za-z_$][\w$]*/);
            const identifier = match?.[0] || char;
            const nextToken = getNextNonSpace(source, index + identifier.length);

            if (javaKeywords.has(identifier) || identifier === "true" || identifier === "false" || identifier === "null") {
                highlighted += wrapCodeToken("code-token-keyword", identifier);
            } else if (javaTypes.has(identifier) || /^[A-Z]/.test(identifier)) {
                highlighted += wrapCodeToken("code-token-type", identifier);
            } else if (nextToken === "(") {
                highlighted += wrapCodeToken("code-token-function", identifier);
            } else {
                highlighted += escapeHtml(identifier);
            }

            index += identifier.length;
            continue;
        }

        highlighted += escapeHtml(char);
        index += 1;
    }

    return highlighted || " ";
}

function syncEditorScroll() {
    lineNumbersElement.scrollTop = editorElement.scrollTop;

    if (highlightElement) {
        highlightElement.scrollTop = editorElement.scrollTop;
        highlightElement.scrollLeft = editorElement.scrollLeft;
    }
}

function renderSyntaxHighlight() {
    if (!highlightElement) {
        return;
    }

    const activeFile = getActiveFile();
    const code = editorElement.value;

    if (activeFile?.name.endsWith(".java")) {
        highlightElement.innerHTML = `${highlightJavaCode(code)}\n`;
    } else {
        highlightElement.textContent = `${code || " "}\n`;
    }

    syncEditorScroll();
}

function renderFiles() {
    fileListElement.replaceChildren(...files.map((file) => {
        const row = createElement("div", "code-file-row");
        const button = createElement("button", "code-file-button");
        const label = createElement("span", "code-file-label");
        const name = createElement("span", "code-file-name", file.name);
        const meta = createElement("span", "code-file-meta", getLanguageForFile(file.name));
        const deleteButton = createElement("button", "code-file-delete", "x");

        button.type = "button";
        button.dataset.fileName = file.name;
        button.dataset.active = String(file.name === activeFileName);
        deleteButton.type = "button";
        deleteButton.setAttribute("aria-label", `Delete ${file.name}`);
        deleteButton.addEventListener("click", (event) => {
            event.stopPropagation();
            deleteFile(file.name);
        });
        label.append(name, meta);
        button.append(label);
        button.addEventListener("click", () => setActiveFile(file.name));
        row.append(button, deleteButton);

        return row;
    }));
}

function renderEditor() {
    const activeFile = getActiveFile();

    if (!activeFile) {
        return;
    }

    activeFileName = activeFile.name;
    activeFileElement.textContent = activeFile.name;
    languageElement.textContent = getLanguageForFile(activeFile.name);
    editorElement.value = activeFile.content;
    renderLineNumbers();
    renderSyntaxHighlight();
}

function renderProject() {
    renderFiles();
    renderEditor();
    saveProject();
}

function setActiveFile(fileName) {
    const currentFile = getActiveFile();

    if (currentFile) {
        currentFile.content = editorElement.value;
    }

    activeFileName = fileName;
    renderFiles();
    renderEditor();
    queueSave();
}

function deleteFile(fileName) {
    if (files.length <= 1) {
        setStatus("Code Space needs at least one file.", "error");
        return;
    }

    if (!window.confirm(`Delete ${fileName}?`)) {
        return;
    }

    const currentFile = getActiveFile();

    if (currentFile && currentFile.name === activeFileName) {
        currentFile.content = editorElement.value;
    }

    files = files.filter((file) => file.name !== fileName);

    if (activeFileName === fileName) {
        activeFileName = files[0].name;
    }

    hideSuggestions();
    renderProject();
    setStatus("");
}

function getCurrentLineIndent(value, cursorPosition) {
    const lineStart = value.lastIndexOf("\n", cursorPosition - 1) + 1;
    const line = value.slice(lineStart, cursorPosition);
    const match = line.match(/^\s*/);

    return match ? match[0] : "";
}

function insertText(text, selectionOffset = text.length) {
    const start = editorElement.selectionStart;
    const end = editorElement.selectionEnd;
    const before = editorElement.value.slice(0, start);
    const after = editorElement.value.slice(end);

    editorElement.value = `${before}${text}${after}`;
    editorElement.selectionStart = start + selectionOffset;
    editorElement.selectionEnd = start + selectionOffset;
    handleEditorInput();
}

function getTokenBeforeCursor() {
    const start = editorElement.selectionStart;
    const beforeCursor = editorElement.value.slice(0, start);
    const match = beforeCursor.match(/[A-Za-z_.]+$/);

    return match ? match[0] : "";
}

function hideSuggestions() {
    visibleSuggestions = [];
    activeSuggestionIndex = 0;

    if (suggestionsElement) {
        suggestionsElement.hidden = true;
        suggestionsElement.replaceChildren();
    }
}

function renderSuggestions(suggestions) {
    if (!suggestionsElement) {
        return;
    }

    visibleSuggestions = suggestions;
    activeSuggestionIndex = 0;

    if (!suggestions.length) {
        hideSuggestions();
        return;
    }

    suggestionsElement.replaceChildren(...suggestions.map((suggestion, index) => {
        const button = createElement("button", "code-suggestion-button");
        const label = createElement("span", "code-suggestion-label", suggestion.label);
        const detail = createElement("span", "code-suggestion-detail", suggestion.detail);

        button.type = "button";
        button.dataset.active = String(index === activeSuggestionIndex);
        button.append(label, detail);
        button.addEventListener("mousedown", (event) => {
            event.preventDefault();
            applySuggestion(index);
        });

        return button;
    }));

    suggestionsElement.hidden = false;
}

function updateSuggestions() {
    const activeFile = getActiveFile();

    if (!activeFile?.name.endsWith(".java")) {
        hideSuggestions();
        return;
    }

    const token = getTokenBeforeCursor().toLowerCase();

    if (token.length < 2) {
        hideSuggestions();
        return;
    }

    const matches = javaSuggestions
        .filter((suggestion) => suggestion.matches.some((match) => match.startsWith(token) || match.includes(token)))
        .slice(0, 6);

    renderSuggestions(matches);
}

function updateActiveSuggestion() {
    if (!suggestionsElement) {
        return;
    }

    [...suggestionsElement.children].forEach((child, index) => {
        child.dataset.active = String(index === activeSuggestionIndex);
    });
}

function applySuggestion(index = activeSuggestionIndex) {
    const suggestion = visibleSuggestions[index];
    const token = getTokenBeforeCursor();

    if (!suggestion) {
        return;
    }

    const start = editorElement.selectionStart - token.length;
    const end = editorElement.selectionEnd;
    const before = editorElement.value.slice(0, start);
    const after = editorElement.value.slice(end);
    const inserted = suggestion.insertText;
    const cursorPosition = start + inserted.length + suggestion.cursorOffset;

    editorElement.value = `${before}${inserted}${after}`;
    editorElement.selectionStart = cursorPosition;
    editorElement.selectionEnd = cursorPosition;
    hideSuggestions();
    handleEditorInput();
    editorElement.focus();
}

function handleEnterKey(event) {
    event.preventDefault();

    const start = editorElement.selectionStart;
    const value = editorElement.value;
    const previousIndent = getCurrentLineIndent(value, start);
    const previousChar = value[start - 1] || "";
    const nextChar = value[start] || "";
    const shouldIndent = /[\{\[\(]$/.test(value.slice(0, start).trimEnd());

    if (shouldIndent && /[\}\]\)]/.test(nextChar)) {
        insertText(`\n${previousIndent}${INDENT}\n${previousIndent}`, previousIndent.length + INDENT.length + 1);
        return;
    }

    insertText(`\n${previousIndent}${shouldIndent ? INDENT : ""}`);

    if (previousChar === "}") {
        renderLineNumbers();
    }
}

function handleEditorKeydown(event) {
    const pairs = {
        "(": ")",
        "[": "]",
        "{": "}",
        "\"": "\"",
        "'": "'",
        "`": "`",
    };

    if ((event.metaKey || event.ctrlKey) && ["+", "=", "-"].includes(event.key)) {
        event.preventDefault();
        setEditorZoom(editorZoom + (event.key === "-" ? -10 : 10));
        return;
    }

    if (!suggestionsElement?.hidden && visibleSuggestions.length) {
        if (event.key === "ArrowDown") {
            event.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex + 1) % visibleSuggestions.length;
            updateActiveSuggestion();
            return;
        }

        if (event.key === "ArrowUp") {
            event.preventDefault();
            activeSuggestionIndex = (activeSuggestionIndex - 1 + visibleSuggestions.length) % visibleSuggestions.length;
            updateActiveSuggestion();
            return;
        }

        if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            applySuggestion();
            return;
        }

        if (event.key === "Escape") {
            event.preventDefault();
            hideSuggestions();
            return;
        }
    }

    if (event.key === "Tab") {
        event.preventDefault();
        insertText(INDENT);
        return;
    }

    if (event.key === "Enter") {
        handleEnterKey(event);
        return;
    }

    if (pairs[event.key]) {
        event.preventDefault();
        const start = editorElement.selectionStart;
        const end = editorElement.selectionEnd;
        const selectedText = editorElement.value.slice(start, end);
        const inserted = `${event.key}${selectedText}${pairs[event.key]}`;
        insertText(inserted, selectedText ? inserted.length : 1);
    }
}

function handleEditorInput() {
    const activeFile = getActiveFile();

    if (!activeFile) {
        return;
    }

    activeFile.content = editorElement.value;
    renderLineNumbers();
    renderSyntaxHighlight();
    window.requestAnimationFrame(updateSuggestions);
    queueSave();
}

function appendConsoleLine(message, tone = "info") {
    consoleElement.textContent += `${consoleElement.textContent ? "\n" : ""}${message}`;
    consoleElement.dataset.tone = tone;
    consoleElement.scrollTop = consoleElement.scrollHeight;
}

function serializeConsoleValue(value) {
    if (typeof value === "string") {
        return value;
    }

    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function createStudentConsole() {
    return {
        log: (...items) => appendConsoleLine(items.map(serializeConsoleValue).join(" ")),
        warn: (...items) => appendConsoleLine(items.map(serializeConsoleValue).join(" "), "warning"),
        error: (...items) => appendConsoleLine(items.map(serializeConsoleValue).join(" "), "error"),
        clear: () => {
            consoleElement.textContent = "";
        },
    };
}

function findMatchingBrace(source, openIndex) {
    return findMatchingDelimiter(source, openIndex, "{", "}");
}

function findMatchingDelimiter(source, openIndex, openChar, closeChar) {
    let depth = 0;
    let quote = "";
    let isEscaped = false;

    for (let index = openIndex; index < source.length; index += 1) {
        const char = source[index];

        if (quote) {
            if (isEscaped) {
                isEscaped = false;
            } else if (char === "\\") {
                isEscaped = true;
            } else if (char === quote) {
                quote = "";
            }
            continue;
        }

        if (char === "\"" || char === "'" || char === "`") {
            quote = char;
            continue;
        }

        if (char === openChar) {
            depth += 1;
        }

        if (char === closeChar) {
            depth -= 1;

            if (depth === 0) {
                return index;
            }
        }
    }

    return -1;
}

function extractJavaMainBody(source) {
    const mainMatch = source.match(/public\s+static\s+void\s+main\s*\(\s*String\s*\[\]\s+\w+\s*\)\s*\{/);

    if (!mainMatch || typeof mainMatch.index !== "number") {
        throw new Error("Java runner needs public static void main(String[] args).");
    }

    const openIndex = mainMatch.index + mainMatch[0].lastIndexOf("{");
    const closeIndex = findMatchingBrace(source, openIndex);

    if (closeIndex === -1) {
        throw new Error("Missing closing brace for main method.");
    }

    return source.slice(openIndex + 1, closeIndex);
}

function replaceJavaOutput(source) {
    const outputCalls = {
        print: "__print",
        printf: "__printf",
        println: "__println",
    };
    const callPattern = /System\.out\.(println|printf|print)\s*\(/g;
    let transformed = "";
    let cursor = 0;
    let match = callPattern.exec(source);

    while (match) {
        const openIndex = callPattern.lastIndex - 1;
        const closeIndex = findMatchingDelimiter(source, openIndex, "(", ")");

        if (closeIndex === -1) {
            throw new Error(`Missing closing parenthesis for System.out.${match[1]}.`);
        }

        let statementEnd = closeIndex + 1;

        while (/\s/.test(source[statementEnd] || "")) {
            statementEnd += 1;
        }

        if (source[statementEnd] !== ";") {
            throw new Error(`Missing semicolon after System.out.${match[1]}.`);
        }

        const args = source.slice(openIndex + 1, closeIndex);

        transformed += source.slice(cursor, match.index);
        transformed += `${outputCalls[match[1]]}(${args});`;
        cursor = statementEnd + 1;
        callPattern.lastIndex = cursor;
        match = callPattern.exec(source);
    }

    return `${transformed}${source.slice(cursor)}`;
}

function replaceJavaDeclarations(source) {
    return source
        .replace(/\b(final\s+)?(byte|short|int|long|float|double|boolean|char|String)\s+([A-Za-z_$][\w$]*)\s*=/g, "let $3 =")
        .replace(/\b(final\s+)?(byte|short|int|long|float|double|boolean|char|String)\s+([A-Za-z_$][\w$]*)\s*;/g, "let $3;")
        .replace(/\b(for\s*\(\s*)(byte|short|int|long|float|double|boolean|char|String)\s+([A-Za-z_$][\w$]*)\s*=/g, "$1let $3 =");
}

function replaceJavaOperators(source) {
    return source
        .replace(/([A-Za-z_$][\w$]*)\.equals\s*\(([^)]+)\)/g, "($1 === $2)")
        .replace(/([A-Za-z_$][\w$]*)\.length\s*\(\s*\)/g, "$1.length");
}

function createJavaScriptFromJava(source) {
    if (/\b(import|package)\b/.test(source)) {
        throw new Error("Imports and packages are not available in the browser Java runner yet.");
    }

    if (/\bScanner\b|System\.in|java\.io|java\.nio|Thread|Runtime|ProcessBuilder|System\.exit/.test(source)) {
        throw new Error("This classroom Java runner supports local console output, variables, loops, conditionals, and Math. Input, files, threads, and system access are not available.");
    }

    const mainBody = extractJavaMainBody(source);
    const withoutComments = mainBody
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
    const withOutput = replaceJavaOutput(withoutComments);
    const withDeclarations = replaceJavaDeclarations(withOutput);

    return replaceJavaOperators(withDeclarations);
}

function createJavaRuntime(consoleBuffer) {
    return {
        __print: (value = "") => {
            consoleBuffer.current += String(value);
        },
        __println: (value = "") => {
            consoleBuffer.lines.push(`${consoleBuffer.current}${String(value)}`);
            consoleBuffer.current = "";
        },
        __printf: (template = "", ...values) => {
            let valueIndex = 0;
            const text = String(template).replace(/%[dfs]/g, () => String(values[valueIndex++]));
            consoleBuffer.current += text;
        },
    };
}

async function executeJavaScriptFile(activeFile) {
    const studentConsole = createStudentConsole();

    try {
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const execute = new AsyncFunction("console", `"use strict";\n${activeFile.content}`);
        const result = await execute(studentConsole);

        if (result !== undefined) {
            appendConsoleLine(serializeConsoleValue(result));
        }
    } catch (error) {
        appendConsoleLine(`${error.name}: ${error.message}`, "error");
    }
}

async function executeJavaFile(activeFile) {
    try {
        const javaScript = createJavaScriptFromJava(activeFile.content);
        const consoleBuffer = { current: "", lines: [] };
        const javaRuntime = createJavaRuntime(consoleBuffer);
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const execute = new AsyncFunction(
            "__print",
            "__println",
            "__printf",
            "Math",
            `"use strict";\n${javaScript}`,
        );

        await execute(javaRuntime.__print, javaRuntime.__println, javaRuntime.__printf, Math);

        if (consoleBuffer.current) {
            consoleBuffer.lines.push(consoleBuffer.current);
        }

        if (consoleBuffer.lines.length) {
            consoleBuffer.lines.forEach((line) => appendConsoleLine(line));
        }
    } catch (error) {
        appendConsoleLine(`Java error: ${error.message}`, "error");
    }
}

async function runCode() {
    const activeFile = getActiveFile();

    if (!activeFile || (!activeFile.name.endsWith(".java") && !activeFile.name.endsWith(".js"))) {
        appendConsoleLine("Run is available for Java and JavaScript files.", "error");
        return;
    }

    runButton.disabled = true;
    consoleElement.textContent = "";

    try {
        if (activeFile.name.endsWith(".java")) {
            await executeJavaFile(activeFile);
        } else {
            await executeJavaScriptFile(activeFile);
        }
    } finally {
        runButton.disabled = false;
    }
}

function createNewFile() {
    const rawName = window.prompt("File name", `Exercise${files.length}.java`);
    const name = String(rawName || "").trim();

    if (!name) {
        return;
    }

    if (files.some((file) => file.name === name)) {
        setStatus("A file with that name already exists.", "error");
        return;
    }

    const currentFile = getActiveFile();

    if (currentFile) {
        currentFile.content = editorElement.value;
    }

    files.push({
        name,
        language: getLanguageForFile(name),
        content: getStarterContentForNewFile(name),
    });
    activeFileName = name;
    renderProject();
    setStatus("");
}

function getStarterContentForNewFile(name) {
    if (name.endsWith(".java")) {
        const className = name.replace(/\.java$/i, "").replace(/[^\w$]/g, "") || "Exercise";

        return [
            `public class ${className} {`,
            "    public static void main(String[] args) {",
            "        System.out.println(\"New Java file ready.\");",
            "    }",
            "}",
        ].join("\n");
    }

    if (name.endsWith(".js")) {
        return "console.log(\"New file ready.\");";
    }

    return "";
}

function resetProject() {
    if (!window.confirm("Reset Code Space to the starter files?")) {
        return;
    }

    files = cloneStarterFiles();
    activeFileName = files[0].name;
    consoleElement.textContent = "";
    renderProject();
}

async function initCodeSpace() {
    const profile = await loadProtectedProfile({
        profileColumns: "id, username, email, platform_role, account_status, profile_completed",
        statusElement,
    });

    if (!profile) {
        return;
    }

    loadProject();
    loadInstructionsWidth();
    loadFilesWidth();
    renderProject();
    workspace.hidden = false;
    loadConsoleHeight();
    loadEditorZoom();
    setStatus("");
}

function startInstructionsResize(event) {
    if (!instructionsResizer || window.matchMedia("(max-width: 720px)").matches) {
        return;
    }

    event.preventDefault();
    const workspaceBox = workspace.getBoundingClientRect();

    workspace.dataset.resizing = "instructions";
    instructionsResizer.setPointerCapture(event.pointerId);

    function handlePointerMove(moveEvent) {
        const nextWidth = moveEvent.clientX - workspaceBox.left;

        setInstructionsWidth(nextWidth);
    }

    function stopResize() {
        delete workspace.dataset.resizing;
        instructionsResizer.removeEventListener("pointermove", handlePointerMove);
        instructionsResizer.removeEventListener("pointerup", stopResize);
        instructionsResizer.removeEventListener("pointercancel", stopResize);
    }

    instructionsResizer.addEventListener("pointermove", handlePointerMove);
    instructionsResizer.addEventListener("pointerup", stopResize);
    instructionsResizer.addEventListener("pointercancel", stopResize);
}

function handleInstructionsResizeKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        return;
    }

    event.preventDefault();
    const currentWidth = Number(instructionsResizer.getAttribute("aria-valuenow")) || 300;

    if (event.key === "Home") {
        setInstructionsWidth(MIN_INSTRUCTIONS_WIDTH);
        return;
    }

    if (event.key === "End") {
        setInstructionsWidth(MAX_INSTRUCTIONS_WIDTH);
        return;
    }

    const direction = event.key === "ArrowRight" ? 1 : -1;
    const step = event.shiftKey ? 40 : 16;

    setInstructionsWidth(currentWidth + direction * step);
}

function startFilesResize(event) {
    if (!filesResizer || !filePanel || window.matchMedia("(max-width: 720px)").matches) {
        return;
    }

    event.preventDefault();
    const filePanelBox = filePanel.getBoundingClientRect();

    workspace.dataset.resizing = "files";
    filesResizer.setPointerCapture(event.pointerId);

    function handlePointerMove(moveEvent) {
        const nextWidth = moveEvent.clientX - filePanelBox.left;

        setFilesWidth(nextWidth);
    }

    function stopResize() {
        delete workspace.dataset.resizing;
        filesResizer.removeEventListener("pointermove", handlePointerMove);
        filesResizer.removeEventListener("pointerup", stopResize);
        filesResizer.removeEventListener("pointercancel", stopResize);
    }

    filesResizer.addEventListener("pointermove", handlePointerMove);
    filesResizer.addEventListener("pointerup", stopResize);
    filesResizer.addEventListener("pointercancel", stopResize);
}

function handleFilesResizeKeydown(event) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        return;
    }

    event.preventDefault();
    const currentWidth = Number(filesResizer.getAttribute("aria-valuenow")) || 190;

    if (event.key === "Home") {
        setFilesWidth(MIN_FILES_WIDTH);
        return;
    }

    if (event.key === "End") {
        setFilesWidth(MAX_FILES_WIDTH);
        return;
    }

    const direction = event.key === "ArrowRight" ? 1 : -1;
    const step = event.shiftKey ? 32 : 12;

    setFilesWidth(currentWidth + direction * step);
}

function startConsoleResize(event) {
    if (!consoleResizer || window.matchMedia("(max-width: 720px)").matches) {
        return;
    }

    event.preventDefault();
    const workArea = qs(".code-work-area");

    if (!workArea) {
        return;
    }

    const workAreaBox = workArea.getBoundingClientRect();

    workspace.dataset.resizing = "console";
    consoleResizer.setPointerCapture(event.pointerId);

    function handlePointerMove(moveEvent) {
        const nextHeight = workAreaBox.bottom - moveEvent.clientY;

        setConsoleHeight(nextHeight);
    }

    function stopResize() {
        delete workspace.dataset.resizing;
        consoleResizer.removeEventListener("pointermove", handlePointerMove);
        consoleResizer.removeEventListener("pointerup", stopResize);
        consoleResizer.removeEventListener("pointercancel", stopResize);
    }

    consoleResizer.addEventListener("pointermove", handlePointerMove);
    consoleResizer.addEventListener("pointerup", stopResize);
    consoleResizer.addEventListener("pointercancel", stopResize);
}

function handleConsoleResizeKeydown(event) {
    if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
        return;
    }

    event.preventDefault();
    const currentHeight = Number(consoleResizer.getAttribute("aria-valuenow")) || DEFAULT_CONSOLE_HEIGHT;

    if (event.key === "Home") {
        setConsoleHeight(MIN_CONSOLE_HEIGHT, "minimized");
        return;
    }

    if (event.key === "End") {
        setConsoleHeight(getMaxConsoleHeight(), "maximized");
        return;
    }

    const direction = event.key === "ArrowUp" ? 1 : -1;
    const step = event.shiftKey ? 48 : 18;

    setConsoleHeight(currentHeight + direction * step);
}

editorElement.addEventListener("keydown", handleEditorKeydown);
editorElement.addEventListener("input", handleEditorInput);
editorElement.addEventListener("scroll", () => {
    syncEditorScroll();
});
runButton.addEventListener("click", runCode);
resetButton.addEventListener("click", resetProject);
newFileButton.addEventListener("click", createNewFile);
clearConsoleButton.addEventListener("click", () => {
    consoleElement.textContent = "";
});
zoomOutButton?.addEventListener("click", () => setEditorZoom(editorZoom - 10));
zoomInButton?.addEventListener("click", () => setEditorZoom(editorZoom + 10));

if (instructionsResizer) {
    instructionsResizer.addEventListener("pointerdown", startInstructionsResize);
    instructionsResizer.addEventListener("keydown", handleInstructionsResizeKeydown);
}

if (filesResizer) {
    filesResizer.addEventListener("pointerdown", startFilesResize);
    filesResizer.addEventListener("keydown", handleFilesResizeKeydown);
}

if (consoleResizer) {
    consoleResizer.addEventListener("pointerdown", startConsoleResize);
    consoleResizer.addEventListener("keydown", handleConsoleResizeKeydown);
}

initCodeSpace();
