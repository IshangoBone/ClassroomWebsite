export const AP_CSA_INSTRUCTIONAL_STRATEGIES = {
    id: "ap-csa-ced-instructional-strategies",
    source: {
        title: "AP Computer Science A Course and Exam Description",
        publisher: "College Board",
        section: "Instructional Strategies",
        pages: "136-139",
        range: "Code Tracing through Vocabulary Organizer",
    },
    categories: [
        {
            name: "Programming and Problem-Solving",
            purpose: "Help students reason through code, decompose programming tasks, debug, and explain program behavior.",
            strategies: [
                {
                    name: "Code Tracing",
                    summary: "Students step through code by hand to predict variable changes, control flow, and output.",
                    platformUses: ["trace tables", "debugging checks", "AP-style code reading"],
                },
                {
                    name: "Create a Plan",
                    summary: "Students outline the data, steps, methods, and checks needed before writing code.",
                    platformUses: ["algorithm planning", "lab setup", "pseudocode prompts"],
                },
                {
                    name: "Error Analysis",
                    summary: "Students inspect code, output, or explanations to find mistakes and explain how to fix them.",
                    platformUses: ["debug-this-code tasks", "misconception checks", "feedback cycles"],
                },
                {
                    name: "Identify a Subtask",
                    summary: "Students break a larger problem into smaller responsibilities such as helper methods or control-flow steps.",
                    platformUses: ["decomposition prompts", "method planning", "project checkpoints"],
                },
                {
                    name: "Look for a Pattern",
                    summary: "Students compare examples to generalize how an algorithm, rule, or code segment behaves.",
                    platformUses: ["pattern finding", "prediction prompts", "algorithm generalization"],
                },
                {
                    name: "Marking the Text",
                    summary: "Students annotate prompts, code, constraints, parameters, and return values to focus on required details.",
                    platformUses: ["FRQ annotation", "specification reading", "prompt markup"],
                },
                {
                    name: "Pair Programming",
                    summary: "Students work in driver and navigator roles so coding and review happen together.",
                    platformUses: ["partner labs", "role cards", "collaboration routines"],
                },
                {
                    name: "Predict and Confirm",
                    summary: "Students predict code behavior, test or trace it, and revise their understanding based on evidence.",
                    platformUses: ["prediction checks", "run-and-reflect prompts", "quick formative checks"],
                },
                {
                    name: "Simplify the Problem",
                    summary: "Students solve a smaller version of a task before extending it to the full problem.",
                    platformUses: ["scaffolded problems", "base cases", "worked examples"],
                },
                {
                    name: "Think Aloud",
                    summary: "Students explain their reasoning while reading, designing, debugging, or revising code.",
                    platformUses: ["reasoning prompts", "peer debugging", "reflection responses"],
                },
            ],
        },
        {
            name: "Cooperative Learning",
            purpose: "Structure peer interaction so students explain ideas, compare strategies, and learn from classmates.",
            strategies: [
                {
                    name: "Ask the Expert",
                    summary: "Students consult a peer who has practiced a concept and can coach others through it.",
                    platformUses: ["peer help routines", "expert groups", "review rotations"],
                },
                {
                    name: "Discussion Groups",
                    summary: "Small groups discuss prompts, code, or solution approaches before sharing conclusions.",
                    platformUses: ["discussion boards", "group prompts", "collaborative analysis"],
                },
                {
                    name: "Jigsaw",
                    summary: "Students become responsible for one part of a larger concept, then teach that piece to peers.",
                    platformUses: ["topic teams", "unit review stations", "expert-share tasks"],
                },
                {
                    name: "Kinesthetic Learning",
                    summary: "Students physically model program behavior, data movement, or algorithm steps.",
                    platformUses: ["unplugged simulations", "movement routines", "algorithm acting"],
                },
                {
                    name: "Sharing and Responding",
                    summary: "Students present ideas or work and respond constructively to peers.",
                    platformUses: ["peer feedback", "gallery walks", "discussion replies"],
                },
                {
                    name: "Student Response System",
                    summary: "Students submit quick answers so the teacher can see patterns and adjust instruction.",
                    platformUses: ["polls", "short responses", "live checks"],
                },
                {
                    name: "Think-Pair-Share",
                    summary: "Students think independently, discuss with a partner, and then share with the class.",
                    platformUses: ["bell ringers", "prediction prompts", "exit checks"],
                },
                {
                    name: "Unplugged Activities",
                    summary: "Students explore computing concepts without a computer to make abstract ideas visible.",
                    platformUses: ["paper algorithms", "card sorts", "human-computer models"],
                },
                {
                    name: "Using Manipulatives",
                    summary: "Students use physical or visual objects to model program state, memory, logic, or data structures.",
                    platformUses: ["variable cards", "array models", "object diagrams"],
                },
            ],
        },
        {
            name: "Making Connections",
            purpose: "Help students connect new AP CSA ideas to prior knowledge, vocabulary, representations, and written explanations.",
            strategies: [
                {
                    name: "Activating Prior Knowledge",
                    summary: "Students connect a new topic to what they already know before formal instruction begins.",
                    platformUses: ["bell ringers", "warmups", "concept previews"],
                },
                {
                    name: "Diagramming",
                    summary: "Students draw relationships, flow, structure, or state to make program behavior easier to reason about.",
                    platformUses: ["memory diagrams", "flowcharts", "object relationship maps"],
                },
                {
                    name: "Note-Taking",
                    summary: "Students capture important concepts, examples, and corrections in an organized format.",
                    platformUses: ["guided notes", "lesson summaries", "review notes"],
                },
                {
                    name: "Paraphrasing",
                    summary: "Students restate code behavior, prompts, or concepts in their own words.",
                    platformUses: ["explain-in-plain-English prompts", "reflection checks", "vocabulary practice"],
                },
                {
                    name: "Quickwrite",
                    summary: "Students write briefly and quickly to process an idea, explain reasoning, or surface confusion.",
                    platformUses: ["exit tickets", "reflection prompts", "bell ringers"],
                },
                {
                    name: "Vocabulary Organizer",
                    summary: "Students organize key terms, definitions, examples, and connections across a unit.",
                    platformUses: ["flashcards", "word banks", "term maps"],
                },
            ],
        },
    ],
};

function contentLiteracyRoutine(name, summary, platformUses) {
    return { name, summary, platformUses };
}

export const CONTENT_LITERACY_INSTRUCTIONAL_ROUTINES = {
    id: "fisher-brozo-frey-ivey-content-literacy-routines",
    source: {
        title: "50 Instructional Routines to Develop Content Literacy",
        authors: "Douglas Fisher, William G. Brozo, Nancy Frey, and Gay Ivey",
        publisher: "Pearson",
        edition: "Third edition",
        year: 2015,
        section: "Instructional Routines for Use Before, During, and After Reading",
        pages: "inside cover and routines 1-50",
        range: "Adjunct Displays through Writing Frames and Templates",
    },
    categories: [
        {
            name: "Before Reading and Learning",
            purpose: "Activate prior knowledge, establish a purpose, preview language, and prepare students to enter unfamiliar content.",
            strategies: [
                contentLiteracyRoutine("Adjunct Displays", "Use a visual, diagram, map, or other representation to preview relationships students will encounter.", ["lesson openers", "visual previews", "concept maps"]),
                contentLiteracyRoutine("Anticipation Guides", "Ask students to react to carefully chosen statements before learning and revisit their thinking afterward.", ["bell ringers", "misconception checks", "before-and-after reflection"]),
                contentLiteracyRoutine("Interest Surveys, Questionnaires, and Interviews", "Gather information about students' interests and experience so examples and texts can connect to them.", ["learner profiles", "course surveys", "personalized examples"]),
                contentLiteracyRoutine("KWL", "Students identify what they know, what they want to learn, and what they learned.", ["unit launch", "inquiry planning", "reflection"]),
                contentLiteracyRoutine("Read-Alouds", "Model fluent, expressive reading while making important language and ideas accessible.", ["teacher modeling", "complex excerpts", "audio-supported lessons"]),
                contentLiteracyRoutine("Shades of Meaning", "Compare related words along a continuum to develop precise understanding and word choice.", ["vocabulary scales", "term comparisons", "word-choice discussions"]),
                contentLiteracyRoutine("Shared Reading", "Guide the class through a common text so everyone can practice meaning-making with support.", ["guided text study", "whole-class annotation", "modeled reading"]),
                contentLiteracyRoutine("Student Questions for Purposeful Learning", "Use student-generated questions to establish a meaningful reason for reading and investigation.", ["inquiry boards", "lesson questions", "research planning"]),
                contentLiteracyRoutine("Text Impressions", "Preview selected words or phrases and ask students to predict how they may connect in the text.", ["prediction prompts", "vocabulary previews", "lesson hooks"]),
                contentLiteracyRoutine("Think-Alouds", "Make expert thinking visible by verbalizing predictions, questions, connections, and repair strategies.", ["teacher modeling", "worked examples", "reasoning demonstrations"]),
                contentLiteracyRoutine("Vocabulary Cards", "Organize a term with its meaning, examples, visuals, and connections on a reusable card.", ["digital flashcards", "term banks", "example/nonexample practice"]),
                contentLiteracyRoutine("Vocabulary Self-Awareness", "Students rate their familiarity with key terms and update those ratings as understanding grows.", ["preassessment", "progress checks", "study planning"]),
                contentLiteracyRoutine("Word Sorts", "Students classify terms into meaningful groups and explain the reasoning behind their categories.", ["card sorts", "concept classification", "vocabulary review"]),
                contentLiteracyRoutine("Word Walls", "Maintain a visible, organized collection of important academic and discipline-specific language.", ["course glossary", "unit word walls", "reference panels"]),
            ],
        },
        {
            name: "During Reading and Investigation",
            purpose: "Support close attention, comprehension monitoring, collaborative reasoning, and understanding of complex texts and ideas.",
            strategies: [
                contentLiteracyRoutine("Annotation", "Students mark and comment on a text to capture questions, evidence, vocabulary, and connections.", ["PDF annotation", "evidence marking", "reading notes"]),
                contentLiteracyRoutine("Close Reading", "Guide repeated, purposeful readings that examine meaning, structure, language, and evidence.", ["text-dependent lessons", "evidence analysis", "layered rereading"]),
                contentLiteracyRoutine("Conversation Roundtable", "Structure equitable small-group discussion so each student contributes and the group records shared thinking.", ["discussion roles", "collaborative notes", "team synthesis"]),
                contentLiteracyRoutine("Directed Reading-Thinking Activity", "Pause reading at planned points so students predict, read for evidence, and revise their predictions.", ["chunked reading", "predict-and-confirm", "formative pauses"]),
                contentLiteracyRoutine("Fishbowl Discussions", "One group models an evidence-based discussion while observers track the ideas and interaction moves.", ["discussion modeling", "observation checklists", "seminar preparation"]),
                contentLiteracyRoutine("Generative Reading", "Students actively create questions, connections, summaries, or representations while reading.", ["reader-generated prompts", "concept sketches", "active reading"]),
                contentLiteracyRoutine("Guest Speakers", "Connect course content with a knowledgeable guest and prepare students to listen, question, and synthesize.", ["expert interviews", "career connections", "speaker reflections"]),
                contentLiteracyRoutine("Jigsaw", "Students master one portion of content and teach it to peers responsible for other portions.", ["expert groups", "distributed reading", "peer teaching"]),
                contentLiteracyRoutine("Modeling Comprehension", "Demonstrate how a proficient learner notices confusion and applies strategies to restore meaning.", ["error recovery", "reading demonstrations", "metacognitive prompts"]),
                contentLiteracyRoutine("Read-Write-Pair-Share", "Students read, write an individual response, discuss it with a partner, and share refined thinking.", ["source responses", "partner processing", "discussion preparation"]),
                contentLiteracyRoutine("Reciprocal Teaching", "Students rotate through predicting, questioning, clarifying, and summarizing to guide group comprehension.", ["role-based reading", "student-led groups", "comprehension cycles"]),
                contentLiteracyRoutine("Text-Dependent Questions", "Use questions that require students to return to the source and support answers with specific evidence.", ["evidence checks", "close-reading questions", "source-based assessment"]),
                contentLiteracyRoutine("Text Structures", "Teach students to recognize how information is organized and use that structure to understand it.", ["structure signals", "graphic organizers", "comparison and cause-effect analysis"]),
                contentLiteracyRoutine("Word Grids/Semantic Feature Analysis", "Compare related terms across shared features to clarify categories and conceptual distinctions.", ["comparison matrices", "concept attributes", "vocabulary analysis"]),
            ],
        },
        {
            name: "After Reading and Synthesis",
            purpose: "Help students consolidate meaning, discuss evidence, apply vocabulary, write from learning, and demonstrate understanding.",
            strategies: [
                contentLiteracyRoutine("Collaborative Conversations", "Students use academic language and accountable talk to build, challenge, and refine ideas together.", ["discussion boards", "team reasoning", "accountable-talk prompts"]),
                contentLiteracyRoutine("Debate", "Students develop and defend evidence-based positions while responding to competing claims.", ["claim-evidence tasks", "structured debate", "argument assessment"]),
                contentLiteracyRoutine("Exit Slips", "Collect a brief response at the end of learning to reveal understanding, confusion, or next steps.", ["exit tickets", "confidence checks", "lesson feedback"]),
                contentLiteracyRoutine("Found Poems", "Students select and arrange significant words from a source to synthesize its ideas and tone.", ["creative synthesis", "text evidence", "concept distillation"]),
                contentLiteracyRoutine("Independent Reading", "Provide sustained choice-based reading that builds knowledge, fluency, motivation, and reading identity.", ["reading pathways", "choice texts", "reading logs"]),
                contentLiteracyRoutine("Language Experience Approach", "Turn a shared experience or student account into text that can be reread, analyzed, and extended.", ["experience summaries", "class-created texts", "reflection writing"]),
                contentLiteracyRoutine("Mnemonics", "Create memorable patterns, phrases, or associations that support recall of important information.", ["memory aids", "review tools", "student-created cues"]),
                contentLiteracyRoutine("Popcorn Review", "Use rapid, connected student contributions to retrieve and extend key learning from a lesson or unit.", ["retrieval review", "whole-class recap", "concept chains"]),
                contentLiteracyRoutine("Question-Answer Relationship", "Teach students to identify whether an answer comes directly from a source, across the source, or from prior knowledge.", ["question classification", "reading comprehension", "evidence awareness"]),
                contentLiteracyRoutine("Questioning the Author", "Students examine what an author is trying to communicate and evaluate how clearly the text develops that meaning.", ["author's-purpose prompts", "source critique", "clarity analysis"]),
                contentLiteracyRoutine("RAFT Writing", "Students write from a selected role, for an audience, in a format, about a focused topic.", ["authentic writing", "perspective tasks", "choice-based products"]),
                contentLiteracyRoutine("Readers' Theatre", "Students adapt and perform a text to deepen interpretation, fluency, and attention to meaning.", ["scripted performance", "fluency practice", "historical or literary interpretation"]),
                contentLiteracyRoutine("ReQuest", "Teacher and students alternate asking and answering questions about a shared source.", ["question exchanges", "comprehension checks", "student questioning"]),
                contentLiteracyRoutine("Response Writing", "Students write to process, interpret, connect, or evaluate what they learned from a source.", ["learning journals", "constructed responses", "reflection"]),
                contentLiteracyRoutine("Socratic Seminar", "Students collaboratively explore an open question through evidence, listening, and follow-up questions.", ["seminar prompts", "evidence discussion", "student-led inquiry"]),
                contentLiteracyRoutine("Split-Page Notetaking", "Students divide notes into complementary columns such as key ideas and details, questions and evidence, or terms and examples.", ["guided notes", "Cornell-style layouts", "study resources"]),
                contentLiteracyRoutine("Student Booktalks", "Students briefly recommend and explain a text to peers, emphasizing its ideas and appeal.", ["peer recommendations", "reading community", "oral summaries"]),
                contentLiteracyRoutine("Take 6", "Students reduce learning to six essential ideas or representations and explain why each matters.", ["six-point summaries", "visual synthesis", "unit review"]),
                contentLiteracyRoutine("Tossed Terms", "Students use a set of important terms to construct, explain, or revise a coherent account of learning.", ["vocabulary synthesis", "concept connections", "review games"]),
                contentLiteracyRoutine("Writing Frames and Templates", "Provide temporary language and organizational scaffolds that help students produce discipline-appropriate responses.", ["sentence frames", "argument templates", "scaffolded writing"]),
            ],
        },
        {
            name: "Across the Learning Cycle",
            purpose: "Revisit thinking and language before, during, and after instruction so growth becomes visible.",
            strategies: [
                contentLiteracyRoutine("Opinionnaire", "Students record and justify opinions about key issues, then revisit their positions after learning.", ["before-and-after beliefs", "discussion launch", "evidence-based revision"]),
                contentLiteracyRoutine("Word Scavenger Hunts", "Students locate important terms in authentic contexts and explain how each term is being used.", ["source searches", "context clues", "vocabulary evidence"]),
            ],
        },
    ],
};

export const INSTRUCTIONAL_STRATEGY_MEMORY = {
    sources: [
        AP_CSA_INSTRUCTIONAL_STRATEGIES.source,
        CONTENT_LITERACY_INSTRUCTIONAL_ROUTINES.source,
    ],
    collections: [
        AP_CSA_INSTRUCTIONAL_STRATEGIES,
        CONTENT_LITERACY_INSTRUCTIONAL_ROUTINES,
    ],
};

export function getInstructionalStrategySummary() {
    return INSTRUCTIONAL_STRATEGY_MEMORY.collections.flatMap((collection) =>
        collection.categories.map((category) => ({
            name: category.name,
            purpose: category.purpose,
            strategies: category.strategies.map((strategy) => strategy.name),
            sourceId: collection.id,
        }))
    );
}
