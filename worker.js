import * as XLSX from "xlsx";

const BOXES = { A: 10, B: 5, C: 20 };
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
const adminPath = (env) => "/tableau-dinicex-2026";
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/") + "===".slice((s.length+3)%4)), c=>c.charCodeAt(0));
async function key(env) { return crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET || "replace-this-secret-in-cloudflare-settings"), {name:"HMAC",hash:"SHA-256"}, false, ["sign","verify"]); }
async function makeCookie(data, env) { const payload=b64url(new TextEncoder().encode(JSON.stringify({...data,exp:Date.now()+3*60*60*1000}))); const sig=b64url(await crypto.subtle.sign("HMAC",await key(env),new TextEncoder().encode(payload))); return `dinicex.sid=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=10800`; }
async function readSession(req,env) { try { const raw=(req.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("dinicex.sid="))?.slice(12); if(!raw)return {}; const [payload,sig]=raw.split("."); if(!payload||!sig||!await crypto.subtle.verify("HMAC",await key(env),fromB64url(sig),new TextEncoder().encode(payload)))return {}; const data=JSON.parse(new TextDecoder().decode(fromB64url(payload))); return data.exp>Date.now()?data:{}; } catch { return {}; } }
const cookieHeader = async (data,env) => ({"set-cookie":await makeCookie(data,env)});
async function rows(env) { const r=await env.DB.prepare("SELECT id,name,suffix,status,answer,box,points,datetime(created_at,'localtime') AS date FROM entries ORDER BY id DESC").all(); return r.results || []; }
async function asset(path,request,env) { const url=new URL(request.url); url.pathname=path; return env.ASSETS.fetch(new Request(url.toString(),request)); }
const ADMIN_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Administration Dinice.X</title><link rel="stylesheet" href="/style.css"><style>
main{max-width:1100px}#dash{max-width:100%}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:14px 0}
.stat{background:#fff7ee;border:1px solid #efdfd4;border-radius:14px;padding:12px;text-align:center}
.stat b{display:block;font:900 24px Montserrat;color:var(--red)}.stat small{color:#65726b;font-size:11px;font-weight:700}
.bar{display:flex;gap:10px;flex-wrap:wrap;margin:14px 0}
.bar input{flex:1;min-width:180px}
.btn{display:inline-block;border:0;border-radius:12px;padding:14px 18px;font:800 13px Montserrat;cursor:pointer;text-decoration:none;text-align:center;color:#fff}
.btn.g{background:#075c39}.btn.r{background:#bd111b}
.wrap{overflow:auto;max-height:70vh;border:1px solid #e5d8ce;border-radius:12px}
table{border-collapse:collapse;width:100%;font-size:13px;min-width:720px}
th,td{border:1px solid #e5d8ce;padding:9px 11px;text-align:left;white-space:nowrap}
th{background:#075c39;color:#fff;position:sticky;top:0;font-weight:700}
tbody tr:nth-child(even){background:#fbf5ee}
.ok{color:#075c39;font-weight:700}.ko{color:#bd111b;font-weight:700}
</style></head><body><header><div class="logo"><img src="/logo.png" alt="Logo" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"><span>DINICE.X<br>PIZZA</span></div><div><b>DINICE.X PIZZA</b><small>Administration</small></div><label class="tag">ESPACE ADMIN</label></header><main><section class="hero"><h1>TABLEAU DES <em>COTES</em></h1><p>Consulte les résultats en direct et télécharge le fichier Excel.</p></section><section class="panel" id="dash"><h2>Participations</h2><div class="stats" id="stats"></div><div class="bar"><input id="q" placeholder="Rechercher un nom, un statut, une boîte..."><button class="btn r" id="refresh" type="button">↻ Actualiser</button><a class="btn g" id="xl" href="#">↓ Télécharger Excel (.xlsx)</a></div><div class="wrap"><table><thead><tr><th>ID</th><th>Nom WhatsApp</th><th>3 derniers chiffres</th><th>Statut</th><th>Réponse</th><th>Boîte</th><th>Cote (points)</th><th>Date</th></tr></thead><tbody id="rows"></tbody></table></div><p id="note"></p></section></main><script>
var $=function(x){return document.getElementById(x)};
var base=location.pathname;while(base.length>1&&base.charAt(base.length-1)=="/")base=base.slice(0,-1);
$("xl").href=base+"/export.xlsx";
var all=[];
function stat(label,value){var d=document.createElement("div");d.className="stat";var b=document.createElement("b");b.textContent=value;var s=document.createElement("small");s.textContent=label;d.append(b,s);return d}
function draw(){
  var q=$("q").value.trim().toLowerCase();
  var list=all.filter(function(p){return !q||[p.name,p.suffix,p.status,p.answer,p.box,p.date].join(" ").toLowerCase().indexOf(q)>-1});
  $("rows").replaceChildren();
  list.forEach(function(p){
    var tr=document.createElement("tr");
    [p.id,p.name,p.suffix,p.status,p.answer||"",p.box||"—",p.points,p.date].forEach(function(v,i){
      var td=document.createElement("td");td.textContent=v;
      if(i==3)td.className=(p.status=="Échec")?"ko":"ok";
      tr.append(td)
    });
    $("rows").append(tr)
  });
  $("note").textContent=list.length+" ligne(s) affichée(s) sur "+all.length;
}
async function load(){
  try{
    var r=await fetch(base+"/entries",{cache:"no-store"});
    if(!r.ok){$("note").textContent="Erreur de chargement";return}
    var d=await r.json();all=d.entries;
    var pts=0,fin=0,fail=0;
    all.forEach(function(p){pts+=Number(p.points)||0;if(p.status=="Terminé")fin++;if(p.status=="Échec")fail++});
    $("stats").replaceChildren(stat("Participations",all.length),stat("Terminées",fin),stat("Échecs",fail),stat("Total points",pts));
    draw();
  }catch(e){$("note").textContent="Erreur de connexion"}
}
$("q").addEventListener("input",draw);
$("refresh").addEventListener("click",load);
load();setInterval(load,30000);
</script></body></html>`;

export default { async fetch(request, env) {
 const url=new URL(request.url), path=url.pathname.replace(/\/+$/,"/"); const admin=adminPath(env);
 try {
  if(path==="/api/health") return json({ok:true});
  if(path==="/api/identify" && request.method==="POST") {
   const body=await request.json().catch(()=>({})); const name=String(body.name||"").trim().replace(/\s+/g," "), suffix=String(body.suffix||"");
   if(name.length<2||name.length>50||!/^[0-9]{3}$/.test(suffix))return json({error:"Entre ton nom WhatsApp et exactement les 3 derniers chiffres."},400);
   const existing=await env.DB.prepare("SELECT id FROM entries WHERE name=? COLLATE NOCASE AND suffix=? LIMIT 1").bind(name,suffix).first();
   if(existing)return json({error:"Cette identité a déjà participé. Une seule tentative est autorisée."},409);
   return json({ok:true},200,await cookieHeader({person:{name,suffix},stage:"question"},env));
  }
  if(path==="/api/question" && request.method==="POST") {
   const s=await readSession(request,env); if(!s.person||s.stage!=="question")return json({error:"Identifie-toi d'abord."},400);
   const body=await request.json().catch(()=>({})), answer=String(body.answer||"").trim(), ok=["bukavu","bkv"].includes(norm(answer));
   try { const r=await env.DB.prepare("INSERT INTO entries(name,suffix,status,answer,points) VALUES(?,?,?,?,0)").bind(s.person.name,s.person.suffix,ok?"Question réussie":"Échec",answer.slice(0,120)).run();
    if(!ok)return json({failed:true,message:"Mauvaise réponse. Participation terminée : 0 point."},200,await cookieHeader({stage:"failed"},env));
    return json({ok:true},200,await cookieHeader({person:s.person,stage:"box",entryId:Number(r.meta.last_row_id)},env));
   } catch(e) { return json({error:"Cette identité a déjà participé."},409); }
  }
  if(path==="/api/box" && request.method==="POST") {
   const s=await readSession(request,env); if(!s.entryId||s.stage!=="box")return json({error:"Étape non autorisée"},400);
   const body=await request.json().catch(()=>({})), b=String(body.box||"").toUpperCase(); if(!BOXES[b])return json({error:"Choisis A, B ou C"},400);
   const r=await env.DB.prepare("UPDATE entries SET status='Terminé',box=?,points=? WHERE id=? AND status='Question réussie'").bind(b,BOXES[b],s.entryId).run();
   if(!r.meta.changes)return json({error:"Participation déjà terminée"},409);
   return json({box:b,points:BOXES[b]},200,await cookieHeader({stage:"done"},env));
  }
  if(path===admin+"/entries" && request.method==="GET") return json({entries:(await rows(env)).map(p=>({id:p.id,name:p.name,suffix:p.suffix,status:p.status,answer:p.answer||"",box:p.box||"",points:p.points||0,date:p.date||""}))},200,{"cache-control":"no-store"});
  if(path===admin+"/export.xlsx" && request.method==="GET") {
   const data=(await rows(env)).map(p=>({ID:p.id,"Nom WhatsApp":p.name,"3 derniers chiffres":p.suffix,Statut:p.status,Réponse:p.answer||"",Boîte:p.box||"", "Cote (points)":p.points||0,Date:p.date||""}));
   const ws=XLSX.utils.json_to_sheet(data.length?data:[{Information:"Aucune participation"}]), wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Cotes");
   const bytes=XLSX.write(wb,{type:"array",bookType:"xlsx"}); return new Response(bytes,{headers:{"content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","content-disposition":"attachment; filename=\"DiniceX_Cotes.xlsx\"","cache-control":"no-store"}});
  }
  if((path===admin||path===admin+"/") && request.method==="GET") return new Response(ADMIN_HTML,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-robots-tag":"noindex"}});
  return env.ASSETS.fetch(request);
 } catch(e) { console.error(e); return json({error:"Erreur serveur. Vérifie la configuration Cloudflare et la base D1."},500); }
}};
