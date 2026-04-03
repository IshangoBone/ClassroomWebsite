const engineeringModules = [
    ["Engineering Mindset and Design Thinking", "Start with the habits, vocabulary, and mindset engineers use to define problems and create solutions.", [
        "What Is Engineering Design?",
        "How Engineers Solve Problems",
        "Design Thinking in Real Contexts",
        "Engineering Habits of Mind",
        "Systems, Needs, and Users",
        "Module 1 Review and Reflection"
    ]],
    ["The Engineering Design Process", "Build a clear picture of the full design cycle from problem identification through iteration.", [
        "Steps in the Design Process",
        "Defining the Problem Clearly",
        "Research Before Designing",
        "Generating Early Solution Paths",
        "Why Iteration Matters",
        "Module 2 Review and Reflection"
    ]],
    ["Criteria, Constraints, and Trade-Offs", "Learn how good designs are shaped by limits, goals, and informed compromises.", [
        "What Are Design Criteria?",
        "Understanding Constraints",
        "Recognizing Trade-Offs",
        "Balancing Competing Needs",
        "Writing a Design Brief",
        "Module 3 Review and Reflection"
    ]],
    ["Brainstorming and Idea Generation", "Develop strategies for generating, comparing, and refining early solution ideas.", [
        "Brainstorming Rules and Norms",
        "Divergent vs. Convergent Thinking",
        "SCAMPER and Creative Idea Tools",
        "Selecting Promising Concepts",
        "Decision Matrices for Ideas",
        "Module 4 Review and Reflection"
    ]],
    ["Sketching and Visual Communication", "Use sketches to communicate ideas clearly before building physical or digital models.", [
        "Why Engineers Sketch",
        "Thumbnail Sketches and Variations",
        "Annotated Concept Sketches",
        "Perspective and Form Basics",
        "Communicating Design Intent",
        "Module 5 Review and Reflection"
    ]],
    ["Measurement and Precision", "Build confidence with measuring tools, units, tolerances, and precision in design work.", [
        "Units, Scale, and Conversion",
        "Using Measuring Tools Accurately",
        "Precision vs. Accuracy",
        "Tolerance in Design",
        "Dimensioning Basics",
        "Module 6 Review and Reflection"
    ]],
    ["Technical Drawing Fundamentals", "Introduce the conventions engineers use to create readable technical drawings.", [
        "Orthographic Views",
        "Isometric Drawing Basics",
        "Line Types and Drawing Standards",
        "Dimensioning Technical Drawings",
        "Reading Engineering Drawings",
        "Module 7 Review and Reflection"
    ]],
    ["Materials and Material Properties", "Explore how material choice affects strength, cost, durability, and manufacturability.", [
        "Common Engineering Materials",
        "Strength, Flexibility, and Toughness",
        "Selecting Materials for Purpose",
        "Cost and Sustainability in Materials",
        "Material Testing Concepts",
        "Module 8 Review and Reflection"
    ]],
    ["Tools, Equipment, and Safety", "Build foundational knowledge of shop safety, tool use, and productive engineering habits.", [
        "Safety Mindset in the Lab",
        "Hand Tools and Their Uses",
        "Power Tools and Best Practices",
        "Workspace Organization",
        "Planning Safe Build Procedures",
        "Module 9 Review and Reflection"
    ]],
    ["Prototyping Foundations", "Learn why engineers prototype and how different prototype types serve different purposes.", [
        "What Makes a Good Prototype?",
        "Low-Fidelity vs. High-Fidelity Models",
        "Rapid Prototyping Strategies",
        "Choosing Materials for Prototypes",
        "Documenting Prototype Decisions",
        "Module 10 Review and Reflection"
    ]],
    ["Testing and Data Collection", "Use testing plans and evidence to evaluate designs more objectively.", [
        "Why Testing Matters",
        "Planning a Fair Test",
        "Collecting Quantitative Data",
        "Collecting Qualitative Feedback",
        "Interpreting Test Results",
        "Module 11 Review and Reflection"
    ]],
    ["Iteration and Improvement", "Use evidence from testing to revise and improve design solutions.", [
        "Identifying Design Weaknesses",
        "Using Feedback to Improve",
        "Revising with Purpose",
        "Comparing Versions of a Design",
        "Knowing When to Iterate Again",
        "Module 12 Review and Reflection"
    ]],
    ["Structures and Stability", "Study how forces, supports, and geometry influence stable structures.", [
        "Loads and Forces in Structures",
        "Compression and Tension",
        "Triangulation and Stability",
        "Trusses and Structural Systems",
        "Failure Analysis in Structures",
        "Module 13 Review and Reflection"
    ]],
    ["Forces, Motion, and Mechanics", "Connect force and motion concepts to practical engineering systems and designs.", [
        "Net Force and Balanced Systems",
        "Motion in Designed Systems",
        "Friction and Surface Interaction",
        "Simple Mechanical Advantage",
        "Using Force Analysis in Design",
        "Module 14 Review and Reflection"
    ]],
    ["Mechanisms and Motion Transfer", "Explore mechanisms that move, rotate, link, and transfer force through a system.", [
        "Levers and Linkages",
        "Pulleys and Belt Systems",
        "Gears and Gear Ratios",
        "Cams and Cranks",
        "Choosing the Right Mechanism",
        "Module 15 Review and Reflection"
    ]],
    ["Energy and Power Systems", "Examine how energy is generated, transferred, transformed, and used in engineered solutions.", [
        "Forms of Energy in Systems",
        "Power and Efficiency",
        "Energy Transfer Pathways",
        "Losses and Waste in Systems",
        "Designing for Better Efficiency",
        "Module 16 Review and Reflection"
    ]],
    ["Electrical and Electronic Basics", "Introduce the fundamentals of circuits, components, and electrical thinking for modern design.", [
        "Current, Voltage, and Resistance",
        "Simple Circuits and Components",
        "Series and Parallel Concepts",
        "Sensors and Inputs",
        "Electrical Safety and Troubleshooting",
        "Module 17 Review and Reflection"
    ]],
    ["Manufacturing and Production", "Study how designs move from prototype to scaled production and manufacturing workflows.", [
        "From Prototype to Production",
        "Manufacturing Processes Overview",
        "Quality Control Basics",
        "Assembly Planning",
        "Designing for Manufacturability",
        "Module 18 Review and Reflection"
    ]],
    ["Reverse Engineering", "Learn from existing products by analyzing their parts, functions, and decisions.", [
        "What Reverse Engineering Reveals",
        "Taking Products Apart Systematically",
        "Identifying Design Choices",
        "Comparing Alternatives and Improvements",
        "Documenting Findings from Teardowns",
        "Module 19 Review and Reflection"
    ]],
    ["Human-Centered Design", "Focus on empathy, usability, and the needs of the people a design is meant to serve.", [
        "Designing for Real Users",
        "Empathy and User Needs",
        "Accessibility in Design",
        "Usability Testing Basics",
        "Iterating from User Feedback",
        "Module 20 Review and Reflection"
    ]],
    ["Sustainable and Ethical Design", "Explore environmental responsibility and ethical decision making in engineering.", [
        "Sustainability in Engineering",
        "Life Cycle Thinking",
        "Waste, Reuse, and Materials Choices",
        "Ethics in Engineering Decisions",
        "Designing for Long-Term Impact",
        "Module 21 Review and Reflection"
    ]],
    ["CAD Foundations", "Introduce computer-aided design as a digital extension of engineering communication and modeling.", [
        "What CAD Is Used For",
        "Navigating a CAD Workspace",
        "Sketching in CAD",
        "Constraints and Dimensions in CAD",
        "Turning Ideas into Digital Models",
        "Module 22 Review and Reflection"
    ]],
    ["3D Modeling and Design Refinement", "Build stronger digital models and connect them to prototyping and revision.", [
        "Extrudes, Cuts, and Features",
        "Refining a 3D Model",
        "Modeling for Accuracy",
        "Preparing Models for Prototyping",
        "Using CAD to Compare Alternatives",
        "Module 23 Review and Reflection"
    ]],
    ["Documentation and Design Notebooks", "Use engineering notebooks and documentation to track thinking, decisions, and evidence.", [
        "Why Engineers Document Their Work",
        "Notebook Entries and Organization",
        "Capturing Sketches and Data",
        "Recording Decisions and Changes",
        "Building a Strong Design Record",
        "Module 24 Review and Reflection"
    ]],
    ["Teamwork and Project Management", "Develop collaboration habits that help teams plan, divide work, and deliver stronger projects.", [
        "Roles on an Engineering Team",
        "Task Planning and Milestones",
        "Collaboration and Accountability",
        "Managing Time and Scope",
        "Handling Team Challenges",
        "Module 25 Review and Reflection"
    ]],
    ["Engineering Communication and Presentation", "Present technical work clearly through visuals, speaking, writing, and evidence.", [
        "Communicating Design Ideas Clearly",
        "Presentation Structure for Engineering",
        "Using Visuals to Support Explanation",
        "Justifying Design Decisions",
        "Responding to Questions and Critique",
        "Module 26 Review and Reflection"
    ]],
    ["Decision Making in Complex Design Challenges", "Pull together engineering tools to evaluate choices and make stronger design decisions.", [
        "Defining a Complex Design Challenge",
        "Evaluating Multiple Paths",
        "Comparing Evidence and Trade-Offs",
        "Selecting the Best-Fit Solution",
        "Defending a Final Recommendation",
        "Module 27 Review and Reflection"
    ]],
    ["Robotics and Control Concepts", "Introduce automation, control systems, sensors, and feedback in engineered systems.", [
        "What Makes a System Autonomous",
        "Inputs, Outputs, and Feedback",
        "Sensors in Engineering Systems",
        "Control Logic Basics",
        "Testing Automated Behavior",
        "Module 28 Review and Reflection"
    ]],
    ["Systems Thinking and Integration", "See how subsystems interact and why strong designs depend on successful integration.", [
        "Subsystems and Whole Systems",
        "Interfaces Between Components",
        "Integration Challenges",
        "Troubleshooting Across a System",
        "Designing for Reliability",
        "Module 29 Review and Reflection"
    ]],
    ["Capstone Engineering Studio", "Apply the full course progression to larger design challenges, portfolios, and final presentations.", [
        "Choosing a Capstone Problem",
        "Planning a Complete Design Pathway",
        "Building and Testing the Capstone",
        "Iterating the Final Solution",
        "Presenting the Final Design",
        "Final Reflection and Course Wrap-Up"
    ]]
];

window.engineeringCourse = {
    courseId: "engineering-design",
    courseTitle: "Intro to Engineering Design",
    coursePage: "course-engineering-design.html",
    lessonPage: "lesson-engineering-design.html",
    modules: engineeringModules.map((module, moduleIndex) => {
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
                    id: `eng-m${String(moduleIndex + 1).padStart(2, "0")}-l${String(lessonIndex + 1).padStart(2, "0")}`,
                    number,
                    title: lessonTitle,
                    summary: isReview
                        ? `Review the major ideas from ${title} and reflect on how they strengthen engineering thinking.`
                        : `Build understanding of ${lessonTitle.toLowerCase()} as part of ${title}.`
                };
            })
        };
    })
};

window.currentCourseData = window.engineeringCourse;
