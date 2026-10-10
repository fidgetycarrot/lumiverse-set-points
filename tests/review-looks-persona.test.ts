import { afterEach, describe, expect, test } from 'bun:test';
import { Window } from 'happy-dom';
import type { SpindleFrontendContext } from 'lumiverse-spindle-types';
import { setup } from '../src/frontend';
import { validateDraft } from '../src/importer';
import { LOOK_FIELDS, lookAppearance, lookDraftSignature, lookOutfit, type CharacterLook, type LookPack } from '../src/looks';
import { personaDraft } from '../src/persona';
import { visualDraftSignature } from '../src/visuals';
import type { AppSnapshot, StoryDraft } from '../src/types';

const cleanups: Array<() => void> = [];
afterEach(() => { for (const fn of cleanups.splice(0)) fn(); });
const tick = () => new Promise(resolve => setTimeout(resolve, 5));
/** Two cast members; the human plays Iona. */
const fixture = (): StoryDraft => ({
  version: 1, id: 'draft-a', title: 'The Letter', premise: 'A missing sailor and a letter.', playerRole: 'Iona', startingPoint: 'The harbor', narratorInstructions: 'Leave the player’s actions open.',
  roles: { narration: 'neutral', playerCharacterId: 'captain', viewpointCharacterId: null, sourceViewpoint: '' },
  cast: [
    { id: 'captain', name: 'Iona', aliases: [], personality: 'Blunt but loyal', voice: 'Direct', relationships: 'Wary of Elias', knowledge: 'There is a letter.', sourceRefs: ['chunk:1'] },
    { id: 'keeper', name: 'Elias', aliases: [], personality: 'Earnest', voice: 'Warm', relationships: 'Trusts Iona', knowledge: 'The lens is cracked.', sourceRefs: ['chunk:1'] },
  ],
  lore: [{ id: 'harbor', name: 'Harbor', keys: ['harbor'], content: 'A coastal village.' }],
  scenes: [{ id: 'opening', title: 'The harbor', greeting: 'Elias waits at the dock.', direction: 'Introduce Elias.', assumptions: [], sourceRefs: ['chunk:1'] }],
  warnings: [], source: { title: 'The Letter', characters: 100, chunks: 1 }, createdAt: 1,
});
function look(characterId: string, tag: string, rerolls = 0): CharacterLook {
  const clues = [{ id: `clue-${characterId}`, kind: 'stated' as const, about: 'hair' as const, text: 'Grey hair.', sourceRefs: ['chunk:1'] }];
  return { characterId, clues, rerolls, rejected: [], traits: LOOK_FIELDS.map(field => field === 'hair' ? { field, value: 'Grey, cropped', basis: 'story' as const, clueIds: [clues[0].id], why: '' } : { field, value: `${field} ${tag}`, basis: field === 'build' ? 'invented' as const : 'invented' as const, clueIds: [], why: 'fits the harbor' }) };
}
const pack = (tag = 'one', rerolls = 0): LookPack => ({ version: 1, draftId: 'draft-a', looks: [look('captain', tag, rerolls), look('keeper', 'keeper')], warnings: ['One clue was left out.'] });
function harness(options: { bound?: boolean; personas?: boolean } = {}) {
  const window = new Window({ url: 'https://lumiverse.example/' });
  Object.assign(globalThis, { document: window.document, HTMLInputElement: window.HTMLInputElement, HTMLTextAreaElement: window.HTMLTextAreaElement });
  const root = window.document.createElement('div'); window.document.body.append(root);
  const draft = fixture(), signature = lookDraftSignature(draft), sourceSignature = visualDraftSignature(draft);
  const state: AppSnapshot = {
    version: '0.1.12', permissions: options.personas === false ? [] : ['personas'], ...(options.personas === false ? {} : { personas: [{ id: 'p-eric', name: 'Eric', title: 'Me' }, { id: 'p-iona', name: 'iona', title: 'Old save' }] }),
    connections: [{ id: 'model', name: 'Writing model', provider: 'test', model: 'test' }], job: null, draft, saved: null,
    play: { chatId: null, characterId: null, title: '', enabled: false, current: 0, next: null, scenes: [], canUndo: false, busy: false, notice: '' },
    visuals: { job: null, pack: null, ...(options.bound === false ? {} : { sourceSignature }), resumeAvailable: false, retryUncertain: false },
    looks: { job: null, pack: null, resumeAvailable: false, retryUncertain: false }, diagnostics: [],
  };
  let receive: (message: unknown) => void = () => {};
  const requests: Array<{ action: string; input: any }> = [];
  const ctx = {
    ui: { registerDrawerTab: () => ({ root, tabId: 'set-points', setBadge: () => {}, onActivate: () => () => {}, activate: () => {}, destroy: () => {} }), registerInputBarAction: () => ({ onClick: () => () => {}, destroy: () => {} }) },
    dom: { addStyle: () => () => {} }, events: { on: () => () => {} }, getActiveChat: () => ({ chatId: null, characterId: null }), ready: () => {},
    onBackendMessage: (callback: (message: unknown) => void) => { receive = callback; return () => { receive = () => {}; }; },
    sendToBackend: (message: any) => { requests.push(message); queueMicrotask(() => {
      let result: unknown;
      try {
        if (message.action === 'snapshot') result = structuredClone(state);
        else if (message.action === 'start-looks' || message.action === 'reroll-look') { state.looks = { ...state.looks!, job: { id: 'look-job', status: 'running', completed: 0, total: 1, label: 'Designing' }, requestSignature: lookDraftSignature(message.input.draft), ...(message.input.characterId ? { rerolling: message.input.characterId } : {}) }; result = state.looks.job; }
        else if (message.action === 'save-draft') { state.draft = validateDraft(message.input.draft); result = state.draft; }
        else if (message.action === 'create-card') { const persona = message.input.draft.persona; state.saved = { characterId: 'card', worldBookId: 'book', draftId: message.input.draft.id, title: message.input.draft.title, ...(persona?.mode === 'create' ? { personaId: 'made', personaName: persona.name } : {}) }; result = state.saved; }
        else if (message.action === 'switch-persona') result = { personaId: message.input.personaId, name: 'Iona' };
        receive({ type: 'set-points:response', id: message.id, result: structuredClone(result) });
      } catch (error) { receive({ type: 'set-points:response', id: message.id, error: error instanceof Error ? error.message : String(error) }); }
    }); },
  } as unknown as SpindleFrontendContext;
  cleanups.push(setup(ctx));
  const all = <T>(selector: string) => Array.from(root.querySelectorAll(selector)) as unknown as T[];
  const button = (text: string) => all<HTMLButtonElement>('button').find(item => item.textContent === text)!;
  const field = (label: string) => { const caption = all<HTMLLabelElement>('label').find(item => item.textContent === label)!; return caption && root.querySelector(`#${caption.htmlFor}`) as unknown as HTMLInputElement; };
  const input = (label: string, value: string) => { const el = field(label); el.value = value; el.dispatchEvent(new window.Event('input', { bubbles: true }) as unknown as Event); return el; };
  const choose = (label: string, value: string) => { const el = field(label); el.value = value; el.dispatchEvent(new window.Event('change', { bubbles: true }) as unknown as Event); return el; };
  const status = () => root.querySelector('.sp-status')!.textContent;
  /** Finish the running look job with the given looks, as the backend would. */
  const finish = async (next: LookPack) => { state.looks = { ...state.looks!, pack: next, resultSignature: signature, job: { ...state.looks!.job!, status: 'complete', completed: 1 }, rerolling: undefined }; receive({ type: 'set-points:changed' }); await tick(); };
  const sent = (action: string) => requests.filter(item => item.action === action).map(item => item.input);
  const card = (id: string) => root.querySelector(`[data-look="${id}"]`) as unknown as HTMLElement;
  return { root, state, signature, button, field, input, choose, status, finish, sent, card, changed: async () => { receive({ type: 'set-points:changed' }); await tick(); } };
}

describe('choosing a persona in Review', () => {
  test('sits right after the role choices and starts as “pick one myself”', async () => {
    const app = harness(); await tick();
    const titles = Array.from(app.root.querySelectorAll('summary')).map(item => item.textContent);
    expect(titles.indexOf('Your persona')).toBe(titles.indexOf('Player and narrator roles') + 1);
    expect(app.field('Who you play as in Lumiverse').value).toBe('none');
    expect(Array.from(app.field('Who you play as in Lumiverse').querySelectorAll('option')).map(item => item.textContent)).toEqual(['I’ll pick a persona myself', 'Make a persona for Iona', 'Use one of my personas']);
    expect(app.field('Persona name')).toBeFalsy();
  });
  test('writes a persona from the played character for review, then follows edits to them', async () => {
    const app = harness(); await tick();
    app.choose('Who you play as in Lumiverse', 'create');
    expect(app.field('Persona name').value).toBe('Iona');
    expect(app.field('Short label').value).toBe('The Letter');
    expect(app.field('Persona description').value).toBe(personaDraft(fixture()).description);
    app.input('Voice & manner', 'Clipped orders');
    expect(app.field('Persona description').value).toContain('Voice: Clipped orders');
    app.input('Iona: approved appearance', 'Hair: grey, cropped');
    expect(app.field('Persona description').value).toContain('Appearance:\nHair: grey, cropped');
    // Elias is someone else; editing him never touches the persona.
    const before = app.field('Persona description').value;
    for (const item of Array.from(app.root.querySelectorAll('label')).filter(label => label.textContent === 'Personality')) { const el = app.root.querySelector(`#${item.htmlFor}`) as unknown as HTMLInputElement; if (el.value === 'Earnest') { el.value = 'Reckless'; el.dispatchEvent(new (el.ownerDocument.defaultView as any).Event('input', { bubbles: true })); } }
    expect(app.field('Persona description').value).toBe(before);
  });
  test('stops following once the wording is changed, and can be rewritten on request', async () => {
    const app = harness(); await tick();
    app.choose('Who you play as in Lumiverse', 'create');
    app.input('Persona description', 'My own words.');
    app.input('Voice & manner', 'Clipped orders');
    expect(app.field('Persona description').value).toBe('My own words.');
    app.button('Write it again from Iona').click(); await tick();
    expect(app.field('Persona description').value).toContain('Voice: Clipped orders');
    app.button('Save draft').click(); await tick();
    expect(app.sent('save-draft')[0].draft.persona).toMatchObject({ mode: 'create', name: 'Iona', description: expect.stringContaining('Voice: Clipped orders') });
  });
  test('uses an existing persona, preferring one with the character’s name', async () => {
    const app = harness(); await tick();
    app.choose('Who you play as in Lumiverse', 'existing');
    expect(app.field('Your persona').value).toBe('p-iona');
    expect(app.field('Persona name')).toBeFalsy();
    app.choose('Your persona', 'p-eric');
    app.button('Save draft').click(); await tick();
    expect(app.sent('save-draft')[0].draft.persona).toMatchObject({ mode: 'existing', personaId: 'p-eric' });
    expect(app.root.textContent).toContain('The narrator still treats you as Iona');
  });
  test('explains what is missing instead of picking a persona that is not there', async () => {
    const app = harness({ personas: false }); await tick();
    app.choose('Who you play as in Lumiverse', 'existing');
    expect(app.field('Who you play as in Lumiverse').value).toBe('none');
    expect(app.status()).toContain('Grant personas');
    app.choose('Who you play as in Lumiverse', 'create');
    expect(app.root.textContent).toContain('Until then, Save to Lumiverse will stop and tell you.');
  });
  test('shows the saved persona and switches to it only when asked', async () => {
    const app = harness(); await tick();
    app.choose('Who you play as in Lumiverse', 'create');
    app.button('Save to Lumiverse  →').click(); await tick();
    expect(app.status()).toContain('with the persona Iona');
    expect(app.root.textContent).toContain('Persona: Iona');
    expect(app.sent('switch-persona')).toHaveLength(0);
    app.button('Switch to this persona now').click(); await tick();
    expect(app.sent('switch-persona')).toEqual([{ personaId: 'made' }]);
    expect(app.status()).toBe('You are now playing as Iona.');
  });
});

describe('designing looks in Review', () => {
  test('sits with the cast and starts from the story saved with the draft', async () => {
    const app = harness(); await tick();
    const titles = Array.from(app.root.querySelectorAll('summary')).map(item => item.textContent);
    expect(titles.indexOf('Design character looks · optional')).toBe(titles.indexOf('Elias') + 1);
    expect(app.root.textContent).toContain('The story text is saved with this draft.');
    app.button('Design looks').click(); await tick();
    const [request] = app.sent('start-looks');
    expect(request).toMatchObject({ connectionId: 'model', maxOutputTokens: 16000, reasoningMode: 'inherit' });
    expect('sourceText' in request).toBe(false);
    expect(request.draft.id).toBe('draft-a');
  });
  test('asks for the story when none is saved, and keeps it apart from image descriptions', async () => {
    const app = harness({ bound: false }); await tick();
    app.button('Design looks').click(); await tick();
    expect(app.sent('start-looks')).toHaveLength(0);
    expect(app.status()).toContain('Add between 100 and 500,000 characters');
    app.input('Story text for this draft', 'The original story. '.repeat(10));
    expect(app.field('Original story for these descriptions').value).toBe('');
    app.button('Design looks').click(); await tick();
    expect(app.sent('start-looks')[0].sourceText).toBe('The original story. '.repeat(10));
  });
  test('shows every trait with where it came from, without changing the story', async () => {
    const app = harness(); await tick();
    app.button('Design looks').click(); await tick();
    await app.finish(pack());
    const card = app.card('captain');
    expect(Array.from(card.querySelectorAll('dt')).map(item => item.textContent)).toEqual(['Age', 'Height', 'Build', 'Skin', 'Hair', 'Eyes', 'Face', 'Marks', 'Outfit at the start']);
    const hair = Array.from(card.querySelectorAll('dd'))[4];
    expect(hair.textContent).toContain('Grey, cropped');
    expect(hair.querySelector('.sp-basis')!.textContent).toBe('From the story');
    expect(hair.textContent).toContain('Story: Grey hair.');
    expect(Array.from(card.querySelectorAll('dd'))[0].querySelector('.sp-basis')!.textContent).toBe('Made up to fit');
    expect(card.querySelector('.sp-tag')!.textContent).toBe('Not in your story yet');
    expect(app.root.textContent).toContain('1 note from look design');
    expect(app.field('Iona: approved appearance').value).toBe('');
    expect(app.button('Design all looks again')).toBeTruthy();
  });
  test('fills only the characters who have no look yet', async () => {
    const app = harness(); await tick();
    app.input('Elias: approved appearance', 'Typed by hand.');
    app.button('Design looks').click(); await tick();
    await app.finish(pack());
    app.button('Use all looks in the story').click(); await tick();
    expect(app.field('Iona: approved appearance').value).toBe(lookAppearance(pack().looks[0]));
    expect(app.field('Iona: approved starting outfit').value).toBe(lookOutfit(pack().looks[0]));
    expect(app.field('Elias: approved appearance').value).toBe('Typed by hand.');
    expect(app.status()).toContain('1 look put in your story. Kept the text you already had for Elias');
    expect(app.card('captain').querySelector('.sp-tag')!.textContent).toBe('In your story');
    expect(app.card('keeper').querySelector('.sp-tag')!.textContent).toBe('Your story has different text');
    // Replacing hand-written text is a separate, deliberate click.
    app.button('Use Elias’s look').click(); await tick();
    expect(app.field('Elias: approved appearance').value).toBe(lookAppearance(pack().looks[1]));
    expect(app.button('In your story').disabled).toBe(true);
  });
  test('a reroll replaces a look that was in the story, everywhere at once', async () => {
    const app = harness(); await tick();
    app.choose('Who you play as in Lumiverse', 'create');
    app.button('Design looks').click(); await tick();
    await app.finish(pack());
    app.button('Use Iona’s look').click(); await tick();
    expect(app.field('Persona description').value).toContain('Build: build one');
    app.input('Iona: what to change · optional', 'heavier build');
    app.button('Reroll Iona').click(); await tick();
    expect(app.sent('reroll-look')[0]).toMatchObject({ characterId: 'captain', note: 'heavier build', connectionId: 'model' });
    await app.finish(pack('two', 1));
    expect(app.field('Iona: approved appearance').value).toBe(lookAppearance(pack('two').looks[0]));
    expect(app.field('Iona: approved appearance').value).not.toContain('build one');
    expect(app.field('Persona description').value).toContain('Build: build two');
    expect(app.field('Persona description').value).not.toContain('build one');
    expect(app.status()).toBe('New look for Iona is in your story, in place of the old one.');
    expect(app.card('captain').textContent).toContain('Rerolled 1 time.');
    expect(app.field('Iona: what to change · optional').value).toBe('');
  });
  test('a reroll never overwrites text typed by hand', async () => {
    const app = harness(); await tick();
    app.button('Design looks').click(); await tick();
    await app.finish(pack());
    app.button('Use Iona’s look').click(); await tick();
    app.input('Iona: approved appearance', 'My own description.');
    app.button('Reroll Iona').click(); await tick();
    await app.finish(pack('two', 1));
    expect(app.field('Iona: approved appearance').value).toBe('My own description.');
    expect(app.status()).toBe('New look for Iona is ready. Choose Use Iona’s look to put it in your story.');
  });
  test('keeps looks through ordinary edits and hides the ones for another draft', async () => {
    const app = harness(); await tick();
    app.button('Design looks').click(); await tick();
    await app.finish(pack());
    app.input('Voice & manner', 'Clipped orders'); app.input('Premise', 'A reworded premise.');
    expect(app.card('captain')).toBeTruthy();
    app.button('Reroll Iona').click(); await tick();
    expect(app.sent('reroll-look')[0].draft.cast[0].voice).toBe('Clipped orders');
    await app.finish(pack('two', 1));
    // Looks saved for some other story are never shown against this one.
    app.state.looks!.resultSignature = lookDraftSignature({ id: 'another-draft', cast: fixture().cast }); await app.changed();
    expect(app.card('captain')).toBeFalsy();
    expect(app.root.textContent).toContain('The saved looks are for a different draft');
    expect(app.button('Design looks')).toBeTruthy();
  });
  test('locks its buttons while a look is being designed', async () => {
    const app = harness(); await tick();
    app.button('Design looks').click(); await tick();
    await app.finish(pack());
    app.button('Reroll Elias').click(); await tick();
    expect(app.button('Reroll Iona').disabled).toBe(true);
    expect(app.button('Use all looks in the story')).toBeTruthy();
    expect(app.button('Design all looks again').disabled).toBe(true);
    expect(app.button('Create image descriptions').disabled).toBe(true);
    await app.finish(pack());
    expect(app.button('Reroll Iona').disabled).toBe(false);
  });
});
