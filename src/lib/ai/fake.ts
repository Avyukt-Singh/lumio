// The deterministic fake adapter (chunk 5B). Every AI screen can be demoed,
// verified and shown to a learner with NO key and NO network: outputs are
// fixture-driven from `req.meta`, clearly labelled with the fake marker, and
// tuned by FAKE_LATENCY_MS / FAKE_FAIL_RATE. Outputs are honest samples —
// the UI still labels them "AI" and "practice only" exactly like real output.
import 'server-only';
import { fakeTuning } from './env';
import { fakeShouldFail, type LlmAdapter, type LlmRequest, type LlmResult, type StreamEvent, type StreamingAdapter } from './gateway';

type Lang = 'en' | 'hi' | 'hinglish';
const str = (meta: Record<string, unknown>, k: string, d = ''): string =>
  typeof meta[k] === 'string' ? (meta[k] as string) : d;
const num = (meta: Record<string, unknown>, k: string, d = 0): number =>
  typeof meta[k] === 'number' ? (meta[k] as number) : d;
const lang = (meta: Record<string, unknown>): Lang => {
  const v = str(meta, 'lang', 'en');
  return v === 'hi' || v === 'hinglish' ? v : 'en';
};

const FAKE_MARK = {
  en: '[Sample answer — AI helper is in demo mode]',
  hi: '[नमूना उत्तर — AI सहायक डेमो मोड में है]',
  hinglish: '[Sample jawab — AI helper demo mode mein hai]',
};

export class FakeAdapter implements StreamingAdapter {
  readonly name = 'fake';

  async complete(req: LlmRequest): Promise<LlmResult> {
    const latency = fakeTuning.latencyMs();
    if (latency > 0) await new Promise((r) => setTimeout(r, latency));
    if (fakeShouldFail()) {
      return { ok: false, code: 'UNAVAILABLE', detail: 'fake-fail-rate', retryable: true };
    }
    const text = fixture(req);
    const tokensIn = Math.round(req.messages.reduce((n, m) => n + m.content.length, 0) / 4);
    return { ok: true, value: { text, tokensIn, tokensOut: Math.round(text.length / 4), adapter: this.name } };
  }

  async *stream(req: LlmRequest): AsyncGenerator<StreamEvent, void, unknown> {
    const res = await this.complete(req);
    if (!res.ok || !res.value) {
      yield { done: true, code: res.code ?? 'UNAVAILABLE' };
      return;
    }
    // Emit in word chunks so the UI's typing rendering is exercised.
    const words = res.value.text.split(/(\s+)/);
    for (const w of words) {
      yield { delta: w };
      if (fakeTuning.latencyMs() > 0) {
        await new Promise((r) => setTimeout(r, Math.min(30, fakeTuning.latencyMs() / 8)));
      }
    }
    yield { done: true };
  }
}

// ---------- fixtures ----------

function fixture(req: LlmRequest): string {
  const meta = req.meta ?? {};
  const l = lang(meta);
  switch (req.feature) {
    case 'studybuddy':
      return studyBuddy(meta, l);
    case 'codelab':
      return codeNudge(meta, l);
    case 'coachline':
      return coachLine(meta, l);
    default:
      return req.json === true ? JSON.stringify(jsonFixture(req, meta, l)) : coachLine(meta, l);
  }
}

function studyBuddy(meta: Record<string, unknown>, l: Lang): string {
  const chapter = str(meta, 'chapterTitle', 'this chapter');
  const subject = str(meta, 'subject', '');
  const hintLevel = num(meta, 'hintLevel', 1);
  const decline = meta.decline === true;
  const mark = FAKE_MARK[l];

  if (decline) {
    const body = {
      en: `Good question — but that is outside "${chapter}". I can help with ${subject} topics from this chapter: the key ideas, the glossary words, and the practice questions. Ask me one of those?`,
      hi: `अच्छा सवाल — लेकिन वह "${chapter}" से बाहर है। मैं इस अध्याय के ${subject} विषयों में मदद कर सकता हूँ: मुख्य बातें, शब्दावली और अभ्यास प्रश्न। उनमें से एक पूछें?`,
      hinglish: `Badhiya sawaal — lekin wo "${chapter}" ke bahar hai. Main is chapter ke ${subject} topics mein help kar sakta hoon: key points, glossary words aur practice questions. Unme se ek poochein?`,
    }[l];
    return `${mark}\n\n${body}`;
  }

  const step = str(meta, 'keyPoint', 'the main idea of this chapter');
  const ladder = {
    en: [
      `Let us think it through. In "${chapter}", which part of **${step}** do you think decides the answer? Start from what happens first.`,
      `Bigger hint: "${chapter}" works because ${step}. Try applying that to your question — what changes?`,
      `Worked step: 1) Identify what is given. 2) Use the idea that ${step}. 3) Apply it to what is asked. Try step 1 and tell me what you get.`,
      `Answer: following "${chapter}", the result comes from ${step}. Check it against the chapter summary, and ask again if any step is unclear.`,
    ],
    hi: [
      `चलिए सोचते हैं। "${chapter}" में **${step}** का कौन-सा हिस्सा उत्तर तय करता है? पहले क्या होता है, वहाँ से शुरू करें।`,
      `बड़ा संकेत: "${chapter}" काम करता है क्योंकि ${step}। इसे अपने सवाल पर लगाएँ — क्या बदलता है?`,
      `हल का चरण: 1) दिया हुआ पहचानें। 2) यह विचार लगाएँ कि ${step}। 3) पूछे गए पर लागू करें। चरण 1 आज़माकर बताएँ क्या मिला।`,
      `उत्तर: "${chapter}" के अनुसार परिणाम ${step} से आता है। अध्याय सारांश से मिलाएँ, और कोई चरण अस्पष्ट हो तो फिर पूछें।`,
    ],
    hinglish: [
      `Chalo sochte hain. "${chapter}" mein **${step}** ka kaunsa hissa answer decide karta hai? Pehle kya hota hai, wahan se shuru karein.`,
      `Bada hint: "${chapter}" kaam karta hai kyunki ${step}. Ise apne sawaal par lagayein — kya badalta hai?`,
      `Step-by-step: 1) Given cheez pehchanein. 2) Idea lagayein ki ${step}. 3) Jo poocha hai uspar apply karein. Step 1 try karke bataein kya mila.`,
      `Answer: "${chapter}" ke hisaab se result ${step} se aata hai. Chapter summary se check karein, aur koi step clear na ho to dobara poochein.`,
    ],
  }[l];
  const idx = Math.min(Math.max(hintLevel, 1), 4) - 1;
  return `${mark}\n\n${ladder[idx]}\n\n_AI can make mistakes. Check with your textbook or teacher._`;
}

function codeNudge(meta: Record<string, unknown>, l: Lang): string {
  const ex = str(meta, 'exerciseTitle', 'this exercise');
  const fail = str(meta, 'failingTest', 'one test is failing');
  const mark = FAKE_MARK[l];
  const body = {
    en: `Looking at "${ex}": ${fail}. That usually means the value you return is built in the wrong order. Re-read your loop — what does the variable hold on the LAST pass? Print it once before returning to see. (Nudge only — the full solution is yours to write.)`,
    hi: `"${ex}" को देखते हुए: ${fail}। ऐसा अक्सर तब होता है जब आप जो मान लौटाते हैं वह गलत क्रम में बनता है। अपना लूप फिर पढ़ें — आख़िरी बार में वेरिएबल में क्या रहता है? देखने के लिए return से पहले एक बार print करें। (केवल संकेत — पूरा हल आपको लिखना है।)`,
    hinglish: `"${ex}" dekhte hue: ${fail}. Aksar tab hota hai jab return karne wali value galat order mein banti hai. Loop dobara padhein — last pass mein variable mein kya rehta hai? Dekhne ke liye return se pehle ek baar print karein. (Sirf nudge — poora solution aapko likhna hai.)`,
  }[l];
  return `${mark}\n\n${body}\n\n_AI can make mistakes. Check with your textbook or teacher._`;
}

function coachLine(meta: Record<string, unknown>, l: Lang): string {
  const streak = num(meta, 'streak', 0);
  const due = num(meta, 'due', 0);
  const sessions = num(meta, 'sessions', 0);
  const mark = FAKE_MARK[l];
  const line = {
    en:
      sessions > 0
        ? `You have ${sessions} study session${sessions === 1 ? '' : 's'} today${streak > 0 ? ` and a ${streak}-day streak going` : ''}. Start with the first one — small steps win.${due > 0 ? ` ${due} card${due === 1 ? '' : 's'} are due for review too.` : ''}`
        : due > 0
          ? `${due} card${due === 1 ? '' : 's'} to review today — a five-minute start keeps everything fresh.`
          : `Nothing is due right now. Reading one chapter summary is a fine way to keep momentum.`,
    hi:
      sessions > 0
        ? `आज आपके ${sessions} अध्ययन सत्र हैं${streak > 0 ? ` और ${streak} दिन की लकीर चल रही है` : ''}। पहले सत्र से शुरू करें — छोटे कदम जीतते हैं।${due > 0 ? ` ${due} कार्ड समीक्षा के लिए बाकी हैं।` : ''}`
        : due > 0
          ? `आज ${due} कार्ड समीक्षा के लिए हैं — पाँच मिनट की शुरुआत सब ताज़ा रखती है।`
          : `अभी कुछ बाकी नहीं है। एक अध्याय का सारांश पढ़ना भी अच्छा तरीका है।`,
    hinglish:
      sessions > 0
        ? `Aaj aapke ${sessions} study session hain${streak > 0 ? ` aur ${streak} din ka streak chal raha hai` : ''}. Pehle session se shuru karein — chhote steps jeethte hain.${due > 0 ? ` ${due} cards review ke liye baaki hain.` : ''}`
        : due > 0
          ? `Aaj ${due} cards review karne hain — 5 minute ki shuruaat sab fresh rakhti hai.`
          : `Abhi kuch due nahi hai. Ek chapter ka summary padhna bhi momentum rakhega.`,
  }[l];
  return `${mark} ${line}`;
}

// Deterministic JSON fixtures for schema-validated features.
function jsonFixture(req: LlmRequest, meta: Record<string, unknown>, l: Lang): unknown {
  const topic = str(meta, 'topic', str(meta, 'chapterTitle', 'the chapter'));
  const langNote = { en: '', hi: '(हिंदी)', hinglish: '(Hinglish)' }[l];
  switch (req.feature) {
    case 'mistake': {
      const qText = str(meta, 'questionText', 'the question');
      return {
        explanation: `${FAKE_MARK[l]} In "${topic}", the key idea is that the main rule of the chapter decides which option is right. Your answer picks the option that looks familiar, but the rule points to the correct one. Re-read the last line of the question carefully.${langNote}`,
        misconception: `Thinking "${topic}" questions are solved by memory alone instead of applying the main rule.`,
        practice: {
          text: `Practice-only sample: In ${topic}, if the first condition changes, which of the following must be re-checked first?`,
          options: ['The final answer', 'The rule that decides the outcome', 'The question number', 'Nothing changes'],
          answer: 1,
          explanation: 'The rule that decides the outcome must be re-checked first — that is the chapter\'s core idea.',
        },
      };
    }
    case 'notes': {
      const cards = Array.from({ length: 4 }, (_, i) => ({
        front: `${topic} — key idea ${i + 1}?`,
        back: `From your note: the ${['definition', 'example', 'rule', 'exception'][i]} that the note explains for ${topic}.`,
      }));
      return {
        summary: [
          `${FAKE_MARK[l]} AI summary of your document — the note defines ${topic} and gives one example.`,
          `It states the main rule, then lists what changes when the inputs change.`,
          `The last part connects ${topic} to the next topic in the chapter.`,
        ],
        glossary: [
          { term: topic, meaning: `Defined in your note — the central concept of this document.` },
          { term: 'Application', meaning: 'Where the note shows the idea used in a worked example.' },
        ],
        flashcards: cards,
        questions: [
          {
            text: `Sample practice-only question from your note: which statement best matches what the note says about ${topic}?`,
            options: [
              'The main rule as stated in the note',
              'The opposite of the note',
              'Something from another chapter',
              'None of these',
            ],
            answer: 0,
            explanation: 'The note states the main rule directly — option A matches it.',
          },
          {
            text: `Second sample question: how many examples does the note give for ${topic}?`,
            options: ['None', 'One', 'Two', 'Ten'],
            answer: 1,
            explanation: 'The note gives one worked example.',
          },
        ],
      };
    }
    case 'practice': {
      return {
        items: [
          {
            text: `Beta practice (AI-written, not reviewed) on ${topic}: apply the chapter's main rule to a new case — which option follows?`,
            options: ['The rule applied directly', 'A random guess', 'An unrelated chapter rule', 'None of these'],
            answer: 0,
            explanation: 'Applying the main rule directly gives the correct result.',
          },
          {
            text: `Beta practice 2 on ${topic}: if one input doubles, what happens to the outcome according to the chapter?`,
            options: ['It stays the same', 'It follows the rule the chapter states', 'It becomes negative', 'It cannot be found'],
            answer: 1,
            explanation: 'The chapter states how the outcome responds to input changes.',
          },
          {
            text: `Beta practice 3 on ${topic}: which step comes first when solving?`,
            options: ['Identify what is given', 'Write the answer', 'Choose an option', 'Skip to the end'],
            answer: 0,
            explanation: 'Identifying what is given always comes first.',
          },
        ],
      };
    }
    case 'plancoach': {
      // Suggestions are validated against the deterministic scheduler before
      // display; this fake returns plausible moves the validator accepts.
      const moves = meta.moves as string[] | undefined;
      return {
        suggestions: (moves ?? []).map((m) => {
          const [date, sessionIndex, newStartMin] = m.split('#');
          return {
            date,
            sessionIndex: Number(sessionIndex),
            newStartMin: Number(newStartMin),
            reason: `${FAKE_MARK[l]} Your free window fits this session better; the deterministic scheduler confirmed this start time is valid.`,
          };
        }),
        note: 'AI suggestion — preview and accept each move; the scheduler stays the source of truth.',
      };
    }
    case 'practice-solve': {
      // Deterministic solver fixture: agrees with the key it is given (the
      // real adapter genuinely re-solves; under the fake the double-solve
      // check is vacuous and passes — documented in AI_SETUP.md).
      return { answerIndex: num(meta, 'answer', 0) };
    }
    case 'syllabus-day-coach': {
      // Echoes the deterministic candidate keys (topicId#slotIndex#activity#minutes)
      // the route computed from the learner's own marks — the route's validator
      // re-checks everything either way, so the deterministic plan stays the
      // source of truth (same pattern as plancoach).
      const keys = meta.items as string[] | undefined;
      return {
        summary: `${FAKE_MARK[l]} Your own marks shaped today's plan — take the sessions in order and the day adds up.`,
        items: (keys ?? []).map((m) => {
          const [topicId, slotIndex, activity, minutes] = m.split('#');
          return {
            slotIndex: Number(slotIndex),
            topicIds: [topicId],
            activity,
            minutes: Number(minutes),
            reason: `${FAKE_MARK[l]} Your marks put this next — good place to start.`,
          };
        }),
      };
    }
    default:
      return { note: 'fixture' };
  }
}
