import * as XLSX from "xlsx";

const BOXES = { A: 10, B: 5, C: 20 };
const norm = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", ...headers } });
const adminPath = (env) => "/" + String(env.ADMIN_PATH || "gestion-7xP9k").replace(/^\/+|\/+$/g, "");
const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
const fromB64url = (s) => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/") + "===".slice((s.length+3)%4)), c=>c.charCodeAt(0));
async function key(env) { return crypto.subtle.importKey("raw", new TextEncoder().encode(env.SESSION_SECRET || "replace-this-secret-in-cloudflare-settings"), {name:"HMAC",hash:"SHA-256"}, false, ["sign","verify"]); }
async function makeCookie(data, env) { const payload=b64url(new TextEncoder().encode(JSON.stringify({...data,exp:Date.now()+3*60*60*1000}))); const sig=b64url(await crypto.subtle.sign("HMAC",await key(env),new TextEncoder().encode(payload))); return `dinicex.sid=${payload}.${sig}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=10800`; }
async function readSession(req,env) { try { const raw=(req.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("dinicex.sid="))?.slice(12); if(!raw)return {}; const [payload,sig]=raw.split("."); if(!payload||!sig||!await crypto.subtle.verify("HMAC",await key(env),fromB64url(sig),new TextEncoder().encode(payload)))return {}; const data=JSON.parse(new TextDecoder().decode(fromB64url(payload))); return data.exp>Date.now()?data:{}; } catch { return {}; } }
const cookieHeader = async (data,env) => ({"set-cookie":await makeCookie(data,env)});
async function rows(env) { const r=await env.DB.prepare("SELECT id,name,suffix,status,answer,box,points,datetime(created_at,'localtime') AS date FROM entries ORDER BY id DESC").all(); return r.results || []; }
async function asset(path,request,env) { const url=new URL(request.url); url.pathname=path; return env.ASSETS.fetch(new Request(url.toString(),request)); }
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
  if(path===admin+"/entries" && request.method==="GET") return json({entries:(await rows(env)).map(p=>({name:p.name,suffix:p.suffix,status:p.status,box:p.box||"",points:p.points||0,date:p.date||""}))});
  if(path===admin+"/export.xlsx" && request.method==="GET") {
   const data=(await rows(env)).map(p=>({ID:p.id,"Nom WhatsApp":p.name,"3 derniers chiffres":p.suffix,Statut:p.status,Réponse:p.answer||"",Boîte:p.box||"", "Cote (points)":p.points||0,Date:p.date||""}));
   const ws=XLSX.utils.json_to_sheet(data.length?data:[{Information:"Aucune participation"}]), wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Cotes");
   const bytes=XLSX.write(wb,{type:"array",bookType:"xlsx"}); return new Response(bytes,{headers:{"content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","content-disposition":"attachment; filename=\"DiniceX_Cotes.xlsx\"","cache-control":"no-store"}});
  }
  if(path===admin && request.method==="GET") return asset("/admin.html",request,env);
  return env.ASSETS.fetch(request);
 } catch(e) { console.error(e); return json({error:"Erreur serveur. Vérifie la configuration Cloudflare et la base D1."},500); }
}};
