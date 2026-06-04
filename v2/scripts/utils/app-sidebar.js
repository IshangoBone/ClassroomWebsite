import { supabase } from "../../services/supabase/client.js";
import { createElement } from "./dom.js";

const SIDEBAR_STORAGE_KEY = "codethecurrent-sidebar-collapsed";

function isPlatformAdminRole(role) {
    return role === "admin" || role === "supreme_admin";
}

function getPagesRootUrl() {
    const marker = "/pages/";
    const markerIndex = window.location.pathname.indexOf(marker);

    if (markerIndex === -1) {
        return `${window.location.origin}/pages`;
    }

    return `${window.location.origin}${window.location.pathname.slice(0, markerIndex)}${marker.slice(0, -1)}`;
}

function getRelativePagePath() {
    const marker = "/pages/";
    const markerIndex = window.location.pathname.indexOf(marker);

    if (markerIndex === -1) {
        return "";
    }

    return window.location.pathname.slice(markerIndex + marker.length);
}

function getRoleLabel(profile, hasTeachingTools) {
    if (profile.platform_role === "supreme_admin") {
        return "Supreme admin";
    }

    if (profile.platform_role === "admin") {
        return "Admin";
    }

    return hasTeachingTools ? "Teacher" : "Student";
}

function createNavLink(item, pagesRoot, currentPath) {
    const link = createElement("a", "app-sidebar-link");
    const itemPath = item.path.replace(/^\/+/, "");
    const [pagePath, hash = ""] = itemPath.split("#");
    const isAnchorLink = Boolean(hash);
    const currentHash = window.location.hash.replace(/^#/, "");

    link.href = `${pagesRoot}/${itemPath}`;
    link.dataset.sidebarLabel = item.label;
    link.setAttribute("aria-label", item.label);
    link.innerHTML = `<span class="app-sidebar-icon" aria-hidden="true">${item.icon}</span><span class="app-sidebar-label">${item.label}</span>`;

    if (currentPath === pagePath && (isAnchorLink ? currentHash === hash : !currentHash)) {
        link.classList.add("app-sidebar-link--active");
        link.setAttribute("aria-current", "page");
    }

    return link;
}

function createNavSection(title, items, pagesRoot, currentPath) {
    const section = createElement("section", "app-sidebar-section");
    const heading = createElement("h2", "app-sidebar-heading", title);
    const nav = createElement("nav", "app-sidebar-nav");

    nav.setAttribute("aria-label", title);
    items.forEach((item) => {
        nav.append(createNavLink(item, pagesRoot, currentPath));
    });
    section.append(heading, nav);

    return section;
}

async function hasTeachingTools(profileId) {
    const { count, error } = await supabase
        .from("courses")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", profileId)
        .neq("status", "deleted");

    return !error && Boolean(count);
}

function getSidebarSections(profile, hasTeachingAccess) {
    const sections = [
        {
            title: "Workspace",
            items: [
                { label: "Home", path: "dashboard/index.html", icon: "H" },
                { label: "Profile", path: "profile/index.html", icon: "U" },
            ],
        },
        {
            title: "Learning",
            items: [
                { label: "Course catalog", path: "courses/discover.html", icon: "C" },
                { label: "My courses", path: "dashboard/index.html#enrolled-courses-heading", icon: "M" },
                { label: "Progress", path: "progress/index.html", icon: "P" },
                { label: "My work", path: "submissions/index.html", icon: "W" },
            ],
        },
    ];

    if (hasTeachingAccess) {
        sections.push({
            title: "Teaching",
            items: [
                { label: "My courses", path: "dashboard/index.html#courses-heading", icon: "C" },
                { label: "Student work", path: "submissions/index.html", icon: "S" },
                { label: "Analytics", path: "analytics/index.html", icon: "A" },
            ],
        });
    }

    if (isPlatformAdminRole(profile.platform_role)) {
        const adminItems = [
            { label: "Admin overview", path: "admin/index.html", icon: "A" },
            { label: "Platform analytics", path: "admin/analytics.html", icon: "N" },
            { label: "Activity logs", path: "activity/index.html", icon: "L" },
        ];

        if (profile.platform_role === "supreme_admin") {
            adminItems.push({ label: "Moderation", path: "admin/moderation.html", icon: "M" });
        }

        sections.push({
            title: "Administration",
            items: adminItems,
        });
    }

    return sections;
}

function wrapPage(sidebar) {
    let shell = document.querySelector("[data-app-shell]");
    const main = document.querySelector("main");

    if (!main) {
        return null;
    }

    if (!shell) {
        shell = createElement("div", "app-shell");
        shell.dataset.appShell = "true";
        main.parentNode.insertBefore(shell, main);
        shell.append(main);
    }

    shell.insertBefore(sidebar, shell.firstElementChild);
    document.body.classList.add("has-app-sidebar");

    return shell;
}

function applyCollapsedState(shell, toggle, isCollapsed) {
    shell.classList.toggle("app-shell--collapsed", isCollapsed);
    toggle.setAttribute("aria-expanded", String(!isCollapsed));
    toggle.setAttribute("aria-label", isCollapsed ? "Expand navigation" : "Collapse navigation");
    toggle.title = isCollapsed ? "Expand navigation" : "Collapse navigation";
}

export async function renderAppSidebar(profile) {
    if (!profile || document.querySelector("[data-app-sidebar]")) {
        return;
    }

    const pagesRoot = getPagesRootUrl();
    const currentPath = getRelativePagePath();
    const hasTeachingAccess = await hasTeachingTools(profile.id);
    const sidebar = createElement("aside", "app-sidebar");
    const brand = createElement("div", "app-sidebar-brand");
    const mark = createElement("a", "app-sidebar-mark", "CTC");
    const titleGroup = createElement("div", "app-sidebar-title-group");
    const title = createElement("strong", "app-sidebar-title", "CodeTheCurrent");
    const role = createElement("span", "app-sidebar-role", getRoleLabel(profile, hasTeachingAccess));
    const toggle = createElement("button", "app-sidebar-toggle");
    const toggleIcon = createElement("span", "app-sidebar-toggle-icon");
    const shell = wrapPage(sidebar);

    if (!shell) {
        return;
    }

    sidebar.dataset.appSidebar = "true";
    mark.href = `${pagesRoot}/dashboard/index.html`;
    toggle.type = "button";
    toggle.setAttribute("aria-controls", "app-sidebar-navigation");
    toggleIcon.setAttribute("aria-hidden", "true");
    toggle.append(toggleIcon);
    titleGroup.append(title, role);
    brand.append(mark, titleGroup);

    const content = createElement("div", "app-sidebar-content");
    content.id = "app-sidebar-navigation";
    getSidebarSections(profile, hasTeachingAccess).forEach((section) => {
        content.append(createNavSection(section.title, section.items, pagesRoot, currentPath));
    });

    const footer = createElement("div", "app-sidebar-footer");
    footer.append(toggle);

    sidebar.append(brand, content, footer);

    const savedState = window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    applyCollapsedState(shell, toggle, savedState);
    toggle.addEventListener("click", () => {
        const nextState = !shell.classList.contains("app-shell--collapsed");
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextState));
        applyCollapsedState(shell, toggle, nextState);
    });
}
