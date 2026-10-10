import type { VisualPack } from './visuals';
import type { LookPack } from './looks';
export const EXTENSION_ID = 'lumiverse_set_points';
export const VERSION = '0.1.12';
export type NarrationMode = 'neutral'|'character';
export interface StoryRoles { narration: NarrationMode; playerCharacterId: string|null; viewpointCharacterId: string|null; sourceViewpoint: string }
export interface CastMember { id: string; name: string; aliases: string[]; personality: string; voice: string; relationships: string; knowledge: string; sourceRefs: string[] }
export interface ApprovedAppearance { characterId: string; description: string; startingOutfit: string }
/** Who the human plays as in Lumiverse. 'create' makes a persona on save; 'existing' points at one of theirs; 'none' leaves it alone. */
export type PersonaMode = 'create'|'existing'|'none';
export interface PersonaPlan { mode: PersonaMode; name: string; title: string; description: string; personaId?: string }
export interface PersonaChoice { id: string; name: string; title: string }
export interface LoreEntry { id: string; name: string; keys: string[]; content: string }
export interface StoryScene { id: string; title: string; greeting: string; direction: string; assumptions: string[]; sourceRefs: string[] }
export interface StoryDraft {
  version: 1; id: string; title: string; premise: string; playerRole: string; startingPoint: string;
  narratorInstructions: string; cast: CastMember[]; appearances?: ApprovedAppearance[]; lore: LoreEntry[]; scenes: StoryScene[]; warnings: string[];
  roles?: StoryRoles; roleReview?: string; openingStyle?:'interactive'|'story'; persona?: PersonaPlan;
  source: { title: string; url?: string; characters: number; chunks: number }; createdAt: number;
}
export type ReasoningMode = 'inherit'|'off'|'low';
export interface ImportOptions { text: string; sourceTitle: string; sourceUrl?: string; playerRole: string; startingPoint: string; sceneCount: number; connectionId: string; chunkSize: number; maxOutputTokens?: number; reasoningMode?: ReasoningMode; narrationMode?: NarrationMode; narratorCharacter?: string; sourceViewpoint?: string; openingStyle?:StoryDraft['openingStyle'] }
export interface WebPageLink { title: string; url: string }
export interface WebStoryPage { title: string; text: string; url: string; nextPages: WebPageLink[] }
export interface ImportJob { id: string; status: 'running'|'complete'|'cancelled'|'failed'; completed: number; total: number; label: string; error?: string; retryUncertain?: boolean; phase?: string }
export interface SavedStory { characterId: string; worldBookId: string; draftId: string; title: string; personaId?: string; personaName?: string; personaNote?: string }
export interface SceneView { chatId: string|null; characterId: string|null; title: string; enabled: boolean; current: number; next: number|null; scenes: StoryScene[]; canUndo: boolean; busy: boolean; notice: string }
export interface ConnectionChoice { id: string; name: string; provider: string; model: string }
export interface VisualSnapshot { job: ImportJob|null; pack: VisualPack|null; resultSignature?: string; requestSignature?: string; sourceSignature?: string; resumeAvailable: boolean; retryUncertain: boolean; connectionId?: string; maxOutputTokens?: number; reasoningMode?: ReasoningMode }
export interface LookSnapshot { job: ImportJob|null; pack: LookPack|null; resultSignature?: string; requestSignature?: string; resumeAvailable: boolean; retryUncertain: boolean; rerolling?: string; connectionId?: string; maxOutputTokens?: number; reasoningMode?: ReasoningMode }
export interface RepairSnapshot { job: ImportJob|null; result: StoryDraft|null; requestSignature?: string; resumeAvailable: boolean; retryUncertain: boolean; connectionId?: string }
export interface AppSnapshot { version: string; permissions: string[]; connections: ConnectionChoice[]; job: ImportJob|null; draft: StoryDraft|null; saved: SavedStory|null; play: SceneView; resume?: { available: boolean; retryUncertain: boolean; maxOutputTokens?: number; reasoningMode?: ReasoningMode }; visuals?: VisualSnapshot; looks?: LookSnapshot; personas?: PersonaChoice[]; repairs?: RepairSnapshot; diagnostics: string[] }
export interface RequestMessage { type: 'set-points:request'; id: string; action: string; input?: unknown }
export interface ResponseMessage { type: 'set-points:response'; id: string; result?: unknown; error?: string }
export interface ChangedMessage { type: 'set-points:changed' }
export const DEMO_STORY = `The Lighthouse Letter\n\nMara, a cautious cartographer who hides her nerves behind dry humor, arrives at Greyhaven to find her missing brother Elias. Elias repairs the lighthouse and trusts Captain Iona, a blunt sailor who values promises. Mara knows neither why Elias vanished nor who last saw him.\n\nAt the harbor, Iona tells Mara that Elias left a sealed letter in the old chart room. Iona is wary of outsiders, but admits she is worried. A storm will reach Greyhaven at midnight. Mara can ask Iona for help or investigate alone.\n\nThe chart room contains a letter from Elias: the lighthouse lens was deliberately damaged, and he has gone to the north cove to find a replacement. He asks for a lantern signal if the boat should return. The letter is the first evidence that Elias left willingly.\n\nAt the north cove, Elias waits beside a stranded boat. He has the lens, but the tide has blocked the footpath. Iona knows a sea route back. The group must decide how to carry the fragile lens home.\n\nAt the lighthouse, the storm arrives. The replacement lens can restore the beacon. Whether Mara repairs it, asks for help, or finds another solution remains her choice.`;
