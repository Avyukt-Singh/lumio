// Email templates (chunk 5A). Short, kind, plain text first plus a minimal
// HTML version. The 6-digit code sits large and alone on its own line. No
// links and no tracking pixels anywhere — the OTP is the proof, links are the
// phishing vector. Each template carries one Hindi line per the spec.
import 'server-only';

export type TemplatePurpose = 'signup' | 'login' | 'reset' | 'delete';

const PURPOSE_WORDS: Record<TemplatePurpose, string> = {
  signup: 'to finish creating your Lumio account',
  login: 'to sign in to Lumio',
  reset: 'to reset your Lumio password',
  delete: 'to delete your Lumio account',
};

const PURPOSE_WORDS_HI: Record<TemplatePurpose, string> = {
  signup: 'अपना Lumio खाता बनाने के लिए',
  login: 'Lumio में साइन इन करने के लिए',
  reset: 'अपना Lumio पासवर्ड रीसेट करने के लिए',
  delete: 'अपना Lumio खाता हटाने के लिए',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function otpEmail(
  email: string,
  purpose: TemplatePurpose,
  code: string,
  /** Optional honest notice, e.g. the anti-enumeration "already have an account" line. */
  notice?: string
): {
  subject: string;
  text: string;
  html: string;
} {
  const words = PURPOSE_WORDS[purpose];
  const wordsHi = PURPOSE_WORDS_HI[purpose];
  const noticeHtml = notice
    ? `<p style="margin:.75rem 0;font-weight:600">${esc(notice)}</p>`
    : '';
  const subject = `Your Lumio code: ${code}`;
  const text = [
    ...(notice ? [notice, ''] : []),
    `Use this code ${words}:`,
    '',
    code,
    '',
    'This code works for 10 minutes.',
    `यह कोड ${wordsHi} है — यह 10 मिनट तक चलेगा।`,
    '',
    'If you didn\u2019t ask for this, you can ignore this email; nobody can use it without the code.',
    'अगर आपने यह कोड नहीं माँगा, तो इस ईमेल को नज़रअंदाज़ करें — कोड के बिना कोई इसे इस्तेमाल नहीं कर सकता।',
  ].join('\n');
  const html = [
    '<div style="font-family:system-ui,sans-serif;max-width:32rem;margin:0 auto;padding:1.5rem;color:#1a1a1a">',
    noticeHtml,
    `<p style="margin:0 0 1rem">Use this code ${esc(words)}:</p>`,
    `<p style="font-size:2rem;letter-spacing:.35em;font-weight:700;margin:1rem 0">${esc(code)}</p>`,
    '<p style="margin:0 0 .5rem">This code works for 10 minutes.</p>',
    `<p style="margin:0 0 1rem">\u0905\u0917\u0930 \u0906\u092a\u0928\u0947 \u092f\u0939 \u0915\u094b\u0921 \u0928\u0939\u0940\u0902 \u092e\u093e\u0901\u0917\u093e, \u0924\u094b \u0907\u0938 \u0908\u092e\u0947\u0932 \u0915\u094b \u0928\u091c\u093c\u0930\u0905\u0902\u0926\u093e\u091c\u093c \u0915\u0930\u0947\u0902 \u2014 \u0915\u094b\u0921 \u0915\u0947 \u092c\u093f\u0928\u093e \u0915\u094b\u0908 \u0907\u0938\u0947 \u0907\u0938\u094d\u0924\u0947\u092e\u093e\u0932 \u0928\u0939\u0940\u0902 \u0915\u0930 \u0938\u0915\u0924\u093e\u0964</p>`,
    '<p style="margin:0;color:#555;font-size:.85rem">Lumio &mdash; study app for Indian learners</p>',
    '</div>',
  ].join('');
  return { subject, text, html };
}
