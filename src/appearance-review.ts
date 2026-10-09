import type { StoryDraft } from './types';

export interface AppearanceMention { location: string; text: string }
// A review aid, not a semantic conflict detector. Return the entire matching
// field so the reader can see its context and edit the visible source field.
const appearanceWords = /\b(?:hair|haired|blond(?:e)?|brunette|redhead|bald|eyes?|freckles?|complexion|skin|scar(?:s|red)?|tattoo(?:s|ed)?|beard|moustache|mustache|height|physique|clothes|clothing|outfit|dress|coat|jacket|shirt|trousers|pants|skirt|boots|uniform|cloak|robe|glasses|horns?|fur|scales|wings?)\b/i;

/** Locate possible appearances across every narrative field exported for play. */
export function appearanceMentions(draft: StoryDraft): AppearanceMention[] {
  const fields: AppearanceMention[] = [
    { location: 'Story title', text: draft.title },
    { location: 'Premise', text: draft.premise },
    { location: 'Player role', text: draft.playerRole },
    { location: 'Starting point', text: draft.startingPoint },
    { location: 'Narrator direction', text: draft.narratorInstructions },
  ];
  for (const person of draft.cast) {
    fields.push({ location: `${person.name} · name and aliases`, text: [person.name, ...person.aliases].join(', ') });
    for (const [label, field] of [['Personality', 'personality'], ['Voice & manner', 'voice'], ['Relationships at the start', 'relationships'], ['Knowledge at the start', 'knowledge']] as const) fields.push({ location: `${person.name} · ${label}`, text: person[field] });
  }
  for (const entry of draft.lore) fields.push({ location: `Lore · ${entry.name}`, text: entry.content });
  for (const [index, scene] of draft.scenes.entries()) {
    fields.push({ location: `Scene ${index + 1} · title`, text: scene.title });
    fields.push({ location: `Scene ${index + 1} · ${scene.title} · opening`, text: scene.greeting });
    fields.push({ location: `Scene ${index + 1} · ${scene.title} · private direction`, text: scene.direction });
    scene.assumptions.forEach((text, i) => fields.push({ location: `Scene ${index + 1} · ${scene.title} · assumption ${i + 1}`, text }));
  }
  return fields.filter(field => appearanceWords.test(field.text));
}
