import { getReleaseCommit } from './release';

const runtime = globalThis as typeof globalThis & { __TASKFORGE_COMMIT__?: string };
afterEach(() => {
  delete runtime.__TASKFORGE_COMMIT__;
});

describe('release identity', () => {
  it('uses unknown when no build identity exists', () => {
    expect(getReleaseCommit()).toBe('unknown');
  });

  it('normalizes a complete checkout SHA', () => {
    runtime.__TASKFORGE_COMMIT__ = 'A'.repeat(40);
    expect(getReleaseCommit()).toBe('a'.repeat(40));
  });

  it.each(['', 'main', 'abc123', 'g'.repeat(40), 'private deployment detail'])(
    'does not expose invalid build identity %s',
    (value) => {
      runtime.__TASKFORGE_COMMIT__ = value;
      expect(getReleaseCommit()).toBe('unknown');
    },
  );
});
