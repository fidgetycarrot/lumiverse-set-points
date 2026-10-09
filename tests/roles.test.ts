import { describe,expect,test } from 'bun:test';
import { cardPayload,validateDraft,type GenerationMessage } from '../src/importer';
import { defaultRoles,rolesForImport,roleInstruction,roleIssues,roleReviewFingerprint,requireRoleReview } from '../src/roles';
import { repairSceneOpenings,repairSignature } from '../src/scene-repair';
import { EXTENSION_ID } from '../src/types';
import { draft } from './fixtures';

// Original, non-explicit fixture: the source narrator and human player differ.
function story(){const value=draft();value.cast.push({...value.cast[0],id:'mara',name:'Mara',aliases:['The cartographer']});value.roles={narration:'neutral',playerCharacterId:'mara',viewpointCharacterId:null,sourceViewpoint:'Iona tells the source story in first person.'};return value;}
function repaired(messages:GenerationMessage[]){const input=JSON.parse(messages[1].content);return {content:JSON.stringify({id:input.scene.id,greeting:'Iona waits by the boat. “I have a letter for you.”',direction:'Offer the letter if the human chooses to approach.',assumptions:[],roles:{playerCharacterId:input.roles.playerCharacterId,narration:input.roles.narration,viewpointCharacterId:input.roles.viewpointCharacterId}})};}

describe('fixed player and narrator roles',()=>{
  test('story excerpts accept preset actions while identity and viewpoint checks still apply',()=>{
    const value=story();value.openingStyle='story';value.scenes[0].greeting='You decide to open the letter. Mara says the map is accurate.';
    expect(roleIssues(value)).toEqual([]);expect(()=>requireRoleReview(value)).not.toThrow();expect(validateDraft(JSON.parse(JSON.stringify(value)))).toEqual(value);
    const card=cardPayload(value);expect(card.extensions[EXTENSION_ID].openingStyle).toBe('story');expect(card.system_prompt).toContain('During live chat after the stored scene opening');expect(card.system_prompt).toContain('they may contain preset source actions');
    value.scenes[0].greeting='You are Iona. I open the letter.';expect(roleIssues(value).map(issue=>issue.kind)).toEqual(['viewpoint','identity']);expect(()=>requireRoleReview(value)).toThrow();
    expect(()=>validateDraft({...value,openingStyle:'anything'})).toThrow('opening style');
  });
  test.each([
    'If you choose to approach, Iona holds out a letter.',
    'Unless you decide otherwise, the letter stays on the table.',
    'When you choose a route, Iona can explain the map.',
    'Once Mara chooses a route, Iona can explain the map.',
    'How do you feel about the letter?',
    'Do you want to examine the map?',
    "Iona asks, 'Do you think the map is accurate? I'll wait for your answer.'",
    'Iona says, “I have a letter.\nYou know where to find me.”',
  ])('does not treat an optional choice, question, or quoted line as asserted player agency: %s',opening=>{
    const value=story();value.scenes[0].greeting=opening;expect(roleIssues(value)).toEqual([]);
  });
  test.each([
    'If you choose to approach, you smile at Iona.',
    'How long has the letter been here? You decide to open it.',
    'When you stepped aboard, Iona raised her lantern.',
    'Iona asks, “What do you want?” Mara nods in agreement.',
    "You don't wait. You decide to leave.",
    'If the door opens, you walk inside.',
  ])('still catches asserted actions beside optional wording or dialogue: %s',opening=>{
    const value=story();value.scenes[0].greeting=opening;const issue=roleIssues(value).find(item=>item.kind==='agency')!;expect(issue).toBeDefined();expect(opening.slice(issue.start,issue.end)).toMatch(/you|Mara/i);expect(issue.excerpt).toContain(opening.slice(issue.start,issue.end));
  });
  test('binds aliases without treating source viewpoint as a player assignment',()=>{
    const value=story();expect(defaultRoles({...value,playerRole:'The cartographer'}).playerCharacterId).toBe('mara');
    expect(rolesForImport(value.cast,'Mara',{narrationMode:'character',narratorCharacter:'Captain Iona',sourceViewpoint:'Iona'})).toEqual({narration:'character',playerCharacterId:'mara',viewpointCharacterId:'iona',sourceViewpoint:'Iona'});
    expect(defaultRoles({...value,playerRole:'A new visitor'}).playerCharacterId).toBeNull();
    const duplicate=[...value.cast,{...value.cast[1],id:'another'}];expect(defaultRoles({cast:duplicate,playerRole:'Mara'}).playerCharacterId).toBeNull();
    expect(()=>rolesForImport(duplicate,'A visitor',{narrationMode:'character',narratorCharacter:'Mara'})).toThrow('exactly one');
  });
  test('supports legacy drafts without changing shape and validates new IDs on roundtrip',()=>{
    const legacy=draft();expect(validateDraft(legacy)).toEqual(legacy);expect('roles' in validateDraft(legacy)).toBe(false);
    const value=story();expect(validateDraft(JSON.parse(JSON.stringify(value)))).toEqual(value);
    expect(()=>validateDraft({...value,playerRole:'Iona'})).toThrow('different cast identity');
    for(const roles of [{...value.roles,playerCharacterId:'missing'},{...value.roles,narration:'character',viewpointCharacterId:'mara'},{...value.roles,viewpointCharacterId:'iona'},{...value.roles,narration:'character'},{...value.roles,sourceViewpoint:'{{setvar::role::changed}}'}])expect(()=>validateDraft({...value,roles})).toThrow();
  });
  test('flags drift and scripted actions but permits quoted supporting dialogue',()=>{
    const value=story();value.scenes[0].greeting='You are Iona. My map is missing. Mara says the journey is over. You decide to leave.';
    expect(new Set(roleIssues(value).map(issue=>issue.kind))).toEqual(new Set(['agency','viewpoint','identity']));
    value.scenes[0].greeting='Iona waits beside the boat. “I think you should come back tomorrow.” A letter rests nearby.';expect(roleIssues(value)).toEqual([]);
    value.roles!.narration='character';value.roles!.viewpointCharacterId='iona';value.scenes[0].greeting='I wait by the boat. “A letter for you,” I say.';
    expect(roleIssues(value)).toEqual([]);expect(roleInstruction(value)).toContain('first person as supporting character Iona');expect(roleInstruction(value)).toContain('you/your and {{user}} refer only');
  });
  test('finds conflicting directions in private guidance, cast voice, and lore',()=>{
    const value=story();value.scenes[1].direction='Use first-person narration as Iona.';value.cast[0].voice='Tell the story in first person.';value.lore[0].content='Narrate the journey in first person.';
    expect(roleIssues(value).map(issue=>issue.fieldKey)).toEqual(['scene:letter:direction','lore:greyhaven:content','cast:iona:voice']);
    value.roles!.narration='character';value.roles!.viewpointCharacterId='iona';value.narratorInstructions='Never use first-person narration.';
    expect(roleIssues(value).some(issue=>issue.fieldKey==='narratorInstructions')).toBe(true);
  });
  test('requires explicit review, survives whitespace normalization, and invalidates on relevant edits',()=>{
    const value=story();value.scenes[0].greeting='You decide to enter.';expect(()=>requireRoleReview(value)).toThrow();
    value.roles!.sourceViewpoint+='  ';value.roleReview=roleReviewFingerprint(value);expect(()=>requireRoleReview(validateDraft(value))).not.toThrow();
    value.lore[0].content='Use first person for narration.';expect(()=>requireRoleReview(value)).toThrow();
    value.roleReview=roleReviewFingerprint(value);value.roles!.playerCharacterId=null;expect(()=>requireRoleReview(value)).toThrow();
  });
  test('publishes the same role contract with ordered scenes and extension metadata',()=>{
    const value=story(),card=cardPayload(value),metadata=card.extensions[EXTENSION_ID];
    expect(metadata.roles).toEqual(value.roles!);expect(metadata.roleDirection).toBe(roleInstruction(value));expect(metadata.scenes).toEqual(value.scenes);
    expect(card.system_prompt).toContain(roleInstruction(value));expect(card.first_mes).toBe(value.scenes[0].greeting);expect(card.alternate_greetings).toEqual(value.scenes.slice(1).map(scene=>scene.greeting));
  });
});

describe('optional repair of completed scenes',()=>{
  test('story-excerpt repairs retain intentional scripted setup and request only identity/viewpoint changes',async()=>{
    const value=story();value.openingStyle='story';value.scenes[0].greeting='You decide to examine the map.';
    const result=await repairSceneOpenings(value,['harbor'],async messages=>{expect(messages[0].content).toContain('Retain its preset source actions');expect(messages[0].content).not.toContain('Remove scripted player speech');expect(messages[0].content).not.toContain('Replace asserted player verbs');const output=JSON.parse(repaired(messages).content);output.greeting=value.scenes[0].greeting;return {content:JSON.stringify(output)};},()=>{},undefined,2);
    expect(result.scenes[0].greeting).toBe(value.scenes[0].greeting);expect(roleIssues(result)).toEqual([]);
  });
  test('new repairs supply actual matched wording without adding an automatic semantic retry',async()=>{
    const value=story();value.scenes[0].greeting='You decide to leave.';let calls=0;
    await repairSceneOpenings(value,['harbor'],async messages=>{calls++;const body=JSON.parse(messages[1].content);expect(body.task).toBe('set-points-scene-repair-v2');expect(body.localChecks[0].excerpt).toContain('You decide');expect(messages[0].content).toContain('The letter rests within reach');return repaired(messages);},()=>{},undefined,2);
    expect(calls).toBe(1);
  });
  test('requests selected scenes, preserves paid draft material, and returns a separate candidate',async()=>{
    const value=story(),before=structuredClone(value),calls:GenerationMessage[][]=[];value.roleReview=roleReviewFingerprint(value);
    const result=await repairSceneOpenings(value,['letter'],async messages=>{calls.push(messages);return repaired(messages);},()=>{});
    expect(calls).toHaveLength(1);expect(JSON.parse(calls[0][1].content).task).toBe('set-points-scene-repair-v1');
    expect(result.cast).toEqual(before.cast);expect(result.lore).toEqual(before.lore);expect(result.source).toEqual(before.source);expect(result.scenes[0]).toEqual(before.scenes[0]);
    expect(result.scenes[1]).toMatchObject({id:'letter',title:before.scenes[1].title,assumptions:before.scenes[1].assumptions,sourceRefs:before.scenes[1].sourceRefs});
    expect(value.scenes).toEqual(before.scenes);expect(result.roleReview).toBeUndefined();expect(roleIssues(result)).toEqual([]);
  });
  test('rejects scene or role substitution after one format repair',async()=>{
    for(const change of [{id:'other'},{roles:{playerCharacterId:'iona',narration:'neutral',viewpointCharacterId:null}}]){
      let calls=0;await expect(repairSceneOpenings(story(),['harbor'],async messages=>{calls++;return {content:JSON.stringify({...JSON.parse(repaired(messages).content),...change})};},()=>{})).rejects.toThrow('role identities');expect(calls).toBe(2);
    }
  });
  test('leaves semantic concerns for review without buying another attempt automatically',async()=>{
    let calls=0;const result=await repairSceneOpenings(story(),['harbor'],async messages=>{calls++;return {content:JSON.stringify({...JSON.parse(repaired(messages).content),greeting:'You decide to leave. I wait beside the dock.'})};},()=>{});
    expect(calls).toBe(1);expect(roleIssues(result)).toHaveLength(2);expect(()=>requireRoleReview(result)).toThrow();
  });
  test('rejects invalid selection or cancellation before sending and ignores only review acknowledgment in request binding',async()=>{
    let calls=0;const generate=async(messages:GenerationMessage[])=>{calls++;return repaired(messages);};
    for(const ids of [[],['missing'],['harbor','harbor']])await expect(repairSceneOpenings(story(),ids,generate,()=>{})).rejects.toThrow('Select existing');
    const controller=new AbortController();controller.abort();await expect(repairSceneOpenings(story(),['harbor'],generate,()=>{},controller.signal)).rejects.toThrow();expect(calls).toBe(0);
    const value=story(),signature=repairSignature(value);value.roleReview=roleReviewFingerprint(value);expect(repairSignature(value)).toBe(signature);value.premise='Another premise.';expect(repairSignature(value)).not.toBe(signature);
  });
});
