import { supabase } from "../../../services/supabase/client.js";
import { isTeachingRole } from "../../utils/auth-guard.js";
import { createElement, qs } from "../../utils/dom.js";
import { getHallPassStorageKey } from "../../utils/hall-pass-data.js";
import { createButton, createModalShell, notifyStatus } from "../../utils/ui-components.js";

const ROOM_LABEL = "214";
const PASS_STORAGE_PREFIX = "brainkernl.attendance.hallPasses";
const STUDENTS_STORAGE_PREFIX = "brainkernl.attendance.students";
const QR_ALPHANUMERIC = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const DEFAULT_STUDENTS = [
    { id: "stu-alex-roll", first_name: "Alexander", last_name: "Roll", class_period: "Period 1", active: true },
    { id: "stu-thats-programmed", first_name: "Thats", last_name: "Programmed", class_period: "Period 2", active: true },
    { id: "stu-maya-johnson", first_name: "Maya", last_name: "Johnson", class_period: "Period 2", active: true },
    { id: "stu-chris-lee", first_name: "Chris", last_name: "Lee", class_period: "Period 3", active: true },
    { id: "stu-jordan-smith", first_name: "Jordan", last_name: "Smith", class_period: "Period 4", active: true },
    { id: "stu-taylor-brown", first_name: "Taylor", last_name: "Brown", class_period: "Period 5", active: true },
];

const statusElement = qs("[data-attendance-status]");
const passForm = qs("[data-pass-form]");
const scannerForm = qs("[data-scanner-form]");
const studentSelect = qs("[data-student-select]");
const passTypeSelect = qs("[data-pass-type]");
const otherDestinationField = qs("[data-other-destination-field]");
const scannerInput = qs("[data-scanner-input]");
const scanResult = qs("[data-scan-result]");
const activePassList = qs("[data-active-pass-list]");
const passHistoryList = qs("[data-pass-history-list]");
const activeCount = qs("[data-active-count]");
const printTicket = qs("[data-print-ticket]");
const clearHistoryButton = qs("[data-clear-history]");

let currentProfile = null;
let students = [];
let passes = [];
let tickTimer = null;
let rosterStatusMessage = "";
let rosterStatusTone = "info";
let eventsInitialized = false;

function setStatus(message, tone = "info") {
    statusElement.textContent = message;
    statusElement.dataset.tone = tone;

    if (message) {
        notifyStatus(message, tone);
    }
}

function getProfileKey(prefix) {
    if (prefix === PASS_STORAGE_PREFIX) {
        return getHallPassStorageKey(currentProfile?.id || "simulation");
    }

    return `${prefix}.${currentProfile?.id || "simulation"}`;
}

function readJson(key, fallback) {
    try {
        return JSON.parse(window.localStorage.getItem(key)) || fallback;
    } catch (error) {
        console.warn("Could not read attendance storage.", error);
        return fallback;
    }
}

function writeJson(key, value) {
    window.localStorage.setItem(key, JSON.stringify(value));
}

function withTimeout(promise, timeoutMs, label) {
    let timeoutId;
    const timeout = new Promise((_, reject) => {
        timeoutId = window.setTimeout(() => {
            reject(new Error(`${label} timed out.`));
        }, timeoutMs);
    });

    return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

async function loadAttendanceProfile() {
    const { data: authData, error: authError } = await supabase.auth.getUser();

    if (authError || !authData?.user) {
        return null;
    }

    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, profile_completed, platform_role, account_status, username, legal_first_name, legal_last_name, email")
        .eq("auth_user_id", authData.user.id)
        .maybeSingle();

    if (profileError || !profile || !profile.profile_completed || profile.account_status !== "active") {
        return null;
    }

    return profile;
}

function getClassroomLabel(classroom) {
    return [classroom?.name, classroom?.period_block].filter(Boolean).join(" - ") || "Classroom";
}

function getStudentSortName(student) {
    return [
        student?.last_name,
        student?.first_name,
        student?.display_name,
        student?.username,
        student?.email,
    ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
}

async function loadManagedCourses(profileId) {
    const { data: ownedCourses, error: ownedError } = await supabase
        .from("courses")
        .select("id, title")
        .eq("owner_user_id", profileId)
        .neq("status", "deleted");

    if (ownedError) {
        throw ownedError;
    }

    const { data: collaboratorRows, error: collaboratorError } = await supabase
        .from("course_collaborators")
        .select("course_id")
        .eq("user_id", profileId)
        .in("permission_level", ["teacher", "editor", "co_owner"]);

    if (collaboratorError) {
        throw collaboratorError;
    }

    let collaborativeCourses = [];
    const collaborativeCourseIds = [...new Set((collaboratorRows || []).map((row) => row.course_id).filter(Boolean))];

    if (collaborativeCourseIds.length) {
        const { data, error } = await supabase
            .from("courses")
            .select("id, title")
            .in("id", collaborativeCourseIds)
            .neq("status", "deleted");

        if (error) {
            throw error;
        }

        collaborativeCourses = data || [];
    }

    const courseMap = new Map();
    [...(ownedCourses || []), ...collaborativeCourses].forEach((course) => courseMap.set(course.id, course));

    return [...courseMap.values()];
}

async function loadManagedClassrooms(profileId, courseIds) {
    const classroomMap = new Map();

    if (courseIds.length) {
        const { data: courseClassrooms, error: courseClassroomsError } = await supabase
            .from("classrooms")
            .select("id, course_id, name, period_block, status, display_order")
            .in("course_id", courseIds)
            .neq("status", "deleted");

        if (courseClassroomsError) {
            throw courseClassroomsError;
        }

        (courseClassrooms || []).forEach((classroom) => classroomMap.set(classroom.id, classroom));
    }

    const { data: ownedClassrooms, error: ownedError } = await supabase
        .from("classrooms")
        .select("id, course_id, name, period_block, status, display_order")
        .eq("owner_teacher_id", profileId)
        .neq("status", "deleted");

    if (ownedError) {
        throw ownedError;
    }

    (ownedClassrooms || []).forEach((classroom) => classroomMap.set(classroom.id, classroom));

    const { data: teacherAssignments, error: assignmentError } = await supabase
        .from("classroom_teachers")
        .select("classroom_id")
        .eq("user_id", profileId);

    if (assignmentError) {
        throw assignmentError;
    }

    const assignedClassroomIds = [...new Set((teacherAssignments || []).map((assignment) => assignment.classroom_id).filter(Boolean))];

    if (assignedClassroomIds.length) {
        const { data: assignedClassrooms, error } = await supabase
            .from("classrooms")
            .select("id, course_id, name, period_block, status, display_order")
            .in("id", assignedClassroomIds)
            .neq("status", "deleted");

        if (error) {
            throw error;
        }

        (assignedClassrooms || []).forEach((classroom) => classroomMap.set(classroom.id, classroom));
    }

    return [...classroomMap.values()];
}

async function loadEnrollments(courseIds, classroomIds) {
    const enrollmentMap = new Map();

    if (courseIds.length) {
        const { data, error } = await supabase
            .from("enrollments")
            .select("id, user_id, course_id, classroom_id, enrollment_type, enrollment_status, joined_at")
            .in("course_id", courseIds)
            .eq("enrollment_status", "active");

        if (error) {
            throw error;
        }

        (data || []).forEach((enrollment) => enrollmentMap.set(enrollment.id, enrollment));
    }

    if (classroomIds.length) {
        const { data, error } = await supabase
            .from("enrollments")
            .select("id, user_id, course_id, classroom_id, enrollment_type, enrollment_status, joined_at")
            .in("classroom_id", classroomIds)
            .eq("enrollment_type", "classroom")
            .eq("enrollment_status", "active");

        if (error) {
            throw error;
        }

        (data || []).forEach((enrollment) => enrollmentMap.set(enrollment.id, enrollment));
    }

    return [...enrollmentMap.values()].filter((enrollment) => enrollment.user_id);
}

async function loadStudentProfiles(profileIds) {
    const { data, error } = await supabase.rpc("reviewable_student_profiles");

    if (error) {
        throw error;
    }

    if (!profileIds.length) {
        return data || [];
    }

    const eligibleProfileIds = new Set(profileIds);
    const profileMap = new Map(
        (data || [])
            .filter((profile) => eligibleProfileIds.has(profile.id))
            .map((profile) => [profile.id, profile])
    );
    const missingProfileIds = profileIds.filter((profileId) => !profileMap.has(profileId));

    if (missingProfileIds.length) {
        const { data: directProfiles, error: directError } = await supabase
            .from("profiles")
            .select("id, username, legal_first_name, legal_last_name, email, account_status")
            .in("id", missingProfileIds);

        if (directError) {
            console.warn("Could not directly load enrolled attendance profiles.", directError);
        } else {
            (directProfiles || []).forEach((profile) => profileMap.set(profile.id, profile));
        }
    }

    return profileIds.map((profileId) => profileMap.get(profileId)).filter(Boolean);
}

function buildRosterFromProfiles(profiles) {
    return profiles
        .map((profile) => ({
            id: profile.id,
            first_name: profile.legal_first_name || "",
            last_name: profile.legal_last_name || "",
            display_name: [profile.legal_first_name, profile.legal_last_name].filter(Boolean).join(" ").trim(),
            username: profile.username || "",
            email: profile.email || "",
            class_period: "Enrolled student",
            active: true,
            enrollment_count: 1,
        }))
        .sort((firstStudent, secondStudent) => getStudentSortName(firstStudent).localeCompare(getStudentSortName(secondStudent)));
}

function buildRoster(enrollments, profiles, courses, classrooms) {
    const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
    const courseMap = new Map(courses.map((course) => [course.id, course]));
    const classroomMap = new Map(classrooms.map((classroom) => [classroom.id, classroom]));
    const enrollmentsByStudent = new Map();

    enrollments.forEach((enrollment) => {
        const current = enrollmentsByStudent.get(enrollment.user_id) || [];
        current.push(enrollment);
        enrollmentsByStudent.set(enrollment.user_id, current);
    });

    return [...enrollmentsByStudent.entries()]
        .map(([studentId, studentEnrollments]) => {
            const profile = profileMap.get(studentId) || {};
            const contexts = studentEnrollments.map((enrollment) => {
                if (enrollment.classroom_id && classroomMap.has(enrollment.classroom_id)) {
                    return getClassroomLabel(classroomMap.get(enrollment.classroom_id));
                }

                return courseMap.get(enrollment.course_id)?.title || "Course enrollment";
            });
            const uniqueContexts = [...new Set(contexts.filter(Boolean))];

            return {
                id: studentId,
                first_name: profile.legal_first_name || "",
                last_name: profile.legal_last_name || "",
                display_name: [profile.legal_first_name, profile.legal_last_name].filter(Boolean).join(" ").trim(),
                username: profile.username || "",
                email: profile.email || "",
                class_period: uniqueContexts.slice(0, 2).join(" / ") || "Enrolled student",
                active: profile.account_status !== "inactive",
                enrollment_count: studentEnrollments.length,
            };
        })
        .filter((student) => student.active !== false)
        .sort((firstStudent, secondStudent) => getStudentSortName(firstStudent).localeCompare(getStudentSortName(secondStudent)));
}

async function loadStudents() {
    const key = getProfileKey(STUDENTS_STORAGE_PREFIX);

    try {
        const visibleProfiles = await loadStudentProfiles([]);
        const courses = await loadManagedCourses(currentProfile.id);
        const courseIds = courses.map((course) => course.id);
        const classrooms = await loadManagedClassrooms(currentProfile.id, courseIds);
        const classroomIds = classrooms.map((classroom) => classroom.id);
        const enrollments = await loadEnrollments(courseIds, classroomIds);
        const profileIds = [...new Set(enrollments.map((enrollment) => enrollment.user_id))];
        const profiles = profileIds.length ? await loadStudentProfiles(profileIds) : visibleProfiles;
        const loadedStudents = buildRoster(enrollments, profiles, courses, classrooms);

        if (loadedStudents.length) {
            students = loadedStudents;
            writeJson(key, students);
            rosterStatusMessage = `${students.length} enrolled student${students.length === 1 ? "" : "s"} loaded from your courses.`;
            rosterStatusTone = "success";
            return;
        }

        if (visibleProfiles.length) {
            students = buildRosterFromProfiles(visibleProfiles);
            writeJson(key, students);
            rosterStatusMessage = `${students.length} enrolled student${students.length === 1 ? "" : "s"} loaded from your teacher roster.`;
            rosterStatusTone = "success";
            return;
        }

        students = readJson(key, DEFAULT_STUDENTS).filter((student) => student.active !== false);
        rosterStatusMessage = "No students enrolled in your courses or classrooms were found yet, so the simulation roster is showing.";
        rosterStatusTone = "warning";
    } catch (error) {
        console.warn("Could not load enrolled attendance students.", error);
        students = readJson(key, DEFAULT_STUDENTS).filter((student) => student.active !== false);
        rosterStatusMessage = "Enrolled students could not be loaded, so the simulation roster is showing.";
        rosterStatusTone = "warning";
    }
}

function loadPasses() {
    passes = readJson(getProfileKey(PASS_STORAGE_PREFIX), []);
}

function savePasses() {
    writeJson(getProfileKey(PASS_STORAGE_PREFIX), passes);
}

function getStudentName(student) {
    return [student?.first_name, student?.last_name].filter(Boolean).join(" ")
        || student?.display_name
        || student?.username?.replace(/^@/, "")
        || student?.email
        || "Student";
}

function getTeacherName() {
    const legalName = [currentProfile?.legal_first_name, currentProfile?.legal_last_name]
        .filter(Boolean)
        .join(" ")
        .trim();

    return currentProfile?.display_name
        || legalName
        || currentProfile?.full_name
        || currentProfile?.username?.replace(/^@/, "")
        || "Teacher";
}

function formatDateTime(value, options = {}) {
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        ...options,
    }).format(new Date(value));
}

function formatTicketDate(value) {
    return new Intl.DateTimeFormat(undefined, {
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
    }).format(new Date(value));
}

function formatTicketTime(value) {
    return new Intl.DateTimeFormat(undefined, {
        hour: "numeric",
        minute: "2-digit",
    }).format(new Date(value));
}

function formatDuration(seconds) {
    const totalSeconds = Math.max(0, Number(seconds || 0));
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;

    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m`;
    }

    return `${minutes}m ${remainingSeconds.toString().padStart(2, "0")}s`;
}

function getDurationSeconds(pass, endTime = Date.now()) {
    return Math.floor((endTime - new Date(pass.departure_time).getTime()) / 1000);
}

function createPassCode() {
    const randomPart = crypto.getRandomValues(new Uint32Array(1))[0].toString(16).toUpperCase().padStart(8, "0");
    return `HP-${randomPart}`;
}

function createId() {
    return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function populateStudentOptions() {
    studentSelect.replaceChildren(createElement("option", "", "Choose a student"));
    studentSelect.firstElementChild.value = "";

    students.forEach((student) => {
        const option = createElement("option", "", `${getStudentName(student)} - ${student.class_period || "Class"}`);
        option.value = student.id;
        studentSelect.append(option);
    });
}

function getSelectedDestination(formData) {
    const passType = String(formData.get("passType") || "").trim();
    const otherDestination = String(formData.get("otherDestination") || "").trim();
    return passType === "Other" ? otherDestination : passType;
}

function getActivePasses() {
    return passes
        .filter((pass) => pass.status === "active")
        .sort((a, b) => new Date(a.departure_time) - new Date(b.departure_time));
}

function getClosedPasses() {
    return passes
        .filter((pass) => pass.status === "closed")
        .sort((a, b) => new Date(b.return_time || b.created_at) - new Date(a.return_time || a.created_at));
}

function createMetaItem(label, value) {
    const item = createElement("span", "attendance-meta-item");
    item.append(createElement("strong", "", label), document.createTextNode(` ${value}`));
    return item;
}

function appendBits(bits, value, length) {
    for (let index = length - 1; index >= 0; index -= 1) {
        bits.push((value >>> index) & 1);
    }
}

function gfMultiply(left, right) {
    let product = 0;

    for (let index = 0; index < 8; index += 1) {
        if (right & 1) {
            product ^= left;
        }

        const carry = left & 0x80;
        left = (left << 1) & 0xff;
        if (carry) {
            left ^= 0x1d;
        }
        right >>>= 1;
    }

    return product;
}

function gfPow(value, power) {
    let result = 1;

    for (let index = 0; index < power; index += 1) {
        result = gfMultiply(result, value);
    }

    return result;
}

function reedSolomonGenerator(degree) {
    let coefficients = [1];

    for (let index = 0; index < degree; index += 1) {
        const next = new Array(coefficients.length + 1).fill(0);
        coefficients.forEach((coefficient, coefficientIndex) => {
            next[coefficientIndex] ^= gfMultiply(coefficient, gfPow(2, index));
            next[coefficientIndex + 1] ^= coefficient;
        });
        coefficients = next;
    }

    return coefficients.slice(0, degree);
}

function reedSolomonRemainder(data, degree) {
    const generator = reedSolomonGenerator(degree);
    const remainder = new Array(degree).fill(0);

    data.forEach((byte) => {
        const factor = byte ^ remainder.shift();
        remainder.push(0);
        generator.forEach((coefficient, index) => {
            remainder[index] ^= gfMultiply(coefficient, factor);
        });
    });

    return remainder;
}

function getFormatBits(mask) {
    let data = (1 << 3) | mask;
    let bits = data << 10;

    for (let index = 14; index >= 10; index -= 1) {
        if ((bits >>> index) & 1) {
            bits ^= 0x537 << (index - 10);
        }
    }

    return ((data << 10) | bits) ^ 0x5412;
}

function setModule(modules, reserved, x, y, value, isReserved = true) {
    if (x < 0 || y < 0 || y >= modules.length || x >= modules.length) {
        return;
    }

    modules[y][x] = Boolean(value);
    if (isReserved) {
        reserved[y][x] = true;
    }
}

function drawFinder(modules, reserved, x, y) {
    for (let dy = -1; dy <= 7; dy += 1) {
        for (let dx = -1; dx <= 7; dx += 1) {
            const xx = x + dx;
            const yy = y + dy;
            const inFinder = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
            const filled = inFinder && (dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
            setModule(modules, reserved, xx, yy, filled);
        }
    }
}

function shouldMask(mask, x, y) {
    switch (mask) {
        case 0:
            return (x + y) % 2 === 0;
        case 1:
            return y % 2 === 0;
        case 2:
            return x % 3 === 0;
        case 3:
            return (x + y) % 3 === 0;
        default:
            return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    }
}

function makeQrCodeMatrix(text) {
    const size = 21;
    const dataCodewords = 19;
    const errorCodewords = 7;
    const mask = 0;
    const normalized = String(text || "").toUpperCase();
    const bits = [];
    const modules = Array.from({ length: size }, () => Array(size).fill(false));
    const reserved = Array.from({ length: size }, () => Array(size).fill(false));

    appendBits(bits, 0b0010, 4);
    appendBits(bits, normalized.length, 9);

    for (let index = 0; index < normalized.length; index += 2) {
        const first = QR_ALPHANUMERIC.indexOf(normalized[index]);
        const second = QR_ALPHANUMERIC.indexOf(normalized[index + 1]);

        if (first < 0 || (normalized[index + 1] && second < 0)) {
            throw new Error("Pass ID contains unsupported QR characters.");
        }

        if (Number.isInteger(second) && second >= 0) {
            appendBits(bits, first * 45 + second, 11);
        } else {
            appendBits(bits, first, 6);
        }
    }

    appendBits(bits, 0, Math.min(4, dataCodewords * 8 - bits.length));
    while (bits.length % 8 !== 0) {
        bits.push(0);
    }

    const data = [];
    for (let index = 0; index < bits.length; index += 8) {
        data.push(bits.slice(index, index + 8).reduce((byte, bit) => (byte << 1) | bit, 0));
    }

    for (let padIndex = 0; data.length < dataCodewords; padIndex += 1) {
        data.push(padIndex % 2 === 0 ? 0xec : 0x11);
    }

    const codewords = data.concat(reedSolomonRemainder(data, errorCodewords));

    drawFinder(modules, reserved, 0, 0);
    drawFinder(modules, reserved, size - 7, 0);
    drawFinder(modules, reserved, 0, size - 7);

    for (let index = 8; index < size - 8; index += 1) {
        setModule(modules, reserved, 6, index, index % 2 === 0);
        setModule(modules, reserved, index, 6, index % 2 === 0);
    }

    setModule(modules, reserved, 8, size - 8, true);

    for (let index = 0; index < 9; index += 1) {
        setModule(modules, reserved, 8, index, false);
        setModule(modules, reserved, index, 8, false);
    }

    for (let index = size - 8; index < size; index += 1) {
        setModule(modules, reserved, 8, index, false);
        setModule(modules, reserved, index, 8, false);
    }

    const codeBits = [];
    codewords.forEach((codeword) => appendBits(codeBits, codeword, 8));

    let bitIndex = 0;
    let upward = true;

    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) {
            right -= 1;
        }

        for (let vertical = 0; vertical < size; vertical += 1) {
            const y = upward ? size - 1 - vertical : vertical;

            for (let dx = 0; dx < 2; dx += 1) {
                const x = right - dx;

                if (reserved[y][x]) {
                    continue;
                }

                const value = Boolean(codeBits[bitIndex] || 0) !== shouldMask(mask, x, y);
                setModule(modules, reserved, x, y, value, false);
                bitIndex += 1;
            }
        }

        upward = !upward;
    }

    const formatBits = getFormatBits(mask);
    for (let index = 0; index <= 5; index += 1) {
        setModule(modules, reserved, 8, index, (formatBits >>> index) & 1);
    }
    setModule(modules, reserved, 8, 7, (formatBits >>> 6) & 1);
    setModule(modules, reserved, 8, 8, (formatBits >>> 7) & 1);
    setModule(modules, reserved, 7, 8, (formatBits >>> 8) & 1);
    for (let index = 9; index < 15; index += 1) {
        setModule(modules, reserved, 14 - index, 8, (formatBits >>> index) & 1);
    }
    for (let index = 0; index < 8; index += 1) {
        setModule(modules, reserved, size - 1 - index, 8, (formatBits >>> index) & 1);
    }
    for (let index = 8; index < 15; index += 1) {
        setModule(modules, reserved, 8, size - 15 + index, (formatBits >>> index) & 1);
    }

    return modules;
}

function createQrCode(passCode) {
    const modules = makeQrCodeMatrix(passCode);
    const quietZone = 4;
    const size = modules.length + quietZone * 2;
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const commands = [];

    modules.forEach((row, y) => {
        row.forEach((filled, x) => {
            if (filled) {
                commands.push(`M${x + quietZone},${y + quietZone}h1v1h-1z`);
            }
        });
    });

    svg.classList.add("attendance-qr");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", `QR code for pass ${passCode}`);
    svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
    svg.setAttribute("shape-rendering", "crispEdges");
    svg.dataset.passCode = passCode;

    background.setAttribute("width", size);
    background.setAttribute("height", size);
    background.setAttribute("fill", "#ffffff");
    path.setAttribute("d", commands.join(""));
    path.setAttribute("fill", "#000000");
    svg.append(background, path);

    return svg;
}

function renderTicket(pass) {
    const destination = pass.destination || pass.pass_type;
    const ticket = createElement("article", "attendance-ticket");
    const details = [
        ["Student:", pass.student_name],
        ["Destination:", destination],
        ["Teacher:", pass.teacher_name],
        ["Room:", pass.room],
        ["Time Out:", formatTicketTime(pass.departure_time)],
        ["Date:", formatTicketDate(pass.departure_time)],
        ["Pass ID:", pass.pass_code],
    ];

    ticket.append(createElement("h1", "attendance-ticket__title", "HALL PASS"));

    details.forEach(([label, value]) => {
        const row = createElement("div", "attendance-ticket__row");
        row.append(createElement("span", "", label), createElement("strong", "", value));
        ticket.append(row);
    });

    ticket.append(createQrCode(pass.pass_code));
    ticket.append(createElement("p", "attendance-ticket__code-note", "QR contains pass ID only"));
    ticket.append(createElement("p", "attendance-ticket__scan", "Scan upon return"));
    printTicket.replaceChildren(ticket);
}

function printPass(pass, onPrinted) {
    renderTicket(pass);
    document.body.classList.add("attendance-is-printing");

    let didFinish = false;
    const finishPrint = () => {
        if (didFinish) return;
        didFinish = true;
        document.body.classList.remove("attendance-is-printing");
        window.removeEventListener("afterprint", finishPrint);
        onPrinted?.();
    };

    window.addEventListener("afterprint", finishPrint, { once: true });
    window.setTimeout(() => {
        window.print();
        window.setTimeout(finishPrint, 300);
    }, 50);
}

function updateScanResult(message, tone = "info") {
    scanResult.textContent = message;
    scanResult.dataset.tone = tone;
}

function focusScannerSoon() {
    window.setTimeout(() => scannerInput?.focus(), 120);
}

function renderActivePasses() {
    const active = getActivePasses();
    activeCount.textContent = `${active.length} active`;

    if (!active.length) {
        activePassList.replaceChildren(createElement("p", "attendance-empty", "No students are out right now."));
        return;
    }

    const fragment = document.createDocumentFragment();

    active.forEach((pass) => {
        const card = createElement("article", "attendance-pass-card");
        const header = createElement("div", "attendance-pass-card__header");
        const titleGroup = createElement("div");
        const actions = createElement("div", "attendance-card-actions");
        const timer = createElement("strong", "attendance-pass-timer", formatDuration(getDurationSeconds(pass)));
        const reprintButton = createButton("Reprint", { variant: "secondary" });
        const scanButton = createButton("Simulate scan", { variant: "secondary" });
        const closeButton = createButton("Close pass", { destructive: true });

        timer.dataset.passTimer = pass.id;
        titleGroup.append(createElement("h3", "", pass.student_name), createElement("p", "", pass.destination));
        header.append(titleGroup, timer);

        const meta = createElement("div", "attendance-pass-meta");
        meta.append(
            createMetaItem("Out:", formatDateTime(pass.departure_time)),
            createMetaItem("ID:", pass.pass_code),
            createMetaItem("Period:", pass.student_period || "Class")
        );

        reprintButton.addEventListener("click", () => printPass(pass));
        scanButton.addEventListener("click", () => {
            scannerInput.value = pass.pass_code;
            closePassByCode(pass.pass_code, "qr_scan");
        });
        closeButton.addEventListener("click", () => confirmManualClose(pass));

        actions.append(reprintButton, scanButton, closeButton);
        card.append(header, meta, actions);
        fragment.append(card);
    });

    activePassList.replaceChildren(fragment);
}

function renderHistory() {
    const closed = getClosedPasses();

    if (!closed.length) {
        passHistoryList.replaceChildren(createElement("p", "attendance-empty", "Closed passes will appear here."));
        return;
    }

    const fragment = document.createDocumentFragment();

    closed.forEach((pass) => {
        const row = createElement("article", "attendance-history-item");
        const content = createElement("div", "attendance-history-item__content");
        const status = createElement("span", "badge badge--quiet", pass.closed_by === "teacher" ? "Teacher closed" : "QR scan");

        content.append(
            createElement("strong", "", pass.student_name),
            createElement("span", "", `Destination: ${pass.destination}`),
            createElement("span", "", `Date: ${formatTicketDate(pass.departure_time)}`),
            createElement("span", "", `Out: ${formatTicketTime(pass.departure_time)} - Returned: ${formatTicketTime(pass.return_time)}`),
            createElement("span", "", `Pass ID: ${pass.pass_code}`)
        );
        row.append(content, createElement("strong", "attendance-history-duration", formatDuration(pass.duration_seconds)), status);
        fragment.append(row);
    });

    passHistoryList.replaceChildren(fragment);
}

function renderAll() {
    renderActivePasses();
    renderHistory();
}

function startTimer() {
    window.clearInterval(tickTimer);
    tickTimer = window.setInterval(() => {
        getActivePasses().forEach((pass) => {
            const timer = qs(`[data-pass-timer="${pass.id}"]`);
            if (timer) {
                timer.textContent = formatDuration(getDurationSeconds(pass));
            }
        });
    }, 1000);
}

function createPass(event) {
    event.preventDefault();

    const formData = new FormData(passForm);
    const student = students.find((item) => item.id === formData.get("studentId"));
    const destination = getSelectedDestination(formData);
    const allowDuplicate = formData.get("allowDuplicate") === "on";

    if (!student) {
        setStatus("Choose a student before printing a pass.", "error");
        return;
    }

    if (!destination) {
        setStatus("Choose or enter a pass destination.", "error");
        return;
    }

    const existingPass = getActivePasses().find((pass) => pass.student_id === student.id);

    if (existingPass && !allowDuplicate) {
        showDuplicatePassModal(student, existingPass);
        return;
    }

    const now = new Date().toISOString();
    const pass = {
        id: createId(),
        pass_code: createPassCode(),
        student_id: student.id,
        student_name: getStudentName(student),
        student_period: student.class_period,
        teacher_id: currentProfile.id,
        teacher_name: getTeacherName(),
        class_id: "simulation",
        pass_type: formData.get("passType"),
        destination,
        room: ROOM_LABEL,
        departure_time: now,
        return_time: null,
        duration_seconds: null,
        status: "active",
        created_at: now,
        closed_by: null,
    };

    passes.push(pass);
    savePasses();
    renderAll();
    printPass(pass, () => {
        setStatus(`${pass.student_name} is out to ${pass.destination}. Pass ${pass.pass_code} printed.`, "success");
    });
    passForm.reset();
    otherDestinationField.hidden = true;
    updateScanResult(`Ready to scan ${pass.pass_code} when ${pass.student_name} returns.`);
    focusScannerSoon();
}

function closePass(pass, closedBy = "qr_scan") {
    const now = new Date().toISOString();

    pass.return_time = now;
    pass.duration_seconds = getDurationSeconds(pass, new Date(now).getTime());
    pass.status = "closed";
    pass.closed_by = closedBy;

    savePasses();
    renderAll();
    updateScanResult(`${pass.student_name} returned after ${formatDuration(pass.duration_seconds)}.`, "success");
    setStatus(`${pass.student_name} returned after ${formatDuration(pass.duration_seconds)}.`, "success");
    scannerInput.value = "";
    focusScannerSoon();
}

function closePassByCode(code, closedBy = "qr_scan") {
    const scannedCode = String(code || "").trim().toUpperCase();
    const pass = getActivePasses().find((item) => item.pass_code.toUpperCase() === scannedCode);

    if (!scannedCode) {
        updateScanResult("Scan or type a pass ID first.", "error");
        return;
    }

    if (!pass) {
        const closedMatch = passes.find((item) => item.pass_code.toUpperCase() === scannedCode);
        updateScanResult(
            closedMatch ? `${scannedCode} was already closed.` : `No active pass found for ${scannedCode}.`,
            "error"
        );
        setStatus(closedMatch ? "That pass was already closed." : "No active pass matched that scan.", "error");
        scannerInput.value = "";
        focusScannerSoon();
        return;
    }

    closePass(pass, closedBy);
}

function closeModal(overlay) {
    overlay.remove();
    focusScannerSoon();
}

function showDuplicatePassModal(student, existingPass) {
    const body = createElement("div", "join-confirm-body");
    const cancelButton = createButton("Cancel");
    const overrideButton = createButton("Print anyway", { variant: "primary" });
    const overlay = createModalShell({
        title: "Student already has an active pass",
        body,
        actions: [cancelButton, overrideButton],
    });

    body.append(
        createElement("strong", "", `${getStudentName(student)} is already out to ${existingPass.destination}.`),
        createElement("p", "", "Turn on the override checkbox if you need to issue another pass.")
    );

    cancelButton.addEventListener("click", () => closeModal(overlay));
    overrideButton.addEventListener("click", () => {
        passForm.elements.allowDuplicate.checked = true;
        closeModal(overlay);
    });

    document.body.append(overlay);
}

function confirmManualClose(pass) {
    const body = createElement("div", "join-confirm-body");
    const cancelButton = createButton("Cancel");
    const closeButton = createButton("Close pass", { destructive: true });
    const overlay = createModalShell({
        title: "Close pass?",
        body,
        actions: [cancelButton, closeButton],
    });

    body.append(
        createElement("strong", "", `${pass.student_name} - ${pass.destination}`),
        createElement("p", "", "Use this when the student returned but the QR scan was missed.")
    );

    cancelButton.addEventListener("click", () => closeModal(overlay));
    closeButton.addEventListener("click", () => {
        closePass(pass, "teacher");
        closeModal(overlay);
    });

    document.body.append(overlay);
}

function confirmClearHistory() {
    const closedCount = getClosedPasses().length;

    if (!closedCount) {
        setStatus("There is no pass history to clear.", "info");
        return;
    }

    const body = createElement("div", "join-confirm-body");
    const cancelButton = createButton("Cancel");
    const clearButton = createButton("Clear history", { destructive: true });
    const overlay = createModalShell({
        title: "Clear pass history?",
        body,
        actions: [cancelButton, clearButton],
    });

    body.append(
        createElement("strong", "", `${closedCount} closed passes will be removed from this browser.`),
        createElement("p", "", "Active passes will stay visible.")
    );

    cancelButton.addEventListener("click", () => closeModal(overlay));
    clearButton.addEventListener("click", () => {
        passes = passes.filter((pass) => pass.status === "active");
        savePasses();
        renderAll();
        closeModal(overlay);
        setStatus("Pass history cleared.", "success");
    });

    document.body.append(overlay);
}

function handleScannerSubmit(event) {
    event.preventDefault();
    closePassByCode(new FormData(scannerForm).get("passCode"), "qr_scan");
}

function handlePassTypeChange() {
    otherDestinationField.hidden = passTypeSelect.value !== "Other";
    if (!otherDestinationField.hidden) {
        otherDestinationField.querySelector("input")?.focus();
    }
}

function initializeEvents() {
    if (eventsInitialized) {
        return;
    }

    eventsInitialized = true;
    passForm.addEventListener("submit", createPass);
    scannerForm.addEventListener("submit", handleScannerSubmit);
    passTypeSelect.addEventListener("change", handlePassTypeChange);
    clearHistoryButton.addEventListener("click", confirmClearHistory);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            focusScannerSoon();
        }
    });
}

async function initializeAttendanceApp() {
    const profile = await withTimeout(loadAttendanceProfile(), 8000, "Attendance profile load");

    currentProfile = profile || {
        id: "simulation-teacher",
        platform_role: "teacher",
        account_status: "active",
        username: "Teacher",
    };

    if (!isTeachingRole(currentProfile.platform_role)) {
        setStatus("Attendance is available from teacher profiles.", "error");
        return;
    }

    await withTimeout(loadStudents(), 8000, "Attendance roster load");
    loadPasses();
    populateStudentOptions();
    initializeEvents();
    renderAll();
    startTimer();
    setStatus(`${rosterStatusMessage} Hardware is simulated with browser print and the scanner input.`, rosterStatusTone);
    focusScannerSoon();
}

try {
    await initializeAttendanceApp();
} catch (error) {
    console.error("Attendance app could not initialize.", error);
    currentProfile = currentProfile || {
        id: "simulation-teacher",
        platform_role: "teacher",
        account_status: "active",
        username: "Teacher",
    };
    students = readJson(getProfileKey(STUDENTS_STORAGE_PREFIX), DEFAULT_STUDENTS).filter((student) => student.active !== false);
    loadPasses();
    populateStudentOptions();
    initializeEvents();
    renderAll();
    startTimer();
    setStatus("Attendance loaded in simulation mode because the teacher roster could not be reached.", "warning");
    focusScannerSoon();
}
