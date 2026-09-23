import { Router, type IRouter } from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import {
  ExtractDocumentResponse,
  GenerateQuizBody,
  GenerateQuizResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB
const SAFE_CHUNK_SIZE = 12_000;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
});

type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
};

function splitIntoLogicalChunks(text: string, maxSize = SAFE_CHUNK_SIZE): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [];
  if (normalized.length <= maxSize) return [normalized];

  const chunks: string[] = [];
  let remaining = normalized;
  while (remaining.length > maxSize) {
    const paragraphBreak = remaining.lastIndexOf("\n\n", maxSize);
    const sentenceBreak = remaining.lastIndexOf(". ", maxSize);
    const spaceBreak = remaining.lastIndexOf(" ", maxSize);
    const breakAt = Math.max(paragraphBreak, sentenceBreak, spaceBreak);
    const end = breakAt > Math.floor(maxSize * 0.65) ? breakAt : maxSize;
    chunks.push(remaining.slice(0, end).trim());
    remaining = remaining.slice(end).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function wordCount(text: string) {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

function getExtension(fileName: string) {
  return fileName.toLowerCase().split(".").pop() ?? "";
}

async function extractText(file: Express.Multer.File) {
  const extension = getExtension(file.originalname);
  if (["txt", "md", "markdown", "csv", "json", "rtf", "log"].includes(extension)) {
    return file.buffer.toString("utf8");
  }
  if (extension === "docx" || extension === "doc") {
    try {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      if (result.value && result.value.trim().length > 0) {
        return result.value;
      }
    } catch {
      // Fallback text extraction if docx parsing encounters issues
      const rawText = file.buffer.toString("utf8").replace(/[^\x20-\x7E\n\r\t]/g, " ");
      if (rawText.trim().length > 80) return rawText;
    }
  }
  if (extension === "pdf") {
    const parsed = await pdfParse(file.buffer);
    return parsed.text ?? "";
  }
  throw new Error("Only PDF, DOCX, DOC, TXT, and MD files are supported.");
}

function parseJsonResponse(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? content;
  return JSON.parse(candidate.trim());
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function demoQuestions(text: string, questionCount: number): QuizQuestion[] {
  const rawSentences = text
    .split(/(?<=[.!?\n])\s+/)
    .map((s) => s.replace(/[\r\n\t]+/g, " ").trim())
    .filter((s) => s.length >= 25 && s.length <= 220 && !s.startsWith("http"));

  const defaultPool = [
    "Active recall strengthens neural pathways and significantly improves long-term memory retention.",
    "Spaced repetition schedules reviews at optimal intervals right before forgetting typically occurs.",
    "Interleaving different related topics develops problem-solving flexibility and adaptive thinking.",
    "Self-testing exposes knowledge gaps far more effectively than passive re-reading of notes.",
    "Elaborative rehearsal systematically connects new concepts to existing foundational knowledge.",
    "Summarizing key concepts in your own words boosts conceptual comprehension and rapid retrieval.",
    "Breaking down complex documents into modular chunks makes studying and review manageable.",
    "Testing yourself immediately after reading improves consolidation of core factual details.",
    "Reviewing mistakes with clear explanations prevents reinforcement of incorrect mental models.",
    "Consistent daily practice sessions consistently outperform sporadic marathon cramming sessions.",
    "Dual coding combines visual diagrams with verbal explanations for enhanced cognitive retention.",
    "Retrieval practice forces the brain to reconstruct memory traces, solidifying neural pathways."
  ];

  const pool = rawSentences.length >= questionCount ? shuffleArray(rawSentences) : shuffleArray([...rawSentences, ...defaultPool]);

  const questionTemplates = [
    (snip: string) => `According to your study material, which statement accurately reflects the point regarding "${snip}..."?`,
    (snip: string) => `What key takeaway is emphasized in the section discussing "${snip}..."?`,
    (snip: string) => `Based on the provided notes, which of the following is correct regarding "${snip}..."?`,
    (snip: string) => `Which core insight is highlighted in the text concerning "${snip}..."?`,
    (snip: string) => `From the uploaded document, what can be concluded about "${snip}..."?`,
  ];

  return Array.from({ length: questionCount }, (_, index) => {
    const targetSentence = pool[index % pool.length];
    const words = targetSentence.split(" ");
    const snippetLength = Math.min(7, Math.max(3, words.length));
    const snippet = words.slice(0, snippetLength).join(" ").replace(/[.,;:]+$/, "");

    // Pick 3 distractors from other sentences in the pool
    const otherSentences = pool.filter((s) => s !== targetSentence);
    const shuffledOthers = shuffleArray(otherSentences);
    
    let distractors: string[] = [];
    if (shuffledOthers.length >= 3) {
      distractors = shuffledOthers.slice(0, 3);
    } else {
      distractors = [
        `The material indicates that ${snippet.toLowerCase()} is completely irrelevant to the main topic.`,
        `The author suggests the inverse is true regarding ${snippet.toLowerCase()}.`,
        `This concept applies only as an unverified exception in isolated scenarios.`,
      ];
    }

    const templateFn = questionTemplates[index % questionTemplates.length];
    const rawOptions = [targetSentence, ...distractors.slice(0, 3)];
    const options = shuffleArray(rawOptions);
    const correctAnswerIndex = options.indexOf(targetSentence);

    return {
      id: `q-${index + 1}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      question: templateFn(snippet),
      options,
      correctAnswerIndex: correctAnswerIndex >= 0 ? correctAnswerIndex : 0,
      explanation: `From the source material: "${targetSentence}"`,
    };
  });
}

async function callOpenAI(messages: Array<{ role: "system" | "user"; content: string }>, maxTokens: number) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.6,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });
  if (!response.ok) {
    await response.text();
    throw new Error(`OpenAI request failed (${response.status}).`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("The quiz provider returned an empty response.");
  return content;
}

async function buildQuiz(text: string, fileName: string | undefined, questionCount: number) {
  const chunks = splitIntoLogicalChunks(text);
  const chunkSummaries: string[] = [];

  // Limit chunk summarizing to max 6 representative sections to keep response instant
  const selectedChunks = chunks.length > 6
    ? Array.from({ length: 6 }, (_, i) => chunks[Math.floor((i * (chunks.length - 1)) / 5)])
    : chunks;

  if (selectedChunks.length > 1) {
    for (const [index, chunk] of selectedChunks.entries()) {
      const summary = await callOpenAI(
        [
          {
            role: "system",
            content:
              "Extract concise study notes from the provided document section. Return strict JSON with one key, keyPoints, containing an array of 4 to 8 short factual bullet strings. Do not add facts that are not in the source.",
          },
          {
            role: "user",
            content: `Document section ${index + 1} of ${selectedChunks.length}:\n\n${chunk}`,
          },
        ],
        900,
      );
      if (summary) {
        const parsed = parseJsonResponse(summary) as { keyPoints?: unknown };
        if (Array.isArray(parsed.keyPoints)) {
          chunkSummaries.push(parsed.keyPoints.filter((point): point is string => typeof point === "string").join("\n"));
        }
      }
    }
  }

  const sourceForQuiz = chunkSummaries.length
    ? chunkSummaries.join("\n\n")
    : text.slice(0, SAFE_CHUNK_SIZE);
  const prompt = `Create a ${questionCount}-question study quiz from the source below.
Return strict JSON with exactly this shape:
{"title":"short topic title","questions":[{"id":"q1","question":"...","options":["...","...","...","..."],"correctAnswerIndex":0,"explanation":"..."}]}
Every question must have exactly four plausible options, exactly one correct answer, a correctAnswerIndex from 0 to 3, and an explanation grounded in the source. Avoid trivia about file formatting. Do not mention that you are an AI.

Source:
${sourceForQuiz}`;
  const generated = await callOpenAI(
    [
      {
        role: "system",
        content:
          "You are an expert instructional designer. Write clear, fair multiple-choice questions that test understanding, not wording tricks. Output JSON only.",
      },
      { role: "user", content: prompt },
    ],
    2_400,
  );

  if (!generated) {
    return {
      title: "Quick review",
      sourceFileName: fileName ?? "study notes",
      questions: demoQuestions(text, questionCount),
      generatedWith: "demo",
      isDemo: true,
    };
  }

  const raw = parseJsonResponse(generated) as { title?: unknown; questions?: unknown };
  const questions = Array.isArray(raw.questions)
    ? raw.questions
        .map((question, index) => {
          const item = question as Partial<QuizQuestion>;
          if (
            typeof item.question !== "string" ||
            !Array.isArray(item.options) ||
            item.options.length !== 4 ||
            typeof item.correctAnswerIndex !== "number" ||
            typeof item.explanation !== "string"
          ) {
            return null;
          }
          const rawOptions = item.options.map(String);
          const rawCorrectIndex = Math.max(0, Math.min(3, Math.round(item.correctAnswerIndex)));
          const correctAnswerText = rawOptions[rawCorrectIndex];
          const shuffledOptions = shuffleArray(rawOptions);
          const newCorrectIndex = shuffledOptions.indexOf(correctAnswerText);
          return {
            id: typeof item.id === "string" ? `${item.id}-${Math.random().toString(36).slice(2, 6)}` : `q${index + 1}-${Date.now().toString(36)}`,
            question: item.question,
            options: shuffledOptions,
            correctAnswerIndex: newCorrectIndex >= 0 ? newCorrectIndex : 0,
            explanation: item.explanation,
          };
        })
        .filter((question): question is QuizQuestion => question !== null)
    : [];

  return {
    title: typeof raw.title === "string" && raw.title.trim() ? raw.title : "Study review",
    sourceFileName: fileName ?? "study notes",
    questions: questions.length ? questions : demoQuestions(text, questionCount),
    generatedWith: "OpenAI",
    isDemo: !questions.length,
  };
}

router.post(
  "/documents/extract",
  (req, res, next) => {
    upload.single("file")(req, res, (error) => {
      if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "That file is too large. Keep uploads under 100 MB.", code: "FILE_TOO_LARGE" });
        return;
      }
      if (error) {
        res.status(400).json({ error: "We could not receive that file. Try uploading it again.", code: "UPLOAD_FAILED" });
        return;
      }
      next();
    });
  },
  async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: "Choose a PDF, DOCX, TXT, or MD file to continue.", code: "FILE_REQUIRED" });
      return;
    }
    const extension = getExtension(req.file.originalname);
    const supported = ["pdf", "txt", "docx", "doc", "md", "markdown", "csv", "json", "rtf", "log"];
    if (!supported.includes(extension)) {
      res.status(400).json({ error: "Only PDF, DOCX, DOC, TXT, and MD files are supported.", code: "UNSUPPORTED_FILE_TYPE" });
      return;
    }
    const text = (await extractText(req.file)).trim();
    const chunks = splitIntoLogicalChunks(text);
    const warning =
      extension === "pdf" && text.length < 80
        ? "This PDF may be scanned or image-based. No meaningful text was found."
        : text.length < 80
        ? "Very little text was extracted from this file."
        : null;
    const response = ExtractDocumentResponse.parse({
      fileName: req.file.originalname,
      fileType: extension.toUpperCase(),
      characterCount: text.length,
      wordCount: wordCount(text),
      chunkCount: chunks.length,
      text,
      warning,
    });
    res.json(response);
  } catch (error) {
    req.log.error({ err: error }, "Document extraction failed");
    const message = error instanceof Error ? error.message : "We could not read that document.";
    res.status(400).json({ error: message, code: "EXTRACTION_FAILED" });
  }
  },
);

router.post("/generate-quiz", async (req, res) => {
  try {
    const input = GenerateQuizBody.parse(req.body);
    let quiz;
    try {
      quiz = await buildQuiz(input.text, input.fileName, input.questionCount);
    } catch (error) {
      req.log.warn(
        { err: error instanceof Error ? error.message : "provider unavailable" },
        "Quiz provider unavailable; using local fallback",
      );
      quiz = {
        title: "Quick review",
        sourceFileName: input.fileName ?? "study notes",
        questions: demoQuestions(input.text, input.questionCount),
        generatedWith: "local fallback",
        isDemo: true,
      };
    }
    res.json(GenerateQuizResponse.parse(quiz));
  } catch (error) {
    req.log.error({ err: error }, "Quiz generation failed");
    const message = error instanceof Error ? error.message : "Quiz generation failed. Please try again.";
    res.status(502).json({ error: message, code: "GENERATION_FAILED" });
  }
});

export default router;