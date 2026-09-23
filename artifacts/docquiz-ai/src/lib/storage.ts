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