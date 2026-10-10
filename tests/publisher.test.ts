import { describe, expect, test } from 'bun:test';
import type { SpindleAPI } from 'lumiverse-spindle-types';
import { APPEARANCE_CONTINUITY_RULE, APPEARANCE_FIXED_RULE, APPEARANCE_RULE, appearanceEntryText, cardPayload, mainCharacterIds, validateDraft } from '../src/importer';
import { CardPublisher, draftKey, worldEntries } from '../src/publisher';
import { EXTENSION_ID } from '../src/types';
import { draft } from './fixtures';
import { roleInstruction, roleReviewFingerprint } from '../src/roles';

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
  test('blocks unresolved player agency before creating resources and invalidates review after edits',async()=>{
    const h=host(),p=new CardPublisher(h.api,'user-a'),story=draft();
    story.scenes[0].greeting='You decide to open the letter. I wait beside the boat.';
    await expect(p.publish(story)).rejects.toThrow('player and viewpoint checks');
    expect(h.cards).toHaveLength(0);expect(h.books).toHaveLength(0);expect(h.entries).toHaveLength(0);
    story.roleReview=roleReviewFingerprint(story);await p.publish(story);
    expect(h.cards).toHaveLength(1);expect(h.cards[0].system_prompt).toContain('external narrator');
    expect(h.cards[0].extensions[EXTENSION_ID].roleDirection).toBe(roleInstruction(story));
    story.scenes[0].greeting='You decide to leave.';
    await expect(p.publish(story)).rejects.toThrow('player and viewpoint checks');expect(h.cards).toHaveLength(1);
  });
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
  test('adds narrator continuity to the premise while preserving cast and lore without an approved guide', () => {
    const story=draft(), entries=worldEntries(story);
    expect(entries).toHaveLength(3);
    expect(entries.map(entry=>entry.comment)).toEqual(['Premise and player role','Iona','Greyhaven']);
    expect(entries[0].content).toBe(`${story.premise}\n\nPlayer: ${story.playerRole}\nStarting point: ${story.startingPoint}\n\n${roleInstruction(story)}\nThese are starting facts. Later events in the chat take precedence. Leave the player’s actions, thoughts, and speech to them.\n\n${APPEARANCE_CONTINUITY_RULE}`);
    expect(entries[1].content).toBe('Iona\nPersonality: Blunt and dependable.\nVoice: Short, direct sentences.\nRelationships at the start: She knows Elias and is wary of Mara.\nKnowledge at the start: Elias left a letter in the chart room.\nUse subsequent chat events for changes to these starting facts.');
    expect(entries[2].content).toBe(story.lore[0].content);
    expect(worldEntries({...story,appearances:[]})).toEqual(entries);
    expect(JSON.stringify(entries)).not.toContain(APPEARANCE_RULE);
  });
  test('adds an always-active rule and one short appearance entry per character without changing cast or lore', () => {
    const story=draft(), previous=worldEntries(story);
    story.appearances=[{characterId:'iona',description:'Brown hair and a scar on her chin.',startingOutfit:'A green coat.'}];
    const entries=worldEntries(story), [rule]=entries, look=entries.find(entry=>entry.comment==='Iona · appearance')!;
    expect(rule).toMatchObject({comment:'Appearance rule',key:[],constant:true,disabled:false,probability:100,use_probability:false,priority:100,use_regex:false,vectorized:false});
    expect(rule.content).toBe(`${APPEARANCE_RULE}\n\n${APPEARANCE_FIXED_RULE}`);
    expect(look).toMatchObject({key:['Iona','Captain Iona'],constant:true,disabled:false,priority:100,use_regex:false,vectorized:false});
    expect(look.content).toBe('Iona — appearance (fixed)\nBrown hair and a scar on her chin.\nOutfit at the start: A green coat.');
    expect(entries.filter(entry=>entry!==rule&&entry!==look)).toEqual(previous);
  });
  test('keeps main characters always on and finds everyone else by name', () => {
    const story=draft(), extra=(id:string,name:string)=>({...story.cast[0],id,name,aliases:[]});
    story.cast.push(extra('elias','Elias'),extra('bram','Bram'),extra('odile','Odile'),extra('tam','Tam'));
    story.playerRole='Tam';
    story.scenes[1].direction='Elias and Bram argue over the letter while Iona watches.';
    story.scenes[0].direction='Iona and Elias wait. Leave the choice to the player.';
    story.appearances=story.cast.map(person=>({characterId:person.id,description:`${person.name} has a look.`,startingOutfit:''}));
    // The human's own character, then the three named in the most scenes.
    expect([...mainCharacterIds(story)]).toEqual(['tam','iona','elias','bram']);
    const looks=worldEntries(story).filter(entry=>entry.comment?.endsWith('· appearance'));
    expect(looks.map(entry=>[entry.comment,entry.constant])).toEqual([['Iona · appearance',true],['Elias · appearance',true],['Bram · appearance',true],['Odile · appearance',false],['Tam · appearance',true]]);
    expect(looks.find(entry=>entry.comment==='Odile · appearance')!.key).toEqual(['Odile']);
    // An outfit alone still gets an entry; a wholly blank one does not.
    story.appearances=[{characterId:'odile',description:'',startingOutfit:'A grey shawl.'},{characterId:'bram',description:' ',startingOutfit:''}];
    const partial=worldEntries(story).filter(entry=>entry.comment?.endsWith('· appearance'));
    expect(partial).toHaveLength(1);
    expect(partial[0].content).toBe(appearanceEntryText('Odile',story.appearances[0]));
    expect(partial[0].content).toContain('Outfit at the start: A grey shawl.');
  });
  test.each(['absent','blank','partial'] as const)('permits consistent supporting-character invention with %s approvals', async mode => {
    const h=host(),story=draft();
    if(mode==='blank')story.appearances=[{characterId:'iona',description:'',startingOutfit:''}];
    if(mode==='partial')story.appearances=[{characterId:'iona',description:'Green eyes.',startingOutfit:''}];
    const before=structuredClone(story);await new CardPublisher(h.api,'user-a').publish(story);
    expect(h.cards[0].system_prompt).toContain(APPEARANCE_CONTINUITY_RULE);
    expect(h.cards[0].system_prompt).toContain('Invent missing visual details as characters become relevant');
    expect(h.cards[0].system_prompt).toContain('keep those physical details consistent');
    expect(h.cards[0].system_prompt).toContain('Leave unspecified details of the human');
    expect(h.entries.find(entry=>entry.comment==='Premise and player role')).toMatchObject({constant:true,disabled:false,content:expect.stringContaining(APPEARANCE_CONTINUITY_RULE)});
    expect(JSON.stringify(h.cards)).not.toContain('Unspecified fields remain unknown');
    // Blank approvals lock nothing: no rule and no entry. A partial one locks only what it says.
    expect(h.entries.some(entry=>entry.comment==='Appearance rule')).toBe(mode==='partial');
    if(mode==='partial'){expect(h.entries.find(entry=>entry.comment==='Appearance rule').content).toContain('Only explicitly approved traits are locked');expect(h.entries.find(entry=>entry.comment==='Iona · appearance').content).toBe('Iona — appearance (fixed)\nGreen eyes.');}
    expect(h.cards[0].description).not.toContain('Green eyes.');
    expect(story).toEqual(before);
    expect(h.cards[0].first_mes).toBe(story.scenes[0].greeting);
    expect(h.cards[0].alternate_greetings).toEqual(story.scenes.slice(1).map(scene=>scene.greeting));
  });
  test('saving an unchanged pre-update draft creates the revised card once without altering the old publication',async()=>{
    const h=host(),story=draft();story.appearances=[{characterId:'iona',description:'Green eyes.',startingOutfit:''}];
    const oldKey=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(story)))),byte=>byte.toString(16).padStart(2,'0')).join('');
    h.cards.push({...cardPayload(story),id:'old-card',system_prompt:'Unspecified fields remain unknown rather than becoming invented fixed traits.',world_book_ids:['old-book'],extensions:{[EXTENSION_ID]:{key:oldKey,draftId:story.id}}});
    h.books.push({id:'old-book',metadata:{[EXTENSION_ID]:{key:oldKey,draftId:story.id}}});
    h.entries.push({id:'old-entry',world_book_id:'old-book',content:'Old appearance guidance.'});
    await h.api.userStorage.setJson(`receipts/${oldKey}.json`,{key:oldKey,draftId:story.id,characterId:'old-card',worldBookId:'old-book',complete:true},{userId:'user-a'});
    const oldCard=structuredClone(h.cards[0]),oldEntry=structuredClone(h.entries[0]);
    const publisher=new CardPublisher(h.api,'user-a'),saved=await publisher.publish(story);
    expect(await draftKey(story)).not.toBe(oldKey);expect(saved.characterId).not.toBe('old-card');
    expect(h.cards[1].system_prompt).toContain(APPEARANCE_CONTINUITY_RULE);
    expect(h.cards[1].system_prompt).not.toContain('Unspecified fields remain unknown');
    expect(await publisher.publish(story)).toEqual(saved);
    expect(await new CardPublisher(h.api,'user-a').publish(story)).toEqual(saved);
    expect(h.cards).toHaveLength(2);expect(h.books).toHaveLength(2);
    expect(h.cards[0]).toEqual(oldCard);expect(h.entries[0]).toEqual(oldEntry);
  });
  test('publishes manually approved prose consistently in the card and world book after JSON roundtrip', async () => {
    const h=host(), story=draft();
    story.appearances=[{characterId:'iona',description:'Warm brown skin; a silver curl.\nA small scar shaped like an “S”.',startingOutfit:'A navy coat with brass buttons & a red scarf.'}];
    const restored=validateDraft(JSON.parse(JSON.stringify(story)));
    expect(restored.appearances).toEqual(story.appearances);
    const saved=await new CardPublisher(h.api,'user-a').publish(restored);
    const guide=h.entries.find(entry=>entry.comment==='Iona · appearance');
    expect(guide.world_book_id).toBe(saved.worldBookId);
    expect(guide.content).toBe(appearanceEntryText('Iona',restored.appearances![0]));
    expect(h.cards[0].system_prompt).toContain(APPEARANCE_FIXED_RULE);
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
    expect(h.entries.find(entry=>entry.world_book_id===second.worldBookId && entry.comment==='Iona · appearance').content).toContain('Silver hair.');
  });
  test('double clicks and restarted publishing reuse the same approved guide', async () => {
    const h=host(), publisher=new CardPublisher(h.api,'user-a'), story=draft();
    story.appearances=[{characterId:'iona',description:'Brown hair.',startingOutfit:''}];
    const [first,second]=await Promise.all([publisher.publish(story),publisher.publish(structuredClone(story))]);
    expect(second).toEqual(first);
    expect(await new CardPublisher(h.api,'user-a').publish(story)).toEqual(first);
    expect(h.cards).toHaveLength(1);expect(h.books).toHaveLength(1);expect(h.entries).toHaveLength(5);
    expect(h.entries.filter(entry=>entry.comment==='Iona · appearance')).toHaveLength(1);
  });
  test('recovers an interrupted guide publication without duplicating the always-active entry', async () => {
    const h=host(), story=draft();story.appearances=[{characterId:'iona',description:'Brown hair.',startingOutfit:'A green coat.'}];
    h.failEntry();await expect(new CardPublisher(h.api,'user-a').publish(story)).rejects.toThrow('Entry unavailable');
    expect(h.entries).toHaveLength(1);expect(h.entries[0].comment).toBe('Appearance rule');
    await new CardPublisher(h.api,'user-a').publish(story);
    expect(h.entries).toHaveLength(5);expect(h.cards).toHaveLength(1);expect(h.books).toHaveLength(1);
    expect(h.entries.filter(entry=>entry.comment==='Appearance rule')).toHaveLength(1);expect(h.entries.filter(entry=>entry.comment==='Iona · appearance')).toHaveLength(1);
  });
});
