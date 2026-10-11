import { defaultRoles } from './roles';
import type { CastMember, StoryDraft } from './types';

/** One prompt-facing definition per person. Names identify NPCs; {{char}} names the narrator card. */
export function characterText(person: CastMember, draft: StoryDraft): string {
  const player = (draft.roles ?? defaultRoles(draft)).playerCharacterId === person.id;
  return [
    `### ${person.name}${person.aliases.length ? ` (${person.aliases.join(', ')})` : ''}`,
    player ? 'Role: Human-controlled player. These are starting facts and tendencies; the human supplies new choices and dialogue.' : 'Role: Supporting character portrayed by the narrator.',
    `Personality: ${person.personality}`,
    ...(person.notes?.motivations ? [`Motivations at the start: ${person.notes.motivations}`] : []),
    ...(person.notes?.reactions ? [`Behavior and reactions: ${person.notes.reactions}`] : []),
    `Voice: ${person.voice}`,
    ...(person.notes?.voiceExamples.length ? [`Illustrative speech examples (style references, not past dialogue or future events):\n${person.notes.voiceExamples.map(line => `- ${line}`).join('\n')}`] : []),
    `Relationships at the start: ${person.relationships}`,
    `Knowledge at the start: ${person.knowledge}`,
    'Use subsequent chat events for changes to these starting facts. Keep this person’s voice and motives distinct from the other cast.',
  ].join('\n\n');
}
