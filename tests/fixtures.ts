import type { StoryDraft } from '../src/types';
export function draft(): StoryDraft {
  return { version: 1, id: 'test-draft', title: 'The Lighthouse Letter', premise: 'Mara arrives in Greyhaven to look for Elias.', playerRole: 'Mara', startingPoint: 'At the harbor', narratorInstructions: 'Portray the world and supporting cast. Leave Mara’s choices to the player.',
    cast: [{ id: 'iona', name: 'Iona', aliases: ['Captain Iona'], personality: 'Blunt and dependable.', voice: 'Short, direct sentences.', relationships: 'She knows Elias and is wary of Mara.', knowledge: 'Elias left a letter in the chart room.', sourceRefs: ['chunk:1'] }],
    lore: [{ id: 'greyhaven', name: 'Greyhaven', keys: ['Greyhaven', 'harbor'], content: 'A coastal village with an old lighthouse.' }],
    scenes: [{ id: 'harbor', title: 'At the harbor', greeting: 'Iona waits beside a moored boat. “Looking for someone?”', direction: 'Introduce Iona without deciding what Mara says.', assumptions: [], sourceRefs: ['chunk:1'] }, { id: 'letter', title: 'The chart room', greeting: 'A sealed letter rests on the desk.', direction: 'Let the player decide whether to open it.', assumptions: ['The player reached the chart room.'], sourceRefs: ['chunk:1'] }],
    warnings: [], source: { title: 'The Lighthouse Letter', characters: 1000, chunks: 1 }, createdAt: 1 };
}
