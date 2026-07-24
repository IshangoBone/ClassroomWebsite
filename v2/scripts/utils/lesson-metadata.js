const LESSON_METADATA_PREFIX = "BK_LESSON_META_V1:";

export function encodeLessonMetadata(lesson) {
    return `${LESSON_METADATA_PREFIX}${JSON.stringify({
        overview: String(lesson.overview || "").trim(),
        learningTarget: String(lesson.learningTarget || "").trim(),
        essentialQuestion: String(lesson.essentialQuestion || "").trim(),
        standards: Array.isArray(lesson.standards) ? lesson.standards : [],
        instructionalStrategies: Array.isArray(lesson.instructionalStrategies)
            ? lesson.instructionalStrategies
            : [],
    })}`;
}

export function getLessonMetadata(lesson) {
    const summary = String(lesson?.summary || "");
    if (!summary.startsWith(LESSON_METADATA_PREFIX)) {
        return {
            overview: summary.trim(),
            learningTarget: "",
            essentialQuestion: "",
            standards: [],
            instructionalStrategies: [],
        };
    }

    try {
        const metadata = JSON.parse(summary.slice(LESSON_METADATA_PREFIX.length));
        return {
            overview: String(metadata.overview || "").trim(),
            learningTarget: String(metadata.learningTarget || "").trim(),
            essentialQuestion: String(metadata.essentialQuestion || "").trim(),
            standards: Array.isArray(metadata.standards) ? metadata.standards : [],
            instructionalStrategies: Array.isArray(metadata.instructionalStrategies)
                ? metadata.instructionalStrategies
                : [],
        };
    } catch {
        return {
            overview: "",
            learningTarget: "",
            essentialQuestion: "",
            standards: [],
            instructionalStrategies: [],
        };
    }
}

export function getLessonOverview(lesson) {
    return getLessonMetadata(lesson).overview;
}

export function formatStandardsAlignment(standards) {
    return standards
        .map((standard) => {
            const code = String(standard.code || "Standard").trim();
            const description = String(standard.description || "").trim();
            return description ? `${code}\n${description}` : code;
        })
        .filter(Boolean)
        .join("\n\n");
}
