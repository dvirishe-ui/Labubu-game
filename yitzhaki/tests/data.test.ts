import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (p: string) => JSON.parse(fs.readFileSync(new URL('../data/' + p, import.meta.url), 'utf8'));
const questions = read('questions.json');
const games = read('games.json');
const coverage = read('coverage.json');
const review = read('needs_review.json');

describe('structured database', () => {
  it('every question is traceable to a source document and line range', () => {
    for (const q of questions) {
      expect(q.source_document).toBeTruthy();
      expect(Number.isInteger(q.source_line_start)).toBe(true);
      expect(q.source_line_end).toBeGreaterThanOrEqual(q.source_line_start);
      expect(['high', 'medium', 'low']).toContain(q.confidence);
      expect(q.original_or_podcast).toBe('podcast');
    }
  });

  it('usable real/fake rounds are backed by a podcast reveal', () => {
    for (const q of questions.filter((x: { usable: boolean; engine: string }) => x.usable && x.engine === 'realfake')) {
      expect(q.correct_answer).toBeTruthy();
      expect(q.answer_basis).toBe('podcast_reveal');
      expect(['high', 'medium']).toContain(q.confidence);
    }
  });

  it('opinion games never claim a correct answer', () => {
    for (const q of questions.filter((x: { engine: string }) => x.engine !== 'realfake')) expect(q.correct_answer).toBeNull();
  });

  it('ids are unique and counts add up', () => {
    expect(new Set(questions.map((q: { id: string }) => q.id)).size).toBe(questions.length);
    expect(coverage.rounds_usable + coverage.rounds_unresolved).toBe(questions.length);
    expect(review).toHaveLength(coverage.rounds_unresolved);
    expect(games.reduce((n: number, g: { question_count: number }) => n + g.question_count, 0)).toBe(coverage.rounds_usable);
  });

  it('disabled and duplicate rounds are never usable', () => {
    for (const q of questions) if (q.disabled || q.duplicate_of) expect(q.usable).toBe(false);
  });
});
