const apcsaModules = [
    [
        "Tips for Taking the Exam",
        "Start the course with AP Computer Science A exam strategy, multiple-choice habits, and free-response expectations.",
        [
            "Tips for Taking the Exam",
            "Tips for the Multiple-Choice Section",
            "What Is Tested?",
            "Time Management",
            "Guessing",
            "The Java Quick Reference",
            "An Active Pencil",
            "Troubleshooting—What’s Wrong with This Code?",
            "Loop Tracing",
            "Java Exceptions",
            "Matrix Manipulation",
            "Comparing Algorithms",
            "Mechanics of Answering Multiple-Choice Questions",
            "Tips for the Free-Response Section",
            "What Is the Format?",
            "What Is Tested?",
            "What Types of Questions Might Be Asked?",
            "Skill Focus in Free-Response Questions",
            "The Java Quick Reference",
            "Time Management",
            "Grading the Free-Response Questions",
            "Writing Code",
            "Maximizing Your Score"
        ]
    ],
    [
        "Introductory Java Language Features",
        "Build the Java foundations you need for AP CSA, including identifiers, types, operators, input/output, and control structures.",
        [
            "Packages and Classes",
            "Javadoc Comments",
            "Types and Identifiers",
            "Identifiers",
            "Built-in Types",
            "Storage of Numbers",
            "Hexadecimal and Octal Numbers",
            "Final Variables",
            "Operators",
            "Arithmetic Operators",
            "Relational Operators",
            "Logical Operators",
            "Assignment Operators",
            "Increment and Decrement Operators",
            "Operator Precedence",
            "Input/Output",
            "Input",
            "Output",
            "Escape Sequences",
            "Control Structures",
            "Decision-Making Control Structures",
            "Iteration",
            "Errors and Exceptions"
        ]
    ],
    [
        "Classes and Objects",
        "Move into object-oriented Java by working with classes, methods, references, scope, and parameters.",
        [
            "Objects",
            "Classes",
            "Public, Private, and Static Methods",
            "Headers",
            "Types of Methods",
            "Method Overloading",
            "Scope",
            "The this Keyword",
            "References",
            "Reference vs. Primitive Data Types",
            "The Null Reference",
            "Method Parameters"
        ]
    ],
    [
        "Inheritance and Polymorphism",
        "Study superclass-subclass relationships, dynamic binding, abstract classes, interfaces, and type behavior.",
        [
            "Inheritance",
            "Superclass and Subclass",
            "Inheritance Hierarchy",
            "Implementing Subclasses",
            "Declaring Subclass Objects",
            "Polymorphism",
            "Dynamic Binding (Late Binding)",
            "Using super in a Subclass",
            "Type Compatibility",
            "Downcasting",
            "Abstract Classes",
            "Interfaces"
        ]
    ],
    [
        "Some Standard Classes",
        "Strengthen Java fluency by working with Object, String, wrapper classes, Math, and random numbers.",
        [
            "The Object Class",
            "The Universal Superclass",
            "Methods in Object",
            "The String Class",
            "String Objects",
            "Constructing String Objects",
            "The Concatenation Operator",
            "Comparison of String Objects",
            "Other String Methods",
            "Special Emphasis",
            "Wrapper Classes",
            "The Integer Class",
            "The Double Class",
            "Autoboxing and Unboxing",
            "The Math Class",
            "Random Numbers"
        ]
    ],
    [
        "Program Design and Analysis",
        "Focus on software development, class design, UML, correctness, and analytical reasoning about programs.",
        [
            "Software Development",
            "Program Specification",
            "Program Design",
            "Program Implementation",
            "Testing and Debugging",
            "Program Maintenance",
            "Object-Oriented Program Design",
            "Identifying Classes",
            "Identifying Behaviors",
            "Determining Relationships Between Classes",
            "UML Diagrams",
            "Implementing Classes",
            "Implementing Methods",
            "Vocabulary Summary",
            "Program Analysis",
            "Program Correctness",
            "Assertions",
            "Efficiency"
        ]
    ],
    [
        "Arrays and Array Lists",
        "Build confidence with one-dimensional arrays, ArrayList, and two-dimensional arrays in AP-style problems.",
        [
            "One-Dimensional Arrays",
            "Initialization",
            "Length of Array",
            "Traversing a One-Dimensional Array",
            "Arrays as Parameters",
            "Array Variables in a Class",
            "Array of Class Objects",
            "Analyzing Array Algorithms",
            "Array Lists",
            "The ArrayList Class",
            "The Methods of ArrayList<E>",
            "Autoboxing and Unboxing",
            "Using ArrayList<E>",
            "Two-Dimensional Arrays",
            "Declarations",
            "Matrix as Array of Row Arrays",
            "Processing a Two-Dimensional Array",
            "Two-Dimensional Array as Parameter"
        ]
    ],
    [
        "Recursion",
        "Introduce recursive problem solving, recursive methods, and recursive algorithm analysis.",
        [
            "Recursive Methods",
            "General Form of Simple Recursive Methods",
            "Writing Recursive Methods",
            "Analysis of Recursive Methods",
            "Sorting Algorithms That Use Recursion",
            "Recursive Helper Methods",
            "Recursion in Two-Dimensional Grids",
            "Sample Free-Response Question 1",
            "Sample Free-Response Question 2"
        ]
    ],
    [
        "Sorting and Searching",
        "Close the sequence with classic sorting and searching algorithms that regularly appear in AP CSA preparation.",
        [
            "Sorts: Selection and Insertion Sorts",
            "Selection Sort",
            "Insertion Sort",
            "Recursive Sorts: Merge Sort and Quicksort",
            "Merge Sort",
            "Quicksort",
            "Sorting Algorithms in Java",
            "Sequential Search",
            "Binary Search",
            "Analysis of Binary Search"
        ]
    ]
];

window.apcsaCourse = {
    courseId: "ap-computer-science-a",
    courseTitle: "AP Computer Science A",
    coursePage: "course-ap-computer-science-a.html",
    lessonPage: "lesson-ap-computer-science-a.html",
    modules: apcsaModules.map((module, moduleIndex) => {
        const [title, overview, lessons] = module;

        return {
            id: `m${String(moduleIndex + 1).padStart(2, "0")}`,
            number: moduleIndex + 1,
            title,
            overview,
            lessons: lessons.map((lessonTitle, lessonIndex) => {
                const previousLessonCount = apcsaModules
                    .slice(0, moduleIndex)
                    .reduce((count, currentModule) => count + currentModule[2].length, 0);
                const number = previousLessonCount + lessonIndex + 1;

                return {
                    id: `apcsa-m${String(moduleIndex + 1).padStart(2, "0")}-l${String(lessonIndex + 1).padStart(2, "0")}`,
                    number,
                    title: lessonTitle,
                    summary: `Work through ${lessonTitle.toLowerCase()} as part of AP CSA Module ${moduleIndex + 1}: ${title}.`
                };
            })
        };
    })
};

window.currentCourseData = window.apcsaCourse;
