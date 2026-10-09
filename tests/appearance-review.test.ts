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
  expect(mentions).toContainEqual({ location: `${story.cast[0].name} · Personality`, text: story.cast[0].personality, fieldKey: `cast:${story.cast[0].id}:personality` });
  expect(mentions).toContainEqual({ location: `Lore · ${story.lore[0].name}`, text: story.lore[0].content, fieldKey: `lore:${story.lore[0].id}:content` });
  expect(mentions).toContainEqual({ location: `Scene 2 · ${story.scenes[1].title} · opening`, text: story.scenes[1].greeting, fieldKey: `scene:${story.scenes[1].id}:greeting` });
  expect(mentions).toContainEqual({ location: `Scene 2 · ${story.scenes[1].title} · private direction`, text: story.scenes[1].direction, fieldKey: `scene:${story.scenes[1].id}:direction` });
  expect(mentions.every(item => !item.text.includes('Black hair.'))).toBe(true);
  expect(story).toEqual(before);
});


test('large narrative fields yield at most two short excerpts with appearance details in context',()=>{
 const story=draft();story.lore[0].content='An unrelated record. '.repeat(100)+'Iona has blonde hair. '+'More record details. '.repeat(100)+'Iona wears a green coat. '+'Further records. '.repeat(100);
 const result=appearanceMentions(story).filter(item=>item.fieldKey===`lore:${story.lore[0].id}:content`);
 expect(result).toHaveLength(2);
 expect(result[0].text).toContain('blonde hair');expect(result[1].text).toContain('green coat');
 expect(result.every(item=>item.text.length<=220)).toBe(true);
 expect(result[0].text.startsWith('…')).toBe(true);
});
