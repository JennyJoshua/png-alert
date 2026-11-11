const MESSAGES: Record<string, string> = {
  rate_limited: "You are sending too much too quickly. Try again later.",
  duplicate_submission: "You already sent a very similar report in the last 24 hours.",
  duplicate_source: "That link has already been submitted.",
  already_voted: "You have already responded to this report.",
  own_report: "You cannot confirm or dispute your own report.",
  not_active: "This report is no longer active, so it cannot be confirmed or disputed.",
  not_found: "That item is not available.",
  login_required: "Log in to do that.",
  forbidden: "You do not have permission to do that.",
  reason_required: "A reason of at least 5 characters is required for this action.",
  summary_required: "Write a short title and summary in your own words before publishing.",
  authority_required: "Authority name, its own notice link, evidence and (for confirmation) the confirmation time are required.",
  invalid_state: "That action is not available in the item's current state.",
  invalid_merge: "Choose a different published report to merge into, and give a reason.",
  invalid_link: "Only published reports can be linked.",
  official_requires_registry: "Mark a source as official only when it is linked to an official entry in the source registry.",
  unknown_registry: "That registry entry does not exist.",
  nothing_to_edit: "Enter a new title or summary.",
};

/** Maps database exception text to a safe, human message. Unknown errors are not echoed to the user. */
export function userMessage(raw: string | undefined): string {
  const key = Object.keys(MESSAGES).find((k) => raw?.includes(k));
  return key ? MESSAGES[key] : "Something went wrong. Please try again.";
}
