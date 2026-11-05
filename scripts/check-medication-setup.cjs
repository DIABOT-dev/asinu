const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const flush = async () => { for (let n=0;n<30;n++) await Promise.resolve(); };
function harness({self=true}={}) {
  let cursor=0; const slots=[],effects=[],calls=[],toasts=[],errors=[],navigation=[];
  const memo=(fn,deps)=>{const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n])))slots[i]={value:fn(),deps};return slots[i].value;};
  const react={
    useState(initial){const i=cursor++;slots[i]??={value:initial};return [slots[i].value,v=>{slots[i].value=typeof v==='function'?v(slots[i].value):v;}];},
    useRef:initial=>memo(()=>({current:initial}),[]),useCallback:(fn,deps)=>memo(()=>fn,deps),
    useEffect(fn,deps){const i=cursor++,old=slots[i];if(!old||deps.some((v,n)=>!Object.is(v,old.deps[n]))){slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}},
  };
  const server={fail:false,pending:null,aiConsent:false,photoError:null,scanError:null,pickerCanceled:false,scanItems:null};
  const auth={token:'setup-account-a',profile:{id:1}},route={patientId:'1'};
  const useAuthStore=Object.assign(select=>select(auth),{getState:()=>auth});
  class PhotoError extends Error { constructor(code){super(code);this.code=code;} }
  class ApiError extends Error {}
  class NativeForm { constructor(){this.parts=[];} append(...args){this.parts.push(args);} }
  const data={self,conditions:[],flags:{scan:true},meals:{breakfast:'06:30',lunch:'11:30',dinner:'18:00',bedtime:'21:30'}};
  const t=key=>key;
  const deps={react,'react-native':{Platform:{OS:'ios'},Alert:{alert:(...args)=>calls.push(['alert',...args])}},
    'expo-router':{useLocalSearchParams:()=>route,useFocusEffect:fn=>react.useEffect(fn,[fn]),useRouter:()=>({back:()=>navigation.push('back'),replace:path=>navigation.push(path)})},
    '../auth/auth.store':{useAuthStore},
    '../../hooks/useGuardedRouter':{useGuardedRouter:()=>({back:()=>navigation.push('back'),replace:path=>navigation.push(path)})},
    'expo-image-picker':{requestCameraPermissionsAsync:async()=>{if(server.permissionPending)await server.permissionPending;return {granted:true};},requestMediaLibraryPermissionsAsync:async()=>{if(server.permissionPending)await server.permissionPending;return {granted:true};},launchCameraAsync:async options=>{calls.push(['picker',options]);return {canceled:false,assets:[{uri:'fixture://medicine.jpg',mimeType:'image/jpeg'}]};},launchImageLibraryAsync:async options=>{calls.push(['library',options]);return server.pickerCanceled ? {canceled:true,assets:null} : {canceled:false,assets:[{uri:'ph://selected.heic',mimeType:'image/heic',base64:'/9j/export'}]};}},
    'expo-file-system':{File:class File {constructor(uri){this.uri=uri;this.name=uri.split('/').pop();this.type='audio/mp4';}async bytes(){return new Uint8Array([1,2,3]);}}},'expo-crypto':{randomUUID},'react-i18next':{useTranslation:()=>({t})},'../../lib/aiDataConsent':{hasAiDataConsent:async()=>server.aiConsent},'../../lib/audio':{Audio:{requestPermissionsAsync:async()=>({granted:true}),setAudioModeAsync:async()=>{},RecordingOptionsPresets:{HIGH_QUALITY:{}},Recording:{createAsync:async()=>({recording:{stopAndUnloadAsync:async()=>{},getURI:()=> 'file:///fixture/name.m4a'}})}}},
    '../../lib/apiClient':{ApiError},'../../observability/sentry':{reportError:(e,context)=>calls.push(['diagnostic',context.operation,e.name])},
    './medication-photo':{MedicationPhotoError:PhotoError,prepareMedicationPhoto:async()=>{if(server.photoError)throw new PhotoError(server.photoError);return {body:{photo:true},dispose:()=>calls.push(['dispose'])};}},
    './useMedicationPurposeLookup':{useMedicationPurposeLookup:()=>({pending:false,retry:()=>{}})},
    '../../stores/toast.store':{useToastStore:{getState:()=>({show:(...args)=>toasts.push(args)})}},'./V21Layout':{v21Error:error=>errors.push(error)},
    './v21.api':{v21Api:{transcribe:async(id,body)=>{calls.push(['transcribe',id,body]);return {text:'Tên đã đọc'};},overview:async()=>data,scan:async()=>{calls.push(['scan']);if(server.scanPending)await server.scanPending;if(server.scanError)throw server.scanError;return {readable:true,mediaId:'photo-1',items:server.scanItems||[{display_name:'Tên đọc từ ảnh',kind:'MEDICINE',suggested_slots:[]}]};},setup:async(id,body)=>{calls.push(['setup',id,body]);if(server.pending)await server.pending;if(server.setupError)throw server.setupError;if(server.fail)throw Error('offline');return {pendingConsent:!self};}}},
  };
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
  const toReview=async()=>{read().addManual();read().update(0,{display_name:'Tên đã kiểm tra',confirmed:true,anchors:['after_breakfast']});read().next();read().next();await flush();return read();};
  return {read,settle,toReview,calls,toasts,errors,server,navigation,auth,route,makeApiError:code=>Object.assign(new ApiError('fixture'),{code}),blur:()=>slots.forEach(x=>x?.cleanup?.())};
}
let count=0;async function test(name,fn){await fn();count++;console.log('PASS '+name);}
(async()=>{
  await test('opening setup only reads; continuing requires names, kind and explicit confirmation',async()=>{
    const h=harness();await h.settle();assert.equal(h.calls.length,0);h.read().addManual();assert.equal(h.read().canContinue,false);h.read().next();assert.equal(h.read().step,2);
    h.read().update(0,{display_name:'Tên trên hộp'});assert.equal(h.read().canContinue,false);
    h.read().update(0,{confirmed:true});assert.equal(h.read().canContinue,true);
    h.read().update(0,{display_name:'Thuốc 500 mg',confirmed:true});assert.equal(h.read().canContinue,false);
  });
  await test('meal times and selected slots are required before review',async()=>{
    const h=harness();await h.settle();h.read().addManual();h.read().update(0,{display_name:'Tên đã kiểm tra',confirmed:true});h.read().next();assert.equal(h.read().step,3);assert.equal(h.read().canContinue,false);
    h.read().update(0,{anchors:['after_breakfast']});h.read().setMeals(old=>({...old,breakfast:'29:00'}));assert.equal(h.read().canContinue,false);
    h.read().setMeals(old=>({...old,breakfast:'06:30'}));h.read().next();assert.equal(h.read().step,4);assert.equal(h.read().slots[0].time_local,'07:00');
  });
  await test('items at the same time produce one reminder and each item is listed once',async()=>{
    const h=harness();await h.settle();h.read().addManual();h.read().update(0,{display_name:'Tên một',confirmed:true,anchors:['after_dinner','bedtime']});
    h.read().addItem('Tên hai');h.read().update(1,{confirmed:true,anchors:['after_dinner']});h.read().setMeals(old=>({...old,dinner:'21:00',bedtime:'21:30'}));h.read().next();h.read().next();
    assert.equal(h.read().slots.length,1);assert.deepEqual(h.read().slots[0].item_indexes,[0,1]);
  });
  await test('more than four distinct daily times cannot reach save',async()=>{
    const h=harness();await h.settle();h.read().addManual();h.read().update(0,{display_name:'Tên đã kiểm tra',confirmed:true,anchors:['before_breakfast','after_breakfast','after_lunch','after_dinner','bedtime']});h.read().next();h.read().next();assert.equal(h.read().step,3);assert.equal(h.toasts.at(-1)[0],'scheduleLimit');assert.ok(!h.calls.some(x=>x[0]==='setup'));
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
    h.read().next();await flush();assert.equal(h.read().step,2);assert.equal(h.read().draft.length,1);assert.equal(h.read().busy,false);
  });
  await test('rapid final presses send only one pending save',async()=>{
    const h=harness();await h.settle();await h.toReview();let release;h.server.pending=new Promise(r=>{release=r;});const old=h.read();old.next();old.next();assert.equal(h.calls.filter(x=>x[0]==='setup').length,1);release();await flush();
  });
  await test('photo reading waits for AI consent; extracted names still need confirmation',async()=>{
    const h=harness();await h.settle();await h.read().pick(true);assert.equal(h.read().consent,true);assert.ok(!h.calls.some(x=>x[0]==='scan'));h.read().agreeAi();await flush();assert.equal(h.read().step,2);assert.equal(h.read().draft[0].confirmed,false);assert.equal(h.read().canContinue,false);assert.equal(h.calls.find(x=>x[0]==='picker')[1].base64,true);assert.equal(h.calls.filter(x=>x[0]==='dispose').length,1);
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
    assert.equal(h.read().step,2);assert.equal(h.read().draft[0].confirmed,false);assert.equal(h.calls.filter(x=>x[0]==='dispose').length,1);
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
    assert.equal(h.read().step,2);assert.equal(h.read().draft[0].display_name,'Tên đã đọc');assert.equal(h.read().draft[0].confirmed,false);assert.equal(h.read().busy,false);
  });
  await test('printed time-of-day hints survive OCR without inventing before/after-meal instructions', async()=>{
    const h=harness();await h.settle();h.server.aiConsent=true;
    h.server.scanItems=[{display_name:'Tên đã đọc',printed_name:'Tên in trên hộp',kind:'MEDICINE',suggested_slots:['morning','evening']}];
    await h.read().pick(false);
    assert.deepEqual(h.read().draft[0].timeHints,['morning','evening']);assert.deepEqual(h.read().draft[0].anchors,[]);
    assert.equal(h.read().draft[0].printed_name,'Tên in trên hộp');assert.equal(h.read().draft[0].confirmed,false);
    h.read().update(0,{confirmed:true});h.read().next();assert.equal(h.read().step,3);assert.equal(h.read().canContinue,false);
    h.read().update(0,{anchors:['after_breakfast']});h.read().next();
    h.read().setSlots(old=>old.map(s=>({...s,note:'Sau ăn'})));h.read().next();await flush();
    const sent=h.calls.find(x=>x[0]==='setup')[2];
    assert.equal(sent.slots[0].note,'Sau ăn');assert.equal(sent.items[0].printed_name,'Tên in trên hộp');
    assert.equal(sent.items[0].timeHints,undefined);assert.equal(sent.items[0].photo_uri,undefined);assert.equal(sent.items[0].anchors,undefined);
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
    const h=harness();await h.settle();h.read().addManual();h.read().addItem('Thuốc mỡ máu');
    assert.equal(h.read().draft.length,1);assert.equal(h.read().draft[0].display_name,'Thuốc mỡ máu');assert.equal(h.read().canContinue,false);
    h.read().update(0,{confirmed:true});assert.equal(h.read().canContinue,true);h.read().next();assert.equal(h.read().step,3);
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
  await test('notes follow the dose identity rather than the clock when meal times swap',async()=>{
    const h=harness();await h.settle();h.read().addManual();h.read().update(0,{display_name:'Thuốc A',confirmed:true,anchors:['after_breakfast']});h.read().addItem('Thuốc B');h.read().update(1,{confirmed:true,anchors:['after_dinner']});
    h.read().next();h.read().next();h.read().setSlots(old=>old.map(s=>({...s,note:s.meal_anchor==='after_breakfast'?'Ghi chú sáng':'Ghi chú tối'})));
    h.read().leave();h.read().setMeals({...h.read().meals,breakfast:'18:00',dinner:'06:30'});h.read().next();
    assert.deepEqual(Object.fromEntries(h.read().slots.map(s=>[s.meal_anchor,s.note])),{after_dinner:'Ghi chú tối',after_breakfast:'Ghi chú sáng'});h.blur();
  });
  await test('merging two times preserves both notes and UI identity fields never reach the API',async()=>{
    const h=harness();await h.settle();h.read().addManual();h.read().update(0,{display_name:'Thuốc A',confirmed:true,anchors:['after_breakfast']});h.read().addItem('Thuốc B');h.read().update(1,{confirmed:true,anchors:['after_dinner']});
    h.read().next();h.read().next();h.read().setSlots(old=>old.map(s=>({...s,note:s.meal_anchor==='after_breakfast'?'Ghi chú sáng':'Ghi chú tối'})));
    h.read().leave();h.read().setMeals({...h.read().meals,dinner:'06:30'});h.read().next();assert.equal(h.read().slots.length,1);
    assert.equal(h.read().slots[0].note,'Ghi chú sáng; Ghi chú tối');h.read().next();await flush();const sent=h.calls.find(x=>x[0]==='setup')[2];
    assert.equal(sent.items[0].clientId,undefined);assert.equal(sent.slots[0].sourceKeys,undefined);h.blur();
  });
  await test('removing the token hides the previous draft immediately even if the profile is not cleared yet',async()=>{
    const h=harness();await h.settle();await h.toReview();h.auth.token=null;
    assert.equal(h.read().data,null);assert.deepEqual(h.read().draft,[]);assert.equal(h.read().canContinue,false);h.blur();
  });
  console.log(`Medication setup: ${count} runtime checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
