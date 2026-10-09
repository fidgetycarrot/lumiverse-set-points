import { expect, test } from 'bun:test';
import { appearanceMentions } from '../src/appearance-review';
import { draft } from './fixtures';

test('surfaces incidental looks in unrelated lore and forced scene text without rewriting the draft', () => {
  const story = draft();
  story.cast[0].personality = 'Her brown hair is usually tied back.';
  story.lore[0].content = 'The harbor tax record describes Iona with blonde hair.';
  story.scenes[1].greeting = 'Iona enters wearing a green coat.';
  story.scenes[1].direction = 'Describe the scar only when the light turns.';
  story.appearances = [{ characterId: story.cast[0].id, description: 'Black hair.', startingOutfit: 'Blue coat.' }];
  const before = structuredClone(story), mentions = appearanceMentions(story);
  expect(mentions).toContainEqual({ location: `${story.cast[0].name} · Personality`, text: story.cast[0].personality });
  expect(mentions).toContainEqual({ location: `Lore · ${story.lore[0].name}`, text: story.lore[0].content });
  expect(mentions).toContainEqual({ location: `Scene 2 · ${story.scenes[1].title} · opening`, text: story.scenes[1].greeting });
  expect(mentions).toContainEqual({ location: `Scene 2 · ${story.scenes[1].title} · private direction`, text: story.scenes[1].direction });
  expect(mentions.every(item => !item.text.includes('Black hair.'))).toBe(true);
  expect(story).toEqual(before);
});
