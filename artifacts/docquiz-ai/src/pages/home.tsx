import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { AlertCircle, ArrowRight, Check, FilePlus2, FileText, Loader2, RefreshCw, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react';
import { useLocation } from 'wouter';
import { useExtractDocument, useGenerateQuiz } from '@workspace/api-client-react';
import type { ExtractedDocument } from '@workspace/api-client-react';
import { AppShell, FileTypeIcon } from '@/components/app-shell';
import { readDocument, writeDocument, writeQuiz } from '@/lib/storage';

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [document, setDocument] = useState<ExtractedDocument | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [questionCount, setQuestionCount] = useState(5);
  const [uploadError, setUploadError] = useState('');
  const extractDocument = useExtractDocument();
  const generateQuiz = useGenerateQuiz();

  useEffect(() => {
    setDocument(readDocument());
  }, []);

  const upload = (file?: File) => {
    if (!file) return;
    setUploadError('');
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'pdf' && extension !== 'txt') {
      setUploadError('Choose a PDF or TXT file to continue.');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    const fileField = formData.get('file');
    if (!(fileField instanceof Blob)) {
      setUploadError('That file could not be read. Try uploading it again.');
      return;
    }
    extractDocument.mutate({ data: { file: fileField } }, {
      onSuccess: (result) => {
        writeDocument(result);
        setDocument(result);
      },
    });
  };

  const handleFileInput = (event: ChangeEvent<HTMLInputElement>) => upload(event.target.files?.[0]);
  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    upload(event.dataTransfer.files[0]);
  };

  const createQuiz = () => {
    if (!document || document.text.trim().length < 80) return;
    generateQuiz.mutate({
      data: { text: document.text, fileName: document.fileName, questionCount },
    }, {
      onSuccess: (quiz) => {
        writeQuiz(quiz);
        setLocation('/quiz');
      },
    });
  };

  const isUploading = extractDocument.isPending;
  const isGenerating = generateQuiz.isPending;
  const hasEnoughText = Boolean(document && document.text.trim().length >= 80);

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-5 pb-14 pt-8 md:px-10 md:pt-12">
        <div className="mb-10 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div className="fade-up">
            <p className="font-mono-ui mb-3 flex items-center gap-2 text-[10px] uppercase tracking-[.22em] text-primary"><span className="h-px w-5 bg-primary" /> Study desk / 01</p>
            <h1 className="max-w-xl text-[clamp(2.5rem,5vw,4.5rem)] leading-[.94] tracking-[-.045em] text-foreground">Read less.<br /><span className="font-display italic text-primary">Recall more.</span></h1>
            <p className="mt-5 max-w-md text-[15px] leading-7 text-muted-foreground">Drop in your notes. Your tutor will find the ideas worth remembering and turn them into a focused quiz.</p>
          </div>
          <div className="fade-up fade-up-delay-1 flex items-center gap-2 self-start rounded-full border border-border bg-card px-3 py-2 text-xs text-muted-foreground lg:mb-1 lg:self-auto">
            <ShieldCheck size={14} className="text-[hsl(165_38%_42%)]" /> Your notes stay in this study session
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <section className="fade-up fade-up-delay-1">
            <div
              className={`ink-grid relative overflow-hidden rounded-[22px] border-2 border-dashed bg-card p-6 transition-colors sm:p-9 ${isDragging ? 'border-primary bg-[hsl(var(--accent)/.14)]' : 'border-[hsl(var(--border))]'} ${isUploading ? 'pointer-events-none' : 'cursor-pointer hover:border-primary/70'}`}
              onClick={() => inputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              data-testid="dropzone-document"
            >
              <input ref={inputRef} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden" onChange={handleFileInput} data-testid="input-document" />
              <div className="relative flex min-h-[248px] flex-col items-center justify-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/.45)] text-secondary shadow-sm">
                  {isUploading ? <Loader2 size={27} className="animate-spin" /> : <UploadCloud size={27} strokeWidth={1.7} />}
                </div>
                <h2 className="text-lg font-bold tracking-[-.02em]">{isUploading ? 'Reading your notes…' : 'Bring your notes to the desk'}</h2>
                <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">{isUploading ? 'Pulling out the useful bits. This usually takes a moment.' : 'Drag and drop a PDF or TXT file here, or browse your files.'}</p>
                {!isUploading && <span className="mt-6 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-xs font-bold text-secondary-foreground"><FilePlus2 size={14} /> Choose a file</span>}
                <p className="font-mono-ui mt-5 text-[10px] uppercase tracking-[.16em] text-muted-foreground/70">PDF or TXT · max 120,000 characters</p>
              </div>
            </div>
            {uploadError && <div className="mt-3 flex items-center gap-2 text-sm text-destructive" role="alert" data-testid="status-upload-error"><AlertCircle size={15} /> {uploadError}</div>}
            {extractDocument.isError && <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert" data-testid="status-extract-error"><span className="flex items-center gap-2"><AlertCircle size={15} /> {getErrorMessage(extractDocument.error, 'We could not read that file.')}</span><button className="font-semibold underline underline-offset-2" onClick={() => inputRef.current?.click()} data-testid="button-retry-upload">Try again</button></div>}
          </section>

          <section className="fade-up fade-up-delay-2 flex flex-col rounded-[22px] border border-border bg-card p-6 paper-shadow sm:p-7">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="font-mono-ui text-[10px] uppercase tracking-[.18em] text-muted-foreground">Recent document</p>
                <h2 className="mt-1 text-lg font-bold tracking-[-.02em]">At your desk</h2>
              </div>
              <FileText size={20} className="text-muted-foreground/50" />
            </div>

            {document ? (
              <div className="flex flex-1 flex-col">
                <div className="rounded-2xl bg-[hsl(var(--muted)/.72)] p-4" data-testid="card-document">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-card"><FileTypeIcon type={document.fileType} /></span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold" title={document.fileName} data-testid="text-document-name">{document.fileName}</p>
                      <p className="font-mono-ui mt-1 text-[10px] uppercase tracking-[.1em] text-muted-foreground">{document.fileType} · ready to study</p>
                    </div>
                    <Check size={16} className="ml-auto shrink-0 text-[hsl(165_38%_42%)]" />
                  </div>
                  <div className="mt-5 grid grid-cols-3 divide-x divide-border text-center">
                    <div><p className="text-base font-bold">{formatNumber(document.wordCount)}</p><p className="font-mono-ui mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">words</p></div>
                    <div><p className="text-base font-bold">{formatNumber(document.characterCount)}</p><p className="font-mono-ui mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">characters</p></div>
                    <div><p className="text-base font-bold">{document.chunkCount}</p><p className="font-mono-ui mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">sections</p></div>
                  </div>
                </div>
                {document.warning && <p className="mt-3 text-xs leading-5 text-[hsl(35_65%_43%)]" data-testid="text-document-warning">{document.warning}</p>}
                {!hasEnoughText && <p className="mt-4 flex gap-2 text-xs leading-5 text-muted-foreground"><AlertCircle size={14} className="mt-0.5 shrink-0 text-[hsl(35_65%_43%)]" /> Add a longer set of notes. Your tutor needs at least 80 characters to make useful questions.</p>}
                <div className="mt-auto pt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <label htmlFor="question-count" className="text-xs font-semibold">Questions</label>
                    <select id="question-count" value={questionCount} onChange={(event) => setQuestionCount(Number(event.target.value))} className="rounded-lg border border-border bg-background px-2 py-1 text-xs font-bold outline-none focus:ring-2 focus:ring-ring" data-testid="select-question-count">
                      {[3, 5, 7, 10].map((count) => <option key={count} value={count}>{count}</option>)}
                    </select>
                  </div>
                  <button onClick={createQuiz} disabled={!hasEnoughText || isGenerating} className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0" data-testid="button-generate-quiz">
                    {isGenerating ? <><Loader2 size={16} className="animate-spin" /> Building your quiz…</> : <><Sparkles size={16} /> Make my quiz <ArrowRight size={15} /></>}
                  </button>
                  {generateQuiz.isError && <p className="mt-3 text-xs text-destructive" role="alert" data-testid="status-generate-error">{getErrorMessage(generateQuiz.error, 'Quiz generation failed. Try again.')}</p>}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-border px-5 py-10 text-center" data-testid="empty-recent-document">
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground"><FileText size={19} /></div>
                <p className="text-sm font-semibold">Nothing here yet</p>
                <p className="mt-2 max-w-[210px] text-xs leading-5 text-muted-foreground">Upload your first notes above and they will wait here.</p>
              </div>
            )}
          </section>
        </div>

        <section className="fade-up fade-up-delay-3 mt-12 grid gap-4 border-t border-border pt-7 sm:grid-cols-3">
          {[
            { icon: FileText, label: '01 / Import', copy: 'Your PDF or TXT becomes a clean study source.' },
            { icon: Sparkles, label: '02 / Distill', copy: 'The tutor spots concepts worth testing.' },
            { icon: RefreshCw, label: '03 / Recall', copy: 'Answer, reflect, and make it stick.' },
          ].map(({ icon: Icon, label, copy }) => (
            <div className="flex gap-3" key={label}>
              <Icon size={17} className="mt-0.5 shrink-0 text-primary" />
              <div><p className="font-mono-ui text-[10px] uppercase tracking-[.16em] text-primary">{label}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{copy}</p></div>
            </div>
          ))}
        </section>
      </div>
    </AppShell>
  );
}