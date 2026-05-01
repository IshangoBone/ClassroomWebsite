const engineeringModules = [
    ["Overview and History of Engineering", "Build context for engineering by studying the history, disciplines, and long-term impact of engineered systems.", [
        "Introduction",
        "The Mesopotamians and Early Engineering",
        "The Egyptians and Monument Construction",
        "The Greeks and Classical Innovation",
        "The Romans and Infrastructure",
        "The Middle Ages",
        "Engineering Pioneers",
        "Engineering, Science, Technology, and Art",
        "The Age of Transportation",
        "Steam Engines and Industrial Transport",
        "Canals, Roads, and Transportation Systems",
        "The Age of Electricity",
        "Engineering Societies and the Engineering Profession",
        "Preparing for the Field of Engineering"
    ]],
    ["Design Tools", "Use brainstorming, sketching, modeling, and presentation tools to communicate and refine design ideas.", [
        "Introduction",
        "Design Process",
        "Brainstorming Ideas",
        "Group vs. Individual Brainstorming",
        "Traditional Group Brainstorm Guidelines",
        "Alternative Brainstorming Methods",
        "Documenting a Brainstorming Session",
        "Sketching Fundamentals",
        "Pictorial Sketches",
        "Multiview Sketches",
        "Computer-Aided Design Applications",
        "Presentation Tools and Public Speaking"
    ]],
    ["Mechanical Advantage", "Study the force relationships behind simple and compound machines and how engineers use them to multiply effort.", [
        "Introduction",
        "Force, Work, and Power",
        "Mechanical Advantage",
        "Ideal Mechanical Advantage",
        "Actual Mechanical Advantage",
        "Simple Machines",
        "The Inclined Plane",
        "The Wedge",
        "The Lever",
        "Compound Machines",
        "The Pulley",
        "The Screw"
    ]],
    ["Mechanisms", "Explore how mechanisms transfer motion and force through linked parts, rotating systems, and drive components.", [
        "Introduction",
        "Linkages",
        "The Cam and Follower",
        "Bearings",
        "Gears",
        "Sprockets and Chains",
        "Drives",
        "Mechanism Selection and Design Choices",
        "Motion Transfer in Mechanisms",
        "Comparing Common Mechanisms",
        "Mechanism Troubleshooting",
        "Mechanisms Review and Application"
    ]],
    ["Energy", "Understand forms of energy, thermodynamics, and the systems engineers use to generate, transfer, and conserve energy.", [
        "Introduction",
        "Forms of Energy",
        "Potential and Kinetic Energy",
        "Why Energy Matters",
        "Heat and Heat Transfer",
        "Temperature and Molecular Motion",
        "Units of Energy: Btu, Joule, and Calorie",
        "Comparing Light Sources and Efficiency",
        "Real-World Energy Examples",
        "Laws of Thermodynamics",
        "Renewable Energy Sources",
        "Nonrenewable Energy Sources",
        "Nuclear Energy",
        "Energy Efficiency and Conservation"
    ]],
    ["Electrical Systems", "Build electrical literacy by studying charge, voltage sources, components, measurement tools, and circuits.", [
        "Introduction",
        "The Atom, Elements, and Ions",
        "Static Electricity and the Law of Charges",
        "Current and Polarity",
        "Sources of Voltage",
        "Batteries and Generators",
        "Photovoltaic Cells, Thermocouples, and Piezoelectric Devices",
        "Common Electrical Components",
        "Voltage, Resistance, Conductance, Power, and Charge",
        "Digital Multimeters",
        "Measuring Voltage, Resistance, and Current",
        "Metric Prefixes",
        "Basic Circuits and Ohm's Law",
        "Series and Parallel Circuits"
    ]],
    ["Fluid Power Systems", "Learn the principles behind hydraulic and pneumatic systems, including components, pressure, and gas behavior.", [
        "Introduction",
        "Basic Principles of Fluid Power",
        "Hydraulic Systems",
        "Milestones in the History of Fluid Power",
        "Fluid Power Components and Schematic Symbols",
        "Hydraulic System Components",
        "Pneumatic System Components",
        "Scientific Concepts of Fluid Power",
        "Hydrodynamics",
        "Hydrostatics",
        "Pressure and Types of Air Pressure",
        "Perfect Gas Laws"
    ]],
    ["Control Systems", "Study how systems use inputs, outputs, signals, controllers, and logic to automate behavior.", [
        "Introduction",
        "Overview of a System",
        "Open-Loop and Closed-Loop Systems",
        "Input Devices",
        "Analog and Digital Signals",
        "Analog-to-Digital Conversion",
        "Analog Input Devices",
        "Digital Input Devices",
        "Output Devices and Actuators",
        "Processors and Controllers",
        "Microprocessors and Microcontrollers",
        "Computer-Based Controllers and PLCs",
        "Programming and Graphical Flowcharting",
        "Ladder Logic and Control System Examples"
    ]],
    ["Materials", "Compare major material families and understand how material choice affects performance and manufacturability.", [
        "Introduction",
        "Metals",
        "Ferrous and Nonferrous Metals",
        "Wood and Wood Products",
        "Hardwoods, Softwoods, and Engineered Lumber",
        "Ceramics and Glass",
        "Polymers",
        "Thermoplastics and Thermosets",
        "Elastomers",
        "Composite Materials",
        "Material Selection in Design",
        "Materials Review and Application"
    ]],
    ["Material Properties", "Investigate how materials behave under load and how engineers test strength, hardness, and deformation.", [
        "Introduction",
        "Deformable Body Mechanics",
        "Internal Forces, Stress, Deformation, and Strain",
        "Engineering Stress, True Stress, and Strain Gage",
        "Mechanical Properties of Materials",
        "Strength, Ductility, and Brittleness",
        "Elasticity, Resilience, and Toughness",
        "Testing Materials",
        "Tensile and Compression Testing",
        "Shear, Torsion, and Flexure Testing",
        "Testing Strength, Toughness, and Impact",
        "Hardness"
    ]],
    ["Manufacturing Processes and Product Life Cycle", "Follow products from raw material processing through production, use, and disposal.", [
        "Introduction",
        "Processing Metals: Casting and Metal Forming",
        "Processing Plastics: Blow Molding, Thermoforming, Extrusion, and Injection Molding",
        "Chip-Producing Machining and Threads",
        "Product Life Cycle Overview",
        "Design Phase",
        "Manufacturing Phase",
        "Production and Marketing Phase",
        "Use Phase",
        "Disposal Phase",
        "Manufacturing Decisions in Product Design",
        "Product Life Cycle Review and Application"
    ]],
    ["Statics", "Use statics concepts to analyze forces, structures, equilibrium, and support reactions in engineered systems.", [
        "Introduction",
        "Mechanics and Statics",
        "Structures, Members, and Loads",
        "Types of Structural Load",
        "Vector and Scalar Quantities",
        "Force Systems and Vector Addition",
        "Rigid Bodies and the Principle of Transmissibility",
        "External and Internal Forces",
        "Equilibrium",
        "Free-Body Diagrams",
        "Particle and Rigid-Body Free-Body Diagrams",
        "Simple Supports and Reactions",
        "Structural Analysis of Trusses",
        "Static Determinacy and Setting Standards"
    ]],
    ["Kinematics and Trajectory Motion", "Explore motion, projectiles, and the directional reasoning engineers use to model movement.", [
        "Introduction",
        "The Disciplines of Mechanics",
        "Basic Kinematic Terms",
        "Magnitude versus Direction",
        "Characteristics of Projectile Trajectory",
        "Horizontal Motion",
        "Vertical Motion",
        "Combined Horizontal and Vertical Motion",
        "Projectiles and the Parabolic Curve",
        "Analyzing Projectile Motion",
        "Maximum Height, Initial Velocity, and Flight Duration",
        "Trajectory Motion Review and Application"
    ]],
    ["Introduction to Measurement, Statistics, and Quality", "Connect accurate measurement, statistical thinking, and quality systems to real engineering decisions.", [
        "Introduction",
        "Standard System of Measurement",
        "Today's Measurement System",
        "Scientific Measuring Tools and Techniques",
        "The Fractional, Decimal, and Metric Rules",
        "Conversion Methods and Factors",
        "Precision Measuring Tools",
        "Measuring with a Dial Caliper",
        "Measuring with a Micrometer",
        "Statistical Analysis of Data",
        "Average, Mode, Median, Range, and Standard Deviation",
        "Quality and the Quality Revolution",
        "Quality Systems, Sources of Error, and Process Capability",
        "Putting It All Together"
    ]]
];

let engineeringLessonNumber = 0;

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
            lessons: lessons.map((lessonTitle, lessonIndex) => ({
                id: `eng-m${String(moduleIndex + 1).padStart(2, "0")}-l${String(lessonIndex + 1).padStart(2, "0")}`,
                number: ++engineeringLessonNumber,
                title: lessonTitle,
                summary: `Build understanding of ${lessonTitle.toLowerCase()} as part of ${title}.`
            }))
        };
    })
};

window.currentCourseData = window.engineeringCourse;
