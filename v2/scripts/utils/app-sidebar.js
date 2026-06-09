import { supabase } from "../../services/supabase/client.js";
import { createElement } from "./dom.js";

function isPlatformAdminRole(role) {
    return role === "admin" || role === "supreme_admin";
}

function isTeachingRole(role) {
    return role === "teacher" || isPlatformAdminRole(role);
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

    if (profile.platform_role === "teacher") {
        return "Teacher";
    }

    return hasTeachingTools ? "Teacher" : "Student";
}

function getDisplayName(profile) {
    return profile.username || profile.legal_first_name || profile.email || "Account";
}

function getInitials(profile) {
    const source = getDisplayName(profile).trim();
    const words = source.split(/\s+/).filter(Boolean);

    if (!words.length) {
        return "CTC";
    }

    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }

    return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

async function hasTeachingTools(profile) {
    if (isTeachingRole(profile.platform_role)) {
        return true;
    }

    const { count, error } = await supabase
        .from("courses")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", profile.id)
        .neq("status", "deleted");

    return !error && Boolean(count);
}

function getNavItems(hasTeachingAccess) {
    if (hasTeachingAccess) {
        return [
            { label: "Home", path: "dashboard/index.html", icon: "H" },
            { label: "My Courses", path: "courses/index.html", icon: "C" },
            { label: "Profile", path: "profile/index.html", icon: "P" },
        ];
    }

    return [
        { label: "Home", path: "dashboard/index.html", icon: "H" },
        { label: "My Classes", path: "classrooms/index.html", icon: "M" },
        { label: "Browse Courses", path: "courses/discover.html", icon: "B" },
        { label: "Profile", path: "profile/index.html", icon: "P" },
    ];
}

function isCurrentNavItem(item, currentPath) {
    const itemPath = item.path.replace(/^\/+/, "");
    const [pagePath, hash = ""] = itemPath.split("#");
    const currentHash = window.location.hash.replace(/^#/, "");

    return currentPath === pagePath && (hash ? currentHash === hash : !currentHash);
}

function createNavLink(item, pagesRoot, currentPath) {
    const link = createElement("a", "app-topnav-link");

    link.href = `${pagesRoot}/${item.path}`;
    link.innerHTML = `<span class="app-topnav-link-icon" aria-hidden="true">${item.icon}</span><span>${item.label}</span>`;

    if (isCurrentNavItem(item, currentPath)) {
        link.classList.add("app-topnav-link--active");
        link.setAttribute("aria-current", "page");
    }

    return link;
}

function wrapPage(nav) {
    let shell = document.querySelector("[data-app-shell]");
    const main = document.querySelector("main");

    if (!main) {
        return null;
    }

    if (!shell) {
        shell = createElement("div", "app-frame");
        shell.dataset.appShell = "true";
        main.parentNode.insertBefore(shell, main);
        shell.append(main);
    } else {
        shell.classList.remove("app-shell", "app-shell--collapsed");
        shell.classList.add("app-frame");
    }

    shell.insertBefore(nav, shell.firstElementChild);
    document.body.classList.remove("has-app-sidebar");
    document.body.classList.add("has-app-nav");

    return shell;
}

async function handleLogout(pagesRoot, button) {
    button.disabled = true;
    const { error } = await supabase.auth.signOut();

    if (error) {
        button.disabled = false;
        return;
    }

    window.location.href = `${pagesRoot}/auth/login.html`;
}

export async function renderAppSidebar(profile) {
    if (!profile || document.querySelector("[data-app-nav]")) {
        return;
    }

    const pagesRoot = getPagesRootUrl();
    const currentPath = getRelativePagePath();
    const hasTeachingAccess = await hasTeachingTools(profile);
    const nav = createElement("header", "app-topnav");
    const brand = createElement("a", "app-topnav-brand");
    const mark = createElement("span", "app-topnav-mark", "CTC");
    const titleGroup = createElement("span", "app-topnav-title-group");
    const title = createElement("strong", "app-topnav-title", "CodeTheCurrent");
    const role = createElement("span", "app-topnav-role", getRoleLabel(profile, hasTeachingAccess));
    const links = createElement("nav", "app-topnav-links");
    const account = createElement("details", "app-topnav-account");
    const accountSummary = createElement("summary", "app-topnav-account-summary");
    const accountInitials = createElement("span", "app-topnav-account-avatar", getInitials(profile));
    const accountName = createElement("span", "app-topnav-account-name", getDisplayName(profile));
    const accountMenu = createElement("div", "app-topnav-account-menu");
    const settingsLink = createElement("a", "app-topnav-menu-link", "Settings");
    const logoutButton = createElement("button", "app-topnav-menu-link app-topnav-menu-button", "Log out");
    const shell = wrapPage(nav);

    if (!shell) {
        return;
    }

    nav.dataset.appNav = "true";
    brand.href = `${pagesRoot}/dashboard/index.html`;
    brand.setAttribute("aria-label", "CodeTheCurrent home");
    titleGroup.append(title, role);
    brand.append(mark, titleGroup);

    links.setAttribute("aria-label", "Primary");
    getNavItems(hasTeachingAccess).forEach((item) => {
        links.append(createNavLink(item, pagesRoot, currentPath));
    });

    settingsLink.href = `${pagesRoot}/profile/index.html`;
    logoutButton.type = "button";
    logoutButton.addEventListener("click", () => {
        handleLogout(pagesRoot, logoutButton);
    });

    accountSummary.append(accountInitials, accountName);
    accountMenu.append(settingsLink, logoutButton);
    account.append(accountSummary, accountMenu);

    nav.append(brand, links, account);
}
