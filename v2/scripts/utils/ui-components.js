import { createElement } from "./dom.js";

let modalId = 0;

export function createBadge(text, { quiet = false } = {}) {
    return createElement("span", quiet ? "badge badge--quiet" : "badge", text);
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

    if (typeof body === "string") {
        content.append(createElement("p", "", body));
    } else if (body) {
        content.append(body);
    }

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

        if (typeof tab.content === "string") {
            panel.append(createElement("p", "", tab.content));
        } else if (tab.content) {
            panel.append(tab.content);
        }

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
