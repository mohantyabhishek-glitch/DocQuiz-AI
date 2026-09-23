import { Router, type IRouter } from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import {
  ExtractDocumentResponse,
  GenerateQuizBody,
  GenerateQuizResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
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
  if (extension === "txt") {
    return file.buffer.toString("utf8");
  }
  if (extension === "pdf") {
    const parsed = await pdfParse(file.buffer);
    return parsed.text ?? "";
  }
  throw new Error("Only PDF and TXT files are supported.");
}

function parseJsonResponse(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fenced?.[1] ?? content;
  return JSON.parse(candidate.trim());
}

function demoQuestions(text: string, questionCount: number): QuizQuestion[] {
  const firstSentence =
    text.match(/[^.!?]+[.!?]/)?.[0]?.trim() ??
    "This document contains a set of important ideas to review.";
  const topic = firstSentence.replace(/[.!?]+$/, "").slice(0, 96);
  return Array.from({ length: questionCount }, (_, index) => ({
    id: `demo-${index + 1}`,
    question:
      index === 0
        ? `Which statement best reflects the opening idea of the document?`
        : `What is the most useful study action for reviewing this material?`,
    options:
      index === 0
        ? [firstSentence, "The document has no central idea.", "The topic is unrelated to study.", "Only the formatting matters."]
        : ["Connect the ideas to examples.", "Skip the explanations.", "Memorize the file name.", "Review without reading."],
    correctAnswerIndex: 0,
    explanation:
      index === 0
        ? `The document begins with the idea that ${topic.toLowerCase()}.`
        : "Connecting ideas to examples improves recall and shows whether the concept is understood.",
  }));
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
      temperature: 0.2,
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

  if (chunks.length > 1) {
    for (const [index, chunk] of chunks.entries()) {
      const summary = await callOpenAI(
        [
          {
            role: "system",
            content:
              "Extract concise study notes from the provided document section. Return strict JSON with one key, keyPoints, containing an array of 4 to 8 short factual bullet strings. Do not add facts that are not in the source.",
          },
          {
            role: "user",
            content: `Document section ${index + 1} of ${chunks.length}:\n\n${chunk}`,
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
          return {
            id: typeof item.id === "string" ? item.id : `q${index + 1}`,
            question: item.question,
            options: item.options.map(String),
            correctAnswerIndex: Math.max(0, Math.min(3, Math.round(item.correctAnswerIndex))),
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
        res.status(413).json({ error: "That file is too large. Keep uploads under 15 MB.", code: "FILE_TOO_LARGE" });
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
      res.status(400).json({ error: "Choose a PDF or TXT file to continue.", code: "FILE_REQUIRED" });
      return;
    }
    const extension = getExtension(req.file.originalname);
    if (!["pdf", "txt"].includes(extension)) {
      res.status(400).json({ error: "Only PDF and TXT files are supported.", code: "UNSUPPORTED_FILE_TYPE" });
      return;
    }
    const text = (await extractText(req.file)).trim();
    const chunks = splitIntoLogicalChunks(text);
    const warning =
      extension === "pdf" && text.length < 80
        ? "This PDF may be scanned or image-based. No meaningful text was found."
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