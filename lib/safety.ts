// Lightweight triage only. Flags never auto-publish or auto-reject; they force a moderator to write a reason before approval.
const RULES: Record<string, RegExp> = {
  violence: /\b(kill(ed|ing)?|murder(ed)?|stab(bed)?|shot|shooting|rape[sd]?|assault(ed)?|beaten|machete|gunmen|gunshots?)\b/i,
  conflict: /\b(tribal|clan fight|payback|riot(s|ing)?|unrest|mob)\b/i,
  accusation: /\b(thief|thieves|robber(s|y)?|raskol|rascals?|criminals?|hold-?up|hijack(ed|ers?)?|suspect(s|ed)?)\b/i,
  political: /\b(election fraud|rigged|corrupt(ion)?)\b/i,
};

export function riskFlags(...texts: (string | null | undefined)[]): string[] {
  const joined = texts.filter(Boolean).join(" \n ");
  return Object.entries(RULES).filter(([, re]) => re.test(joined)).map(([flag]) => flag);
}

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /(?:\+?\d[\s().-]?){8,}/;
/** Reporter or third-party contact details must not be published. */
export function containsContactInfo(...texts: (string | null | undefined)[]): boolean {
  const joined = texts.filter(Boolean).join(" \n ");
  return EMAIL.test(joined) || PHONE.test(joined);
}
