const introCsModules = [
    [
        "Introduction to Computers and Programming",
        "Start with the foundations of computing, hardware, software, data, and the way a program works.",
        [
            "Introduction",
            "Hardware",
            "How Computers Store Data",
            "How a Program Works",
            "Types of Software"
        ]
    ],
    [
        "Input, Processing, and Output",
        "Build the programming foundation for program design, variables, calculations, data types, and language comparisons.",
        [
            "Designing a Program",
            "Output, Input, and Variables",
            "Variable Assignment and Calculations",
            "Variable Declarations and Data Types",
            "Named Constants",
            "Hand Tracing a Program",
            "Documenting a Program",
            "Designing Your First Program",
            "Focus on Languages: Java, Python, and C++"
        ]
    ],
    [
        "Decision Structures and Boolean Logic",
        "Move into program decisions, string comparisons, nested logic, case structures, and Boolean reasoning.",
        [
            "Introduction to Decision Structures",
            "Dual Alternative Decision Structures",
            "Comparing Strings",
            "Nested Decision Structures",
            "The Case Structure",
            "Logical Operators",
            "Boolean Variables",
            "Focus on Languages: Java, Python, and C++"
        ]
    ],
    [
        "Repetition Structures",
        "Explore loops, repetition patterns, sentinels, running totals, and nested loop design.",
        [
            "Introduction to Repetition Structures",
            "Condition-Controlled Loops: While, Do-While, and Do-Until",
            "Count-Controlled Loops and the For Statement",
            "Calculating a Running Total",
            "Sentinels",
            "Nested Loops",
            "Focus on Languages: Java, Python, and C++"
        ]
    ],
    [
        "Modules",
        "Break larger programs into reusable modules and work with arguments, local scope, and global values.",
        [
            "Introduction to Modules",
            "Defining and Calling a Module",
            "Local Variables",
            "Passing Arguments to Modules",
            "Global Variables and Global Constants",
            "Focus on Languages: Java, Python, and C++"
        ]
    ],
    [
        "Functions",
        "Introduce functions, library tools, random number generation, and stronger modular program design.",
        [
            "Introduction to Functions: Generating Random Numbers",
            "Writing Your Own Functions",
            "More Library Functions",
            "Focus on Languages: Java, Python, and C++"
        ]
    ],
    [
        "Input Validation",
        "Focus on validation loops, defensive programming, and preventing bad data from entering a program.",
        [
            "Garbage In, Garbage Out",
            "The Input Validation Loop",
            "Defensive Programming",
            "Focus on Languages: Java, Python, and C++"
        ]
    ],
    [
        "Arrays",
        "Introduce arrays, array processing, searching, and multi-dimensional storage structures.",
        [
            "Array Basics",
            "Sequentially Searching an Array",
            "Processing the Contents of an Array",
            "Parallel Arrays",
            "Two-Dimensional Arrays",
            "Arrays of Three or More Dimensions",
            "Focus on Languages: Java, Python, and C++"
        ]
    ],
    [
        "Sorting and Searching Arrays",
        "Strengthen algorithmic reasoning with classic sorting and searching techniques.",
        [
            "The Bubble Sort Algorithm",
            "The Selection Sort Algorithm",
            "The Insertion Sort Algorithm",
            "The Binary Search Algorithm",
            "Focus on Languages: Java, Python, and C++"
        ]
    ],
    [
        "Files",
        "Learn file input and output, records, control break logic, and file-based data processing.",
        [
            "Introduction to File Input and Output",
            "Using Loops to Process Files",
            "Using Files and Arrays",
            "Processing Records",
            "Control Break Logic",
            "Focus on Languages: Java, Python, and C++"
        ]
    ],
    [
        "Menu-Driven Programs",
        "Build structured menu-driven applications with modular design and repeated menu loops.",
        [
            "Introduction to Menu-Driven Programs",
            "Modularizing a Menu-Driven Program",
            "Using a Loop to Repeat the Menu",
            "Multiple-Level Menus",
            "Focus on Languages: Java, Python, and C++"
        ]
    ],
    [
        "Text Processing",
        "Work with text one character at a time and apply text validation and formatting strategies.",
        [
            "Introduction",
            "Character-by-Character Text Processing",
            "Focus on Languages: Java, Python, and C++"
        ]
    ],
    [
        "Recursion",
        "Introduce recursive thinking, recursive problem solving, and recursive algorithm design.",
        [
            "Introduction to Recursion",
            "Problem Solving with Recursion",
            "Examples of Recursive Algorithms",
            "Focus on Languages: Java, Python, and C++"
        ]
    ],
    [
        "Object-Oriented Programming",
        "Shift into classes, UML, responsibilities, inheritance, and polymorphism.",
        [
            "Procedural and Object-Oriented Programming",
            "Classes",
            "Using the Unified Modeling Language to Design Classes",
            "Finding the Classes and Their Responsibilities in a Problem",
            "Inheritance",
            "Polymorphism",
            "Focus on Languages: Java, Python, and C++"
        ]
    ],
    [
        "GUI Applications and Event-Driven Programming",
        "Close the course with user interface design, event handlers, GUI applications, and mobile app thinking.",
        [
            "Graphical User Interfaces",
            "Designing the User Interface for a GUI Program",
            "Writing Event Handlers",
            "Designing Apps for Mobile Devices",
            "Focus on Languages: Java, Python, and C++"
        ]
    ]
];

window.introCsCourse = {
    courseId: "intro-computer-science",
    courseTitle: "Intro to Computer Science",
    coursePage: "course-intro-computer-science.html",
    lessonPage: "lesson-intro-computer-science.html",
    modules: introCsModules.map((module, moduleIndex) => {
        const [title, overview, lessons] = module;

        return {
            id: `m${String(moduleIndex + 1).padStart(2, "0")}`,
            number: moduleIndex + 1,
            title,
            overview,
            lessons: lessons.map((lessonTitle, lessonIndex) => {
                const previousLessonCount = introCsModules
                    .slice(0, moduleIndex)
                    .reduce((count, currentModule) => count + currentModule[2].length, 0);
                const number = previousLessonCount + lessonIndex + 1;

                return {
                    id: `ics-m${String(moduleIndex + 1).padStart(2, "0")}-l${String(lessonIndex + 1).padStart(2, "0")}`,
                    number,
                    title: lessonTitle,
                    summary: `Work through ${lessonTitle.toLowerCase()} as part of Chapter ${moduleIndex + 1}: ${title}.`
                };
            })
        };
    })
};

window.currentCourseData = window.introCsCourse;
