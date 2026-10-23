// Game catalogue. Titles describe the podcast segment; none of them are official names.
// engine: realfake | dilemma | fmk | creative | hotseat
const RF = { real: 'אמיתי', fake: 'יצחקי המציא' };

export const GAME_DEFS = [
  { id: 'israel-bidur', title: 'ישראל בידור', subtitle: 'כותרת אמיתית או שיצחקי המציא?', aliases: ['כותרות ישראל בידור'], engine: 'realfake', options: RF, emoji: '📰', canonical: true },
  { id: 'mizrahi-song', title: 'שירים במזרחית', subtitle: 'שיר אמיתי או שיצחקי כתב?', aliases: ['שיר של מושיקו מור'], engine: 'realfake', options: RF, emoji: '🎤', canonical: true },
  { id: 'noam-status', title: 'נועם או אסיר משוחרר', subtitle: 'סטטוס ישן של נועם — או של אסיר משוחרר?', aliases: ['סטטוס של נועם'], engine: 'realfake', options: { noam: 'נועם', prisoner: 'אסיר משוחרר' }, emoji: '🔐', canonical: true },
  { id: 'red-line', title: 'רד ליינס', subtitle: 'משפט אמיתי מהעמוד או שיצחקי כתב?', aliases: ['משפטי פתיחה', 'העמוד הסקסי'], engine: 'realfake', options: RF, emoji: '💋', canonical: true, mature: true },
  { id: 'sheets-lines', title: 'משפטים מהמיטה', subtitle: 'משפט אמיתי מהעמוד או שיצחקי כתב?', aliases: [], engine: 'realfake', options: RF, emoji: '🛏️', canonical: true, mature: true },
  { id: 'mauhevet', title: 'מאוהבת', subtitle: 'משפט מעמוד אמיתי או שיצחקי כתב?', aliases: [], engine: 'realfake', options: RF, emoji: '💘', canonical: true, mature: true },
  { id: 'masc-page', title: 'גבר אמיתי', subtitle: 'עצה מעמוד אמיתי או שיצחקי המציא?', aliases: [], engine: 'realfake', options: RF, emoji: '💪', canonical: true },
  { id: 'student-film', title: 'סרט סטודנטים', subtitle: 'סינופסיס אמיתי או שיצחקי המציא?', aliases: [], engine: 'realfake', options: RF, emoji: '🎬', canonical: true },
  { id: 'tiktok-ads', title: 'פרסומות טיקטוק', subtitle: 'פרסומת שבאמת רצה — או המצאה?', aliases: [], engine: 'realfake', options: RF, emoji: '📱', canonical: true },
  { id: 'fb-confessions', title: 'וידויים בפייסבוק', subtitle: 'וידוי אמיתי או שיצחקי המציא?', aliases: [], engine: 'realfake', options: RF, emoji: '🤫', canonical: true },
  { id: 'pickup-tips', title: 'אמני פיתוי', subtitle: 'טיפ אמיתי או שיצחקי המציא?', aliases: [], engine: 'realfake', options: RF, emoji: '🕶️', canonical: true },
  { id: 'new-age-workshop', title: 'סדנאות ניו-אייג\'', subtitle: 'סדנה אמיתית או שיצחקי המציא?', aliases: ['רוחניות'], engine: 'realfake', options: RF, emoji: '🧘', canonical: true },
  { id: 'mizrahi-poster', title: 'פוסטרים במזרחית', subtitle: 'פוסטר הופעה אמיתי או המצאה?', aliases: [], engine: 'realfake', options: RF, emoji: '🪩', canonical: true },
  { id: 'fake-podcast', title: 'הפודקאסט הזה קיים?', subtitle: 'פודקאסט אמיתי או שיצחקי המציא?', aliases: [], engine: 'realfake', options: RF, emoji: '🎙️', canonical: true },
  { id: 'local-facts', title: 'עובדות מקומיות', subtitle: 'עובדה אמיתית או המצאה?', aliases: ['עובדות על בת ים'], engine: 'realfake', options: RF, emoji: '🏙️', canonical: true },
  { id: 'zimmer', title: 'צימר לשעה', subtitle: 'צימר אמיתי או שיצחקי המציא?', aliases: [], engine: 'realfake', options: RF, emoji: '🛁', canonical: true, mature: true },
  { id: 'messages', title: 'הודעות אמיתיות?', subtitle: 'הודעה שמישהי באמת קיבלה — או שיצחקי המציא?', aliases: [], engine: 'realfake', options: RF, emoji: '💬', canonical: true, mature: true },
  { id: 'ex-or-dictator', title: 'הגרושה או דיקטטור', subtitle: 'הודעה מהגרושה — או טקסט של דיקטטור?', aliases: [], engine: 'realfake', options: { ex: 'הגרושה', dictator: 'דיקטטור' }, emoji: '📨', canonical: true, mature: true },
  { id: 'wedding-photos', title: 'תמונות מהחתונה', subtitle: 'תמונה אמיתית או AI?', aliases: [], engine: 'realfake', options: { real: 'אמיתית', fake: 'AI' }, emoji: '💍', canonical: true },
  { id: 'perfect-but', title: 'היא מושלמת והכל, אבל…', subtitle: 'זורמים או לא זורמים?', aliases: ['היא סבבה והכל', 'הוא סבבה והכל'], engine: 'dilemma', options: { yes: 'זורם/ת', no: 'לא זורם/ת' }, emoji: '😇', canonical: true },
  { id: 'chaltura', title: 'היית לוקח את החלטורה?', subtitle: 'הסכום מצדיק את מה שתעבור?', aliases: [], engine: 'dilemma', options: { yes: 'לוקח/ת', no: 'לא לוקח/ת' }, emoji: '💸', canonical: true },
  { id: 'hard-dilemmas', title: 'דילמות קשות', subtitle: 'הכסף שווה את זה?', aliases: [], engine: 'dilemma', options: { yes: 'לוקח/ת', no: 'לא לוקח/ת' }, emoji: '⚖️', canonical: true },
  { id: 'fmk', title: 'פאק מארי קיל', subtitle: 'שלושה שמות, שלוש החלטות', aliases: ['FMK'], engine: 'fmk', options: {}, emoji: '🃏', canonical: true, mature: true },
  { id: 'worst-advice', title: 'העצה הכי גרועה', subtitle: 'בעיה אמיתית מהבית — תנו את העצה הכי נוראית', aliases: ['שאלות מהבית', 'ייעוץ הפאנל'], engine: 'creative', options: {}, emoji: '🆘', canonical: true },
  { id: 'crisis-ads', title: 'פרסומות בזמן משבר', subtitle: 'מותג + משבר = סלוגן', aliases: [], engine: 'creative', options: {}, emoji: '📣', canonical: true },
  { id: 'polygraph', title: 'מכונת האמת', subtitle: 'הכיסא החם — בידור בלבד, לא גלאי שקר אמיתי', aliases: ['פוליגרף'], engine: 'hotseat', options: { yes: 'כן', no: 'לא' }, emoji: '🫀', canonical: true }
];

export const NON_GAME_SEGMENTS = [
  { id: 'kids-book-reading', title: 'ספר שאלות לילדים — קריאה ודיון', classification: 'NOT_A_GAME', reason: 'קטע קריאה ושיחה בלי סבבי ניחוש.' },
  { id: 'gifts', title: 'מתנות מהקהל — אמיתי או לא', classification: 'POSSIBLE_GAME', reason: 'הפינה מוצגת אך הפריטים מוצגים במצלמה; אין בתמליל מספיק תוכן לשחק.' },
  { id: 'cringe-transfer', title: 'קרינג\' מעבר', classification: 'CONFIRMED_INTERACTIVE_SEGMENT', reason: 'קריאה ותגובות בלי סבבים עם תשובה.' },
  { id: 'testimonies', title: 'עדויות סטנדאפיסטים', classification: 'CONFIRMED_INTERACTIVE_SEGMENT', reason: 'מבוסס הקלטות קוליות ותוכן על אנשים אמיתיים.' },
  { id: 'fake-sponsors', title: 'חסויות מזויפות', classification: 'CONFIRMED_INTERACTIVE_SEGMENT', reason: 'מערכון בלי סבבי ניחוש.' },
  { id: 'interviews', title: 'ראיונות ושיחות', classification: 'NOT_A_GAME', reason: 'שיחה חופשית.' }
];
