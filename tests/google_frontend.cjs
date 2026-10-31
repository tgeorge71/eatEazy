const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const store = new Map();
let platform = 'web';
const nativeStore = new Map();
global.window = { sessionStorage: { getItem: key => store.get(key) ?? null, setItem: (key,v) => store.set(key,v), removeItem: key => store.delete(key) } };
const mocks = {
  'react-native': { Platform: { get OS() { return platform; } } },
  'expo-secure-store': { getItemAsync: async k => nativeStore.get(k) ?? null, setItemAsync: async (k,v) => nativeStore.set(k,v), deleteItemAsync: async k => nativeStore.delete(k) },
  '@/config': { API_BASE_URL: 'http://test' },
};
const moduleRef = { exports: {} };
const code = ts.transpileModule(fs.readFileSync('src/api/googleHealth.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
new Function('require','module','exports',code)(name=>mocks[name],moduleRef,moduleRef.exports);
const api = moduleRef.exports;
const calls = [];
let devices = 0;
let connected = false;
let stale = false;
let failRevoke = false;
global.fetch = async(url, options) => {
  const route = new URL(url).pathname;
  calls.push({route,options});
  if(route.endsWith('/config')) return response(200,{available:true,message:'Ready'});
  if(route.endsWith('/device')) return response(200,{token:`device-${++devices}`});
  if(stale) { stale=false; return response(401,{detail:'Expired'}); }
  if(route.endsWith('/login')) return response(200,{url:'https://accounts.google.com/login'});
  if(route.endsWith('/session')) return response(200,{signed_out:true});
  if(route.endsWith('/authorize')) return response(200,{url:'https://accounts.google.com/test'});
  if(route.endsWith('/status')) return response(200,{connected,has_grant:connected,pending:false});
  if(route.endsWith('/workouts')) return response(200,{workouts:[{id:'google:run',source:'google_health',status:'completed'}],synced_at:'2026-10-12T12:00:00Z'});
  if(route.endsWith('/connection')) return response(failRevoke?502:200,failRevoke?{detail:'Revocation failed'}:{disconnected:true});
  throw new Error('Unexpected route');
};
function response(status,data) { return {ok:status===200,status,json:async()=>data}; }
(async()=>{
  assert.equal((await api.googleHealthStatus()).connected,false);
  await Promise.all([api.authorizeGoogleLogin(),api.authorizeGoogleLogin()]);
  assert.equal(devices,1);
  assert.equal(store.size,1);
  connected=true;
  assert.equal((await api.googleHealthStatus()).connected,true);
  const result=await api.syncGoogleWorkouts('2026-10-06','2026-10-12');
  assert.equal(result.workouts[0].source,'google_health');
  assert.equal(calls.at(-1).options.headers.Authorization,'Bearer device-1');
  stale=true;
  await assert.rejects(() => api.authorizeGoogleHealth(), /Expired/);
  assert.equal(devices,1,"expired session must not abandon Health credential");
  stale=true;
  await api.authorizeGoogleLogin();
  assert.equal(devices,2);
  failRevoke=true;
  await assert.rejects(()=>api.disconnectGoogleHealth(),/Revocation failed/);
  assert.equal(store.size,1,'failed revoke retains credential for retry');
  failRevoke=false;
  await api.disconnectGoogleHealth();
  assert.equal(store.size,1,'disconnect keeps app session');
  await api.signOutGoogle();
  assert.equal(store.size,0);
  platform='ios';
  await api.authorizeGoogleLogin();
  assert.equal(nativeStore.size,1);
  assert.equal(store.size,0);
  await api.disconnectGoogleHealth();
  assert.equal(nativeStore.size,1);
  await api.signOutGoogle();
  assert.equal(nativeStore.size,0);
  await api.authorizeGoogleLogin();
  assert.equal(calls.at(-1).route, '/google-health/login');
  assert.deepEqual(await api.sessionHeaders(), {Authorization: `Bearer device-${devices}`});
  await api.signOutGoogle();
  console.log('Google frontend checks passed: device isolation, session/native storage, credential recovery, syncing and revocation retry.');
})().catch(error=>{console.error(error);process.exitCode=1;});
