// Frozen baseline for corpus kan50-v1. A change here means retrieval behavior changed: explain it
// in docs/tasks/KAN-50-retrieval-evaluation.md rather than silently updating the numbers.
export const KEYWORD_BASELINE: Record<string, string[]> = {
  q01: ['backup-policy'],
  q02: ['release-checklist', 'backup-policy'],
  q03: ['oncall-rotation'],
  q04: ['design-tokens', 'oncall-rotation'],
  q05: ['accessibility'],
  q06: ['cold-start'],
  q07: ['budget'],
  q08: ['planning-meeting'],
  q09: ['glossary', 'vendor-injection'],
  q10: ['oncall-rotation'],
  u01: [],
  u02: [],
  u03: [],
};
export const SEMANTIC_FIXTURE_BASELINE: Record<string, string[]> = {
  ...KEYWORD_BASELINE,
  q02: [],
  q03: [],
  q04: ['design-tokens'],
  q09: ['glossary'],
};
