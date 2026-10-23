import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { checkEditorPassword, sha256 } from '../src/lib/hash';

describe('editor password', () => {
  it('sha256 matches node', () => {
    for (const s of ['', 'abc', 'עברית ✓', 'x'.repeat(130)]) expect(sha256(s)).toBe(createHash('sha256').update(s).digest('hex'));
  });
  it('accepts only the right password', () => {
    expect(checkEditorPassword('25092008')).toBe(true);
    expect(checkEditorPassword(' 25092008 ')).toBe(true);
    expect(checkEditorPassword('25092009')).toBe(false);
    expect(checkEditorPassword('')).toBe(false);
  });
});
