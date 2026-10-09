import type { StoryDraft } from './types';

export interface AppearanceMention { location: string; text: string; fieldKey: string }
// A review aid, not a semantic conflict detector. Show bounded excerpts around
// the actual appearance words instead of making the reader inspect whole fields.
const appearanceWords = /\b(?:hair|haired|blond(?:e)?|brunette|redhead|bald|eyes?|freckles?|complexion|skin|scar(?:s|red)?|tattoo(?:s|ed)?|beard|moustache|mustache|height|physique|clothes|clothing|outfit|dress|coat|jacket|shirt|trousers|pants|skirt|boots|uniform|cloak|robe|glasses|horns?|fur|scales|wings?)\b/i;

function excerpts(text: string): string[] {
  const expression = new RegExp(appearanceWords.source, 'gi'), result: string[] = [];
  let coveredUntil = 0, match: RegExpExecArray|null;
  while ((match = expression.exec(text)) && result.length < 2) {
    if (match.index < coveredUntil) continue;
    let start = Math.max(0, match.index - 70), end = Math.min(text.length, match.index + match[0].length + 110);
    if (start) { const space = text.indexOf(' ', start); if (space >= start && space < match.index) start = space + 1; }
    if (end < text.length) { const space = text.lastIndexOf(' ', end); if (space > match.index + match[0].length) end = space; }
    result.push(`${start ? '…' : ''}${text.slice(start, end).trim().replace(/\s+/g, ' ')}${end < text.length ? '…' : ''}`);
    coveredUntil = end;
  }
  return result;
}

/** Locate possible appearances across every narrative field exported for play. */
export function appearanceMentions(draft: StoryDraft): AppearanceMention[] {
  const fields: AppearanceMention[] = [
    { location: 'Story title', text: draft.title, fieldKey: 'title' },
    { location: 'Premise', text: draft.premise, fieldKey: 'premise' },
    { location: 'Player role', text: draft.playerRole, fieldKey: 'playerRole' },
    { location: 'Starting point', text: draft.startingPoint, fieldKey: 'startingPoint' },
    { location: 'Narrator direction', text: draft.narratorInstructions, fieldKey: 'narratorInstructions' },
  ];
  for (const person of draft.cast) {
    fields.push({ location: `${person.name} · name`, text: person.name, fieldKey: `cast:${person.id}:name` });
    fields.push({ location: `${person.name} · aliases`, text: person.aliases.join(', '), fieldKey: `cast:${person.id}:aliases` });
    for (const [label, field] of [['Personality', 'personality'], ['Voice & manner', 'voice'], ['Relationships at the start', 'relationships'], ['Knowledge at the start', 'knowledge']] as const) fields.push({ location: `${person.name} · ${label}`, text: person[field], fieldKey: `cast:${person.id}:${field}` });
  }
  for (const entry of draft.lore) fields.push({ location: `Lore · ${entry.name}`, text: entry.content, fieldKey: `lore:${entry.id}:content` });
  for (const [index, scene] of draft.scenes.entries()) {
    fields.push({ location: `Scene ${index + 1} · title`, text: scene.title, fieldKey: `scene:${scene.id}:title` });
    fields.push({ location: `Scene ${index + 1} · ${scene.title} · opening`, text: scene.greeting, fieldKey: `scene:${scene.id}:greeting` });
    fields.push({ location: `Scene ${index + 1} · ${scene.title} · private direction`, text: scene.direction, fieldKey: `scene:${scene.id}:direction` });
    scene.assumptions.forEach((text, i) => fields.push({ location: `Scene ${index + 1} · ${scene.title} · assumption ${i + 1}`, text, fieldKey: `scene:${scene.id}:assumption:${i}` }));
  }
  return fields.flatMap(field => excerpts(field.text).map(text => ({ ...field, text })));
}
