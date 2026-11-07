/* eslint-disable no-new-func -- Execute trusted production modules with isolated native/network adapters. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const flush = async () => { for (let n=0;n<30;n++) await Promise.resolve(); };
function harness({self=true}={}) {
  let cursor=0,focusCallback; const slots=[],effects=[],calls=[],toasts=[],errors=[],navigation=[],appStates=new Set();
  const memo=(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n])))slots[i]={value:fn(),deps};return slots[i].value;};
  const react={
    useState(initial){const i=cursor++;slots[i]??={value:initial};return [slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;}];},
    useRef:initial=>memo(()=>({current:initial}),[]),useCallback:(fn,deps)=>memo(()=>fn,deps),
    useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n]))){slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}},
  };
  const server={fail:false,pending:null,aiConsent:false,draft:null,photoError:null,scanError:null,pickerCanceled:false,scanItems:null};
  const auth={token:'setup-account-a',profile:{id:1}},route={patientId:'1'};
  const useAuthStore=Object.assign(select=>select(auth),{getState:()=>auth});
  class PhotoError extends Error { constructor(code){super(code);this.code=code;} }
  class ApiError extends Error {}
  class NativeForm { constructor(){this.parts=[];} append(...args){this.parts.push(args);} }
  const data={self,items:[],schedules:[],conditions:[],flags:{scan:true},meals:{breakfast:'06:30',lunch:'11:30',dinner:'18:00',bedtime:'21:30'}};
  const t=key=>key;
  const deps={react,'react-native':{Platform:{OS:'ios'},AppState:{addEventListener:(_event,fn)=>{appStates.add(fn);return {remove:()=>appStates.delete(fn)};}},Alert:{alert:(...args)=>calls.push(['alert',...args])}},
    'expo-router':{useLocalSearchParams:()=>route,useFocusEffect:fn=>{focusCallback=fn;return react.useEffect(fn,[fn]);},useRouter:()=>({back:()=>navigation.push('back'),replace:path=>navigation.push(path)})},
    '../auth/auth.store':{useAuthStore},
    '../../hooks/useGuardedRouter':{useGuardedRouter:()=>({back:()=>navigation.push('back'),replace:path=>navigation.push(path)})},
    'expo-image-picker':{requestCameraPermissionsAsync:async()=>{if(server.permissionPending)await server.permissionPending;return {granted:true};},requestMediaLibraryPermissionsAsync:async()=>{if(server.permissionPending)await server.permissionPending;return {granted:true};},launchCameraAsync:async options=>{calls.push(['picker',options]);return {canceled:false,assets:[{uri:'fixture://medicine.jpg',mimeType:'image/jpeg'}]};},launchImageLibraryAsync:async options=>{calls.push(['library',options]);return server.pickerCanceled ? {canceled:true,assets:null} : {canceled:false,assets:[{uri:'ph://selected.heic',mimeType:'image/heic',base64:'/9j/export'}]};}},
    'expo-file-system':{File:class File {constructor(uri){this.uri=uri;this.name=uri.split('/').pop();this.type='audio/mp4';}async bytes(){return new Uint8Array([1,2,3]);}}},'expo-crypto':{randomUUID},'react-i18next':{useTranslation:()=>({t:server.unstableTranslations?(key=>key):t})},'../../lib/aiDataConsent':{hasAiDataConsent:async()=>server.aiConsent},'../../lib/audio':{Audio:{requestPermissionsAsync:async()=>({granted:true}),setAudioModeAsync:async()=>{},RecordingOptionsPresets:{HIGH_QUALITY:{}},Recording:{createAsync:async()=>({recording:{stopAndUnloadAsync:async()=>{},getURI:()=> 'file:///fixture/name.m4a'}})}}},
    '../../lib/apiClient':{ApiError},'../../observability/sentry':{reportError:(e,context)=>calls.push(['diagnostic',context.operation,e.name])},
    './medication-photo':{MedicationPhotoError:PhotoError,prepareMedicationPhoto:async()=>{if(server.photoError)throw new PhotoError(server.photoError);return {body:{photo:true},dispose:()=>calls.push(['dispose'])};}},
    './useMedicationPurposeLookup':{useMedicationPurposeLookup:()=>({pending:false,retry:()=>{}})},
    '../../stores/toast.store':{useToastStore:{getState:()=>({show:(...args)=>toasts.push(args)})}},'./V21Layout':{v21Error:error=>errors.push(error)},
    './v21.api':{v21Api:{transcribe:async(id,body)=>{calls.push(['transcribe',id,body]);return {text:'Tên đã đọc'};},overview:async()=>{server.overviewReads=(server.overviewReads||0)+1;return {...data,draft:server.draft,drafts:server.drafts};},writeDraft:async(id,body)=>{calls.push(['draft',id,body]);if(server.draftPending)await server.draftPending;if(server.draftFail)throw Error('draft offline');server.validateDraft?.(body);return {id:body.id,revision:body.revision+1};},removeDraft:async(...args)=>{calls.push(['removeDraft',...args]);server.draft=null;},scan:async()=>{calls.push(['scan']);if(server.scanPending)await server.scanPending;if(server.scanError)throw server.scanError;return {readable:true,mediaId:'photo-1',items:server.scanItems||[{display_name:'Tên đọc từ ảnh',kind:'MEDICINE',suggested_slots:[]}]};},setup:async(id,body)=>{calls.push(['setup',id,body]);if(server.pending)await server.pending;if(server.setupError)throw server.setupError;if(server.fail)throw Error('offline');return {pendingConsent:!self};}}},
  };
  deps['../../lib/env']={env:{apiBaseUrl:'https://local.test'}};
  const purposeModule={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync('src/features/v21/useMedicationPurposeLookup.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(purposeModule,purposeModule.exports,k=>deps[k]);
  deps['./useMedicationPurposeLookup'].validatedMedicationPurposeResult=purposeModule.exports.validatedMedicationPurposeResult;
  const draftModule={exports:{}};new Function('module','exports','require',ts.transpileModule(fs.readFileSync('src/features/v21/medication-draft-session.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(draftModule,draftModule.exports,k=>deps[k]);deps['./medication-draft-session']=draftModule.exports;
  const module={exports:{}};
  const inputs={exports:{}};
  new Function('module','exports',ts.transpileModule(fs.readFileSync('src/features/v21/medication-input.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(inputs,inputs.exports);
  deps['./medication-input']=inputs.exports;
  const source=ts.transpileModule(fs.readFileSync('src/features/v21/useMedicationSetup.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  // Execute the production setup controller with isolated network/native adapters.
  // eslint-disable-next-line no-new-func
  new Function('module','exports','require','FormData',source)(module,module.exports,key=>{assert.ok(key in deps,key);return deps[key];},NativeForm);
  const read=()=>{cursor=0;return module.exports.useMedicationSetup();};
  const settle=async()=>{read();effects.splice(0).forEach(fn=>fn());await flush();return read();};
  const toReview=async()=>{if(!read().slots.length)read().toggleTime('07:00','after_breakfast');read().next();read().addManual();read().update(0,{display_name:'Tên đã kiểm tra',confirmed:true});read().next();await flush();return read();};
  return {read,settle,toReview,data,calls,toasts,errors,server,navigation,auth,route,refocus:()=>focusCallback(),background:()=>appStates.forEach(fn=>fn('background')),makeApiError:code=>Object.assign(new ApiError('fixture'),{code}),blur:()=>slots.forEach(x=>x?.cleanup?.())};
}
let count=0;async function test(name,fn){await fn();count++;console.log('PASS '+name);}
(async()=>{
  await test('new setup requires an explicit time before adding medicines and never creates a default reminder',async()=>{
    const h=harness();await h.settle();assert.equal(h.calls.length,0);assert.equal(h.read().step,1);assert.equal(h.read().canContinue,false);
    h.read().next();assert.equal(h.read().step,1);assert.deepEqual(h.read().slots,[]);
    h.read().toggleTime('07:00','after_breakfast');assert.equal(h.read().canContinue,true);h.read().next();assert.equal(h.read().step,2);
    h.read().addManual();assert.equal(h.read().step,3);assert.equal(h.read().canContinue,false);
    h.read().update(0,{display_name:'Tên trên hộp',confirmed:true});assert.equal(h.read().canContinue,true);
    h.read().update(0,{display_name:'Thuốc 500 mg',confirmed:true});assert.equal(h.read().canContinue,false);h.blur();
  });
  await test('two medicines in one chosen group share one reminder and one medicine can belong to multiple groups',async()=>{
    const h=harness();await h.settle();h.read().toggleTime('07:00');h.read().toggleTime('19:00');h.read().next();h.read().addManual();
    h.read().update(0,{display_name:'Thuốc A',confirmed:true});h.read().addItem('Thuốc B');h.read().update(1,{confirmed:true});
    assert.equal(h.read().canContinue,false);h.read().assignItem(0,0);h.read().assignItem(0,1);h.read().assignItem(1,0);
    assert.equal(h.read().canContinue,true);h.read().next();assert.equal(h.read().step,4);h.read().next();await flush();
    const body=h.calls.find(row=>row[0]==='setup')[2];assert.equal(body.merge_existing,true);
    assert.deepEqual(body.slots.map(row=>row.item_indexes),[[0,1],[0]]);h.blur();
  });
  await test('existing active groups count toward the cap but selecting the same time never counts twice',async()=>{
    const h=harness();h.data.schedules=['07:00','11:00','15:00','19:00'].map(time_local=>({time_local,active:true,consent_state:'ACTIVE'}));await h.settle();
    h.read().toggleTime('07:00');assert.equal(h.read().selectedTimeCount,4);assert.equal(h.read().canContinue,true);
    h.read().toggleTime('21:00');assert.equal(h.read().timingLimitExceeded,true);assert.equal(h.read().canContinue,false);
    h.read().toggleTime('21:00');assert.equal(h.read().canContinue,true);h.blur();
  });
  await test('reusing a saved medicine sends only its identifier and cannot duplicate or rename it',async()=>{
    const h=harness();h.data.items=[{id:'saved-item',display_name:'Thuốc đã lưu',kind:'MEDICINE',source:'CHIP'}];await h.settle();
    h.read().toggleTime('07:30');h.read().next();h.read().selectExisting('saved-item');h.read().selectExisting('saved-item');
    assert.equal(h.read().draft.length,1);h.read().next();h.read().update(0,{display_name:'Đổi tên'});assert.equal(h.read().draft[0].display_name,'Thuốc đã lưu');
    h.read().next();h.read().next();await flush();assert.deepEqual(h.calls.find(row=>row[0]==='setup')[2].items,[{id:'saved-item'}]);h.blur();
  });
  await test('removing one medicine remaps every group without changing other assignments',async()=>{
    const h=harness();await h.settle();h.read().toggleTime('07:00');h.read().next();h.read().addManual();h.read().addItem('A');h.read().addItem('B');
    assert.deepEqual(h.read().slots[0].item_indexes,[0,1]);h.read().removeItem(0);assert.deepEqual(h.read().slots[0].item_indexes,[0]);assert.equal(h.read().draft[0].display_name,'B');h.blur();
  });
  await test('routine time hints remain editable and never create a schedule by themselves',async()=>{
    const h=harness();await h.settle();assert.deepEqual(h.read().anchorTimes,{before_breakfast:'06:00',after_breakfast:'07:00',after_lunch:'12:00',after_dinner:'18:30',bedtime:'21:30'});
    assert.deepEqual(h.read().slots,[]);h.read().setMeals(old=>({...old,breakfast:'29:00'}));assert.equal(h.read().anchorTimes,null);assert.equal(h.read().canContinue,false);h.blur();
  });
  await test('saving for a relative uses the existing consent path and sends confirmed items without UI-only anchors',async()=>{
    const h=harness({self:false});await h.settle();await h.toReview();h.read().next();await flush();
    const body=h.calls.find(x=>x[0]==='setup')[2];assert.equal(body.items[0].confirmed,true);assert.equal('anchors' in body.items[0],false);assert.equal(h.toasts.at(-1)[0],'consentSent');assert.deepEqual(h.navigation,['/medication']);
  });
  await test('retry reuses the request ID; a changed review gets a new ID',async()=>{
    const h=harness();await h.settle();await h.toReview();h.server.fail=true;h.read().next();await flush();h.read().next();await flush();
    const posts=()=>h.calls.filter(x=>x[0]==='setup');assert.equal(posts()[0][2].request_id,posts()[1][2].request_id);
    h.read().setSlots(old=>old.map(x=>({...x,time_local:'08:00'})));h.read().next();await flush();assert.notEqual(posts()[1][2].request_id,posts()[2][2].request_id);assert.equal(h.read().busy,false);
  });
  await test('only confirmed selected purpose tags reach setup; lookup UI state never reaches the API', async()=>{
    const h=harness();await h.settle();await h.toReview();
    h.read().update(0,{purposeLookup:{key:'fixture',loading:false,result:{status:'matched',token:'verified-token',tags:['fever_reduction','pain_relief']}},selectedPurposeCodes:['pain_relief'],confirmed:true});
    h.read().next();await flush();const sent=h.calls.find(x=>x[0]==='setup')[2].items[0];
    assert.deepEqual(sent.tag_confirmation,{token:'verified-token',codes:['pain_relief']});
    assert.equal(sent.purposeLookup,undefined);assert.equal(sent.selectedPurposeCodes,undefined);
  });
  await test('an expired purpose confirmation returns to review instead of losing the schedule', async()=>{
    const h=harness();await h.settle();await h.toReview();h.server.setupError=h.makeApiError('MED_TAG_CONFIRMATION_EXPIRED');
    h.read().next();await flush();assert.equal(h.read().step,3);assert.equal(h.read().draft.length,1);assert.equal(h.read().busy,false);
  });
  await test('rapid final presses send only one pending save',async()=>{
    const h=harness();await h.settle();await h.toReview();let release;h.server.pending=new Promise(r=>{release=r;});const old=h.read();old.next();old.next();await flush();assert.equal(h.calls.filter(x=>x[0]==='setup').length,1);release();await flush();
  });
  await test('photo reading waits for AI consent; extracted names still need confirmation',async()=>{
    const h=harness();await h.settle();await h.read().pick(true);assert.equal(h.read().consent,true);assert.ok(!h.calls.some(x=>x[0]==='scan'));h.read().agreeAi();await flush();assert.equal(h.read().step,3);assert.equal(h.read().draft[0].confirmed,false);assert.equal(h.read().canContinue,false);assert.equal(h.calls.find(x=>x[0]==='picker')[1].base64,true);assert.equal(h.calls.filter(x=>x[0]==='dispose').length,1);
  });
  await test('an unreadable local image never calls scan and reports an actionable photo error',async()=>{
    const h=harness();await h.settle();h.server.aiConsent=true;h.server.photoError='MED_LOCAL_PHOTO_UNREADABLE';await h.read().pick(true);
    assert.ok(!h.calls.some(x=>x[0]==='scan'));assert.equal(h.toasts.at(-1)[0],'medicationPhotoReadError');assert.equal(h.read().busy,false);assert.ok(h.calls.some(x=>x[0]==='diagnostic'&&x[1]==='photo_prepare'));
  });
  await test('native photo preparation owns the cache file, matches MIME to bytes and removes it after upload',async()=>{
    const files=[];class File{constructor(_root,name){this.uri='file:///cache/'+name;this.name=name;this.type=name.endsWith('.png')?'image/png':'image/jpeg';this.exists=false;this.size=0;files.push(this);}write(value,options){this.value=value;this.options=options;this.exists=true;this.size=24;}delete(){this.exists=false;}}
    class Form{constructor(){this.parts=[];}append(...args){this.parts.push(args);}}
    const module={exports:{}};const source=ts.transpileModule(fs.readFileSync('src/features/v21/medication-photo.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    const deps={'react-native':{Platform:{OS:'ios'}},'expo-file-system':{File,Paths:{cache:'file:///cache/'}},'expo-crypto':{randomUUID}};
    // Execute production file preparation with an isolated sandboxed-file adapter.
    // eslint-disable-next-line no-new-func
    new Function('module','exports','require','FormData',source)(module,module.exports,key=>deps[key],Form);
    const upload=await module.exports.prepareMedicationPhoto({uri:'ph://temporary',mimeType:'image/heic',base64:'/9j/fixture'});
    assert.equal(files[0].exists,true);assert.deepEqual(files[0].options,{encoding:'base64'});assert.equal(upload.body.parts[0][1].type,'image/jpeg');assert.equal(upload.body.parts[0][1].uri,files[0].uri);upload.dispose();assert.equal(files[0].exists,false);
    await assert.rejects(()=>module.exports.prepareMedicationPhoto({uri:'ph://missing'}),{code:'MED_LOCAL_PHOTO_UNREADABLE'});
    const png=await module.exports.prepareMedicationPhoto({uri:'ph://png',base64:'iVBORw0KGgoAAA'});assert.equal(png.body.parts[0][1].type,'image/png');png.dispose();
  });
  await test('selecting an existing library photo requests a JPEG export and reaches name confirmation',async()=>{
    const h=harness();await h.settle();h.server.aiConsent=true;await h.read().pick(false);
    assert.equal(h.calls.find(x=>x[0]==='library')[1].base64,true);assert.equal(h.calls.filter(x=>x[0]==='scan').length,1);
    assert.equal(h.read().step,3);assert.equal(h.read().draft[0].confirmed,false);assert.equal(h.calls.filter(x=>x[0]==='dispose').length,1);
  });
  await test('canceling the library picker does not upload or show an error',async()=>{
    const h=harness();await h.settle();h.server.pickerCanceled=true;await h.read().pick(false);
    assert.equal(h.calls.filter(x=>x[0]==='scan').length,0);assert.equal(h.errors.length,0);assert.equal(h.toasts.length,0);
  });
  await test('a failed library upload cleans up its temporary file and resets loading',async()=>{
    const h=harness();await h.settle();h.server.aiConsent=true;h.server.scanError=new Error('upload failed');await h.read().pick(false);
    assert.equal(h.calls.filter(x=>x[0]==='dispose').length,1);assert.equal(h.read().busy,false);assert.equal(h.read().step,1);
    assert.equal(h.errors.at(-1),h.server.scanError);assert.ok(h.calls.some(x=>x[0]==='diagnostic'&&x[1]==='photo_upload'));
  });
  await test('reading a medicine name uploads a File compatible with Expo 57 and still requires name confirmation',async()=>{
    const h=harness();await h.settle();h.server.aiConsent=true;h.read().voice();await flush();assert.equal(h.read().listening,true);h.read().voice();await flush();
    const form=h.calls.find(x=>x[0]==='transcribe')[2];assert.equal(form.parts[0][0],'audio');const file=form.parts[0][1];assert.equal(file.name,'name.m4a');assert.equal(typeof file.bytes,'function');
    assert.equal(h.read().step,3);assert.equal(h.read().draft[0].display_name,'Tên đã đọc');assert.equal(h.read().draft[0].confirmed,false);assert.equal(h.read().busy,false);
  });
  await test('recognition appends names, keeps selected times and never replaces earlier medicines',async()=>{
    const h=harness();await h.settle();h.read().toggleTime('07:00');h.read().next();h.read().addManual();h.read().update(0,{display_name:'Thuốc cũ',confirmed:true});
    h.server.aiConsent=true;h.server.scanItems=[{display_name:'Tên đã đọc',printed_name:'Tên in trên hộp',kind:'MEDICINE',suggested_slots:['morning','evening']}];await h.read().pick(false);
    assert.equal(h.read().draft.length,2);assert.equal(h.read().draft[0].display_name,'Thuốc cũ');assert.deepEqual(h.read().draft[1].timeHints,['morning','evening']);
    assert.deepEqual(h.read().slots[0].item_indexes,[0,1]);assert.equal(h.read().slots[0].time_local,'07:00');assert.equal(h.read().canContinue,false);
    h.read().update(1,{confirmed:true});h.read().next();h.read().setSlots(old=>old.map(slot=>({...slot,note:'Sau ăn'})));h.read().next();await flush();
    const sent=h.calls.find(x=>x[0]==='setup')[2];assert.equal(sent.slots[0].note,'Sau ăn');assert.equal(sent.items[1].printed_name,'Tên in trên hộp');assert.equal(sent.items[1].timeHints,undefined);assert.equal(sent.items[1].anchors,undefined);h.blur();
  });
  await test('review notes survive going back and cannot contain dosage or exceed 60 characters',async()=>{
    const h=harness();await h.settle();await h.toReview();
    h.read().setSlots(old=>old.map(s=>({...s,time_local:'08:15',note:'Sau bữa ăn'})));h.read().leave();h.read().next();
    assert.equal(h.read().slots[0].note,'Sau bữa ăn');assert.equal(h.read().slots[0].time_local,'08:15');
    for(const note of ['a'.repeat(61),'2 viên','10 mg']){
      h.read().setSlots(old=>old.map(s=>({...s,note})));assert.equal(h.read().canContinue,false);h.read().next();await flush();
    }
    assert.equal(h.calls.filter(x=>x[0]==='setup').length,0);
  });
  await test('manual cholesterol chips only use declared conditions and retain the no-condition fallback',async()=>{
    const module={exports:{}};new Function('module','exports',ts.transpileModule(fs.readFileSync('src/features/v21/medication-input.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(module,module.exports);
    assert.deepEqual(module.exports.medicationQuickNames([]),['medicine_generic','supplement','medicine_other']);
    for(const condition of ['Mỡ máu cao','dyslipidemia','high_cholesterol']) assert.ok(module.exports.medicationQuickNames([condition]).includes('medicine_lipids'));
    assert.ok(!module.exports.medicationQuickNames(['hypertension']).includes('medicine_lipids'));
  });
  await test('a manual quick choice fills the initial empty item without typing or leaving a hidden required blank',async()=>{
    const h=harness();await h.settle();h.read().toggleTime('07:00');h.read().addManual();h.read().addItem('Thuốc mỡ máu');
    assert.equal(h.read().draft.length,1);assert.equal(h.read().draft[0].display_name,'Thuốc mỡ máu');assert.equal(h.read().canContinue,false);
    h.read().update(0,{confirmed:true});assert.equal(h.read().canContinue,true);h.read().next();assert.equal(h.read().step,4);
  });
  await test('old setup handlers cannot submit after an account change',async()=>{
    const h=harness();await h.settle();await h.toReview();const old=h.read();h.auth.token='account-b';h.auth.profile.id=2;old.next();await flush();
    assert.equal(h.calls.filter(x=>x[0]==='setup').length,0);h.blur();
  });
  await test('an accepted response from the previous account cannot navigate or display a success toast',async()=>{
    const h=harness();await h.settle();await h.toReview();let finish;h.server.pending=new Promise(r=>finish=r);h.read().next();await flush();
    h.auth.token='account-b';h.auth.profile.id=2;finish();await flush();assert.equal(h.navigation.length,0);assert.equal(h.toasts.length,0);h.blur();
  });
  await test('a previous save completing cannot release the new account save lock',async()=>{
    const h=harness();await h.settle();await h.toReview();let oldDone,newDone;h.server.pending=new Promise(r=>oldDone=r);h.read().next();await flush();
    h.auth.token='account-b';h.auth.profile.id=2;await h.settle();assert.equal(h.read().draft.length,0);await h.toReview();
    h.server.pending=new Promise(r=>newDone=r);h.read().next();await flush();oldDone();await flush();
    assert.equal(h.read().busy,true);assert.equal(h.navigation.length,0);h.read().next();await flush();assert.equal(h.calls.filter(x=>x[0]==='setup').length,2);
    newDone();await flush();assert.equal(h.navigation.length,1);h.blur();
  });
  await test('a pending native photo permission cannot upload after leaving the screen',async()=>{
    const h=harness();await h.settle();h.server.aiConsent=true;let finish;h.server.permissionPending=new Promise(r=>finish=r);
    const pending=h.read().pick(false);await flush();h.blur();finish();await pending;assert.equal(h.calls.filter(x=>x[0]==='scan').length,0);
  });
  await test('an OCR response for the previous patient is discarded and its temporary file is cleaned',async()=>{
    const h=harness();await h.settle();h.server.aiConsent=true;let finish;h.server.scanPending=new Promise(r=>finish=r);
    const pending=h.read().pick(false);await flush();h.route.patientId='2';await h.settle();finish();await pending;
    assert.equal(h.read().draft.length,0);assert.equal(h.read().photo,null);assert.equal(h.calls.filter(x=>x[0]==='dispose').length,1);h.blur();
  });
  await test('merging edited times keeps both notes, deduplicates item membership and omits UI fields',async()=>{
    const h=harness();await h.settle();await h.toReview();h.read().setSlots(old=>[old[0],{...old[0],time_local:'19:00',note:'Buổi tối'}]);
    h.read().setSlots(old=>old.map(slot=>({...slot,time_local:'07:00',sourceKeys:['ui-only']})));h.read().next();await flush();
    const sent=h.calls.find(x=>x[0]==='setup')[2];assert.equal(sent.slots.length,1);assert.deepEqual(sent.slots[0].item_indexes,[0]);assert.equal(sent.slots[0].sourceKeys,undefined);assert.equal(sent.items[0].clientId,undefined);h.blur();
  });
  await test('removing the token hides the previous draft immediately even if the profile is not cleared yet',async()=>{
    const h=harness();await h.settle();await h.toReview();h.auth.token=null;
    assert.equal(h.read().data,null);assert.deepEqual(h.read().draft,[]);assert.equal(h.read().canContinue,false);h.blur();
  });
  await test('the centered scan overlay follows the actual pending photo request and closes on success',async()=>{
    const h=harness();await h.settle();h.server.aiConsent=true;let release;
    h.server.scanPending=new Promise(r=>{release=r;});
    const pending=h.read().pick(false);await flush();
    assert.equal(h.read().scanning,true);assert.equal(h.read().canContinue,false);
    release();await pending;assert.equal(h.read().scanning,false);assert.equal(h.read().step,3);
    assert.equal(h.read().draft[0].confirmed,false);h.blur();
  });
  await test('scan overlay never claims success for failed or unreadable photos and does not show for consent or voice',async()=>{
    const consent=harness();await consent.settle();await consent.read().pick(false);
    assert.equal(consent.read().consent,true);assert.equal(consent.read().scanning,false);consent.blur();
    for(const outcome of ['error','unreadable']){
      const h=harness();await h.settle();h.server.aiConsent=true;
      if(outcome==='error')h.server.scanError=new Error('offline');else h.server.scanItems=[];
      await h.read().pick(false);assert.equal(h.read().scanning,false);assert.equal(h.read().step,1);h.blur();
    }
    const voice=harness();await voice.settle();voice.server.aiConsent=true;voice.read().voice();await flush();
    assert.equal(voice.read().listening,true);assert.equal(voice.read().scanning,false);voice.blur();
  });
  await test('an old scan cannot keep the overlay open across accounts or close a new account scan',async()=>{
    const h=harness();await h.settle();h.server.aiConsent=true;let releaseOld,releaseNew;
    h.server.scanPending=new Promise(r=>{releaseOld=r;});const old=h.read().pick(false);await flush();
    assert.equal(h.read().scanning,true);h.auth.token='setup-account-b';h.auth.profile.id=2;h.route.patientId='2';
    assert.equal(h.read().scanning,false);await h.settle();
    h.server.scanPending=new Promise(r=>{releaseNew=r;});const next=h.read().pick(false);await flush();
    assert.equal(h.read().scanning,true);releaseOld();await old;assert.equal(h.read().scanning,true);
    h.blur();assert.equal(h.read().scanning,false);releaseNew();await next;assert.equal(h.read().scanning,false);
  });
  const savedDraft=(overrides={})=>({id:randomUUID(),revision:3,updatedAt:new Date().toISOString(),photos:{'photo-1':'/api/mobile/med-media/photo-1?token=signed'},snapshot:{version:1,step:4,items:[{clientId:randomUUID(),display_name:'Tên đã đọc trước',printed_name:'Tên in trên hộp',kind:'MEDICINE',source:'PHOTO_AI',confirmed:true,anchors:['after_breakfast'],photo_media_id:'photo-1'}],meals:{breakfast:'07:00',lunch:'11:30',dinner:'18:00',bedtime:'21:30'},slots:[{time_local:'07:30',meal_anchor:'after_breakfast',item_indexes:[0],note:'Sau ăn'}],photoMediaId:'photo-1',...overrides}});
  await test('restoring a saved photo draft keeps names, image, meals, notes and wizard step without scanning again',async()=>{
    const h=harness();h.server.draft=savedDraft();await h.settle();
    assert.equal(h.read().step,4);assert.equal(h.read().draft[0].display_name,'Tên đã đọc trước');assert.match(h.read().draft[0].photo_uri,/^https:\/\/local.test\/api\/mobile\/med-media\//);
    assert.equal(h.read().slots[0].note,'Sau ăn');assert.equal(h.read().meals.breakfast,'07:00');assert.equal(h.calls.some(x=>x[0]==='scan'),false);h.blur();
  });
  await test('leaving explicitly flushes edited draft before navigation and never uploads the photo again',async()=>{
    const h=harness();h.server.draft=savedDraft();await h.settle();h.read().update(0,{display_name:'Tên vừa chỉnh'});
    await h.read().exitDraft();const sent=h.calls.find(x=>x[0]==='draft')[2];assert.equal(sent.snapshot.items[0].display_name,'Tên vừa chỉnh');assert.equal(sent.snapshot.items[0].photo_uri,undefined);
    assert.equal(h.calls.some(x=>x[0]==='scan'),false);assert.deepEqual(h.navigation,['back']);h.blur();
  });
  await test('a failed draft flush retains the editor and blocks a false saved exit, then can be retried',async()=>{
    const h=harness();h.server.draft=savedDraft();await h.settle();h.read().update(0,{display_name:'Tên cần giữ'});h.server.draftFail=true;
    await h.read().exitDraft();assert.deepEqual(h.navigation,[]);assert.equal(h.read().draftStatus,'error');assert.equal(h.read().draft[0].display_name,'Tên cần giữ');
    h.server.draftFail=false;await h.read().exitDraft();assert.deepEqual(h.navigation,['back']);h.blur();
  });
  await test('a retry saves the current edit without leaving the screen or repeating recognition',async()=>{
    const h=harness();h.server.draft=savedDraft();await h.settle();h.read().update(0,{display_name:'Hapacol 650'});h.server.draftFail=true;
    await h.read().retryDraft();assert.equal(h.read().draftStatus,'error');assert.deepEqual(h.navigation,[]);
    h.server.draftFail=false;await h.read().retryDraft();assert.equal(h.read().draftStatus,'saved');assert.deepEqual(h.navigation,[]);
    assert.equal(h.calls.some(x=>x[0]==='scan'),false);h.blur();
  });
  await test('old lookup HTTP metadata in memory cannot prevent the current draft from saving',async()=>{
    const h=harness();h.server.draft=savedDraft();await h.settle();
    h.read().update(0,{purposeLookup:{key:'MEDICINE:hapacol 650',loading:false,result:{ok:true,status:'matched',tags:['pain_relief'],productName:'Hapacol 650',token:'verified-token',source:{name:'DHG',url:'https://dhgpharma.com.vn',ok:true}}}});
    await h.read().retryDraft();const result=h.calls.find(x=>x[0]==='draft')[2].snapshot.items[0].purposeLookup.result;
    assert.equal(result.ok,undefined);assert.equal(result.source.ok,undefined);assert.equal(result.token,'verified-token');assert.equal(h.read().draftStatus,'saved');h.blur();
  });
  await test('discarding a restored draft requires confirmation and clears it without deleting saved schedules',async()=>{
    const h=harness();h.server.draft=savedDraft();await h.settle();h.read().discardDraft();assert.ok(!h.calls.some(x=>x[0]==='removeDraft'));
    await h.calls.find(x=>x[0]==='alert')[3][1].onPress();assert.equal(h.calls.filter(x=>x[0]==='removeDraft').length,1);assert.equal(h.read().step,1);assert.deepEqual(h.read().draft,[]);h.blur();
  });
  await test('an account switch during a pending draft flush cannot submit the old setup under the new account',async()=>{
    const h=harness();await h.settle();await h.toReview();let release;h.server.draftPending=new Promise(r=>{release=r;});h.read().next();await flush();
    assert.equal(h.calls.some(x=>x[0]==='draft'),true);h.auth.token='new-owner';h.auth.profile.id=2;h.route.patientId='2';await h.settle();release();await flush();
    assert.equal(h.calls.some(x=>x[0]==='setup'),false);h.blur();
  });
  await test('backgrounding the app flushes the latest edit before the autosave debounce',async()=>{
    const h=harness();h.server.draft=savedDraft();await h.settle();h.read().update(0,{display_name:'Tên cần giữ khi đóng app'});await h.settle();h.background();await flush();
    assert.equal(h.calls.filter(x=>x[0]==='draft').at(-1)[2].snapshot.items[0].display_name,'Tên cần giữ khi đóng app');h.blur();
  });
  await test('creating a new plan starts empty and never deletes or resumes another unfinished draft',async()=>{
    const h=harness();h.server.draft=savedDraft();h.server.drafts=[h.server.draft];h.route.newPlan='1';await h.settle();
    assert.equal(h.read().step,1);assert.deepEqual(h.read().draft,[]);h.read().addManual();h.read().update(0,{display_name:'Đơn mới'});
    await h.read().retryDraft();const sent=h.calls.find(x=>x[0]==='draft')[2];assert.notEqual(sent.id,h.server.draft.id);
    assert.equal(h.server.draft.snapshot.items[0].display_name,'Tên đã đọc trước');assert.equal(h.calls.some(x=>x[0]==='removeDraft'),false);h.blur();
  });
  await test('opening a chosen older draft resumes its own names and revision instead of the newest draft',async()=>{
    const h=harness(),old=savedDraft(),latest=savedDraft();old.snapshot.items[0].display_name='Đơn trước';
    h.server.draft=latest;h.server.drafts=[latest,old];h.route.draftId=old.id;await h.settle();assert.equal(h.read().draft[0].display_name,'Đơn trước');
    h.read().update(0,{display_name:'Đơn trước đã sửa'});await h.read().retryDraft();assert.equal(h.calls.find(x=>x[0]==='draft')[2].id,old.id);h.blur();
  });
  await test('a selected draft always opens its editable names and types even when saved at another step',async()=>{
    for(const step of [1,2,3,4]){
      const h=harness(),saved=savedDraft({step});h.server.draft=saved;h.route.draftId=saved.id;await h.settle();
      assert.equal(h.read().step,3);assert.equal(h.read().draft[0].display_name,'Tên đã đọc trước');assert.equal(h.read().draft[0].kind,'MEDICINE');
      assert.equal(h.calls.some(x=>x[0]==='scan'||x[0]==='setup'),false);h.blur();
    }
  });
  await test('a legacy draft at the photo step cannot hide already entered medicine fields',async()=>{
    const h=harness();h.server.draft=savedDraft({step:1});await h.settle();assert.equal(h.read().step,3);assert.equal(h.read().draft.length,1);h.blur();
  });
  await test('reviewing names and types preserves previously edited reminder times and notes',async()=>{
    const h=harness(),saved=savedDraft();saved.snapshot.slots[0].time_local='08:15';h.server.draft=saved;h.route.draftId=saved.id;await h.settle();
    h.read().update(0,{display_name:'Tên đã sửa'});h.read().update(0,{confirmed:true});h.read().next();
    assert.equal(h.read().step,4);assert.equal(h.read().slots[0].time_local,'08:15');assert.equal(h.read().slots[0].note,'Sau ăn');h.blur();
  });
  await test('discarding one draft resets to an independent blank editor without loading another draft',async()=>{
    const h=harness(),old=savedDraft(),other=savedDraft();h.server.drafts=[old,other];h.route.draftId=old.id;await h.settle();
    h.read().discardDraft();await h.calls.find(x=>x[0]==='alert')[3][1].onPress();
    assert.deepEqual(h.read().draft,[]);assert.equal(h.read().step,1);assert.equal(h.server.overviewReads,1);
    h.read().addManual();h.read().update(0,{display_name:'Đơn riêng mới'});await h.read().retryDraft();assert.notEqual(h.calls.find(x=>x[0]==='draft')[2].id,old.id);
    assert.equal(h.calls.filter(x=>x[0]==='removeDraft').length,1);h.blur();
  });
  await test('translation function changes and ordinary edits cannot repeatedly fetch the setup page',async()=>{
    const h=harness();h.server.unstableTranslations=true;await h.settle();h.read().addManual();
    for(let n=0;n<12;n++){h.read().update(0,{display_name:'Tên '+n});await h.settle();}
    assert.equal(h.server.overviewReads,1);assert.equal(h.read().loading,false);h.blur();
  });
  await test('refocusing setup keeps entered names visible during a background refresh',async()=>{
    const h=harness();await h.settle();h.read().addManual();h.read().update(0,{display_name:'Tên cần giữ'});h.blur();h.refocus();
    assert.equal(h.read().loading,false);assert.equal(h.read().draft[0].display_name,'Tên cần giữ');await h.settle();
    assert.equal(h.read().draft[0].display_name,'Tên cần giữ');h.blur();
  });
  console.log(`Medication setup: ${count} runtime checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
