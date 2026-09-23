import type { ExtractedDocument, Quiz } from '@workspace/api-client-react';

const DOCUMENT_KEY = 'docquiz-ai.document';
const QUIZ_KEY = 'docquiz-ai.quiz';

export function readDocument(): ExtractedDocument | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(DOCUMENT_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as ExtractedDocument;
  } catch {
    return null;
  }
}

export function writeDocument(document: ExtractedDocument): void {
  window.localStorage.setItem(DOCUMENT_KEY, JSON.stringify(document));
}

export function readQuiz(): Quiz | null {
  if (typeof window === 'undefined') return null;
  const value = window.localStorage.getItem(QUIZ_KEY);
  if (!value) return null;
  try {
    return JSON.parse(value) as Quiz;
  } catch {
    return null;
  }
}

export function writeQuiz(quiz: Quiz): void {
  window.localStorage.setItem(QUIZ_KEY, JSON.stringify(quiz));
}

export function clearQuiz(): void {
  window.localStorage.removeItem(QUIZ_KEY);
}

export type QuizDifficulty = 'blitz' | 'challenge' | 'relaxed' | 'untimed';

const DIFFICULTY_KEY = 'docquiz-ai.difficulty';

export function readDifficulty(): QuizDifficulty {
  if (typeof window === 'undefined') return 'challenge';
  const val = window.localStorage.getItem(DIFFICULTY_KEY);
  if (val === 'blitz' || val === 'challenge' || val === 'relaxed' || val === 'untimed') {
    return val;
  }
  return 'challenge';
}

export function writeDifficulty(difficulty: QuizDifficulty): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DIFFICULTY_KEY, difficulty);
  }
}

export function getTimeForDifficulty(difficulty: QuizDifficulty): number | null {
  switch (difficulty) {
    case 'blitz': return 15;
    case 'challenge': return 30;
    case 'relaxed': return 60;
    case 'untimed': return null;
    default: return 30;
  }
}