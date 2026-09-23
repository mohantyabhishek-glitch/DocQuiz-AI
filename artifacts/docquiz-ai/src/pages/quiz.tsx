import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CircleAlert, RotateCcw, Sparkles, X, Loader2 } from 'lucide-react';
import { Link } from 'wouter';
import { useGenerateQuiz } from '@workspace/api-client-react';
import type { Quiz, QuizQuestion } from '@workspace/api-client-react';
import { AppShell } from '@/components/app-shell';
import { readDocument, readQuiz, writeQuiz } from '@/lib/storage';

function letter(index: number): string {
  return String.fromCharCode(65 + index);
}

function scoreLabel(score: number, total: number): string {
  const ratio = total ? score / total : 0;
  if (ratio === 1) return 'Perfect recall';
  if (ratio >= 0.75) return 'Strong foundation';
  if (ratio >= 0.5) return 'Good start';
  return 'Worth another pass';
}

function EmptyQuiz() {
  return (
    <AppShell>
      <div className="mx-auto flex min-h-[calc(100dvh-68px)] max-w-xl items-center justify-center px-5 py-12 md:min-h-[100dvh]">
        <div className="w-full rounded-[24px] border border-border bg-card p-8 text-center paper-shadow sm:p-12">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/.5)] text-secondary"><Sparkles size={25} /></div>
          <p className="font-mono-ui text-[10px] uppercase tracking-[.2em] text-primary">Your quiz is waiting</p>
          <h1 className="font-display mt-3 text-4xl italic tracking-[-.03em]">Start with a set of notes.</h1>
          <p className="mx-auto mt-4 max-w-sm text-sm leading-6 text-muted-foreground">Upload a PDF or TXT on your study desk and your tutor will build a quiz here.</p>
          <Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5" data-testid="link-upload-notes"><ArrowLeft size={16} /> Upload notes</Link>
        </div>
      </div>
    </AppShell>
  );
}

function Results({
  quiz,
  answers,
  onRestart,
  onGenerateNew,
  isGeneratingNew,
  questionCount,
  setQuestionCount,
}: {
  quiz: Quiz;
  answers: (number | null)[];
  onRestart: () => void;
  onGenerateNew: () => void;
  isGeneratingNew: boolean;
  questionCount: number;
  setQuestionCount: (count: number) => void;
}) {
  const score = quiz.questions.reduce((total, question, index) => total + (answers[index] === question.correctAnswerIndex ? 1 : 0), 0);
  const percentage = quiz.questions.length ? Math.round((score / quiz.questions.length) * 100) : 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-5 pb-14 pt-8 md:px-10 md:pt-12">
        <div className="fade-up mb-8 flex items-start justify-between gap-5">
          <div>
            <p className="font-mono-ui mb-3 text-[10px] uppercase tracking-[.2em] text-primary">Session complete / 03</p>
            <h1 className="text-4xl tracking-[-.04em] sm:text-5xl">You made it stick.</h1>
            <p className="mt-3 text-sm text-muted-foreground">{quiz.title}</p>
          </div>
          <Link href="/" className="hidden items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground sm:flex" data-testid="link-new-notes"><ArrowLeft size={14} /> New notes</Link>
        </div>

        <div className="grid gap-5 md:grid-cols-[.85fr_1.15fr]">
          <section className="fade-up fade-up-delay-1 flex flex-col rounded-[22px] bg-secondary p-7 text-secondary-foreground paper-shadow sm:p-9">
            <p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-secondary-foreground/55">Your score</p>
            <div className="mt-6 flex items-end gap-2"><span className="font-display text-8xl leading-none text-[hsl(var(--accent))]">{score}</span><span className="mb-2 text-sm text-secondary-foreground/55">/ {quiz.questions.length}</span></div>
            <p className="mt-4 text-lg font-bold">{scoreLabel(score, quiz.questions.length)}</p>
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-secondary-foreground/15"><div className="h-full rounded-full bg-[hsl(var(--accent))] transition-all" style={{ width: `${percentage}%` }} /></div>
            <p className="mt-2 text-right font-mono-ui text-[10px] uppercase tracking-wider text-secondary-foreground/55">{percentage}% correct</p>

            <div className="mt-8 space-y-3">
              <div className="rounded-xl bg-secondary-foreground/10 p-3">
                <label className="text-[11px] font-semibold text-secondary-foreground/80 block mb-1.5">Next quiz length:</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[3, 5, 7, 10].map((count) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => setQuestionCount(count)}
                      className={`rounded-lg py-1.5 text-xs font-bold transition-all ${
                        questionCount === count
                          ? 'bg-[hsl(var(--accent))] text-accent-foreground font-black shadow-sm'
                          : 'bg-secondary-foreground/15 text-secondary-foreground/80 hover:bg-secondary-foreground/25'
                      }`}
                    >
                      {count} Qs
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={onGenerateNew}
                disabled={isGeneratingNew}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[hsl(var(--accent))] px-4 py-3.5 text-sm font-bold text-accent-foreground transition-transform hover:-translate-y-0.5 disabled:opacity-50"
                data-testid="button-new-questions"
              >
                <Sparkles size={16} /> {isGeneratingNew ? 'Building new questions…' : `Get New Questions (${questionCount} Qs)`}
              </button>

              <button
                onClick={onRestart}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-secondary-foreground/20 px-4 py-2.5 text-xs font-bold text-secondary-foreground/80 transition-colors hover:bg-secondary-foreground/10 hover:text-secondary-foreground"
                data-testid="button-restart-quiz"
              >
                <RotateCcw size={14} /> Retake this exact quiz
              </button>
            </div>
          </section>

          <section className="fade-up fade-up-delay-2 rounded-[22px] border border-border bg-card p-6 paper-shadow sm:p-8">
            <div className="mb-5 flex items-center justify-between">
              <div><p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground">Answer key</p><h2 className="mt-1 text-lg font-bold">A quick review</h2></div>
              <span className="rounded-full bg-muted px-3 py-1.5 font-mono-ui text-[10px] text-muted-foreground">{score} right</span>
            </div>
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {quiz.questions.map((question, index) => {
                const correct = answers[index] === question.correctAnswerIndex;
                return (
                  <div className={`rounded-xl border p-4 ${correct ? 'border-[hsl(165_38%_42%/.26)] bg-[hsl(165_38%_42%/.06)]' : 'border-primary/20 bg-primary/5'}`} key={question.id} data-testid={`review-question-${question.id}`}>
                    <div className="flex items-start gap-3">
                      <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${correct ? 'bg-[hsl(165_38%_42%)] text-card' : 'bg-primary text-primary-foreground'}`}>{correct ? <Check size={12} /> : <X size={12} />}</span>
                      <div className="min-w-0"><p className="text-sm font-semibold leading-5">{index + 1}. {question.question}</p><p className="mt-1.5 text-xs leading-5 text-muted-foreground">{correct ? 'Correct' : `Correct answer: ${question.options[question.correctAnswerIndex]}`}</p></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
        <Link href="/" className="mt-7 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground sm:hidden" data-testid="link-mobile-new-notes"><ArrowLeft size={14} /> Start with new notes</Link>
      </div>
    </AppShell>
  );
}

function QuestionCard({ question, questionNumber, total, selected, onSelect, onNext }: { question: QuizQuestion; questionNumber: number; total: number; selected: number | null; onSelect: (index: number) => void; onNext: () => void }) {
  const hasAnswered = selected !== null;
  const isCorrect = selected === question.correctAnswerIndex;
  return (
    <div className="fade-up mx-auto max-w-3xl">
      <div className="mb-7 flex items-center justify-between gap-4">
        <p className="font-mono-ui text-[10px] uppercase tracking-[.19em] text-muted-foreground">Question {String(questionNumber).padStart(2, '0')} <span className="mx-1 text-border">/</span> {String(total).padStart(2, '0')}</p>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-muted sm:w-44"><div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${(questionNumber / total) * 100}%` }} /></div>
      </div>
      <h1 className="max-w-2xl text-[clamp(1.8rem,4vw,3.35rem)] leading-[1.06] tracking-[-.04em]" data-testid={`text-question-${question.id}`}>{question.question}</h1>
      <div className="mt-8 grid gap-3" role="radiogroup" aria-label="Answer choices">
        {question.options.map((option, index) => {
          const chosen = selected === index;
          const right = hasAnswered && index === question.correctAnswerIndex;
          const wrong = hasAnswered && chosen && !right;
          return (
            <button key={option} onClick={() => onSelect(index)} disabled={hasAnswered} className={`group flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-left transition-all sm:px-5 ${right ? 'border-[hsl(165_38%_42%/.55)] bg-[hsl(165_38%_42%/.09)]' : wrong ? 'border-primary/55 bg-primary/7' : chosen ? 'border-secondary bg-secondary/5' : 'border-border bg-card hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-sm'} disabled:cursor-default`} data-testid={`button-answer-${question.id}-${index}`}>
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-mono-ui text-xs font-medium ${right ? 'bg-[hsl(165_38%_42%)] text-card' : wrong ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-[hsl(var(--accent))] group-hover:text-accent-foreground'}`}>{right ? <Check size={16} /> : wrong ? <X size={16} /> : letter(index)}</span>
              <span className="text-sm font-semibold leading-5">{option}</span>
            </button>
          );
        })}
      </div>
      {hasAnswered && (
        <div className={`mt-5 rounded-2xl border p-5 ${isCorrect ? 'border-[hsl(165_38%_42%/.25)] bg-[hsl(165_38%_42%/.07)]' : 'border-primary/20 bg-primary/5'}`} data-testid="panel-feedback">
          <div className="flex gap-3">
            <span className={`mt-0.5 ${isCorrect ? 'text-[hsl(165_38%_42%)]' : 'text-primary'}`}>{isCorrect ? <Check size={18} /> : <CircleAlert size={18} />}</span>
            <div><p className="text-sm font-bold">{isCorrect ? 'That is right.' : `Not quite. The answer is ${letter(question.correctAnswerIndex)}.`}</p><p className="mt-1.5 text-sm leading-6 text-muted-foreground">{question.explanation}</p></div>
          </div>
        </div>
      )}
      <div className="mt-7 flex justify-end">
        <button onClick={onNext} disabled={!hasAnswered} className="flex items-center gap-2 rounded-xl bg-secondary px-5 py-3 text-sm font-bold text-secondary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:translate-y-0" data-testid="button-next-question">{questionNumber === total ? 'See results' : 'Next question'} <ArrowRight size={16} /></button>
      </div>
    </div>
  );
}

export default function QuizPage() {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [complete, setComplete] = useState(false);
  const [questionCount, setQuestionCount] = useState(5);
  const generateQuiz = useGenerateQuiz();

  useEffect(() => {
    const savedQuiz = readQuiz();
    setQuiz(savedQuiz);
    if (savedQuiz) {
      setAnswers(Array(savedQuiz.questions.length).fill(null));
      setQuestionCount(savedQuiz.questions.length);
    }
  }, []);

  const handleGenerateNew = (overrideCount?: number) => {
    const doc = readDocument();
    if (!doc || doc.text.trim().length < 80) return;
    const targetCount = overrideCount ?? questionCount;
    generateQuiz.mutate({
      data: { text: doc.text, fileName: doc.fileName, questionCount: targetCount },
    }, {
      onSuccess: (newQuiz) => {
        writeQuiz(newQuiz);
        setQuiz(newQuiz);
        setCurrentIndex(0);
        setAnswers(Array(newQuiz.questions.length).fill(null));
        setComplete(false);
      },
    });
  };

  const currentQuestion = useMemo(() => quiz?.questions[currentIndex], [quiz, currentIndex]);
  if (!quiz || !currentQuestion) return <EmptyQuiz />;

  const selected = answers[currentIndex] ?? null;
  const selectAnswer = (index: number) => {
    if (selected !== null) return;
    setAnswers((current) => current.map((answer, answerIndex) => answerIndex === currentIndex ? index : answer));
  };
  const next = () => {
    if (currentIndex === quiz.questions.length - 1) setComplete(true);
    else setCurrentIndex((current) => current + 1);
  };
  const restart = () => {
    setCurrentIndex(0);
    setAnswers(Array(quiz.questions.length).fill(null));
    setComplete(false);
  };

  if (complete) {
    return (
      <Results
        quiz={quiz}
        answers={answers}
        onRestart={restart}
        onGenerateNew={() => handleGenerateNew()}
        isGeneratingNew={generateQuiz.isPending}
        questionCount={questionCount}
        setQuestionCount={setQuestionCount}
      />
    );
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-5 pb-14 pt-8 md:px-10 md:pt-12">
        <div className="mb-12 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono-ui mb-2 text-[10px] uppercase tracking-[.2em] text-primary">Recall session / 02</p>
            <p className="truncate text-sm font-bold" data-testid="text-quiz-title">{quiz.title}</p>
            <p className="mt-1 truncate text-xs text-muted-foreground" data-testid="text-quiz-source">{quiz.sourceFileName}</p>
            {quiz.isDemo && <p className="mt-2 text-[11px] text-[hsl(35_65%_43%)]">Local fallback quiz — connect a valid OpenAI key for AI-generated questions.</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={() => handleGenerateNew()}
              disabled={generateQuiz.isPending}
              className="flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/10 px-3.5 py-2.5 text-xs font-bold text-primary transition-all hover:bg-primary/20 disabled:opacity-50"
              data-testid="button-header-new-quiz"
            >
              {generateQuiz.isPending ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              <span>Get New Questions</span>
            </button>
            <Link href="/" className="flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground" data-testid="link-quiz-home">
              <ArrowLeft size={14} /> <span className="hidden sm:inline">Study desk</span>
            </Link>
          </div>
        </div>
        <QuestionCard question={currentQuestion} questionNumber={currentIndex + 1} total={quiz.questions.length} selected={selected} onSelect={selectAnswer} onNext={next} />
      </div>
    </AppShell>
  );
}