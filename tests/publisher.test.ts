import { describe, expect, test } from 'bun:test';
import type { SpindleAPI } from 'lumiverse-spindle-types';
import { APPEARANCE_RULE, appearanceGuide, validateDraft } from '../src/importer';
import { CardPublisher, draftKey, worldEntries } from '../src/publisher';
import { EXTENSION_ID } from '../src/types';
import { draft } from './fixtures';

function host() {
  const storage = new Map<string,unknown>(), books: any[] = [], cards: any[] = [], entries: any[] = [], users: string[] = [];
  let loseCardReply = false, failEntryOnce = false;
  const api = {
    permissions: {has: () => true},
    userStorage: { getJson: async (key: string, options: any) => structuredClone(storage.get(key) ?? options.fallback), setJson: async (key: string, value: unknown) => {storage.set(key, structuredClone(value));} },
    characters: {
      list: async () => ({data:cards,total:cards.length}),
      create: async (input: any, userId: string) => { users.push(userId); const card={...input,id:`card-${cards.length}`}; cards.push(card); if(loseCardReply){loseCardReply=false;throw new Error('Reply lost');}return card; },
    },
    world_books: {
      list: async () => ({data:books,total:books.length}), get: async (id:string) => books.find(b=>b.id===id),
      create: async (input:any,userId:string) => {users.push(userId);const book={...input,id:`book-${books.length}`};books.push(book);return book;},
      entries: { list: async (bookId:string) => {const data=entries.filter(entry=>entry.world_book_id===bookId);return {data,total:data.length};}, create: async (bookId:string,input:any,userId:string) => {users.push(userId);if(failEntryOnce && entries.length===1){failEntryOnce=false;throw new Error('Entry unavailable');}const entry={...input,id:`entry-${entries.length}`,world_book_id:bookId};entries.push(entry);return entry;} },
    },
  } as unknown as SpindleAPI;
  return {api,books,cards,entries,users,loseReply:()=>{loseCardReply=true;},failEntry:()=>{failEntryOnce=true;}};
}
describe('saving cards and lore', () => {
  test('saves one narrator with attached, non-global lore and ordered greetings', async () => {
    const h=host(), p=new CardPublisher(h.api,'user-a'), story=draft(); const saved=await p.publish(story);
    expect(h.cards).toHaveLength(1); expect(h.books).toHaveLength(1); expect(h.entries).toHaveLength(3);
    expect(h.cards[0].world_book_ids).toEqual([saved.worldBookId]); expect(h.cards[0].first_mes).toBe(story.scenes[0].greeting);
    expect(h.cards[0].alternate_greetings).toEqual([story.scenes[1].greeting]); expect(h.cards[0].extensions[EXTENSION_ID].scenes).toHaveLength(2);
    expect(h.users.every(user=>user==='user-a')).toBe(true);
    expect(worldEntries(story).every(entry=>entry.use_regex===false && entry.vectorized===false)).toBe(true);
  });
  test('double clicks and restart retries do not create duplicate cards', async () => {
    const h=host(),p=new CardPublisher(h.api,'user-a'); const [a,b]=await Promise.all([p.publish(draft()),p.publish(draft())]);
    expect(a.characterId).toBe(b.characterId); expect(h.cards).toHaveLength(1);
    await new CardPublisher(h.api,'user-a').publish(draft()); expect(h.cards).toHaveLength(1);
  });
  test('recovers after host creates card but its reply is lost', async () => {
    const h=host();h.loseReply();await expect(new CardPublisher(h.api,'user-a').publish(draft())).rejects.toThrow('Reply lost');
    const saved=await new CardPublisher(h.api,'user-a').publish(draft());expect(saved.characterId).toBe(h.cards[0].id);expect(h.cards).toHaveLength(1);
  });
  test('retries a partial world book without duplicating existing entries', async () => {
    const h=host();h.failEntry();await expect(new CardPublisher(h.api,'user-a').publish(draft())).rejects.toThrow();
    await new CardPublisher(h.api,'user-a').publish(draft());expect(h.books).toHaveLength(1);expect(h.entries).toHaveLength(3);expect(h.cards).toHaveLength(1);
  });
  test('does not report a successful retry when the saved lore was detached', async () => {
    const h=host(),p=new CardPublisher(h.api,'user-a');await p.publish(draft());h.cards[0].world_book_ids=[];
    await expect(p.publish(draft())).rejects.toThrow('removed or detached');expect(h.cards).toHaveLength(1);
  });
  test('keeps the original lore entries unchanged when there is no approved guide', () => {
    const story=draft(), entries=worldEntries(story);
    expect(entries).toHaveLength(3);
    expect(entries.map(entry=>entry.comment)).toEqual(['Premise and player role','Iona','Greyhaven']);
    expect(entries[0].content).toBe(`${story.premise}\n\nPlayer: ${story.playerRole}\nStarting point: ${story.startingPoint}\nThese are starting facts. Later events in the chat take precedence. Leave the player’s actions, thoughts, and speech to them.`);
    expect(entries[1].content).toBe('Iona\nPersonality: Blunt and dependable.\nVoice: Short, direct sentences.\nRelationships at the start: She knows Elias and is wary of Mara.\nKnowledge at the start: Elias left a letter in the chart room.\nUse subsequent chat events for changes to these starting facts.');
    expect(entries[2].content).toBe(story.lore[0].content);
    expect(worldEntries({...story,appearances:[]})).toEqual(entries);
    expect(JSON.stringify(entries)).not.toContain(APPEARANCE_RULE);
  });
  test('adds an always-active authoritative appearance guide without changing cast or lore', () => {
    const story=draft(), previous=worldEntries(story);
    story.appearances=[{characterId:'iona',description:'Brown hair and a scar on her chin.',startingOutfit:'A green coat.'}];
    const [guide,...unchanged]=worldEntries(story);
    expect(guide).toMatchObject({comment:'Approved character appearances',key:[],constant:true,disabled:false,probability:100,use_probability:false,priority:100,use_regex:false,vectorized:false});
    expect(guide.content).toBe(`${APPEARANCE_RULE}\n\n${appearanceGuide(story)}`);
    expect(unchanged).toEqual(previous);
  });
  test('publishes manually approved prose consistently in the card and world book after JSON roundtrip', async () => {
    const h=host(), story=draft();
    story.appearances=[{characterId:'iona',description:'Warm brown skin; a silver curl.\nA small scar shaped like an “S”.',startingOutfit:'A navy coat with brass buttons & a red scarf.'}];
    const restored=validateDraft(JSON.parse(JSON.stringify(story)));
    expect(restored.appearances).toEqual(story.appearances);
    const saved=await new CardPublisher(h.api,'user-a').publish(restored);
    const guide=h.entries.find(entry=>entry.comment==='Approved character appearances');
    expect(guide.world_book_id).toBe(saved.worldBookId);
    expect(guide.content).toContain(appearanceGuide(restored));
    expect(h.cards[0].description).toContain(appearanceGuide(restored));
    expect(h.cards[0].system_prompt).toContain(APPEARANCE_RULE);
    expect(guide.content).toContain(story.appearances[0].description);
    expect(guide.content).toContain(story.appearances[0].startingOutfit);
    expect(h.cards[0].first_mes).toBe(story.scenes[0].greeting);
    expect(h.cards[0].alternate_greetings).toEqual(story.scenes.slice(1).map(scene=>scene.greeting));
  });
  test('changed approved details get a new receipt and leave the previous card and book intact', async () => {
    const h=host(), publisher=new CardPublisher(h.api,'user-a'), story=draft();
    story.appearances=[{characterId:'iona',description:'Brown hair.',startingOutfit:'A green coat.'}];
    const first=await publisher.publish(story), firstKey=await draftKey(story);
    const beforeCard=structuredClone(h.cards[0]), beforeEntries=structuredClone(h.entries);
    const changed=structuredClone(story);changed.appearances![0].description='Silver hair.';
    expect(await draftKey(changed)).not.toBe(firstKey);
    const second=await publisher.publish(changed);
    expect(second.characterId).not.toBe(first.characterId);
    expect(second.worldBookId).not.toBe(first.worldBookId);
    expect(h.cards).toHaveLength(2);expect(h.books).toHaveLength(2);
    expect(h.cards[0]).toEqual(beforeCard);
    expect(h.entries.filter(entry=>entry.world_book_id===first.worldBookId)).toEqual(beforeEntries);
    expect(h.entries.find(entry=>entry.world_book_id===second.worldBookId && entry.comment==='Approved character appearances').content).toContain('Silver hair.');
  });
  test('double clicks and restarted publishing reuse the same approved guide', async () => {
    const h=host(), publisher=new CardPublisher(h.api,'user-a'), story=draft();
    story.appearances=[{characterId:'iona',description:'Brown hair.',startingOutfit:''}];
    const [first,second]=await Promise.all([publisher.publish(story),publisher.publish(structuredClone(story))]);
    expect(second).toEqual(first);
    expect(await new CardPublisher(h.api,'user-a').publish(story)).toEqual(first);
    expect(h.cards).toHaveLength(1);expect(h.books).toHaveLength(1);expect(h.entries).toHaveLength(4);
    expect(h.entries.filter(entry=>entry.comment==='Approved character appearances')).toHaveLength(1);
  });
  test('recovers an interrupted guide publication without duplicating the always-active entry', async () => {
    const h=host(), story=draft();story.appearances=[{characterId:'iona',description:'Brown hair.',startingOutfit:'A green coat.'}];
    h.failEntry();await expect(new CardPublisher(h.api,'user-a').publish(story)).rejects.toThrow('Entry unavailable');
    expect(h.entries).toHaveLength(1);expect(h.entries[0].comment).toBe('Approved character appearances');
    await new CardPublisher(h.api,'user-a').publish(story);
    expect(h.entries).toHaveLength(4);expect(h.cards).toHaveLength(1);expect(h.books).toHaveLength(1);
    expect(h.entries.filter(entry=>entry.comment==='Approved character appearances')).toHaveLength(1);
  });
});
