/**
 * White-label filter. Customers must see "TAKNA AI", never the name of the AI vendor or model behind it.
 * Applied to every reply before it is stored or returned.
 *
 * Deliberately CONTEXTUAL: a bare "Gemini" (zodiac sign) or "Claude Shannon" is left alone; model names,
 * "I am ...", "trained by <vendor>" and vendor names are replaced. No filter is perfect (e.g. a user can ask for
 * the name spelled with spaces or in another script), so the system prompt also tells the model not to reveal it.
 */
const BRAND = "TAKNA AI";
const COMPANY = "TAKNA TECHNOLOGY";
const VENDORS = "google|anthropic|openai|deepmind|google deepmind|meta|microsoft|mistral|xai|deepseek";

const MODEL_RULES: [RegExp, string][] = [
  [/\bgoogle[\s-]+gemini\b/gi, BRAND],
  [/\bgemini(?:[-\s]+(?:\d[\w.]*|pro|flash|ultra|nano|lite|advanced|live|latest|preview|exp\w*|ai|api|model|assistant|chatbot))+/gi, BRAND],
  [/\bclaude(?:[-\s]+(?:\d[\w.]*|ai|sonnet|opus|haiku|instant|code|latest))+/gi, BRAND],
  [/\bgpt[-\s]?(?:\d[\w.]*|o\d\w*)(?:[-\s](?:\d[\w.]*|turbo|mini|nano|preview))*/gi, BRAND],
  [/\b(?:google\s+)?bard\b(?=\s+(?:ai|model|chatbot))/gi, BRAND],
  [/\b(?:llama|mistral|grok|deepseek|copilot|palm)[-\s]?\d[\w.\-]*/gi, BRAND],
];

const IDENTITY = /\b(I am|I'm|my name is|call me|called|named|this is)\s+(?:the\s+)?(gemini|claude|chatgpt|bard)\b/gi;
const VENDOR_NAMES: [RegExp, string][] = [
  [/\banthropic\b/gi, COMPANY],
  [/\bopenai\b/gi, COMPANY],
  [/\bdeepmind\b/gi, COMPANY],
  [/\bchatgpt\b/gi, BRAND],
];
const HINDI: [RegExp, string][] = [
  [/जेमिनी|जेमिनाई|जैमिनी/g, BRAND],
  [/क्लॉड|क्लोड/g, BRAND],
  [/एंथ्रोपिक|एन्थ्रोपिक|ओपनएआई|ओपन\s?एआई|चैट\s?जीपीटी|डीपमाइंड/g, BRAND],
];

const SPEAKS_ABOUT_SELF = /\b(I|I'm|I am|my|me|myself)\b/i;
const VENDOR_IN_ORIGIN = new RegExp(`\\b(?:trained|made|created|developed|built|designed|owned|released|programmed)(?:\\s+and\\s+\\w+)?\\s+by\\s+(?:${VENDORS})\\b|\\b(?:${VENDORS})(?:'s)?\\s+(?:large\\s+language\\s+model|language\\s+model|AI|model)\\b`, "gi");

export function sanitizeReply(text: string, extraModelIds: string[] = []): string {
  let out = text;
  for (const id of extraModelIds) {
    if (id && id.length >= 4) out = out.replace(new RegExp(id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), BRAND);
  }
  for (const [re, to] of MODEL_RULES) out = out.replace(re, to);
  out = out.replace(IDENTITY, (_m, lead: string) => `${lead} ${BRAND}`);
  for (const [re, to] of VENDOR_NAMES) out = out.replace(re, to);
  for (const [re, to] of HINDI) out = out.replace(re, to);
  // Sentences where the assistant talks about itself and names a vendor as its origin ("I was trained by Google").
  out = out.replace(/[^.!?\n]+[.!?]?/g, (sentence) =>
    SPEAKS_ABOUT_SELF.test(sentence) ? sentence.replace(VENDOR_IN_ORIGIN, (m) => m.replace(new RegExp(VENDORS, "i"), COMPANY)) : sentence,
  );
  // Never leave "TAKNA AI TAKNA AI" style repeats from stacked rules.
  return out.replace(/(TAKNA AI)(\s+TAKNA AI)+/g, BRAND).replace(/(TAKNA TECHNOLOGY)(\s+TAKNA TECHNOLOGY)+/g, COMPANY);
}
