import { isTeachingRole, loadProtectedProfile } from "../utils/auth-guard.js";
import { createElement, qs } from "../utils/dom.js";
import { notifyStatus } from "../utils/ui-components.js";

const statusElement = qs("[data-toolkit-status]");
const appListElement = qs("[data-toolkit-app-list]");
const appCountElement = qs("[data-toolkit-app-count]");
const installedCountElement = qs("[data-toolkit-installed-count]");
const catalogCountElement = qs("[data-toolkit-catalog-count]");
const searchInput = qs("[data-toolkit-search]");
const categoryButtons = Array.from(document.querySelectorAll("[data-toolkit-category]"));
const installedAppsStorageKey = "brainkernl.teacherTools.installedApps";
let activeCategory = "All";

const teacherApps = [
    {
        id: "attendance-tracker",
        title: "Attendance Tracker",
        category: "Classroom operations",
        description: "Print hall passes, scan returns, and review student pass history from one classroom tool.",
        href: "./attendance/index.html",
        defaultInstalled: true,
        initial: "A",
        accent: "green",
        features: ["Hall passes", "QR return scans", "Student pass reports"],
    },
    {
        id: "course-structure-planner",
        title: "Course Structure Planner",
        category: "Planning",
        description: "Upload a course guide and draft units, lesson pacing, objectives, and learning targets.",
        href: "./course-structure/index.html",
        initial: "P",
        accent: "blue",
        features: ["PDF planning", "Unit pacing", "Learning targets"],
    },
    {
        id: "slide-deck-generator",
        title: "Slide Deck Generator",
        category: "Planning",
        description: "Turn an existing BrainKernl lesson or a custom lesson brief into a downloadable classroom presentation.",
        href: "./slide-generator/index.html",
        initial: "D",
        accent: "purple",
        features: ["Lesson-to-slides", "PPTX download", "Quick checks"],
    },
    {
        id: "quiz-builder",
        title: "Quiz Builder",
        category: "Assessment",
        description: "Create quick checks, quizzes, and review sets from lesson goals and course standards.",
        initial: "Q",
        accent: "amber",
        features: ["Formative checks", "Question banks", "Review mode"],
    },
    {
        id: "seating-chart",
        title: "Seating Chart",
        category: "Classroom operations",
        description: "Arrange students by class period, save room layouts, and keep daily classroom context close.",
        initial: "S",
        accent: "purple",
        features: ["Room layouts", "Class rosters", "Daily notes"],
    },
];

function getDefaultInstalledAppIds() {
    return teacherApps.filter((app) => app.defaultInstalled).map((app) => app.id);
}

function getInstalledAppIds() {
    const fallback = getDefaultInstalledAppIds();
    try {
        const saved = JSON.parse(localStorage.getItem(installedAppsStorageKey) || "null");
        return Array.isArray(saved) ? saved : fallback;
    } catch (error) {
        return fallback;
    }
}

function saveInstalledAppIds(appIds) {
    localStorage.setItem(installedAppsStorageKey, JSON.stringify(appIds));
}

function isAppInstalled(app) {
    return getInstalledAppIds().includes(app.id);
}

function setAppInstalled(appId, shouldInstall) {
    const installedIds = new Set(getInstalledAppIds());
    if (shouldInstall) {
        installedIds.add(appId);
    } else {
        installedIds.delete(appId);
    }
    saveInstalledAppIds(Array.from(installedIds));
    updateApps();
}

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;
    if (message) {
        notifyStatus(message, tone);
    }
}

function createIcon(paths) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    paths.forEach((pathData) => {
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        svg.append(path);
    });
    return svg;
}

function createIconAction(label, modifier, paths) {
    const button = createElement("button", `toolkit-store-icon-button toolkit-store-icon-button--${modifier}`);
    button.type = "button";
    button.title = label;
    button.dataset.tooltip = label;
    button.setAttribute("aria-label", label);
    button.append(createIcon(paths));
    return button;
}

function renderApps(apps) {
    const cards = apps.map((app) => {
        const installed = isAppInstalled(app);
        const canInstall = Boolean(app.href);
        const card = createElement("article", `toolkit-store-card${canInstall ? "" : " toolkit-store-card--disabled"}`);
        if (app.accent) {
            card.dataset.accent = app.accent;
        }
        const top = createElement("div", "toolkit-store-card__top");
        const icon = createElement("div", "toolkit-app-mark", app.initial);
        const content = createElement("div", "toolkit-store-card__content");
        const meta = createElement("div", "profile-toolkit-meta");
        const category = createElement("span", "badge badge--quiet", app.category);
        const status = createElement("span", installed ? "badge" : "badge badge--quiet", canInstall ? (installed ? "Installed" : "Available") : "Coming soon");
        const title = createElement("h3", "", app.title);
        const description = createElement("p", "course-muted", app.description);
        const featureList = createElement("ul", "toolkit-store-features");
        const actions = createElement("div", "toolkit-store-card__actions");

        (app.features || []).forEach((feature) => {
            featureList.append(createElement("li", "", feature));
        });

        if (installed && app.href) {
            const openAction = createElement("a", "primary-button toolkit-store-card__action", "Open app");
            const uninstallAction = createIconAction(`Uninstall ${app.title}`, "uninstall", [
                "M3 6h18",
                "M8 6V4h8v2",
                "M6 6l1 14h10l1-14",
                "M10 11v5",
                "M14 11v5",
            ]);
            openAction.href = app.href;
            uninstallAction.addEventListener("click", () => {
                setAppInstalled(app.id, false);
                setStatus(`${app.title} uninstalled.`, "success");
            });
            actions.append(openAction, uninstallAction);
        } else if (canInstall) {
            actions.classList.add("toolkit-store-card__actions--compact");
            const installAction = createIconAction(`Install ${app.title}`, "install", [
                "M12 3v12",
                "M7 10l5 5 5-5",
                "M5 21h14",
            ]);
            installAction.addEventListener("click", () => {
                setAppInstalled(app.id, true);
                setStatus(`${app.title} installed.`, "success");
            });
            actions.append(installAction);
        } else {
            const action = createElement("button", "secondary-button toolkit-store-card__action", "Preview");
            action.type = "button";
            action.disabled = true;
            actions.append(action);
        }

        top.append(icon, status);
        meta.append(category);
        content.append(meta, title, description, featureList);
        card.append(top, content, actions);
        return card;
    });

    const installedCount = getInstalledAppIds().filter((appId) => teacherApps.some((app) => app.id === appId)).length;
    appCountElement.textContent = apps.length === 1 ? "1 app" : `${apps.length} apps`;
    if (installedCountElement) {
        installedCountElement.textContent = installedCount;
    }
    if (catalogCountElement) {
        catalogCountElement.textContent = teacherApps.length;
    }
    appListElement.replaceChildren(...(cards.length ? cards : [
        createElement("p", "empty-state toolkit-store-empty", "No teacher apps match that search yet."),
    ]));
}

function getFilteredApps() {
    const query = (searchInput?.value || "").trim().toLowerCase();
    return teacherApps.filter((app) => {
        const categoryMatches = activeCategory === "All" || app.category === activeCategory;
        const searchText = [app.title, app.category, app.description, ...(app.features || [])].join(" ").toLowerCase();
        return categoryMatches && (!query || searchText.includes(query));
    });
}

function updateApps() {
    renderApps(getFilteredApps());
}

async function initializeToolkitStore() {
    setStatus("Loading teacher tools...");

    const profile = await loadProtectedProfile({
        loginPath: "../auth/login.html",
        onboardingPath: "../auth/onboarding.html",
        profileColumns: "id, profile_completed, platform_role, account_status",
        statusElement,
    });

    if (!profile) {
        return;
    }

    if (!isTeachingRole(profile.platform_role)) {
        setStatus("Teacher Tools is available to teacher accounts.", "error");
        appListElement.replaceChildren(createElement("p", "empty-state", "Teacher apps are only available to teacher accounts."));
        appCountElement.textContent = "0 apps";
        return;
    }

    categoryButtons.forEach((button) => {
        button.addEventListener("click", () => {
            activeCategory = button.dataset.toolkitCategory || "All";
            categoryButtons.forEach((categoryButton) => {
                categoryButton.classList.toggle("toolkit-store-category--active", categoryButton === button);
            });
            updateApps();
        });
    });

    searchInput?.addEventListener("input", updateApps);

    updateApps();
    setStatus("");
}

await initializeToolkitStore();
