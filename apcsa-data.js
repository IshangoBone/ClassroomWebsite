const apcsaModules = [
    ["Java Setup and Program Structure", "Start with the foundations of Java program organization, execution, and reading code with confidence.", [
        "What Makes a Java Program Run",
        "Classes, Main, and Program Entry",
        "Statements, Blocks, and Syntax",
        "Reading Simple Java Programs",
        "Common Beginner Java Errors",
        "Module 1 Review and Reflection"
    ]],
    ["Variables and Primitive Data Types", "Build the foundation for Java variables, values, and primitive types used throughout AP CSA.", [
        "Declaring Variables in Java",
        "int, double, and boolean Basics",
        "Assignment and Updating Values",
        "Type Rules and Mismatches",
        "Variable Naming and Readability",
        "Module 2 Review and Reflection"
    ]],
    ["Expressions and Math", "Use operators and expressions to calculate, compare, and reason through Java programs.", [
        "Arithmetic Operators in Java",
        "Compound Assignment and Incrementing",
        "Order of Operations in Java",
        "Casting and Numeric Conversion",
        "Writing Useful Math Expressions",
        "Module 3 Review and Reflection"
    ]],
    ["Input, Output, and String Formatting", "Work with printed output, concatenation, and readable program interaction.", [
        "Printing Text and Values",
        "String Concatenation Basics",
        "Mixing Strings and Variables",
        "Formatting Output Clearly",
        "Tracing Output Statements",
        "Module 4 Review and Reflection"
    ]],
    ["Boolean Logic and Relational Operators", "Prepare for selection and control flow by building stronger reasoning with conditions and comparisons.", [
        "Relational Operators in Java",
        "Boolean Expressions",
        "Logical Operators and Combination",
        "Truth Tables and Evaluation",
        "Common Condition Mistakes",
        "Module 5 Review and Reflection"
    ]],
    ["if Statements", "Introduce simple and two-way decision making in Java.", [
        "Single-Alternative if Statements",
        "if-else Structures",
        "Comparing Branch Outcomes",
        "Writing Clear Conditions",
        "Tracing Decision Flow",
        "Module 6 Review and Reflection"
    ]],
    ["Nested and Chained Conditionals", "Move into more complex branching using nested logic and else-if chains.", [
        "Nested if Statements",
        "else-if Chains",
        "Comparing Multi-Branch Logic",
        "Designing Better Condition Order",
        "Debugging Conditional Paths",
        "Module 7 Review and Reflection"
    ]],
    ["Iteration with while", "Learn repetition with while loops and condition-based control.", [
        "Why while Loops Matter",
        "Building a Basic while Loop",
        "Loop Variables and Updates",
        "Preventing Infinite Loops",
        "Tracing while Loop Behavior",
        "Module 8 Review and Reflection"
    ]],
    ["Iteration with for", "Use for loops when a count-controlled pattern is the better fit.", [
        "Anatomy of a for Loop",
        "Counter-Controlled Repetition",
        "Comparing while and for",
        "Loop Scope and Variables",
        "Writing Better for Loops",
        "Module 9 Review and Reflection"
    ]],
    ["Nested Loops and Loop Patterns", "Strengthen repetition thinking through nested loops and more advanced patterns.", [
        "Nested Loop Structure",
        "Tracing Nested Loops",
        "Pattern Generation with Loops",
        "Loop Efficiency and Readability",
        "Avoiding Nested Loop Errors",
        "Module 10 Review and Reflection"
    ]],
    ["Methods and Decomposition", "Break larger Java programs into reusable and meaningful methods.", [
        "Why Methods Improve Programs",
        "Method Signatures and Calls",
        "Void Methods",
        "Breaking Problems into Methods",
        "Tracing Method Execution",
        "Module 11 Review and Reflection"
    ]],
    ["Parameters and Return Values", "Use parameters and returns to move data into and out of methods.", [
        "Parameters and Arguments",
        "Methods with Return Values",
        "Using Returned Results",
        "Choosing Parameter Types",
        "Designing Helpful Methods",
        "Module 12 Review and Reflection"
    ]],
    ["Strings", "Work with String objects and common AP CSA String operations.", [
        "String Object Basics",
        "String Methods You Need",
        "Length and Substring",
        "Comparing Strings Correctly",
        "String Traversal Ideas",
        "Module 13 Review and Reflection"
    ]],
    ["Arrays", "Introduce indexed collections and array fundamentals in Java.", [
        "Why Arrays Are Useful",
        "Declaring and Initializing Arrays",
        "Accessing Array Elements",
        "Updating Array Values",
        "Array Bounds and Common Errors",
        "Module 14 Review and Reflection"
    ]],
    ["Array Traversal", "Use loops to move through arrays with consistent patterns.", [
        "Traversing Arrays with for",
        "Enhanced for Loops",
        "Accumulating Array Results",
        "Counting and Filtering Patterns",
        "Tracing Array Traversals",
        "Module 15 Review and Reflection"
    ]],
    ["Array Algorithms", "Apply AP-style array logic for searching, counting, and transformation.", [
        "Searching Arrays",
        "Finding Extremes",
        "Counting Matches in Arrays",
        "Updating Arrays with Rules",
        "Comparing Array Algorithm Choices",
        "Module 16 Review and Reflection"
    ]],
    ["ArrayList", "Shift to dynamic lists and object-based collections.", [
        "What Makes ArrayList Different",
        "Adding and Removing Elements",
        "Getting and Setting Values",
        "Traversing an ArrayList",
        "ArrayList Method Patterns",
        "Module 17 Review and Reflection"
    ]],
    ["2D Arrays", "Organize and process table-like data with nested array structures.", [
        "2D Array Structure",
        "Rows, Columns, and Indexing",
        "Traversing 2D Arrays",
        "Common 2D Array Algorithms",
        "Tracing Table-Based Logic",
        "Module 18 Review and Reflection"
    ]],
    ["Classes and Objects", "Introduce object-oriented thinking through classes and object creation.", [
        "Classes as Blueprints",
        "Creating Objects",
        "State and Behavior",
        "Using Reference Variables",
        "Reading Object-Based Code",
        "Module 19 Review and Reflection"
    ]],
    ["Constructors and Instance Variables", "Build class definitions that initialize and store meaningful object state.", [
        "What Constructors Do",
        "Instance Variables",
        "Initializing Object State",
        "Constructor Parameters",
        "Tracing Object Creation",
        "Module 20 Review and Reflection"
    ]],
    ["Methods and Encapsulation", "Write stronger class behavior and protect object design through encapsulation.", [
        "Accessor and Mutator Methods",
        "Encapsulation Basics",
        "Designing Useful Class Methods",
        "Using this in Methods",
        "Class Design Best Practices",
        "Module 21 Review and Reflection"
    ]],
    ["Object Interaction", "See how multiple objects work together inside larger Java programs.", [
        "Objects Calling Methods",
        "Passing Objects as Parameters",
        "Composing Objects Together",
        "Object State Over Time",
        "Tracing Multi-Object Interactions",
        "Module 22 Review and Reflection"
    ]],
    ["Inheritance and Polymorphism", "Explore AP CSA inheritance relationships and the behavior they create.", [
        "Superclass and Subclass Basics",
        "Inherited Fields and Methods",
        "Method Overriding",
        "Using super",
        "Polymorphism in Context",
        "Module 23 Review and Reflection"
    ]],
    ["Recursion", "Learn recursive thinking and base-case reasoning for AP-style recursive methods.", [
        "What Recursion Means",
        "Base Cases and Recursive Calls",
        "Tracing Recursive Methods",
        "Comparing Recursion and Iteration",
        "Common Recursion Errors",
        "Module 24 Review and Reflection"
    ]],
    ["Searching and Sorting", "Study classic AP algorithms and the reasoning behind them.", [
        "Sequential Search",
        "Binary Search Thinking",
        "Selection Sort",
        "Insertion Sort",
        "Comparing Algorithm Efficiency",
        "Module 25 Review and Reflection"
    ]],
    ["Writing AP-Style Free Responses", "Prepare for AP free-response expectations by focusing on code writing and explanation.", [
        "Reading FRQ Prompts Carefully",
        "Planning Before You Code",
        "Writing Clear AP Responses",
        "Explaining Logic in Words",
        "Avoiding Common FRQ Mistakes",
        "Module 26 Review and Reflection"
    ]],
    ["Debugging and Code Analysis", "Improve the ability to spot errors, trace code, and reason through behavior quickly.", [
        "Compile-Time vs. Run-Time Errors",
        "Logic Errors in Java",
        "Tracing Code by Hand",
        "Debugging with Test Cases",
        "Reading Code for Intent",
        "Module 27 Review and Reflection"
    ]],
    ["Algorithm Analysis and Efficiency", "Think more intentionally about the cost and behavior of different coding strategies.", [
        "Why Efficiency Matters",
        "Comparing Different Solutions",
        "Trade-Offs in Program Design",
        "Efficiency in Loops and Arrays",
        "Choosing Better Algorithms",
        "Module 28 Review and Reflection"
    ]],
    ["Mixed AP Practice Labs", "Bring together major AP CSA ideas through integrated labs and mixed concept practice.", [
        "Combining Strings and Conditionals",
        "Methods with Arrays",
        "Objects with Collections",
        "Debugging Mixed Practice Code",
        "Designing AP-Style Mini Labs",
        "Module 29 Review and Reflection"
    ]],
    ["AP Exam Review and Final Preparation", "Close the course with targeted AP review, reflection, and final readiness work.", [
        "Multiple-Choice Review Strategies",
        "Free-Response Time Management",
        "Reviewing High-Yield Concepts",
        "Building an AP Study Plan",
        "Confidence and Exam Readiness",
        "Final Reflection and Course Wrap-Up"
    ]]
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
                const number = moduleIndex * 6 + lessonIndex + 1;
                const isReview = lessonIndex === 5;

                return {
                    id: `apcsa-m${String(moduleIndex + 1).padStart(2, "0")}-l${String(lessonIndex + 1).padStart(2, "0")}`,
                    number,
                    title: lessonTitle,
                    summary: isReview
                        ? `Review the major ideas from ${title} and reflect on how they support AP Computer Science A success.`
                        : `Build understanding of ${lessonTitle.toLowerCase()} as part of ${title}.`
                };
            })
        };
    })
};

window.currentCourseData = window.apcsaCourse;
