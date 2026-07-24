#!/usr/bin/env node

import { supabaseConfig } from "../v2/services/supabase/config.js";

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const targetCourseTitle = process.env.COURSE_TITLE || "AP Computer Science A";
const targetModuleNumber = Number(process.env.MODULE_ORDER || 1);

if (!accessToken) {
  console.error("Set SUPABASE_ACCESS_TOKEN to a signed-in teacher access token before running.");
  process.exit(1);
}

const { supabaseUrl, supabasePublishableKey } = supabaseConfig;
const apiBase = `${supabaseUrl}/rest/v1`;
const lessonLayoutMarker = "__ctc_lesson_layout_v1__";
const now = () => new Date().toISOString();

function encodeLessonLayout(layout) {
  return `${lessonLayoutMarker}\n${JSON.stringify(layout)}`;
}

async function rest(path, { method = "GET", body, prefer = "return=representation" } = {}) {
  const response = await fetch(`${apiBase}/${path}`, {
    method,
    headers: {
      apikey: supabasePublishableKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: prefer,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} failed (${response.status}): ${text}`);
  }

  return text ? JSON.parse(text) : null;
}

function escapeFilterValue(value) {
  return String(value).replaceAll('"', '\\"');
}

async function findCourse() {
  const courses = await rest(`courses?select=id,title&title=ilike.*${encodeURIComponent(targetCourseTitle)}*&archived_at=is.null&limit=10`);
  const exact = courses.find((course) => course.title.toLowerCase() === targetCourseTitle.toLowerCase());
  const course = exact || courses[0];
  if (!course) {
    throw new Error(`Could not find course matching "${targetCourseTitle}".`);
  }

  return course;
}

async function findModule(courseId) {
  const modules = await rest(`modules?select=id,title,order_index&course_id=eq.${courseId}&archived_at=is.null&order=order_index.asc`);
  const module = modules[targetModuleNumber - 1];
  if (!module) {
    throw new Error(`Could not find module ${targetModuleNumber}.`);
  }

  return module;
}

async function findLessons(moduleId) {
  const lessons = await rest(`lessons?select=id,title,order_index&module_id=eq.${moduleId}&archived_at=is.null&order=order_index.asc&limit=5`);
  if (lessons.length < 5) {
    throw new Error(`Module only has ${lessons.length} active lesson(s); expected at least 5.`);
  }

  return lessons;
}

async function ensureFirstPage(lessonId) {
  const pages = await rest(`lesson_pages?select=id,page_number,order_index,title&lesson_id=eq.${lessonId}&archived_at=is.null&order=order_index.asc&limit=1`);
  if (pages.length) {
    return pages[0].id;
  }

  const [page] = await rest("lesson_pages?select=id", {
    method: "POST",
    body: {
      lesson_id: lessonId,
      page_number: 1,
      order_index: 10,
      title: "Page 1",
      is_visible: true,
    },
  });

  return page.id;
}

function block({ lessonId, pageId, type, title, body, url, fileUrl, fileType, order }) {
  return {
    lesson_id: lessonId,
    lesson_page_id: pageId,
    block_type: type,
    title,
    body_text: body || null,
    external_url: url || null,
    file_url: fileUrl || null,
    file_type: fileType || null,
    order_index: order,
    is_visible: true,
  };
}

function question({ lessonId, pageId, phase, type, prompt, instructions, correctAnswer = null, required = true, order, points = 1 }) {
  return {
    lesson_id: lessonId,
    lesson_page_id: pageId,
    phase,
    question_type: type,
    prompt,
    student_instructions: instructions || null,
    hint: null,
    correct_answer: correctAnswer,
    points,
    is_required: required,
    is_visible: true,
    order_index: order,
  };
}

const miniLessons = [
  {
    match: "Introduction to Algorithms",
    content: ({ lessonId, pageId }) => ({
      blocks: [
        block({
          lessonId,
          pageId,
          type: "text",
          title: "Learning targets and class flow",
          body: [
            "# Learning targets",
            "- I can describe an algorithm as a precise set of steps.",
            "- I can explain how source code becomes a runnable program.",
            "- I can distinguish syntax, compile-time, and run-time errors.",
            "",
            "# Class flow",
            "Bell ringer, mini lesson, vocabulary practice, discussion, and exit check.",
          ].join("\n"),
          order: 20,
        }),
        block({
          lessonId,
          pageId,
          type: "file",
          title: "Algorithm to compiler flow",
          body: "Use this diagram to trace how an idea becomes Java code and how errors are caught.",
          fileUrl: "/v2/assets/lesson-images/apcsa-algorithm-compiler-flow.svg",
          fileType: "image",
          order: 30,
        }),
        block({
          lessonId,
          pageId,
          type: "link",
          title: "Oracle: Java expressions, statements, and blocks",
          body: "Reference for how Java code is structured into statements and blocks.",
          url: "https://docs.oracle.com/javase/tutorial/java/nutsandbolts/expressions.html",
          order: 40,
        }),
        block({
          lessonId,
          pageId,
          type: "text",
          title: "Vocabulary flashcards",
          body: encodeLessonLayout({
            type: "flashcards",
            title: "Key vocabulary",
            cards: [
              { term: "Algorithm", definition: "A precise sequence of steps for solving a problem or completing a task." },
              { term: "Program", definition: "Instructions written in a programming language for a computer to execute." },
              { term: "Source code", definition: "Human-readable code written by a programmer." },
              { term: "Compiler", definition: "A tool that checks/translates source code before it runs." },
              { term: "Syntax error", definition: "A grammar/rules error that prevents code from compiling." },
              { term: "Runtime error", definition: "An error that happens while the program is running." },
            ],
          }),
          order: 50,
        }),
        block({
          lessonId,
          pageId,
          type: "text",
          title: "Discuss: Where can an algorithm break?",
          body: encodeLessonLayout({
            type: "discussion",
            bodyText: "Choose a simple everyday algorithm, like making a sandwich or logging into an app. Identify one step that could be unclear and explain how that ambiguity might become a programming error.",
          }),
          order: 60,
        }),
      ],
      questions: [
        question({
          lessonId,
          pageId,
          phase: "before",
          type: "short_response",
          prompt: "Bell ringer: How can an everyday process be represented as an algorithm, and where might errors appear when the program is compiled or run?",
          instructions: "Answer in 2-3 thoughtful sentences. Use a real-life process or a small program example.",
          order: 10,
        }),
        {
          question: question({
            lessonId,
            pageId,
            phase: "during",
            type: "multiple_choice",
            prompt: "Which statement best describes what a compiler does?",
            instructions: "Choose the best answer.",
            correctAnswer: { value: "translate_check" },
            order: 70,
          }),
          options: [
            ["It translates/checks source code so it can become a runnable program.", "translate_check", true],
            ["It writes the algorithm for the programmer.", "writes_algorithm", false],
            ["It stores all user data forever.", "stores_data", false],
            ["It guarantees the program has no logic errors.", "no_logic_errors", false],
          ],
        },
        question({
          lessonId,
          pageId,
          phase: "reflection",
          type: "short_response",
          prompt: "Exit check: Name one place an error can enter the algorithm-to-program process and how a programmer might catch it.",
          instructions: "Use one vocabulary word from today in your answer.",
          order: 80,
        }),
      ],
    }),
  },
  {
    match: "Variables and Data Types",
    content: ({ lessonId, pageId }) => ({
      blocks: [
        block({
          lessonId,
          pageId,
          type: "text",
          title: "Learning targets and notes",
          body: [
            "# Learning targets",
            "- I can choose a Java data type based on the value I need to store.",
            "- I can declare, initialize, and update variables.",
            "- I can explain why type matters when Java evaluates code.",
            "",
            "A variable is a named storage location. Its data type controls what values it can hold and what operations make sense.",
          ].join("\n"),
          order: 20,
        }),
        block({
          lessonId,
          pageId,
          type: "file",
          title: "Java data types map",
          body: "Use this map to connect common values to the Java types that store them.",
          fileUrl: "/v2/assets/lesson-images/apcsa-data-types-map.svg",
          fileType: "image",
          order: 30,
        }),
        block({
          lessonId,
          pageId,
          type: "link",
          title: "Oracle: Variables",
          body: "Official Java tutorial reference for variables.",
          url: "https://docs.oracle.com/javase/tutorial/java/nutsandbolts/variables.html",
          order: 40,
        }),
        block({
          lessonId,
          pageId,
          type: "link",
          title: "Oracle: Primitive data types",
          body: "Official Java tutorial reference for primitive types and ranges.",
          url: "https://docs.oracle.com/javase/tutorial/java/nutsandbolts/datatypes.html",
          order: 45,
        }),
        block({
          lessonId,
          pageId,
          type: "text",
          title: "Data type flashcards",
          body: encodeLessonLayout({
            type: "flashcards",
            title: "Variable vocabulary",
            cards: [
              { term: "Variable", definition: "A named location that stores a value." },
              { term: "Declaration", definition: "Creating a variable by stating its type and name." },
              { term: "Initialization", definition: "Giving a variable its first value." },
              { term: "int", definition: "A whole-number primitive type." },
              { term: "double", definition: "A primitive type for decimal values." },
              { term: "boolean", definition: "A primitive type that stores true or false." },
              { term: "String", definition: "A reference type that stores text." },
            ],
          }),
          order: 50,
        }),
      ],
      questions: [
        question({
          lessonId,
          pageId,
          phase: "before",
          type: "short_response",
          prompt: "Bell ringer: Why does Java need different data types instead of storing every value the same way?",
          instructions: "Give one example value and the Java type you would use for it.",
          order: 10,
        }),
        {
          question: question({
            lessonId,
            pageId,
            phase: "during",
            type: "select_all_that_apply",
            prompt: "Which are valid reasons to choose a data type carefully?",
            instructions: "Select every answer that applies.",
            correctAnswer: { values: ["range", "decimals", "meaning", "logic"] },
            order: 60,
          }),
          options: [
            ["Some types store whole numbers while others store decimals.", "decimals", true],
            ["A type can limit the range of values a variable can store.", "range", true],
            ["The type helps show the meaning of the value in the program.", "meaning", true],
            ["The type can represent true/false logic.", "logic", true],
            ["The type automatically makes the variable name longer.", "longer_name", false],
          ],
        },
        question({
          lessonId,
          pageId,
          phase: "reflection",
          type: "short_response",
          prompt: "Exit check: Pick data types for age, price, gameOver, and initial. Explain one choice.",
          instructions: "Use Java type names in your answer.",
          order: 70,
        }),
      ],
    }),
  },
  {
    match: "Expressions and Output",
    content: ({ lessonId, pageId }) => ({
      blocks: [
        block({
          lessonId,
          pageId,
          type: "text",
          title: "Learning targets and mini lesson",
          body: [
            "# Learning targets",
            "- I can evaluate arithmetic and string expressions.",
            "- I can predict output from System.out.print and System.out.println.",
            "- I can explain how operator order changes a result.",
            "",
            "An expression produces a value. Output statements display values so a user can see what the program did.",
          ].join("\n"),
          order: 20,
        }),
        block({
          lessonId,
          pageId,
          type: "link",
          title: "Oracle: Operators",
          body: "Official Java tutorial reference for operators used in expressions.",
          url: "https://docs.oracle.com/javase/tutorial/java/nutsandbolts/operators.html",
          order: 30,
        }),
        block({
          lessonId,
          pageId,
          type: "link",
          title: "Oracle: Expressions, statements, and blocks",
          body: "Official Java tutorial reference for expressions and statements.",
          url: "https://docs.oracle.com/javase/tutorial/java/nutsandbolts/expressions.html",
          order: 40,
        }),
        block({
          lessonId,
          pageId,
          type: "text",
          title: "Expressions flashcards",
          body: encodeLessonLayout({
            type: "flashcards",
            title: "Expression vocabulary",
            cards: [
              { term: "Expression", definition: "Code that evaluates to a value." },
              { term: "Operator", definition: "A symbol such as +, -, *, /, or % that performs an operation." },
              { term: "Operand", definition: "A value used by an operator." },
              { term: "Precedence", definition: "The order Java uses to evaluate operators." },
              { term: "Concatenation", definition: "Joining text with another value using +." },
              { term: "println", definition: "Prints output and then moves to a new line." },
            ],
          }),
          order: 50,
        }),
        block({
          lessonId,
          pageId,
          type: "text",
          title: "Discuss: Output surprises",
          body: encodeLessonLayout({
            type: "discussion",
            bodyText: "Find one output statement that might surprise a beginner. Explain what it prints and why Java evaluates it that way.",
          }),
          order: 60,
        }),
      ],
      questions: [
        question({
          lessonId,
          pageId,
          phase: "before",
          type: "short_response",
          prompt: "Bell ringer: How can the same arithmetic symbols produce different results depending on values and data types?",
          instructions: "Use one small example expression in your answer.",
          order: 10,
        }),
        {
          question: question({
            lessonId,
            pageId,
            phase: "during",
            type: "multiple_choice",
            prompt: 'What is printed by System.out.println("Total: " + 3 + 4); ?',
            instructions: "Think about string concatenation from left to right.",
            correctAnswer: { value: "total34" },
            order: 70,
          }),
          options: [
            ["Total: 7", "total7", false],
            ["Total: 34", "total34", true],
            ["7", "seven", false],
            ["The code does not compile.", "no_compile", false],
          ],
        },
        question({
          lessonId,
          pageId,
          phase: "reflection",
          type: "short_response",
          prompt: "Exit check: What is the difference between an expression and a statement?",
          instructions: "Include one Java example of each.",
          order: 80,
        }),
      ],
    }),
  },
  {
    match: "Assignment Statements and Input",
    content: ({ lessonId, pageId }) => ({
      blocks: [
        block({
          lessonId,
          pageId,
          type: "text",
          title: "Learning targets and guided notes",
          body: [
            "# Learning targets",
            "- I can trace assignment and reassignment statements.",
            "- I can use input to make a program interactive.",
            "- I can write clear prompts so users know what to enter.",
            "",
            "Assignment stores a value in a variable. Input lets the user provide data while the program is running.",
          ].join("\n"),
          order: 20,
        }),
        block({
          lessonId,
          pageId,
          type: "file",
          title: "Input process output model",
          body: "Use this model when planning an interactive Java program.",
          fileUrl: "/v2/assets/lesson-images/apcsa-input-process-output.svg",
          fileType: "image",
          order: 30,
        }),
        block({
          lessonId,
          pageId,
          type: "link",
          title: "Oracle: Scanner class",
          body: "Official Java API reference for reading input with Scanner.",
          url: "https://docs.oracle.com/javase/8/docs/api/java/util/Scanner.html",
          order: 40,
        }),
        block({
          lessonId,
          pageId,
          type: "text",
          title: "Input vocabulary flashcards",
          body: encodeLessonLayout({
            type: "flashcards",
            title: "Input and assignment vocabulary",
            cards: [
              { term: "Assignment", definition: "Stores a value in a variable using =." },
              { term: "Reassignment", definition: "Changes a variable to a new value." },
              { term: "Scanner", definition: "A Java class commonly used to read keyboard input." },
              { term: "Prompt", definition: "A message that tells the user what to enter." },
              { term: "Input validation", definition: "Checking whether user input is reasonable before using it." },
            ],
          }),
          order: 50,
        }),
      ],
      questions: [
        question({
          lessonId,
          pageId,
          phase: "before",
          type: "short_response",
          prompt: "Bell ringer: What information does a program need from the user before it can make a decision or calculation?",
          instructions: "Describe one program idea and the input it would need.",
          order: 10,
        }),
        {
          question: question({
            lessonId,
            pageId,
            phase: "during",
            type: "multiple_choice",
            prompt: "Trace the code: int score = 7; score = score + 3; score = score * 2; What is score?",
            instructions: "Work one assignment at a time.",
            correctAnswer: { value: "20" },
            order: 60,
          }),
          options: [
            ["10", "10", false],
            ["14", "14", false],
            ["20", "20", true],
            ["23", "23", false],
          ],
        },
        question({
          lessonId,
          pageId,
          phase: "reflection",
          type: "short_response",
          prompt: "Exit check: Write a clear prompt and choose a variable name/type for one piece of user input.",
          instructions: "Example format: Prompt: ... Variable: ... Type: ...",
          order: 70,
        }),
      ],
    }),
  },
  {
    match: "Casting and Range of Variables",
    content: ({ lessonId, pageId }) => ({
      blocks: [
        block({
          lessonId,
          pageId,
          type: "text",
          title: "Learning targets and concept check",
          body: [
            "# Learning targets",
            "- I can explain widening and narrowing conversions.",
            "- I can predict the result of a numeric cast.",
            "- I can identify when range, truncation, or precision could cause a bug.",
            "",
            "Casting asks Java to treat a value as another type. This can be useful, but narrowing conversions can lose information.",
          ].join("\n"),
          order: 20,
        }),
        block({
          lessonId,
          pageId,
          type: "file",
          title: "Casting and range diagram",
          body: "Use this visual to compare widening, narrowing, truncation, and overflow.",
          fileUrl: "/v2/assets/lesson-images/apcsa-casting-range.svg",
          fileType: "image",
          order: 30,
        }),
        block({
          lessonId,
          pageId,
          type: "link",
          title: "Oracle: Primitive data types and ranges",
          body: "Official Java tutorial reference for primitive type ranges.",
          url: "https://docs.oracle.com/javase/tutorial/java/nutsandbolts/datatypes.html",
          order: 40,
        }),
        block({
          lessonId,
          pageId,
          type: "text",
          title: "Casting flashcards",
          body: encodeLessonLayout({
            type: "flashcards",
            title: "Casting vocabulary",
            cards: [
              { term: "Casting", definition: "Explicitly converting a value from one type to another." },
              { term: "Widening conversion", definition: "Moving to a type that can represent more values, such as int to double." },
              { term: "Narrowing conversion", definition: "Moving to a type with less precision or range, such as double to int." },
              { term: "Truncation", definition: "Dropping the decimal part during a cast to int." },
              { term: "Overflow", definition: "When a value is outside the range a type can store." },
              { term: "Precision", definition: "How exact a numeric value can be represented." },
            ],
          }),
          order: 50,
        }),
      ],
      questions: [
        question({
          lessonId,
          pageId,
          phase: "before",
          type: "short_response",
          prompt: "Bell ringer: Why might a program lose information when converting from one numeric type to another?",
          instructions: "Use the words decimal, range, or precision in your response.",
          order: 10,
        }),
        {
          question: question({
            lessonId,
            pageId,
            phase: "during",
            type: "multiple_choice",
            prompt: "What is the result of (int) 7.9 in Java?",
            instructions: "Remember that casting to int truncates the decimal part.",
            correctAnswer: { value: "7" },
            order: 60,
          }),
          options: [
            ["7", "7", true],
            ["8", "8", false],
            ["7.9", "7.9", false],
            ["The code does not compile.", "no_compile", false],
          ],
        },
        question({
          lessonId,
          pageId,
          phase: "reflection",
          type: "short_response",
          prompt: "Exit check: Describe one bug that could happen because of casting, truncation, overflow, or numeric range.",
          instructions: "Explain how a programmer could notice or prevent the bug.",
          order: 70,
        }),
      ],
    }),
  },
];

async function archiveExistingLessonContent(lessonId) {
  const timestamp = now();
  await rest(`lesson_content_blocks?lesson_id=eq.${lessonId}&archived_at=is.null`, {
    method: "PATCH",
    body: { archived_at: timestamp },
    prefer: "return=minimal",
  });
  await rest(`questions?lesson_id=eq.${lessonId}&archived_at=is.null`, {
    method: "PATCH",
    body: { archived_at: timestamp },
    prefer: "return=minimal",
  });
}

async function insertOptions(questionId, options) {
  if (!options?.length) {
    return;
  }

  await rest("question_options", {
    method: "POST",
    body: options.map(([text, value, isCorrect], index) => ({
      question_id: questionId,
      option_text: text,
      option_value: value,
      is_correct: isCorrect,
      order_index: (index + 1) * 10,
    })),
  });
}

async function buildLesson(lesson, plan) {
  const pageId = await ensureFirstPage(lesson.id);
  const payload = plan.content({ lessonId: lesson.id, pageId });

  await archiveExistingLessonContent(lesson.id);

  if (payload.blocks.length) {
    await rest("lesson_content_blocks", { method: "POST", body: payload.blocks });
  }

  for (const item of payload.questions) {
    const questionPayload = item.question || item;
    const [createdQuestion] = await rest("questions?select=id", { method: "POST", body: questionPayload });
    await insertOptions(createdQuestion.id, item.options);
  }

  return {
    lesson: lesson.title,
    pageId,
    blocks: payload.blocks.length,
    questions: payload.questions.length,
  };
}

const course = await findCourse();
const module = await findModule(course.id);
const lessons = await findLessons(module.id);
const results = [];

for (const plan of miniLessons) {
  const lesson = lessons.find((candidate) => candidate.title.toLowerCase().includes(plan.match.toLowerCase()));
  if (!lesson) {
    throw new Error(`Could not find lesson matching "${plan.match}" in module "${module.title}".`);
  }

  results.push(await buildLesson(lesson, plan));
}

console.log(JSON.stringify({ course: course.title, module: module.title, updated: results }, null, 2));
