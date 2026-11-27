export const weapons = [
 {id:'autocannon',type:'kinetic',apCost:1,accuracy:.9,name:'Autocannon', min:1,max:4,damage:22,kind:'gun'}, // weapon
 {id:'laser',type:'energy',apCost:1,accuracy:.9,name:'Laser', min:1,max:6,damage:16,kind:'laser'}, // weapon
 {id:'missile',type:'explosive',apCost:1,accuracy:.9,name:'Missile', min:3,max:8,damage:30,kind:'missile'} // weapon
]; 
export const terrain = new Map([['3,3','concrete barrier'],['3,4','concrete barrier'],['3,5','concrete barrier'],['6,5','rock'],['6,6','rock'],['7,2','scrap barricade'],['7,3','scrap barricade']]);
export const walls = new Set(terrain.keys());
export const key=(x,y)=>x+','+y;
export const coord=(x,y)=>String.fromCharCode(65+y)+(x+1);
export const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export const alive=u=>u.hp>0;
export function seededRandom(seed){
 let state=seed>>>0;
 return ()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;}; // generator
} // seededRandom
export function createUnit(spec){
 const maxMP=spec.maxMP??4,maxAP=spec.maxAP??2;
 return {accuracy:0,evasion:0,resistances:{},weaponIds:weapons.map(w=>w.id),profile:'assault',controller:spec.team==='friendly'?'player':'ai',maxMP,maxAP,mp:maxMP,ap:maxAP,...spec}; // unit
} // createUnit
export function weaponsFor(u){
 return u?weapons.filter(w=>!u.weaponIds||u.weaponIds.includes(w.id)):[];
} // weaponsFor
export function newGame(seed=Date.now()){
 return {round:1,done:false,seed,random:seededRandom(seed),units:[
 {id:'atlas',name:'Atlas',team:'friendly',x:1,y:7,hp:100,max:100,maxMP:4,maxAP:2}, // unit
 {id:'viper',name:'Viper',team:'friendly',x:2,y:8,hp:80,max:80,maxMP:4,maxAP:2}, // unit
 {id:'reaper',name:'Reaper Scout',team:'enemy',x:5,y:4,hp:55,max:55,maxMP:3,maxAP:1,profile:'scout'}, // unit
 {id:'titan',name:'Titan',team:'enemy',x:7,y:1,hp:90,max:90,maxMP:3,maxAP:1,profile:'defender'}, // unit
 {id:'wraith',name:'Wraith',team:'enemy',x:8,y:4,hp:65,max:65,maxMP:3,maxAP:1,profile:'sniper'} // unit
 ].map(createUnit)}; // state
} // newGame
export function blocked(g,x,y){
 return x<0||x>9||y<0||y>9||walls.has(key(x,y))||g.units.some(u=>alive(u)&&u.x===x&&u.y===y);
} // blocked
export function cover(u,attacker){
 return [[1,0],[-1,0],[0,1],[0,-1]].some(([x,y])=>walls.has(key(u.x+x,u.y+y))&&(!attacker||x*(attacker.x-u.x)+y*(attacker.y-u.y)>0));
} // cover
export function reachable(g,u){
 const q=[{x:u.x,y:u.y,cost:0}],seen=new Set([key(u.x,u.y)]);
 for(let i=0;i<q.length;i++){
  const p=q[i];
  if(p.cost>=u.mp)continue;
  for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
   const x=p.x+dx,y=p.y+dy,k=key(x,y);
   if(seen.has(k)||blocked(g,x,y))continue;
   seen.add(k);q.push({x,y,cost:p.cost+1}); // destination
  } // directions
 } // queue
 return q.slice(1);
} // reachable
export function sightBlockers(a,b,g){
 const blockers=[],seen=new Set();
 function inspect(x,y){
  if((x===a.x&&y===a.y)||(x===b.x&&y===b.y))return;
  const k=key(x,y);if(seen.has(k))return;seen.add(k);
  const type=terrain.get(k);
  const u=g?.units.find(u=>alive(u)&&u.id!==a.id&&u.id!==b.id&&u.x===x&&u.y===y);
  if(type)blockers.push({x,y,type}); // terrain blocker
  else if(u)blockers.push({x,y,type:u.team+' mech '+u.name}); // unit blocker
 } // inspect
 let x=a.x,y=a.y;const dx=b.x-x,dy=b.y-y,nx=Math.abs(dx),ny=Math.abs(dy),sx=Math.sign(dx),sy=Math.sign(dy);
 let ix=0,iy=0;
 while(ix<nx||iy<ny){
  const d=(1+2*ix)*ny-(1+2*iy)*nx;
  if(d===0){
   inspect(x+sx,y);inspect(x,y+sy);
   x+=sx;y+=sy;ix++;iy++;
  }else if(d<0){x+=sx;ix++;}else{y+=sy;iy++;} // grid step
  inspect(x,y);
 } // traversal
 return blockers;
} // sightBlockers
export function sight(a,b,g){
 return sightBlockers(a,b,g).length===0;
} // sight
export function attackPreview(a,b,w,g){
 const reasons=[],cost=w.apCost??1;
 if(!a||!b||!alive(a)||!alive(b)||g?.done)return {available:false,reasons:['Combatant unavailable'],cost,chance:0,damage:0}; // invalid
 if(a.team===b.team)reasons.push('Cannot attack ally');
 if(!weaponsFor(a).some(v=>v.id===w.id))reasons.push('Weapon not equipped');
 if(a.ap<cost)reasons.push('Requires '+cost+' action points; '+a.ap+' remaining');
 const range=distance(a,b),blockers=sightBlockers(a,b,g);
 if(range<w.min)reasons.push('Too close: range '+range+', minimum '+w.min);
 if(range>w.max)reasons.push('Out of range: range '+range+', maximum '+w.max);
 if(blockers.length)reasons.push('Line of sight blocked by '+blockers.map(p=>p.type+' at '+coord(p.x,p.y)).join('; '));
 const covered=cover(b,a);
 const chance=Math.max(.05,Math.min(.98,(w.accuracy??.9)+(a.accuracy??0)-(b.evasion??0)-(covered?.2:0)));
 const resistance=Math.max(0,Math.min(1,b.resistances?.[w.type]??0));
 const damage=Math.max(0,Math.floor(w.damage*(covered?.65:1)*(1-resistance)));
 return {available:reasons.length===0,reasons,cost,chance,damage,covered,range}; // preview
} // attackPreview
export function canFire(a,b,w,g){
 return attackPreview(a,b,w,g).available;
} // canFire
export function resolveAction(g,a,action,random=g?.random??Math.random){
 if(action.type==='move'){
  const p=g&&!g.done&&alive(a)&&reachable(g,a).find(p=>p.x===action.x&&p.y===action.y);
  if(!p)return {ok:false,reasons:['Destination unreachable']}; // rejected move
  a.x=p.x;a.y=p.y;a.mp-=p.cost;
  return {ok:true,type:'move',sound:'move',cost:p.cost,message:a.name+' moves to '+coord(a.x,a.y)+'. Movement remaining '+a.mp+'.'}; // result
 } // move
 if(action.type!=='attack')return {ok:false,reasons:['Unknown action']}; // unsupported
 const b=action.target,w=action.weapon,p=attackPreview(a,b,w,g);
 if(!p.available)return {ok:false,reasons:p.reasons}; // rejected attack
 a.ap-=p.cost;
 const hit=random()<p.chance,damage=hit?Math.min(b.hp,p.damage):0;
 b.hp-=damage;
 const message=a.name+' fires '+w.name+' at '+b.name+'. '+(hit?'Hit. '+damage+' damage.':'Miss. Zero damage.')+' '+(alive(b)?b.name+' has '+b.hp+' armor remaining.':'Target destroyed.')+' '+a.name+' has '+a.ap+' action points remaining.';
 return {ok:true,type:'attack',hit,damage,destroyed:!alive(b),sound:w.kind,message}; // result
} // resolveAction
export function fire(a,b,w,g,random=g?.random??Math.random){
 const result=resolveAction(g,a,{type:'attack',target:b,weapon:w},random);
 return result.ok?result.message:null;
} // fire
export function move(g,u,x,y){
 return resolveAction(g,u,{type:'move',x,y}).ok;
} // move
export function outcome(g){
 if(!g.units.some(u=>u.team==='enemy'&&alive(u)))return 'Victory! All hostiles destroyed.';
 if(!g.units.some(u=>u.team==='friendly'&&alive(u)))return 'Defeat. All friendly mechs destroyed.';
 return '';
} // outcome
const profiles={assault:{risk:.15,cover:2,range:0},scout:{risk:.35,cover:3,range:0},defender:{risk:.6,cover:6,range:0},sniper:{risk:.45,cover:3,range:5}}; // AI weights
export function choosePlan(g,u){
 const foes=g.units.filter(v=>alive(v)&&v.team!==u.team),profile=profiles[u.profile]??profiles.assault;
 let best=null,approach=null;
 const spots=[{x:u.x,y:u.y,cost:0},...reachable(g,u)];
 for(const p of spots){
  const simulated={...u,x:p.x,y:p.y};
  const simGame={...g,units:g.units.map(v=>v.id===u.id?simulated:v)};
  const exposure=foes.reduce((sum,v)=>sum+Math.max(0,...weaponsFor(v).map(w=>{const q=attackPreview({...v,ap:v.maxAP??2},simulated,w,simGame);return q.available?q.chance*q.damage:0;})),0);
  for(const v of foes){
   const d=distance(simulated,v);
   const advance=-d-(sight(simulated,v,simGame)?0:4)-p.cost*.15-exposure*profile.risk*.1;
   if(!approach||advance>approach.score)approach={p,score:advance}; // approach
   for(const w of weaponsFor(u)){
    const q=attackPreview(simulated,v,w,simGame);
    if(!q.available)continue;
    const score=q.chance*(Math.min(v.hp,q.damage)+(q.damage>=v.hp?20:0))-p.cost*.7-exposure*profile.risk+(cover(simulated,v)?profile.cover:0)-(profile.range?Math.abs(d-profile.range)*1.5:0);
    if(!best||score>best.score)best={p,target:v,weapon:w,score}; // best shot
   } // weapons
  } // targets
 } // positions
 return best??approach;
} // choosePlan
function resetUnit(u){
 u.mp=u.maxMP;u.ap=u.maxAP;
} // resetUnit
export function enemyRound(g,report){
 if(g.done||outcome(g))return;
 for(const e of g.units.filter(u=>u.team==='enemy'&&alive(u))){
  resetUnit(e);
  while(e.ap>0&&!outcome(g)){
   const plan=choosePlan(g,e);
   if(!plan)break;
   if(plan.p.cost){const result=resolveAction(g,e,{type:'move',x:plan.p.x,y:plan.p.y});if(result.ok)report(result.message,result.sound);} // move
   if(!plan.weapon){report(e.name+' holds fire.','');break;} // no shot
   const result=resolveAction(g,e,{type:'attack',target:plan.target,weapon:plan.weapon});
   if(!result.ok)break;
   report(result.message,result.sound);
  } // action loop
 } // enemy loop
 if(!outcome(g)){
  g.round++;
  for(const u of g.units.filter(u=>u.team==='friendly'&&alive(u)))resetUnit(u);
 } // reset
} // enemyRound
