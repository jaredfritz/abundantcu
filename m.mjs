import { readFileSync } from "node:fs";
const P = JSON.parse(readFileSync("public/data/parcels/champaign-county-parcels.json","utf8"));
const permits = JSON.parse(readFileSync("src/data/residential-permits.json","utf8")).features.map(f=>f.properties);
const AB={STREET:"ST",AVENUE:"AVE",AV:"AVE",DRIVE:"DR",ROAD:"RD",BOULEVARD:"BLVD",COURT:"CT",LANE:"LN",PLACE:"PL",CIRCLE:"CIR",PARKWAY:"PKWY",TERRACE:"TER",HIGHWAY:"HWY",NORTH:"N",SOUTH:"S",EAST:"E",WEST:"W",TRAIL:"TRL",CROSSING:"XING",SQUARE:"SQ",
FIRST:"1ST",SECOND:"2ND",THIRD:"3RD",FOURTH:"4TH",FIFTH:"5TH",SIXTH:"6TH",SEVENTH:"7TH",EIGHTH:"8TH",NINTH:"9TH",TENTH:"10TH"};
const SUFFIX=new Set(["ST","AVE","DR","RD","BLVD","CT","LN","PL","CIR","PKWY","TER","HWY","TRL","XING","SQ","WAY","RUN","LOOP","PATH","BND","CV","PASS"]);
const toks=t=>t.toUpperCase().replace(/[^A-Z0-9 ]/g," ").split(/\s+/).filter(Boolean).map(x=>AB[x]??x);
const loose=ts=>ts.filter((t,i)=>i===0||!SUFFIX.has(t)).join(" ");
const exact=new Map(), lo=new Map(), street=new Map();
const add=(m,k,i)=>{if(!m.has(k))m.set(k,new Set());m.get(k).add(i)};
const {cols}=P;
for(let i=0;i<cols.pin.length;i++){
  const all=[cols.address[i],...(cols.otherAddresses?.[i]?cols.otherAddresses[i].split("|"):[])].filter(Boolean);
  for(const a of all){
    const m=a.toUpperCase().match(/^(.*?)\s+(CHAMPAIGN|SAVOY|URBANA)(\s+UNIT\b.*)?$/); if(!m||m[2]!=="CHAMPAIGN")continue;
    const t=toks(m[1]); add(exact,t.join(" "),i); add(lo,loose(t),i);
    if(/^\d+$/.test(t[0])) add(street,loose(t.slice(1)).replace(/^/,""),`${t[0]}:${i}`);
  }
}
function find(addr){
  let s=addr.toUpperCase().replace(/\b(\d+)\s+1\/2\b/,"$1");
  const r=s.match(/^(\d+)\s*-\s*(\d+)\s+(.*)$/);
  const cands=r?[`${r[1]} ${r[3]}`,`${r[2]} ${r[3]}`]:[s];
  if(r){for(let n=+r[1]+2;n<+r[2];n+=2)cands.push(`${n} ${r[3]}`)}
  for(const c of cands){const t=toks(c);if(exact.has(t.join(" ")))return["exact",exact.get(t.join(" "))]}
  for(const c of cands){const t=toks(c);if(lo.has(loose(t)))return["loose",lo.get(loose(t))]}
  return null;
}
let n={exact:0,loose:0}, miss=[];
for(const p of permits){const f=find(p.address); if(f)n[f[0]]++; else miss.push(p.address)}
console.log(n,"miss",miss.length); console.log(miss);
