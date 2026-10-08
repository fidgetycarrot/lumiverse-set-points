import { describe, expect, test } from 'bun:test';
import type { SpindleAPI } from 'lumiverse-spindle-types';
import { CardPublisher, worldEntries } from '../src/publisher';
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
      entries: { list: async () => ({data:entries,total:entries.length}), create: async (bookId:string,input:any,userId:string) => {users.push(userId);if(failEntryOnce && entries.length===1){failEntryOnce=false;throw new Error('Entry unavailable');}const entry={...input,id:`entry-${entries.length}`};entries.push(entry);return entry;} },
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
});
