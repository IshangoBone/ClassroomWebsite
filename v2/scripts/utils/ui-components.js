import { createElement } from "./dom.js";

let modalId = 0;

export function createBadge(text, { quiet = false } = {}) {
    return createElement("span", quiet ? "badge badge--quiet" : "badge", text);
}

function appendContent(container, content) {
    if (typeof content === "string") {
        container.append(createElement("p", "", content));
    } else if (typeof content === "number" || typeof content === "boolean") {
        container.textContent = String(content);
    } else if (content?.nodeType) {
        container.append(content);
    } else if (content) {
        container.textContent = String(content);
    }
}

function buttonClassName({ variant = "secondary", destructive = false } = {}) {
    if (destructive) {
        return "destructive-button";
    }

    return variant === "primary" ? "primary-button" : "secondary-button";
}

export function createButton(label, options = {}) {
    const button = createElement("button", buttonClassName(options), label);

    button.type = options.type || "button";

    if (options.disabled) {
        button.disabled = true;
    }

    if (options.ariaLabel) {
        button.setAttribute("aria-label", options.ariaLabel);
    }

    return button;
}

export function createButtonLink(label, href, options = {}) {
    const link = createElement("a", buttonClassName(options), label);

    link.href = href;

    if (options.ariaLabel) {
        link.setAttribute("aria-label", options.ariaLabel);
    }

    return link;
}

export function setStatusMessage(element, message = "", tone = "") {
    if (!element) {
        return;
    }

    element.textContent = message;

    if (tone) {
        element.dataset.tone = tone;
    } else {
        delete element.dataset.tone;
    }
}

export function createStatusAlert(message, { tone = "info" } = {}) {
    const alert = createElement("p", `ui-alert ui-alert--${tone}`, message);

    alert.setAttribute("role", tone === "error" ? "alert" : "status");

    return alert;
}

export function createActionRow(actions = [], { align = "start" } = {}) {
    const row = createElement("div", `ui-action-row ui-action-row--${align}`);

    actions.filter(Boolean).forEach((action) => row.append(action));

    return row;
}

export function createPageHeader({ eyebrow = "", title = "", copy = "", actions = [] } = {}) {
    const header = createElement("header", "ui-page-header");
    const content = createElement("div", "ui-page-header__content");

    if (eyebrow) {
        content.append(createElement("p", "eyebrow", eyebrow));
    }

    if (title) {
        content.append(createElement("h1", "", title));
    }

    if (copy) {
        content.append(createElement("p", "", copy));
    }

    header.append(content);

    if (actions.length) {
        header.append(createActionRow(actions, { align: "end" }));
    }

    return header;
}

export function createSectionHeader({ title = "", copy = "", actions = [] } = {}) {
    const header = createElement("div", "ui-section-header");
    const content = createElement("div", "ui-section-header__content");

    if (title) {
        content.append(createElement("h2", "", title));
    }

    if (copy) {
        content.append(createElement("p", "", copy));
    }

    header.append(content);

    if (actions.length) {
        header.append(createActionRow(actions, { align: "end" }));
    }

    return header;
}

export function createCard({ title = "", copy = "", actions = [], badges = [], className = "" } = {}) {
    const card = createElement("article", `ui-card${className ? ` ${className}` : ""}`);

    if (title || badges.length) {
        const header = createElement("div", "ui-card__header");
        const titleElement = createElement("h3", "ui-card__title", title);
        const badgeRow = createElement("div", "ui-card__badges");

        badges.filter(Boolean).forEach((badge) => {
            badgeRow.append(typeof badge === "string" ? createBadge(badge, { quiet: true }) : badge);
        });

        if (title) {
            header.append(titleElement);
        }

        if (badges.length) {
            header.append(badgeRow);
        }

        card.append(header);
    }

    if (copy) {
        card.append(createElement("p", "ui-card__copy", copy));
    }

    if (actions.length) {
        card.append(createActionRow(actions));
    }

    return card;
}

export function createEmptyState(message, { compact = false } = {}) {
    return createElement("p", compact ? "ui-empty-state ui-empty-state--compact" : "ui-empty-state", message);
}

export function createFormField({ label = "", input, hint = "", className = "" } = {}) {
    const field = createElement("label", `form-field${className ? ` ${className}` : ""}`);

    if (label) {
        field.append(createElement("span", "form-label", label));
    }

    if (input) {
        field.append(input);
    }

    if (hint) {
        field.append(createElement("span", "field-hint", hint));
    }

    return field;
}

export function createDataTable({ columns = [], rows = [], emptyMessage = "No records to show." } = {}) {
    const shell = createElement("div", "ui-data-table-shell");

    if (!rows.length) {
        shell.append(createEmptyState(emptyMessage, { compact: true }));
        return shell;
    }

    const table = createElement("table", "ui-data-table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    const body = document.createElement("tbody");

    columns.forEach((column) => {
        const heading = document.createElement("th");
        heading.scope = "col";
        heading.textContent = column.label || column.key || "";
        headRow.append(heading);
    });

    rows.forEach((row) => {
        const tr = document.createElement("tr");

        columns.forEach((column) => {
            const cell = document.createElement("td");
            const value = typeof column.render === "function" ? column.render(row) : row[column.key];

            if (value?.nodeType) {
                cell.append(value);
            } else if (value !== undefined && value !== null) {
                cell.textContent = String(value);
            }

            tr.append(cell);
        });

        body.append(tr);
    });

    head.append(headRow);
    table.append(head, body);
    shell.append(table);

    return shell;
}

export function setFieldError(field, message = "") {
    if (!field) {
        return;
    }

    let error = field.querySelector("[data-field-error]");
    const input = field.querySelector("input, select, textarea");

    if (!error) {
        error = createElement("span", "field-error");
        error.dataset.fieldError = "true";
        field.append(error);
    }

    error.textContent = message;
    error.hidden = !message;

    if (input) {
        input.setAttribute("aria-invalid", message ? "true" : "false");
    }
}

export function clearFieldError(field) {
    setFieldError(field, "");
}

export function createModalShell({ title, body, actions = [] } = {}) {
    const overlay = createElement("div", "ui-modal-overlay");
    const dialog = createElement("section", "ui-modal");
    const heading = createElement("h2", "ui-modal-title", title || "Confirm action");
    const content = createElement("div", "ui-modal-body");
    const headingId = `ui-modal-title-${modalId += 1}`;

    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", headingId);
    heading.id = headingId;

    appendContent(content, body);

    dialog.append(heading, content, createActionRow(actions, { align: "end" }));
    overlay.append(dialog);

    return overlay;
}

export function createTabs(tabs = []) {
    const shell = createElement("div", "ui-tabs");
    const tabList = createElement("div", "ui-tab-list");
    const panels = createElement("div", "ui-tab-panels");

    tabList.setAttribute("role", "tablist");

    tabs.forEach((tab, index) => {
        const tabId = `ui-tab-${index}`;
        const panelId = `ui-tab-panel-${index}`;
        const button = createElement("button", "ui-tab", tab.label);
        const panel = createElement("section", "ui-tab-panel");

        button.type = "button";
        button.id = tabId;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-controls", panelId);
        button.setAttribute("aria-selected", index === 0 ? "true" : "false");
        panel.id = panelId;
        panel.setAttribute("role", "tabpanel");
        panel.setAttribute("aria-labelledby", tabId);
        panel.hidden = index !== 0;

        appendContent(panel, tab.content);

        button.addEventListener("click", () => {
            [...tabList.children].forEach((tabButton) => tabButton.setAttribute("aria-selected", "false"));
            [...panels.children].forEach((tabPanel) => {
                tabPanel.hidden = true;
            });
            button.setAttribute("aria-selected", "true");
            panel.hidden = false;
        });

        tabList.append(button);
        panels.append(panel);
    });

    shell.append(tabList, panels);

    return shell;
}
