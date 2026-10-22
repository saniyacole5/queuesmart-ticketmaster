// MEMBER 1: error shaping shared by the three authentication forms.
// Owned by the Authentication/Validation work package; see docs/TEAM_PLAN.md.

// `api()` attaches `status` and `fields` only after it has a parsed JSON error
// body. A dropped connection (fetch rejects) or a non-JSON response (a proxy's
// HTML 502) throws before that, so those arrive with no status and a message
// like "Load failed" that means nothing to the person signing in. Collapse that
// case into one actionable banner; keep per-field details for real API errors so
// the existing field-error markup still renders them.
export function describeSubmitError(error) {
  if (error.status === undefined) {
    return {
      form: "Cannot reach the server. Check your connection and try again.",
    };
  }
  return { ...error.fields, form: error.message };
}
