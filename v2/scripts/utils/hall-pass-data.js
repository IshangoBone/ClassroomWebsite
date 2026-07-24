export const HALL_PASS_STORAGE_PREFIX = "brainkernl.attendance.hallPasses";

function canUseLocalStorage() {
    return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function getHallPassStorageKey(ownerId = "simulation") {
    return `${HALL_PASS_STORAGE_PREFIX}.${ownerId || "simulation"}`;
}

function readJson(key, fallback) {
    if (!canUseLocalStorage()) {
        return fallback;
    }

    try {
        return JSON.parse(window.localStorage.getItem(key)) || fallback;
    } catch (error) {
        console.warn("Could not read hall pass storage.", error);
        return fallback;
    }
}

function normalizePasses(passes, ownerId) {
    return Array.isArray(passes)
        ? passes.map((pass) => ({ ...pass, storage_owner_id: pass.storage_owner_id || ownerId }))
        : [];
}

export function sortHallPasses(passes) {
    return [...passes].sort((first, second) => (
        new Date(second.departure_time || second.created_at || 0)
        - new Date(first.departure_time || first.created_at || 0)
    ));
}

export function readHallPassesForOwner(ownerId = "simulation") {
    return sortHallPasses(normalizePasses(readJson(getHallPassStorageKey(ownerId), []), ownerId));
}

export function readAllLocalHallPasses() {
    if (!canUseLocalStorage()) {
        return [];
    }

    const passes = [];

    for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);

        if (!key || !key.startsWith(`${HALL_PASS_STORAGE_PREFIX}.`)) {
            continue;
        }

        const ownerId = key.slice(`${HALL_PASS_STORAGE_PREFIX}.`.length);
        passes.push(...normalizePasses(readJson(key, []), ownerId));
    }

    return sortHallPasses(passes);
}

export function filterHallPassesByStudent(passes, studentId) {
    return passes.filter((pass) => pass.student_id === studentId);
}

export function filterHallPassesByManagedStudents(passes, studentIds) {
    const managedStudentIds = new Set(studentIds.filter(Boolean));

    return passes.filter((pass) => managedStudentIds.has(pass.student_id));
}

export function getPassDurationSeconds(pass, now = new Date()) {
    const stored = Number(pass?.duration_seconds);

    if (Number.isFinite(stored) && stored > 0) {
        return stored;
    }

    if (!pass?.departure_time) {
        return 0;
    }

    const end = pass.return_time ? new Date(pass.return_time) : now;
    return Math.max(0, Math.floor((end - new Date(pass.departure_time)) / 1000));
}

export function summarizeHallPasses(passes) {
    const active = passes.filter((pass) => pass.status === "active");
    const closed = passes.filter((pass) => pass.status !== "active");
    const totalDurationSeconds = passes.reduce((total, pass) => total + getPassDurationSeconds(pass), 0);
    const closedDurationSeconds = closed.reduce((total, pass) => total + getPassDurationSeconds(pass), 0);
    const longestPass = passes.reduce((longest, pass) => (
        getPassDurationSeconds(pass) > getPassDurationSeconds(longest || {}) ? pass : longest
    ), null);

    return {
        activePasses: active.length,
        averageDurationSeconds: closed.length ? Math.round(closedDurationSeconds / closed.length) : 0,
        closedPasses: closed.length,
        lastPass: sortHallPasses(passes)[0] || null,
        longestPass,
        qrClosedCount: closed.filter((pass) => pass.closed_by === "qr_scan").length,
        teacherClosedCount: closed.filter((pass) => pass.closed_by === "teacher").length,
        totalDurationSeconds,
        totalPasses: passes.length,
    };
}

export function formatHallPassDateTime(value, fallback = "Still out") {
    if (!value) {
        return fallback;
    }

    return new Date(value).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

export function formatHallPassDuration(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const remainingSeconds = value % 60;

    if (hours) {
        return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    }

    if (minutes) {
        return `${minutes}m ${String(remainingSeconds).padStart(2, "0")}s`;
    }

    return `${remainingSeconds}s`;
}

export function getHallPassDestination(pass) {
    return pass?.destination || pass?.pass_type || "Hall pass";
}
