// Builds the structured database (data/*.json) and the app deck (src/generated/*) from data/extraction/*.json.
// Usage: node scripts/build-data.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GAME_DEFS, NON_GAME_SEGMENTS } from './game-defs.mjs';
import { seal } from './obfuscate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const exDir = path.join(root, 'data/extraction');
const defs = Object.fromEntries(GAME_DEFS.map((g) => [g.id, g]));

const SCORING = { realfake: 'binary_correct', dilemma: 'opinion_distribution', fmk: 'three_choice_opinion', creative: 'group_vote', hotseat: 'group_prediction' };

function unusableReason(r, def) {
  if (r.disabled) return 'disabled: ' + (r.disabled_reason || '');
  if (r.duplicate_of) return 'duplicate_of ' + r.duplicate_of;
  if (r.media_required || r.status === 'needs_media') return 'needs_media';
  if (!r.prompt) return 'no_intelligible_prompt';
  if (r.kind === 'unused') return 'discussion_only';
  if (!['high', 'medium'].includes(r.conf)) return 'low_confidence';
  if (def.engine === 'realfake') {
    if (r.answer == null) return 'no_reveal_found';
    if (!(r.answer in def.options)) return 'answer_not_in_options';
  }
  if (def.engine === 'fmk' && (r.options || []).length !== 3) return 'fmk_needs_three_options';
  if (r.kind === 'choice' && (r.options || []).length !== 2) return 'choice_needs_two_options';
  return null;
}

const files = fs.readdirSync(exDir).filter((f) => f.endsWith('.json')).sort();
const rounds = [];
const segments = [];
const ids = new Set();
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(path.join(exDir, f), 'utf8'));
  const s = d.segment;
  segments.push({
    id: s.id, extraction_file: f, source_document: s.src, source_line_start: s.ls, source_line_end: s.le,
    timestamp_start: s.t0 ?? null, timestamp_end: s.t1 ?? null, primary_game_id: s.game, raw_title: s.raw_title,
    title_basis: 'descriptive', classification: s.classification || (s.game ? 'CONFIRMED_GAME' : 'NOT_A_GAME'), notes: s.notes || '',
    round_count: d.rounds.length + (d.extras || []).length
  });
  for (const r of [...d.rounds, ...(d.extras || [])]) {
    const gameId = r.game || s.game;
    const def = defs[gameId];
    if (!def) { if (gameId) throw new Error(`Unknown game ${gameId} in ${f}`); continue; }
    let id = `${s.id}-${r.n}`;
    while (ids.has(id)) id += 'b';
    ids.add(id);
    const reason = unusableReason(r, def);
    const options = r.kind === 'choice' || def.engine === 'fmk' ? r.options || [] : Object.keys(def.options);
    rounds.push({
      id, game_id: gameId, segment_id: s.id, source_document: s.src,
      source_line_start: r.ls, source_line_end: r.le, timestamp_start: r.t0 ?? null, timestamp_end: r.t1 ?? null,
      raw_context: s.raw_title, raw_question: r.raw ?? null, display_prompt: r.prompt ?? null,
      options, option_labels: r.kind === 'choice' || def.engine === 'fmk' ? null : def.options,
      correct_answer: def.engine === 'realfake' ? r.answer ?? null : null,
      candidate_answer: r.candidate ?? null,
      answer_basis: def.engine === 'realfake' && r.answer != null ? 'podcast_reveal' : null,
      host_final_reveal_excerpt: r.reveal ?? null, reveal_note: r.reveal_note ?? null,
      guessed_answers: r.guesses || [], panel_reactions: r.panel || [],
      extra: { artist: r.artist ?? null, fee: r.fee ?? null, advice: r.advice ?? null },
      scoring_kind: r.kind === 'choice' ? 'opinion_distribution' : SCORING[def.engine],
      engine: def.engine, confidence: r.conf, source_status: r.status,
      content_rating: r.rating === 'mature' || def.mature ? 'mature' : 'general',
      disabled: !!r.disabled, disabled_reason: r.disabled_reason ?? null, duplicate_of: r.duplicate_of ?? null,
      usable: reason === null, unusable_reason: reason, notes: r.notes || '', original_or_podcast: 'podcast'
    });
  }
}

const games = GAME_DEFS.map((g) => {
  const rs = rounds.filter((r) => r.game_id === g.id);
  const usable = rs.filter((r) => r.usable);
  return {
    id: g.id, hebrew_title: g.title, subtitle: g.subtitle, aliases: g.aliases, kind: g.engine, emoji: g.emoji,
    canonical_in_show: g.canonical, status: usable.length ? 'playable' : 'unplayable', options: g.options,
    rules: null, players_min: g.engine === 'hotseat' ? 3 : 2,
    question_count: usable.length, unresolved_count: rs.length - usable.length,
    mature_count: usable.filter((r) => r.content_rating === 'mature').length,
    content_rating: g.mature ? 'mature' : usable.some((r) => r.content_rating === 'mature') ? 'mixed' : 'general',
    source_segments: [...new Set(rs.map((r) => r.segment_id))]
  };
});

const bySource = {};
for (const r of rounds) {
  const b = (bySource[r.source_document] ||= { source_document: r.source_document, rounds: 0, usable: 0, unresolved: 0, disabled: 0, games: new Set() });
  b.rounds++; r.usable ? b.usable++ : b.unresolved++; if (r.disabled) b.disabled++; b.games.add(r.game_id);
}
for (const s of segments) bySource[s.source_document] ||= { source_document: s.source_document, rounds: 0, usable: 0, unresolved: 0, disabled: 0, games: new Set() };
const reasons = {};
for (const r of rounds) if (!r.usable) { const k = r.unusable_reason.split(':')[0]; reasons[k] = (reasons[k] || 0) + 1; }
const coverage = {
  generated_from: 'data/extraction (manual line-by-line extraction of the supplied source packet)',
  source_documents_processed: Object.keys(bySource).length,
  extraction_files: files.length,
  segments: segments.length,
  rounds_total: rounds.length,
  rounds_usable: rounds.filter((r) => r.usable).length,
  rounds_unresolved: rounds.filter((r) => !r.usable).length,
  unresolved_by_reason: reasons,
  by_source: Object.values(bySource).map((b) => ({ ...b, games: [...b.games] })),
  by_game: games.map((g) => ({ id: g.id, title: g.hebrew_title, playable: g.question_count, unresolved: g.unresolved_count })),
  non_game_segments: NON_GAME_SEGMENTS
};

const needsReview = rounds.filter((r) => !r.usable).map((r) => ({
  id: r.id, game_id: r.game_id, source_document: r.source_document, source_line_start: r.source_line_start,
  source_line_end: r.source_line_end, reason: r.unusable_reason, confidence: r.confidence, source_status: r.source_status,
  candidate_answer: r.candidate_answer
}));

// ---- app deck (spoiler-safe: everything shown after the vote is sealed) ----
const deck = {
  version: 1,
  games: games.map((g) => ({ id: g.id, title: g.hebrew_title, subtitle: g.subtitle, engine: g.kind, emoji: g.emoji, options: g.options, mature: !!defs[g.id].mature, count: g.question_count, unresolved: g.unresolved_count })),
  rounds: rounds.map((r) => ({
    id: r.id, g: r.game_id, p: r.display_prompt, o: r.option_labels ? null : r.options, m: r.content_rating === 'mature',
    u: r.usable, c: r.confidence,
    x: seal(r.id, { a: r.correct_answer, rv: r.host_final_reveal_excerpt, gs: r.guessed_answers, pn: r.panel_reactions, fee: r.extra.fee, ar: r.extra.artist, rn: r.reveal_note })
  }))
};
const evidence = Object.fromEntries(rounds.map((r) => [r.id, seal('ev:' + r.id, {
  src: r.source_document, ls: r.source_line_start, le: r.source_line_end, t0: r.timestamp_start, t1: r.timestamp_end,
  raw: r.raw_question, st: r.source_status, why: r.unusable_reason, notes: r.notes, cand: r.candidate_answer, dis: r.disabled_reason, dup: r.duplicate_of
})]));

if (process.argv.includes('--check')) {
  console.log(JSON.stringify({ rounds: rounds.length, usable: coverage.rounds_usable, games: games.length }, null, 0));
} else {
  const w = (p, o) => fs.writeFileSync(path.join(root, p), JSON.stringify(o, null, 2) + '\n');
  w('data/games.json', games);
  w('data/questions.json', rounds);
  w('data/source_segments.json', segments);
  w('data/needs_review.json', needsReview);
  w('data/coverage.json', coverage);
  fs.mkdirSync(path.join(root, 'src/generated'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/generated/deck.json'), JSON.stringify(deck));
  fs.writeFileSync(path.join(root, 'src/generated/evidence.json'), JSON.stringify(evidence));
  console.log(`games=${games.length} rounds=${rounds.length} usable=${coverage.rounds_usable} unresolved=${coverage.rounds_unresolved} sources=${coverage.source_documents_processed}`);
}
