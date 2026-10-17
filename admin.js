const $=x=>document.getElementById(x);
const base=location.pathname.replace(/\/+$/,"");
$("xl").href=base+"/export.xlsx";
async function load(){
  let r=await fetch(base+"/entries");
  if(!r.ok){$("count").textContent="Erreur de chargement";return}
  let d=await r.json();
  $("count").textContent=d.entries.length+" participation(s)";
  $("rows").replaceChildren();
  d.entries.forEach(p=>{
    let tr=document.createElement("tr");
    [p.name,p.suffix,p.status,p.box||"—",p.points,p.date].forEach(v=>{
      let td=document.createElement("td");td.textContent=v;tr.append(td)
    });
    $("rows").append(tr)
  })
}
load();
