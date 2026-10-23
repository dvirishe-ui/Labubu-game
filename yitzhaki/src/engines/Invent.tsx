import Creative from './Creative';
import type { EngineProps } from './common';

/** מה יצחקי היה ממציא?: the creative engine with format prompts. Answers are player-written. */
export default function Invent(props: EngineProps) {
  return <Creative {...props} game={{ ...props.game, title: 'מה יצחקי היה ממציא?', subtitle: 'תוכן שחקנים — לא מהפודקאסט', emoji: '💡' }} />;
}
