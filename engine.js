export const weapons = [
 {name:'Autocannon', min:1,max:4,damage:22,kind:'gun'}, // weapon
 {name:'Laser', min:1,max:6,damage:16,kind:'laser'}, // weapon
 {name:'Missile', min:3,max:8,damage:30,kind:'missile'} // weapon
]; 
export const walls = new Set(['3,3','3,4','3,5','6,5','6,6','7,2','7,3']);
export const key=(x,y)=>x+','+y;
export const coord=(x,y)=>String.fromCharCode(65+x)+(y+1);
export const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export const alive=u=>u.hp>0;
export function newGame(){
 return {round:1,done:false,units:[
 {id:'atlas',name:'Atlas',team:'friendly',x:1,y:7,hp:100,max:100,mp:4,ap:2}, // unit
 {id:'viper',name:'Viper',team:'friendly',x:2,y:8,hp:80,max:80,mp:4,ap:2}, // unit
 {id:'reaper',name:'Reaper Scout',team:'enemy',x:5,y:4,hp:55,max:55,mp:3,ap:1}, // unit
 {id:'titan',name:'Titan',team:'enemy',x:7,y:1,hp:90,max:90,mp:3,ap:1}, // unit
 {id:'wraith',name:'Wraith',team:'enemy',x:8,y:4,hp:65,max:65,mp:3,ap:1} // unit
 ]}; // state
} // newGame
export function blocked(g,x,y){
 return x<0||x>9||y<0||y>9||walls.has(key(x,y))||g.units.some(u=>alive(u)&&u.x===x&&u.y===y);
} // blocked
export function cover(u){
 return [[1,0],[-1,0],[0,1],[0,-1]].some(([x,y])=>walls.has(key(u.x+x,u.y+y)));
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
export function sight(a,b){
 // Grid traversal; conservative corner blocking.
 let x=a.x,y=a.y;const dx=b.x-x,dy=b.y-y,nx=Math.abs(dx),ny=Math.abs(dy),sx=Math.sign(dx),sy=Math.sign(dy);
 let ix=0,iy=0;
 while(ix<nx||iy<ny){
  const d=(1+2*ix)*ny-(1+2*iy)*nx;
  if(d===0){
   if(walls.has(key(x+sx,y))||walls.has(key(x,y+sy)))return false;
   x+=sx;y+=sy;ix++;iy++;
  }else if(d<0){x+=sx;ix++;}else{y+=sy;iy++;} // grid step
  if(walls.has(key(x,y)))return false;
 } // traversal
 return true;
} // sight
export function canFire(a,b,w){
 return alive(a)&&alive(b)&&a.team!==b.team&&a.ap>0&&distance(a,b)>=w.min&&distance(a,b)<=w.max&&sight(a,b);
} // canFire
export function fire(a,b,w){
 if(!canFire(a,b,w))return null;
 a.ap--;const damage=cover(b)?Math.floor(w.damage*0.65):w.damage;
 b.hp=Math.max(0,b.hp-damage);
 return a.name+' fires '+w.name+' at '+b.name+' for '+damage+' damage. '+(alive(b)?b.hp+' armor remaining.':'Target destroyed.');
} // fire
export function move(g,u,x,y){
 const p=reachable(g,u).find(p=>p.x===x&&p.y===y);
 if(!p)return false;
 u.x=x;u.y=y;u.mp-=p.cost;return true;
} // move
export function outcome(g){
 if(!g.units.some(u=>u.team==='enemy'&&alive(u)))return 'Victory! All hostiles destroyed.';
 if(!g.units.some(u=>u.team==='friendly'&&alive(u)))return 'Defeat. All friendly mechs destroyed.';
 return '';
} // outcome
export function enemyRound(g,report){
 for(const e of g.units.filter(u=>u.team==='enemy'&&alive(u))){
  e.mp=3;e.ap=1;
  const foes=g.units.filter(u=>u.team==='friendly'&&alive(u));
  if(!foes.length)break;
  let target=foes.sort((a,b)=>distance(e,a)-distance(e,b))[0];
  const choose=()=>weapons.filter(w=>canFire(e,target,w)).sort((a,b)=>b.damage-a.damage)[0];
  let w=choose();
  if(!w){
   const spots=reachable(g,e).sort((a,b)=> (distance(a,target)+(!sight(a,target)?5:0))-(distance(b,target)+(!sight(b,target)?5:0)));
   if(spots.length&&move(g,e,spots[0].x,spots[0].y))report(e.name+' moves to '+coord(e.x,e.y)+'.','move');
   w=choose();
  } // movement
  if(w)report(fire(e,target,w),w.kind);
  else report(e.name+' holds fire.','');
 } // enemy loop
 if(!outcome(g)){
  g.round++;
  for(const u of g.units.filter(u=>u.team==='friendly'&&alive(u))){u.mp=4;u.ap=2;} // reset
 } // next round
} // enemyRound
