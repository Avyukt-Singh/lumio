// Client-side AI API (chunk 5B). Thin typed wrappers around /api/ai/* with
// the same never-throw contract as accountClient. Error codes map to calm
// learner copy via i18n `ai.err.*` keys. The SSE reader is the single
// streaming path for Study Buddy and degrades to non-streamed requests when
// the browser cannot consume streams.

export type AiApiCode =
  | 'BAD_REQUEST'
  | 'SIGN_IN_REQUIRED'
  | 'AI_DISABLED'
  | 'CONSENT_REQUIRED'
  | 'OVER_BUDGET'
  | 'UNCONFIGURED'
  | 'UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'INVALID_RESPONSE'
  | 'BLOCKED_BY_POLICY'
  | 'SERVER_ERROR';

export type AiApiResult<T> = { ok: true; data: T } | { ok: false; code: AiApiCode };

export type AiLang = 'en' | 'hi' | 'hinglish';
export type AiBand = 'young' | 'middle' | 'sec' | 'senior' | 'dropper' | 'above';

export interface MistakeAiResult {
  explanation: string;
  misconception: string;
  /** chunk 5-AI feature 7: AI's suggested mistake tag (learner confirms). */
  suggestedTag?: 'concept' | 'careless' | 'calculation' | 'fact';
  practice: { text: string; options: string[]; answer: number; explanation: string };
}

export interface NotesAiResult {
  summary: string[];
  glossary: Array<{ term: string; meaning: string }>;
  flashcards: Array<{ front: string; back: string }>;
  questions: Array<{ text: string; options: string[]; answer: number; explanation: string }>;
}

export interface PracticeAiItem {
  text: string;
  options: string[];
  answer: number;
  explanation: string;
}

export interface PlanAiSuggestion {
  date: string;
  sessionIndex: number;
  newStartMin: number;
  reason: string;
}

// ---- chunk 5-AI result shapes (new Tier-1 features) ----

/** AI chapter lesson: fresh notes, key points, glossary and flashcards. */
export interface LessonAiResult {
  sections: Array<{ heading: string; text: string }>;
  keyPoints: string[];
  glossary: Array<{ term: string; meaning: string }>;
  flashcards: Array<{ front: string; back: string }>;
}

/** One AI worksheet item. options is non-empty for mcq only. */
export interface WorksheetAiItem {
  type: 'mcq' | 'fill' | 'short' | 'long' | 'numerical' | 'hots';
  text: string;
  options: string[];
  answer: string;
  marks: number;
}

export interface WorksheetAiResult {
  title: string;
  instructions: string;
  items: WorksheetAiItem[];
  dropped?: number;
}

/** AI-generated MCQ for the fresh-quiz flow. */
export interface QuizGenItem {
  text: string;
  options: string[];
  answer: number;
  explanation: string;
}

async function post<T>(path: string, body: unknown): Promise<AiApiResult<T>> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; code?: string } & Record<string, unknown>;
    if (json.ok) return { ok: true, data: json as T };
    return { ok: false, code: (json.code as AiApiCode) ?? 'SERVER_ERROR' };
  } catch {
    return { ok: false, code: 'UNAVAILABLE' };
  }
}

/** Streaming SSE reader for Study Buddy. Falls back to non-streamed JSON on failure.
 *  `signal` (optional) aborts the request — the promise still never throws; an
 *  aborted stream resolves `{ ok:false, code:'UNAVAILABLE' }` like any failure. */
export async function streamChat(
  body: {
    chapterId: string;
    chapterTitle: string;
    subject: string;
    summary: string;
    keyPoints: string[];
    glossary: Array<[string, string]>;
    question: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    hintLevel: number;
    band: AiBand;
    lang: AiLang;
  },
  onDelta: (piece: string) => void,
  signal?: AbortSignal
): Promise<AiApiResult<{ text: string; code?: AiApiCode }>> {
  try {
    const res = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
    if (!res.ok || !res.body) {
      const json = (await res.json().catch(() => ({}))) as { code?: string };
      return { ok: false, code: (json.code as AiApiCode) ?? 'UNAVAILABLE' };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    let full = '';
    let endCode: AiApiCode | undefined;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith('data:')) continue;
        try {
          const ev = JSON.parse(t.slice(5)) as { delta?: string; done?: boolean; code?: AiApiCode };
          if (ev.delta) {
            full += ev.delta;
            onDelta(ev.delta);
          }
          if (ev.done) {
            endCode = ev.code;
            if (ev.code) return { ok: false, code: ev.code };
            return { ok: true, data: { text: full } };
          }
        } catch {
          // partial JSON line — ignore
        }
      }
    }
    return { ok: true, data: { text: full } };
  } catch {
    return { ok: false, code: 'UNAVAILABLE' };
  }
}

export const aiApi = {
  chat: streamChat,
  mistake: (input: {
    chapterTitle: string;
    subject: string;
    question: { text: string; options: string[]; answer: number; explanation: string };
    chosen: number | null;
    band: AiBand;
    lang: AiLang;
  }) => post<{ data: MistakeAiResult; label: string; outputHash: string; crisis?: boolean }>('/api/ai/mistake', input),
  notes: (input: { noteId: string; noteName: string; noteText: string; band: AiBand; lang: AiLang }) =>
    post<{ data: NotesAiResult; label: string; cached?: boolean; outputHash: string; crisis?: boolean }>('/api/ai/notes', input),
  practice: (input: {
    chapterId: string;
    chapterTitle: string;
    subject: string;
    summary: string;
    keyPoints: string[];
    sample: { text: string; options: string[]; answer: number; explanation: string } | null;
    count: number;
    band: AiBand;
    lang: AiLang;
  }) => post<{ data: { items: PracticeAiItem[] }; label: string; dropped: number; outputHash: string }>('/api/ai/practice', input),
  plan: (input: {
    weakTopics: string[];
    mockSummary: string;
    examDate: string;
    freeWindows: string;
    commitments: string;
    sessions: Array<{
      date: string;
      index: number;
      subject: string;
      startMin: number;
      endMin: number;
      validStarts: number[];
      done: boolean;
    }>;
    lang: AiLang;
  }) => post<{ data: { suggestions: PlanAiSuggestion[]; note?: string }; dropped: number; outputHash: string }>('/api/ai/plan', input),
  nudge: (input: {
    exerciseTitle: string;
    statement: string;
    code: string;
    failingTests: Array<{ expected: string; got: string; error?: string }>;
    lang: AiLang;
  }) => post<{ data: string; label: string; outputHash: string; crisis?: boolean }>('/api/ai/nudge', input),
  // chunk 6: AI refinement of the deterministic syllabus day plan. The body
  // carries only public syllabus ids/titles, status/flag enums, mark shares,
  // exam buckets and slot lengths — never name, email, user id or notes.
  syllabusCoach: (input: {
    band: AiBand;
    lang: AiLang;
    includeNotes?: boolean;
    notes?: string[];
    slots: Array<{ index: number; subject: string; minutes: number }>;
    candidates: Array<{
      topicId: string;
      title: string;
      subjectId: string;
      slotIndex: number;
      activity: 'learn' | 'practise' | 'revise' | 'recall';
      minutes: number;
      status: 'not_started' | 'in_progress' | 'completed_unrated' | 'completed_confident' | 'completed_unsure';
      flags: string[];
      marksShare: number;
      examBucket: 'none' | 'soon' | 'later';
    }>;
  }) =>
    post<{ data: { summary: string; items: Array<{ slotIndex: number; topicIds: string[]; activity: string; minutes: number; reason: string }> }; dropped: number; outputHash: string }>(
      '/api/ai/syllabus-coach',
      input
    ),
  report: (input: { feature: string; output: string; note?: string }) =>
    post<{ recorded: boolean }>('/api/ai/report', input),
  // ---- chunk 5-AI Tier 1: lesson engine, fresh quiz, AI worksheet ----
  lesson: (input: {
    chapterId: string;
    chapterTitle: string;
    subject: string;
    summary: string;
    keyPoints: string[];
    glossary: Array<[string, string]>;
    mode: 'full' | 'simpler' | 'example' | 'translate';
    point?: string;
    interest?: string;
    band: AiBand;
    lang: AiLang;
  }) =>
    post<{ data: LessonAiResult; label: string; cached?: boolean; outputHash: string; crisis?: boolean }>(
      '/api/ai/lesson',
      input
    ),
  quizGen: (input: {
    chapterId: string;
    chapterTitle: string;
    subject: string;
    summary: string;
    keyPoints: string[];
    difficulty: 'easy' | 'medium' | 'hard';
    count: number;
    wrongTexts?: string[];
    band: AiBand;
    lang: AiLang;
  }) =>
    post<{ data: { items: QuizGenItem[] }; label: string; dropped: number; outputHash: string }>(
      '/api/ai/quiz',
      input
    ),
  worksheet: (input: {
    chapterTitle: string;
    subject: string;
    summary: string;
    keyPoints: string[];
    difficulty: 'easy' | 'medium' | 'hard';
    band: AiBand;
    lang: AiLang;
  }) =>
    post<{ data: WorksheetAiResult; label: string; outputHash: string; crisis?: boolean }>(
      '/api/ai/worksheet',
      input
    ),
  // chunk 5-AI feature 6: photo/scan of notes -> extracted text (checked by the
  // learner before anything is saved). image is a downscaled JPEG data URL.
  ocr: (input: { image: string; band: AiBand; lang: AiLang }) =>
    post<{ data: { text: string }; label: string }>('/api/ai/ocr', input),
  // ---- chunk 5-AI Tier 2: mock paper, study coach, guardian narrative ----
  mock: (input: {
    exam: 'school' | 'jee' | 'neet' | 'cuet';
    subject: string;
    chapters: string[];
    count: number;
    band: AiBand;
    lang: AiLang;
  }) =>
    post<{
      data: {
        title: string;
        sections: Array<{
          name: string;
          instructions: string;
          questions: Array<{
            text: string;
            options: string[];
            answer: number;
            marks: number;
            chapter: string;
            explanation: string;
          }>;
        }>;
        total: number;
        dropped: number;
      } | null;
      label: string;
      outputHash: string;
      crisis?: boolean;
    }>('/api/ai/mock', input),
  coach: (input: {
    mode: 'why' | 'reflect' | 'qotd';
    planSummary: string;
    weakTopics: string[];
    streak: number;
    xpLast7: number;
    focusMins7: number;
    mocksSummary: string;
    band: AiBand;
    lang: AiLang;
  }) =>
    post<{ data: { text: string }; label: string; cached?: boolean; outputHash: string }>(
      '/api/ai/coach',
      input
    ),
  guardian: (input: {
    daysActive7: number;
    xp7: number;
    focusMins7: number;
    chaptersCompleted: number;
    chaptersMastered: number;
    mocks7: number;
    streak: number;
    lang: AiLang;
  }) =>
    post<{ data: { headline: string; text: string }; label: string; cached?: boolean }>(
      '/api/ai/guardian',
      input
    ),
  budget: () => fetch('/api/ai/budget', { cache: 'no-store' }).then((r) => r.json()) as Promise<{
    ok: boolean;
    enabled?: boolean;
    calls?: number;
    callsLeft?: number;
    callsCap?: number;
    code?: AiApiCode;
  }>,
  enable: (enabled: boolean) => post<{ enabled: boolean }>('/api/ai/enable', { enabled }),
};
