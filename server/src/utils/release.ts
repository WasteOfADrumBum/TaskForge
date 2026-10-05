// Replaced by tsup at build time from this checkout, never runtime provider metadata.
declare const __TASKFORGE_COMMIT__: string;

export const getReleaseCommit = (): string => {
  const commit = typeof __TASKFORGE_COMMIT__ === 'undefined' ? 'unknown' : __TASKFORGE_COMMIT__;
  return /^[a-f0-9]{40}$/i.test(commit) ? commit.toLowerCase() : 'unknown';
};
