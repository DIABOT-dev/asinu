const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const { randomUUID } = require('node:crypto');
const flush = async () => { for (let i=0;i<35;i++) await Promise.resolve(); };
function evaluate(file, adapters) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  // Execute production feature modules with isolated network/native adapters.
  // eslint-disable-next-line no-new-func
  new Function('module','exports','require',code)(module,module.exports,name => {
    if (name === 'react/jsx-runtime') return { jsx: (type,props,key) => ({type,props:{...props,key}}), jsxs: (type,props,key) => ({type,props:{...props,key}}) };
    assert.ok(name in adapters, 'Missing adapter '+name); return adapters[name];
  });
  return module.exports;
}
function harness({enabled=false, visible=true}={}) {
  let cursor=0, focused=true, pending=[];
  const slots=[];
  const memo=(fn,deps)=>{ const n=cursor++, old=slots[n]; if(!old||deps.some((v,i)=>!Object.is(v,old.deps[i]))) slots[n]={deps,value:fn()}; return slots[n].value; };
  const hooks={
    useState(initial){ const n=cursor++; if(!slots[n])slots[n]={value:typeof initial==='function'?initial():initial}; return [slots[n].value,value=>{slots[n].value=typeof value==='function'?value(slots[n].value):value;}]; },
    useRef(initial){return memo(()=>({current:initial}),[]);}, useCallback:(fn,deps)=>memo(()=>fn,deps),
  };
  const router={ useFocusEffect(callback){const n=cursor++, old=slots[n]; if(!old||old.callback!==callback){slots[n]={callback};pending.push(()=>{old?.cleanup?.();if(focused)slots[n].cleanup=callback();});}} };
  const auth={token:'fixture-token-a',profile:{id:'alice',consentVersion:'fixture-consent'}};
  const useAuthStore=Object.assign(select=>select(auth),{getState:()=>auth});
  const flags={isDoctorFeaturesEnabled:visible};
  const server={enabled,readError:false,postError:false,wrongAction:false,pendingRead:null,pendingPost:null};
  const calls={requests:[],toasts:[]}; const listeners=new Set();
  const api=evaluate('src/features/profile/specialist-sharing.api.ts',{
    'expo-crypto':{randomUUID},'../../lib/appEnv':flags,'../../lib/env':{env:{doctorTenantId:'fixture-tenant'}},'../auth/auth.store':{useAuthStore},
    '../../lib/apiClient':{apiClient:async(url,options={})=>{
      calls.requests.push({url,...options,method:options.method||'GET'});
      if(options.method==='POST'){
        if(server.pendingPost)await server.pendingPost;
        if(server.postError)throw new Error('Fixture post failure');
        if(server.wrongAction)return {ok:true,data:{action:'export'}};
        server.enabled=options.body.action==='grant_consent';
        return {ok:true,data:{action:options.body.action}};
      }
      if(server.readError)throw new Error('Fixture read failure');
      return server.pendingRead ?? {ok:true,data:{sharing_enabled:server.enabled}};
    }},
  });
  const t=key=>key;
  const {useSpecialistSharingPermission:runSharingFeature}=evaluate('src/features/profile/useSpecialistSharingPermission.ts',{
    react:hooks,'expo-router':router,'react-native':{AppState:{addEventListener:(_,cb)=>{listeners.add(cb);return {remove:()=>listeners.delete(cb)};}}},
    'react-i18next':{useTranslation:()=>({t})},'../../lib/appEnv':flags,
    '../../stores/toast.store':{showToast:(...args)=>calls.toasts.push(args)},'../auth/auth.store':{useAuthStore},'./specialist-sharing.api':api,
  });
  const read=()=>{cursor=0;return runSharingFeature();};
  const {SpecialistSharingPermission}=evaluate('src/features/profile/SpecialistSharingPermission.tsx',{
    '@expo/vector-icons':{Ionicons:'Icon'},'react-native':{ActivityIndicator:'Loading',Pressable:'Button',ScrollView:'Scroll',StyleSheet:{create:s=>s},Switch:'Switch',View:'View'},
    'react-i18next':{useTranslation:()=>({t})},'react-native-safe-area-context':{useSafeAreaInsets:()=>({top:0,bottom:0})},'../../components/QueuedModal':{QueuedModal:'QueuedModal'},'../../components/ScaledText':{ScaledText:'Text'},
    '../../hooks/useThemeColors':{useThemeColors:()=>({colors:{primary:'#008577',primaryText:'#00695c',danger:'#b00020',background:'#f8fcfa',overlay:'#1235'}})},'../../lib/appEnv':flags,
    './useSpecialistSharingPermission':{useSpecialistSharingPermission:read},
  });
  return {auth,flags,server,calls,api,read,tree:()=>SpecialistSharingPermission(),
    settle:async()=>{read();const tasks=pending;pending=[];tasks.forEach(fn=>fn());await flush();return read();},
    blur:()=>{focused=false;slots.forEach(slot=>{slot.cleanup?.();slot.cleanup=null;});}, foreground:()=>listeners.forEach(fn=>fn('active')),
  };
}
const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
const posts=h=>h.calls.requests.filter(x=>x.method==='POST');
let checks=0;
async function test(name,fn){await fn();checks++;console.log('PASS '+name);}
(async()=>{
  await test('opening permissions only reads the specialist state and exposes the real switch value',async()=>{
    const h=harness({enabled:true});await h.settle();assert.equal(posts(h).length,0);assert.equal(h.read().enabled,true);
    const toggle=nodes(h.tree()).find(x=>x.type==='Switch');assert.equal(toggle.props.value,true);assert.equal(toggle.props.accessibilityLabel,'specialistSharing');
    assert.equal(h.calls.requests[0].headers.Authorization,'Bearer fixture-token-a');h.blur();
  });
  await test('toggle opens confirmation; cancel and a stale confirm cannot change sharing',async()=>{
    const h=harness();await h.settle();h.read().request(true);const old=h.read();assert.ok(old.decision);assert.equal(posts(h).length,0);
    old.cancel();await old.confirm();assert.equal(posts(h).length,0);assert.equal(h.read().decision,null);h.blur();
  });
  await test('grant requires confirmation, writes the audited action and reloads GET before showing success',async()=>{
    const h=harness();await h.settle();h.read().request(true);await h.read().confirm();
    assert.equal(posts(h).length,1);assert.equal(posts(h)[0].body.action,'grant_consent');assert.equal(posts(h)[0].body.consent_version,'fixture-consent');assert.equal(posts(h)[0].body.confirmation,'CONFIRM_DOCTOR_DATA_REQUEST');
    assert.equal(h.calls.requests.at(-1).method,'GET');assert.equal(h.read().enabled,true);assert.equal(h.read().decision,null);assert.equal(h.calls.toasts.length,1);h.blur();
  });
  await test('withdraw confirmation retains the active-case cancellation warning and saves withdraw_consent',async()=>{
    const h=harness({enabled:true});await h.settle();h.read().request(false);const tree=nodes(h.tree());
    assert.ok(tree.some(x=>x.type==='Text'&&x.props.children==='privacyCancellationWarningTitle'));
    assert.ok(tree.some(x=>x.type==='Text'&&x.props.children==='privacyCancellationWarningBody'));
    assert.equal(posts(h).length,0);await h.read().confirm();assert.equal(posts(h)[0].body.action,'withdraw_consent');assert.equal(h.read().enabled,false);h.blur();
  });
  await test('double confirmation sends one POST and keeps the switch unchanged until server completion',async()=>{
    const h=harness();await h.settle();h.read().request(true);let finish;h.server.pendingPost=new Promise(resolve=>{finish=resolve;});
    const first=h.read().confirm(),second=h.read().confirm();await flush();assert.equal(posts(h).length,1);assert.equal(h.read().enabled,false);assert.equal(h.read().busy,true);
    finish();await Promise.all([first,second]);assert.equal(h.read().enabled,true);h.blur();
  });
  await test('POST errors retain actual state and retry uses the same idempotency request ID',async()=>{
    const h=harness();await h.settle();h.read().request(true);h.server.postError=true;await h.read().confirm();
    assert.equal(h.read().enabled,false);assert.equal(h.read().saveError,true);assert.equal(h.calls.toasts.length,0);const id=posts(h)[0].body.request_id;
    h.server.postError=false;await h.read().confirm();assert.equal(posts(h)[1].body.request_id,id);assert.equal(h.read().enabled,true);h.blur();
  });
  await test('unavailable state disables sharing and retry only performs a read',async()=>{
    const h=harness();h.server.readError=true;await h.settle();assert.equal(h.read().failed,true);assert.equal(h.read().enabled,null);h.read().request(true);assert.equal(h.read().decision,null);
    h.server.readError=false;h.server.enabled=true;await h.read().refresh();assert.equal(h.read().enabled,true);assert.equal(posts(h).length,0);h.blur();
  });
  await test('wrong action in a successful HTTP response cannot produce a success state',async()=>{
    const h=harness();await h.settle();h.read().request(true);h.server.wrongAction=true;await h.read().confirm();assert.equal(h.read().saveError,true);assert.equal(h.read().enabled,false);assert.equal(h.calls.toasts.length,0);h.blur();
  });
  await test('account changes and blur invalidate an old confirmation before any POST',async()=>{
    for(const change of ['account','blur']){const h=harness();await h.settle();h.read().request(true);const old=h.read();if(change==='account')h.auth.token='fixture-token-b';else h.blur();await old.confirm();assert.equal(posts(h).length,0);h.blur();}
  });
  await test('late GET cannot overwrite a newer sharing status',async()=>{
    const h=harness();await h.settle();let finish;h.server.pendingRead=new Promise(resolve=>{finish=resolve;});const old=h.read().refresh();await flush();
    h.server.pendingRead=null;await h.read().refresh();finish({ok:true,data:{sharing_enabled:true}});await old;assert.equal(h.read().enabled,false);h.blur();
  });
  await test('Doctor flag disables both the feature UI and direct API calls',async()=>{
    const h=harness({visible:false});await h.settle();assert.equal(h.tree(),null);assert.equal(h.calls.requests.length,0);
    const identity={userId:'alice',token:'fixture-token-a',consentVersion:'fixture-consent'};await h.api.specialistSharingApi.read(identity);await h.api.specialistSharingApi.save(identity,true,randomUUID());assert.equal(h.calls.requests.length,0);h.blur();
  });
  console.log(`Specialist sharing: ${checks} runtime checks passed.`);
})().catch(error=>{console.error(error);process.exitCode=1;});
