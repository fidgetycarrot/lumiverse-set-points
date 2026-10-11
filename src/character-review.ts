import { defaultRoles } from './roles';
import type { StoryDraft } from './types';

export interface CharacterIssue { fieldKey: string; location: string; message: string; excerpt?: string; reference?: string }
type Field = { key: string; label: string; text: string; owner?: string };
const short = (text: string) => text.trim().replace(/\s+/g, ' ').slice(0, 320);
const normalized = (text: string) => text.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const colors = 'platinum(?:[ -]blond(?:e)?)?|blond(?:e)?|auburn|brunette|brown|black|red|grey|gray|silver|white|blue|green|hazel|amber|violet|pink';
function visualFacts(text: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, word] of [['hair', 'hair'], ['eyes', 'eyes?']] as const) {
    const label = new RegExp(`\\b${word}(?:\\s+colou?r)?\\s*:\\s*[^\\n.]{0,50}?\\b(${colors})\\b`, 'i');
    const prose = new RegExp(`\\b(${colors})(?:[ -]+(?:long|short|curly|straight|wavy|cropped|pale|dark|light))*[ -]+${word}\\b`, 'i');
    const match = label.exec(text) ?? prose.exec(text);
    if (match) result.set(key, match[1].toLowerCase().replace(/^blonde$/, 'blond').replace(/^gray$/, 'grey').replace(/^brunette$/, 'brown'));
  }
  return result;
}
/** Conservative, free review aids. They never block a save or claim semantic proof. */
export function characterIssues(draft: StoryDraft, existingPersona?: { name: string; description: string }): CharacterIssue[] {
  const fields: Field[] = [
    { key: 'premise', label: 'Premise', text: draft.premise },
    { key: 'narratorInstructions', label: 'Narrator direction', text: draft.narratorInstructions },
    ...draft.cast.flatMap(person => [
      ...(['personality', 'voice', 'relationships', 'knowledge'] as const).map(key => ({ key: `cast:${person.id}:${key}`, label: `${person.name} · ${key}`, text: person[key], owner: person.id })),
      ...(person.notes ? [{ key: `cast:${person.id}:motivations`, label: `${person.name} · motivations`, text: person.notes.motivations, owner: person.id }, { key: `cast:${person.id}:reactions`, label: `${person.name} · reactions`, text: person.notes.reactions, owner: person.id }, { key: `cast:${person.id}:voiceExamples`, label: `${person.name} · speech examples`, text: person.notes.voiceExamples.join('\n'), owner: person.id }] : []),
    ]),
    ...draft.lore.map(entry => ({ key: `lore:${entry.id}:content`, label: `Lore · ${entry.name}`, text: entry.content })),
    ...draft.scenes.flatMap(scene => [{ key: `scene:${scene.id}:greeting`, label: `Scene · ${scene.title} · opening`, text: scene.greeting }, { key: `scene:${scene.id}:direction`, label: `Scene · ${scene.title} · direction`, text: scene.direction }]),
  ];
  const player = draft.cast.find(person => person.id === (draft.roles ?? defaultRoles(draft)).playerCharacterId);
  const persona = draft.persona?.mode === 'create' ? draft.persona : draft.persona?.mode === 'existing' ? existingPersona : undefined;
  if (persona) fields.push({ key: 'persona:description', label: 'Player persona', text: persona.description, owner: player?.id });
  const result: CharacterIssue[] = [];
  for (const field of fields) {
    if (field.owner && /\{\{char\}\}/i.test(field.text)) result.push({ fieldKey: field.key, location: field.label, message: '{{char}} names the narrator card here. Use this character’s name if the text describes them.', excerpt: short(field.text) });
  }
  if (player && persona && ![player.name, ...player.aliases].some(name => normalized(name) === normalized(persona.name))) result.push({ fieldKey: 'persona:name', location: 'Player persona · identity', message: `Your persona name differs from the selected cast identity ${player.name}. This may be intentional; check that the narrator and your persona agree about who you play.`, excerpt: short(persona.name), reference: player.name });
  // Compare labeled starting sections, not arbitrary paraphrases. Differences need human judgment.
  if (player && persona) for (const [label, key] of [['Personality', 'personality'], ['Voice', 'voice'], ['Relationships at the start', 'relationships'], [`What ${player.name} knows at the start`, 'knowledge']] as const) {
    const match = new RegExp(`(?:^|\\n)${escaped(label)}:\\s*([^\\n]+)`, 'i').exec(persona.description);
    if (match && normalized(match[1]) !== normalized(player[key])) result.push({ fieldKey: 'persona:description', location: `Player persona · ${label}`, message: 'The persona’s starting note differs from the cast profile. Compare these versions; different wording may be harmless.', excerpt: short(match[1]), reference: short(player[key]) });
  }
  for (const look of draft.appearances ?? []) {
    const person = draft.cast.find(item => item.id === look.characterId)!;
    const expected = visualFacts(look.description);
    for (const field of fields) {
      // A general scene/lore passage needs a named sentence to attribute a look.
      const sentences = field.text.split(/(?<=[.!?])\s+|\n/).filter(sentence => {
        if (field.owner) return field.owner === person.id && !draft.cast.some(other => other.id !== person.id && [other.name, ...other.aliases].some(name => new RegExp(`\\b${escaped(name)}\\b`, 'i').test(sentence)));
        const names = [person.name, ...person.aliases].filter(name => name.trim().length >= 3);
        return names.some(name => new RegExp(`\\b${escaped(name)}(?:['’]s)?\\b`, 'i').test(sentence)) && !draft.cast.some(other => other.id !== person.id && new RegExp(`\\b${escaped(other.name)}\\b`, 'i').test(sentence));
      });
      for (const sentence of sentences) for (const [trait, value] of visualFacts(sentence)) if (expected.has(trait) && expected.get(trait) !== value) result.push({ fieldKey: field.key, location: field.label, message: `Possible ${person.name} ${trait} conflict with the approved appearance. A deliberate change later in the story may be valid; review the timing.`, excerpt: short(sentence), reference: short(look.description) });
    }
  }
  return result.filter((item, index) => result.findIndex(other => JSON.stringify(other) === JSON.stringify(item)) === index).slice(0, 100);
}
