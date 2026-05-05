export function qs(selector, scope = document) {
    return scope.querySelector(selector);
}

export function createElement(tagName, className, textContent) {
    const element = document.createElement(tagName);

    if (className) {
        element.className = className;
    }

    if (textContent) {
        element.textContent = textContent;
    }

    return element;
}

export function appendModuleStatus(container, moduleInfo) {
    const item = createElement("li", "status-item");
    const title = createElement("strong", "status-title", moduleInfo.name);
    const description = createElement("span", "status-description", moduleInfo.status);

    item.append(title, description);
    container.append(item);
}
