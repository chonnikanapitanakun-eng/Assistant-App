// Prompt design for `ai-prep-meeting`. Kept apart from the handler so it can be read and tuned on its own.
//
// Layout (for prompt caching): SYSTEM is frozen and cached; everything that varies per request
// (today, locale, the event and the records linked to it) rides on the user turn.
import type { PrepMeetingRequest } from '../_shared/prep-meeting-contract.ts';

export const SYSTEM = `You prepare a person for an upcoming meeting, using only what their personal-assistant app already knows about it.
The app is called Veyra. Its user is a Thai accountant and tax advisor (Thai CPA; also serves Thai clients in the UK), usually bilingual, meeting clients, partners and colleagues. Everything you get comes from their own records: the event, the person it is with, and the notes, tasks, transactions and earlier meetings linked to it.

Return only the JSON the schema asks for. No prose outside it.

brief
- 2–4 short paragraphs, plain text (no markdown, no bullets, no headings). Paragraph 1: what this meeting is and who it is with, in one or two sentences. Then: where things stand from the linked records — open tasks, what the notes say, money owed or paid, what happened at earlier meetings. Finish with anything to watch out for (deadlines, unresolved items, a question that was left open).
- Use only the records given. If the app knows almost nothing, say so briefly ("Nothing is linked to this meeting yet") and keep the brief to one paragraph — never invent history, figures or people.
- Quote concrete facts (amounts, dates, names) exactly as they appear in the records. Amounts keep their currency.

checklist
- Things to do or bring before the meeting, each one a short action the user can tick off. Draw them from open tasks, promises in notes, and what a meeting like this normally needs (documents, figures, a follow-up on an unpaid invoice).
- Up to 10 items, most important first. Skip items already marked done in the tasks.

agenda
- The order to discuss things in, up to 8 items. Start with the reason for the meeting, then open items from the records, then next steps. One line each.

Language
- Write in the language given in <locale>: Thai for th (natural professional Thai, ภาษาไทยที่สุภาพและกระชับ; keep proper nouns, product names and English accounting terms as written), English for en.
- Keep names exactly as stored, including titles like คุณ / พี่.
- Be concise. This is read on a phone a few minutes before the meeting.`;

const clip = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '');
const esc = (v: string) => v.replace(/</g, '‹').replace(/>/g, '›');
const attr = (v: string) => esc(v).replace(/"/g, '”');

const MAX = { notes: 8, noteBody: 1500, tasks: 20, transactions: 20, pastEvents: 10, emails: 10, snippet: 400 } as const;

/** Volatile part of the prompt, rendered on the user turn. */
export function userTurn(req: PrepMeetingRequest, today: string, weekday: string): string {
  const ev = req.event;
  const when = [ev.date, ev.isAllDay ? 'all day' : [ev.startTime, ev.endTime].filter(Boolean).join('–')].filter(Boolean).join(' ');
  const out: string[] = [
    `<today>${today} (${weekday})</today>`,
    `<locale>${req.locale === 'th' ? 'th' : 'en'}</locale>`,
    '',
    `<event title="${attr(clip(ev.title, 200))}" when="${attr(when)}"${ev.location ? ` location="${attr(clip(ev.location, 200))}"` : ''} />`,
  ];

  if (req.contact?.name) {
    const c = req.contact;
    out.push(`<contact name="${attr(clip(c.name, 120))}"${c.company ? ` company="${attr(clip(c.company, 120))}"` : ''}${c.role ? ` role="${attr(clip(c.role, 120))}"` : ''}>${esc(clip(c.notes, 1000))}</contact>`);
  } else {
    out.push('<contact none="true" />');
  }

  const past = (req.pastEvents ?? []).slice(0, MAX.pastEvents);
  out.push('<past_meetings>', ...past.map((p) => `- ${clip(p.date, 10)}: ${esc(clip(p.title, 200))}`), '</past_meetings>');

  const tasks = (req.tasks ?? []).slice(0, MAX.tasks);
  out.push('<tasks>', ...tasks.map((t) => `- [${t.isDone ? 'done' : 'open'}]${t.date ? ` ${clip(t.date, 10)}` : ''} ${esc(clip(t.title, 200))}${t.notes ? ` — ${esc(clip(t.notes, 300))}` : ''}`), '</tasks>');

  const notes = (req.notes ?? []).slice(0, MAX.notes);
  out.push('<notes>');
  for (const n of notes) out.push(`<note title="${attr(clip(n.title, 200))}">`, esc(typeof n.body === 'string' ? n.body.trim().slice(0, MAX.noteBody) : ''), '</note>');
  out.push('</notes>');

  const tx = (req.transactions ?? []).slice(0, MAX.transactions);
  out.push('<transactions>', ...tx.map((x) => `- ${clip(x.date, 10)} ${x.type} ${x.amount} ${clip(x.currency, 3)}${x.note ? ` — ${esc(clip(x.note, 200))}` : ''}`), '</transactions>');

  const emails = (req.emails ?? []).slice(0, MAX.emails);
  if (emails.length) {
    out.push('<emails>', ...emails.map((e) => `- ${clip(e.date, 10)} from ${esc(clip(e.from, 120))}: ${esc(clip(e.subject, 200))} — ${esc(clip(e.snippet, MAX.snippet))}`), '</emails>');
  }

  out.push('', 'Prepare me for this meeting.');
  return out.join('\n');
}
