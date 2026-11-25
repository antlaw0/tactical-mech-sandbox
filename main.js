import * as E from './engine.js?v=3';
import * as A from './audio.js';
const $=id=>document.getElementById(id);
let g,unitId,targetId,delay=0,cursor={x:1,y:7}; // cursor state
const active=()=>g.units.find(u=>u.id===unitId);
const target=()=>g.units.find(u=>u.id===targetId);
function report(msg,sound=''){
 if(!msg)return;
 const li=document.createElement('li');li.textContent=msg;$('log').prepend(li);
 $('announcement').textContent=msg;
 if(sound){A.play(sound,delay);delay+=.35;} // sound sequence
} // report
function options(el,items,selected){
 el.replaceChildren();
 for(const [value,label] of items){
  const o=document.createElement('option');o.value=value;o.textContent=label;el.append(o);
 } // options loop
 if(items.some(i=>i[0]===selected))el.value=selected;
} // options
function relative(a,b){
 const dx=b.x-a.x,dy=b.y-a.y;
 return [dy?Math.abs(dy)+' '+(dy<0?'north':'south'):'',dx?Math.abs(dx)+' '+(dx<0?'west':'east'):''].filter(Boolean).join(', ')||'same square';
} // relative
function losText(a,b){
 const blockers=E.sightBlockers(a,b,g);
 return blockers.length?'Line of sight blocked by '+blockers.map(p=>p.type+' at '+E.coord(p.x,p.y)).join('; '):'Clear line of sight';
} // losText
function describe(a,b){
 return b.name+', '+E.coord(b.x,b.y)+', '+relative(a,b)+', range '+E.distance(a,b)+', '+b.hp+' of '+b.max+' armor, '+losText(a,b)+', '+(E.cover(b)?'cover':'open');
} // describe
function cursorUnit(){
 return g.units.find(u=>E.alive(u)&&u.x===cursor.x&&u.y===cursor.y);
} // cursorUnit
function refreshCursor(announce=false){
 const u=cursorUnit(),a=active(),b=target(),type=E.terrain.get(E.key(cursor.x,cursor.y));
 const p=a&&!g.done?E.reachable(g,a).find(p=>p.x===cursor.x&&p.y===cursor.y):null;
 const parts=[E.coord(cursor.x,cursor.y),u?u.team+' mech '+u.name+', armor '+u.hp+' of '+u.max:type||'open ground'];
 if(a&&u!==a)parts.push(relative(a,cursor)+' of '+a.name);
 if(p)parts.push('reachable, movement cost '+p.cost,E.cover(cursor)?'cover':'no cover');
 else if(!u&&!type&&a)parts.push('not reachable this turn');
 if(p&&b)parts.push(losText({...a,...cursor},b));
 const msg=parts.join('. ')+'.';
 $('cursorInfo').textContent=msg;
 $('cursorMove').disabled=!p;
 $('cursorSelect').disabled=g.done||!u;
 $('cursorSelect').textContent=u?(u.team==='friendly'?'Command '+u.name:'Target '+u.name):'Select unit at cursor';
 for(const cell of $('board').querySelectorAll('[data-square]')){
  cell.classList.toggle('cursor',cell.dataset.square===E.key(cursor.x,cursor.y));
 } // visual cursor
 if(announce)$('cursorSpeech').textContent=msg;
} // refreshCursor
function setCursor(x,y){
 if(x<0||x>9||y<0||y>9){$('cursorSpeech').textContent='Battlefield edge. '+E.coord(cursor.x,cursor.y);return;} // boundary
 cursor={x,y};refreshCursor(true);A.play('select');
} // setCursor
function selectCursor(){
 const u=cursorUnit();if(!u||g.done)return;
 if(u.team==='friendly')unitId=u.id;else targetId=u.id;
 render();report(u.team==='friendly'?'Commanding '+u.name:'Targeting '+u.name+'. '+$('targetInfo').textContent);$('cursorPad').focus();
} // selectCursor
function render(){
 const friends=g.units.filter(u=>u.team==='friendly'&&E.alive(u)), enemies=g.units.filter(u=>u.team==='enemy'&&E.alive(u));
 options($('unit'),friends.map(u=>[u.id,u.name]),unitId);unitId=$('unit').value;
 options($('target'),enemies.map(u=>[u.id,u.name]),targetId);targetId=$('target').value;
 const a=active(),b=target(),end=E.outcome(g);
 g.done=!!end;$('round').textContent=end||'Round '+g.round;
 $('stats').textContent=a?a.name+' at '+E.coord(a.x,a.y)+'. Armor '+a.hp+' of '+a.max+'. Movement '+a.mp+'. Actions '+a.ap+'.':'No surviving friendly units.';
 $('targetInfo').textContent=a&&b?describe(a,b):'No target available.';
 const buttons=$('weapons');buttons.replaceChildren();
 for(const w of E.weapons){
  const btn=document.createElement('button');btn.textContent=w.name+' (range '+w.min+' to '+w.max+', damage '+w.damage+')';
  btn.disabled=g.done||!a||!b||!E.canFire(a,b,w,g);
  btn.onclick=()=>{delay=0;report(E.fire(a,b,w,g),w.kind);finish();render();$('target').focus();}; // fire handler
  buttons.append(btn);
 } // weapons
 const dest=a&&!g.done?E.reachable(g,a):[];
 const clear= a&&b?dest.filter(p=>E.sight({...a,...p},b,g)):[];
 const firing=clear.filter(p=>E.weapons.some(w=>E.distance(p,b)>=w.min&&E.distance(p,b)<=w.max));
 $('losAdvice').textContent=a&&b&&!g.done?(clear.length?'Reachable positions with clear line of sight: '+clear.map(p=>E.coord(p.x,p.y)).join(', ')+'. '+(firing.length?'Within at least one weapon range: '+firing.map(p=>E.coord(p.x,p.y)).join(', ')+'.':'None within weapon range.'):'No reachable position has clear line of sight to '+b.name+'.'):'';
 const old=$('destination').value;
 options($('destination'),dest.map(p=>[E.key(p.x,p.y),E.coord(p.x,p.y)+', '+relative(a,p)+', cost '+p.cost+', '+(E.cover(p)?'cover':'open')+(b?', '+losText({...a,...p},b):'')]),old);
 $('move').disabled=!dest.length;
 for(const btn of $('directions').querySelectorAll('button')){
  const [dx,dy]=btn.dataset.dir.split(',').map(Number);
  btn.disabled=g.done||!a||!dest.some(p=>p.x===a.x+dx&&p.y===a.y+dy&&p.cost===1);
 } // direction controls
 $('end').disabled=g.done;$('unit').disabled=!friends.length||g.done;$('target').disabled=!enemies.length||g.done;
 $('destination').disabled=!dest.length;
 const board=$('board');board.replaceChildren();
 const blockers=a&&b?E.sightBlockers(a,b,g):[];
 function axis(label){
  const cell=document.createElement('span');cell.className='axis';cell.textContent=label;board.append(cell);
 } // axis
 axis('');for(let x=0;x<10;x++)axis(String(x+1)); 
 for(let y=0;y<10;y++){
 axis(String.fromCharCode(65+y));
 for(let x=0;x<10;x++){
  const cell=document.createElement('span'),u=g.units.find(u=>E.alive(u)&&u.x===x&&u.y===y);
  cell.className=u?u.team+(u.id===unitId?' selected':''):E.walls.has(E.key(x,y))?'wall':'empty';
  if(u&&u.id===targetId)cell.classList.add('targeted');
  if(blockers.some(p=>p.x===x&&p.y===y))cell.classList.add('los-blocker');
  const type=E.terrain.get(E.key(x,y));
  if(type)cell.classList.add(type==='rock'?'rock':type==='scrap barricade'?'scrap':'barrier');
  cell.dataset.square=E.key(x,y);
  cell.onclick=()=>{setCursor(x,y);}; // pointer exploration
  cell.title=E.coord(x,y)+': '+(u?u.name:type||'open ground');
  cell.textContent=u?u.name[0]:type? (type==='rock'?'R':type==='scrap barricade'?'S':'B'):E.coord(x,y);board.append(cell);
 } // board cells
 } // board rows
 refreshCursor();
} // render
function finish(){
 const end=E.outcome(g);if(end&&!g.done){g.done=true;report(end,end.startsWith('Victory')?'victory':'defeat');} // end
} // finish
function moveTo(x,y){
 delay=0;const a=active();if(!g.done&&a&&E.move(g,a,x,y)){report(a.name+' moves to '+E.coord(x,y)+'. Movement remaining '+a.mp+'.','move');render();if(document.activeElement.disabled)$('unit').focus();} // movement
} // moveTo
function start(){
 g=E.newGame();cursor={x:1,y:7};unitId='atlas';targetId='reaper';delay=0;$('log').replaceChildren();$('scanResult').textContent='';$('setup').hidden=true;$('game').hidden=false;render();report('Mission started. Round 1. Explore the battlefield using arrow keys.','turn');$('cursorPad').focus();
} // start
$('start').onclick=()=>{A.init();start();}; // start button
$('restart').onclick=start;
$('sound').onchange=()=>A.settings($('sound').checked,Number($('volume').value)/100);
$('volume').oninput=$('sound').onchange;
$('unit').onchange=()=>{unitId=$('unit').value;A.play('select');render();report($('stats').textContent);}; // unit selection
$('target').onchange=()=>{targetId=$('target').value;A.play('select');render();report($('targetInfo').textContent);}; // target selection
$('move').onclick=()=>moveTo(...$('destination').value.split(',').map(Number));
for(const btn of $('directions').querySelectorAll('button'))btn.onclick=()=>{const [dx,dy]=btn.dataset.dir.split(',').map(Number),a=active();moveTo(a.x+dx,a.y+dy);}; // direction handler
$('scan').onclick=()=>{
 const a=active();const msg='Round '+g.round+'. '+g.units.filter(E.alive).map(u=>a?describe(a,u):u.name+' at '+E.coord(u.x,u.y)).join('. ')+'.';
 $('scanResult').textContent=msg;report(msg);
}; // scan
$('terrain').onclick=()=>{
 const a=active();if(!a)return;
 const msg='Obstacles near '+a.name+': '+[...E.walls].map(k=>{const [x,y]=k.split(',').map(Number);return {x,y};}).filter(p=>E.distance(a,p)<=4).map(p=>E.terrain.get(E.key(p.x,p.y))+' at '+E.coord(p.x,p.y)+', '+relative(a,p)).join('; ')+'. '+E.reachable(g,a).length+' reachable destinations.';
 $('scanResult').textContent=msg;report(msg);
}; // terrain
$('end').onclick=()=>{
 if(g.done)return;delay=0;const entries=[];
 E.enemyRound(g,(msg,sound)=>{entries.push(msg);report(msg,sound);});
 finish();render();
 if(!g.done){report('Round '+g.round+'. Friendly turn.','turn');$('announcement').textContent=entries.join(' ')+' Round '+g.round+'. Friendly turn.';$('unit').focus();}
 else {$('announcement').textContent=entries.join(' ')+' '+E.outcome(g);$('restart').focus();} // round end focus
}; // enemy round

$('cursorPad').addEventListener('keydown',event=>{
 const dirs={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}; // directions
 const d=dirs[event.key];
 if(d){event.preventDefault();setCursor(cursor.x+d[0],cursor.y+d[1]);}
 else if(event.key==='Enter'){event.preventDefault();selectCursor();}
 else if(event.key==='Home'){event.preventDefault();const a=active();if(a)setCursor(a.x,a.y);} // return to active
}); // keyboard navigation
for(const btn of $('cursorDirections').querySelectorAll('button')){
 btn.onclick=()=>{const [dx,dy]=btn.dataset.cursorDir.split(',').map(Number);setCursor(cursor.x+dx,cursor.y+dy);}; // mobile navigation
} // directional buttons
$('cursorHome').onclick=()=>{const a=active();if(a)setCursor(a.x,a.y);}; // jump home
$('cursorTarget').onclick=()=>{const b=target();if(b)setCursor(b.x,b.y);}; // jump target
$('cursorSelect').onclick=selectCursor;
$('cursorMove').onclick=()=>{moveTo(cursor.x,cursor.y);$('cursorPad').focus();}; // explicit move
