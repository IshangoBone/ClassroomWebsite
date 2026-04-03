const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const yearTarget = document.querySelector("[data-year]");
const contactForms = document.querySelectorAll(".contact-form");
const courseBrowser = document.querySelector("#course-browser");
const courseSearch = document.querySelector("#course-lesson-search");
const courseResultsNote = document.querySelector("#course-results-note");
const courseLessonPage = document.querySelector("#course-lesson-page");

if (yearTarget) {
    yearTarget.textContent = new Date().getFullYear();
}

if (navToggle && siteNav) {
    navToggle.addEventListener("click", () => {
        const isOpen = siteNav.classList.toggle("is-open");
        navToggle.setAttribute("aria-expanded", String(isOpen));
    });
}

contactForms.forEach((form) => {
    form.addEventListener("submit", (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const name = String(formData.get("name") || "").trim();
        const email = String(formData.get("email") || "").trim();
        const message = String(formData.get("message") || "").trim();
        const recipient = form.dataset.email || "";
        const subject = form.dataset.subject || "CodeTheCurrent Message";

        const body = [
            `Form Type: ${subject}`,
            `Name: ${name}`,
            `Email: ${email}`,
            "",
            "Message:",
            message
        ].join("\n");

        window.location.href =
            `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });
});

const currentCourse = window.currentCourseData;

if (currentCourse && courseBrowser) {
    const totalLessonCount = currentCourse.modules.reduce((count, module) => count + module.lessons.length, 0);

    const renderCourseBrowser = (query = "") => {
        const searchTerm = query.trim().toLowerCase();
        let visibleLessonCount = 0;

        const markup = currentCourse.modules.map((module) => {
            const lessons = module.lessons.filter((lesson) => {
                if (!searchTerm) {
                    return true;
                }

                const haystack = `${module.title} ${lesson.title} ${lesson.summary}`.toLowerCase();
                return haystack.includes(searchTerm);
            });

            if (searchTerm && lessons.length === 0) {
                return "";
            }

            visibleLessonCount += lessons.length;

            const lessonMarkup = lessons.map((lesson) => `
                <article class="lesson-row">
                    <div class="lesson-row-body">
                        <p class="lesson-row-number">Lesson ${String(lesson.number).padStart(2, "0")}</p>
                        <h3>${lesson.title}</h3>
                        <p>${lesson.summary}</p>
                    </div>
                    <a class="button button-primary button-small" href="${currentCourse.lessonPage}#${lesson.id}">Open lesson</a>
                </article>
            `).join("");

            return `
                <details class="module-block" ${searchTerm || module.number === 1 ? "open" : ""}>
                    <summary class="module-summary">
                        <div>
                            <p class="module-kicker">Module ${String(module.number).padStart(2, "0")}</p>
                            <h3>${module.title}</h3>
                            <p>${module.overview}</p>
                        </div>
                        <span class="module-count">${lessons.length} lessons</span>
                    </summary>
                    <div class="module-lessons">
                        ${lessonMarkup}
                    </div>
                </details>
            `;
        }).join("");

        const fallbackKeyword = currentCourse.courseId === "engineering-design"
            ? "prototype, sketch, CAD, testing, or materials"
            : currentCourse.courseId === "ap-computer-science-a"
                ? "array, loop, method, object, or recursion"
                : "algorithm, loop, variable, function, or debugging";

        courseBrowser.innerHTML = markup || `
            <div class="empty-state">
                <h3>No lessons matched your search.</h3>
                <p>Try a different keyword like ${fallbackKeyword}.</p>
            </div>
        `;

        if (courseResultsNote) {
            courseResultsNote.textContent = searchTerm
                ? `Showing ${visibleLessonCount} matching lessons.`
                : `Showing all ${totalLessonCount} lessons.`;
        }
    };

    renderCourseBrowser();

    if (courseSearch) {
        courseSearch.addEventListener("input", (event) => {
            renderCourseBrowser(event.target.value);
        });
    }
}

if (currentCourse && courseLessonPage) {
    const flatLessons = currentCourse.modules.flatMap((module) =>
        module.lessons.map((lesson) => ({
            ...lesson,
            moduleNumber: module.number,
            moduleTitle: module.title,
            objective: lesson.objective || lesson.summary,
            lessonSummary:
                lesson.lessonSummary ||
                `This lesson introduces ${lesson.title.toLowerCase()} as part of ${module.title}, helping students connect the concept to the bigger course pathway.`
        }))
    );

    const titleTarget = document.querySelector("#course-lesson-title");
    const summaryLineTarget = document.querySelector("#course-lesson-summary-line");
    const objectiveCardTarget = document.querySelector("#course-lesson-objective-card");
    const beforeQuestionsTarget = document.querySelector("#course-before-question-list");
    const duringQuestionsTarget = document.querySelector("#course-during-question-list");
    const reflectionQuestionsTarget = document.querySelector("#course-reflection-question-list");
    const breadcrumbTarget = document.querySelector("#course-breadcrumb-lesson");
    const moduleLabelTarget = document.querySelector("#course-lesson-module-label");
    const videoTitleTarget = document.querySelector("#course-video-title");
    const prevLink = document.querySelector("#course-prev-lesson");
    const nextLink = document.querySelector("#course-next-lesson");

    const renderCourseLesson = () => {
        const currentId = window.location.hash.replace("#", "") || flatLessons[0].id;
        const lessonIndex = flatLessons.findIndex((lesson) => lesson.id === currentId);
        const lesson = lessonIndex >= 0 ? flatLessons[lessonIndex] : flatLessons[0];
        const previousLesson = flatLessons[lessonIndex - 1];
        const nextLesson = flatLessons[lessonIndex + 1];

        document.title = `${lesson.title} | CodeTheCurrent`;

        if (titleTarget) {
            titleTarget.textContent = lesson.title;
        }

        if (summaryLineTarget) {
            summaryLineTarget.textContent = lesson.lessonSummary;
        }

        if (objectiveCardTarget) {
            objectiveCardTarget.textContent = lesson.objective;
        }

        if (breadcrumbTarget) {
            breadcrumbTarget.textContent = lesson.title;
        }

        if (moduleLabelTarget) {
            moduleLabelTarget.textContent = `Module ${String(lesson.moduleNumber).padStart(2, "0")} · ${lesson.moduleTitle}`;
        }

        if (videoTitleTarget) {
            videoTitleTarget.textContent = `${lesson.title} video placeholder`;
        }

        if (beforeQuestionsTarget) {
            beforeQuestionsTarget.innerHTML = [
                `Before watching, what do you already know about ${lesson.title.toLowerCase()}?`
            ].map((question) => `<li>${question}</li>`).join("");
        }

        if (duringQuestionsTarget) {
            duringQuestionsTarget.innerHTML = [
                `What is one key idea or term from ${lesson.title} that you should define in your own words?`,
                `How does ${lesson.title.toLowerCase()} connect to the larger module topic of ${lesson.moduleTitle}?`,
                `What example, process, or problem from the lesson best shows this concept in action?`
            ].map((question) => `<li>${question}</li>`).join("");
        }

        if (reflectionQuestionsTarget) {
            reflectionQuestionsTarget.innerHTML = [
                `After the lesson, what did you learn about ${lesson.title.toLowerCase()}, and why does it matter in ${currentCourse.courseTitle.toLowerCase()}?`
            ].map((question) => `<li>${question}</li>`).join("");
        }

        if (prevLink) {
            if (previousLesson) {
                prevLink.href = `${currentCourse.lessonPage}#${previousLesson.id}`;
                prevLink.textContent = "Previous lesson";
            } else {
                prevLink.href = currentCourse.coursePage;
                prevLink.textContent = "Back to course";
            }
        }

        if (nextLink) {
            if (nextLesson) {
                nextLink.href = `${currentCourse.lessonPage}#${nextLesson.id}`;
                nextLink.textContent = "Next lesson";
            } else {
                nextLink.href = currentCourse.coursePage;
                nextLink.textContent = "Back to course";
            }
        }
    };

    renderCourseLesson();
    window.addEventListener("hashchange", renderCourseLesson);
}
