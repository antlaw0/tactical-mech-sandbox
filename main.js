import * as E from './engine.js?v=10';
import * as A from './audio.js?v=10';
const $=id=>document.getElementById(id);
let g,unitId,targetId,delay=0,cursor={x:1,y:7}; // cursor state
const active=()=>g.units.find(u=>u.id===unitId);
const target=()=>g.units.find(u=>u.id===targetId);
const squareAt=(x,y)=>$('board').querySelector('[data-square="'+E.key(x,y)+'"]');
let menuOrigin=null,keyboardLocked=false,actionTimer=0,lastAction='',batching=false; // keyboard exploration mode
function returnSquare(x=cursor.x,y=cursor.y){
 cursor={x,y};refreshCursor(false);if(keyboardLocked)$('cursorPad').focus({preventScroll:true});else squareAt(x,y)?.focus({preventScroll:true});
} // returnSquare
function closeActions(restore=true){
 const origin=menuOrigin;menuOrigin=null;
 if($('squareMenu').open)$('squareMenu').close();
 if(restore&&origin)returnSquare(origin.x,origin.y);
} // closeActions
function intelligence(u){
 const enemies=g.units.filter(v=>E.alive(v)&&v.team!==u.team);
 const visible=enemies.filter(v=>E.sight(u,v,g)).length;
 return u.name+', '+u.team+', armor '+u.hp+' of '+u.max+', movement '+u.mp+', actions '+u.ap+'. '+visible+' opposing mechs in sight. '+g.units.filter(v=>E.alive(v)&&v.id!==u.id).map(v=>v.team+' '+v.name+' at '+E.coord(v.x,v.y)+', armor '+v.hp+' of '+v.max+', movement '+v.mp+', actions '+v.ap+', '+(E.sight(u,v,g)?'in sight':'line of sight blocked')).join('; ')+'.';
} // intelligence
function attackReason(a,b,w){
 if(!a||!b||g.done||!E.alive(a)||!E.alive(b))return 'Combatant unavailable';
 const reasons=[],d=E.distance(a,b);
 if(a.ap<1)reasons.push('No action points remaining');
 if(d<w.min)reasons.push('Too close: range '+d+', minimum '+w.min);
 if(d>w.max)reasons.push('Out of range: range '+d+', maximum '+w.max);
 if(!E.sight(a,b,g))reasons.push(losText(a,b));
 return reasons.join('. ');
} // attackReason
function fireAt(a,b,w){
 delay=0;A.init();const result=E.fire(a,b,w,g);
 if(!result)return;
 batching=true;report(result,w.kind);finish();render();batching=false;
 const feedback=result+(g.done?' '+E.outcome(g):'');
 $('fireResult').textContent=feedback;announceAction(feedback);
} // fireAt
function openActions(x,y){
 if(g.done)return;
 const u=g.units.find(v=>E.alive(v)&&v.x===x&&v.y===y),a=active();
 menuOrigin={x,y};
 const dialog=$('squareMenu'),list=$('squareActions');
 $('squareMenuTitle').textContent=E.coord(x,y)+' actions'+(u?' for '+u.name:'');
 list.replaceChildren();
 function add(label,reason,run,keep=false){
  const button=document.createElement('button');button.type='button';
  button.textContent=label+(reason?'. Unavailable. '+reason:'. Available');
  if(reason)button.setAttribute('aria-disabled','true');
  button.onclick=()=>{
   if(reason){$('menuFeedback').textContent=reason;return;} // unavailable
   if(!keep)closeActions(false);
   run();
   if(!keep)returnSquare(x,y);
  }; // action
  list.append(button);
 } // add
 if(u&&u.team==='enemy'){
  targetId=u.id;render();
  for(const w of E.weapons){
   const damage=E.cover(u)?Math.floor(w.damage*.65):w.damage;
   add('Fire '+w.name+'. '+damage+' damage, 1 action point, '+(a?a.ap:0)+' remaining, '+(E.cover(u)?70:90)+' percent accuracy',attackReason(a,u,w),()=>fireAt(a,u,w));
  } // weapons
  add('Inspect target','',()=>{$('menuFeedback').textContent=intelligence(u)+' '+(a?describe(a,u):'');},true);
 }else if(u){
  add('Command '+u.name,'',()=>{unitId=u.id;render();report('Commanding '+u.name);});
  add('Inspect unit and detected mechs','',()=>{$('menuFeedback').textContent=intelligence(u);},true);
 } // entity actions
 add('End friendly round','',()=>{$('end').click();});
 const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel and return to '+E.coord(x,y);cancel.onclick=()=>closeActions();list.append(cancel);
 $('menuFeedback').textContent='';
 dialog.showModal();
 const rect=squareAt(x,y).getBoundingClientRect();
 const bounds=dialog.getBoundingClientRect();
 dialog.style.left=Math.max(4,Math.min(rect.left,window.innerWidth-bounds.width-4))+'px';
 dialog.style.top=Math.max(4,Math.min(rect.top,window.innerHeight-bounds.height-4))+'px';
 list.querySelector('button')?.focus({preventScroll:true});
} // openActions
function activateSquare(x,y){
 if(g.done)return;
 cursor={x,y};refreshCursor(false);
 const u=cursorUnit(),a=active(),type=E.terrain.get(E.key(x,y));
 if(u){
  if(u.team==='friendly'&&u.id!==unitId){unitId=u.id;render();report('Commanding '+u.name);returnSquare(x,y);}
  else openActions(x,y);
  return;
 } // unit activation
 if(type){report(E.coord(x,y)+'. '+type+'. Blocks movement and line of sight.');return;}
 if(a&&E.reachable(g,a).some(p=>p.x===x&&p.y===y)){moveTo(x,y);returnSquare(x,y);return;}
 const route=a?E.reachable(g,{...a,mp:100}).find(p=>p.x===x&&p.y===y):null;
 report(E.coord(x,y)+'. Cannot move. '+(route?'Requires '+route.cost+' movement points; '+a.mp+' remaining.':'No legal path.'));
} // activateSquare
function announceAction(msg){
 if(!msg)return;
 lastAction=msg;
 clearTimeout(actionTimer);
 $('actionSpeech').textContent='';
 $('cursorSpeech').textContent='';
 // Publish after synchronous rendering and focus restoration, including identical results.
 actionTimer=setTimeout(()=>{$('actionSpeech').textContent=msg;},140);
} // announceAction
function report(msg,sound=''){
 if(!msg)return;
 const li=document.createElement('li');li.textContent=msg;$('log').prepend(li);
 $('announcement').textContent=msg;
 if(!batching)announceAction(msg);
 if(sound){A.play(sound,delay);if(['gun','laser','missile'].includes(sound)){A.play(msg.includes('. Miss.')?'miss':'hit',delay+(sound==='missile'?.65:.35));delay+=.85;}else delay+=.35;} // sound sequence
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
 if(announce)$('cursorSpeech').textContent=keyboardLocked?(squareAt(cursor.x,cursor.y)?.getAttribute('aria-label')||msg):msg;
} // refreshCursor
function setCursor(x,y){
 if(x<0||x>9||y<0||y>9){$('cursorSpeech').textContent='Battlefield edge. '+E.coord(cursor.x,cursor.y);return;} // boundary
 cursor={x,y};refreshCursor(true);A.play('select');
} // setCursor
function selectCursor(restoreFocus=true){
 const u=cursorUnit();if(!u||g.done)return;
 if(u.team==='friendly')unitId=u.id;else targetId=u.id;
 render();report(u.team==='friendly'?'Commanding '+u.name:'Targeting '+u.name+'. '+$('targetInfo').textContent);if(restoreFocus===true)$('cursorPad').focus();
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
  btn.dataset.weapon=w.kind;
  btn.disabled=g.done||!a||!b||!E.canFire(a,b,w,g);
  btn.onclick=()=>{
   fireAt(a,b,w);
   const next=[...$('weapons').querySelectorAll('button')].find(el=>el.dataset.weapon===w.kind&&!el.disabled);
   if(next)next.focus();else $('fireResult').focus();
  }; // fire handler
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
 const board=$('board');
 const oldCells=new Map([...board.querySelectorAll('[data-square]')].map(el=>[el.dataset.square,el]));
 const firstBuild=oldCells.size===0;
 const blockers=a&&b?E.sightBlockers(a,b,g):[];
 function axis(label){
  const cell=document.createElement('span');cell.className='axis';cell.setAttribute('aria-hidden','true');cell.textContent=label;board.append(cell);
 } // axis
 if(firstBuild){axis('');for(let x=0;x<10;x++)axis(String(x+1));} // axis header 
 for(let y=0;y<10;y++){
 if(firstBuild)axis(String.fromCharCode(65+y));
 for(let x=0;x<10;x++){
  const cell=oldCells.get(E.key(x,y))||document.createElement('button'),u=g.units.find(u=>E.alive(u)&&u.x===x&&u.y===y);
  cell.className=u?u.team+(u.id===unitId?' selected':''):E.walls.has(E.key(x,y))?'wall':'empty';
  if(u&&u.id===targetId)cell.classList.add('targeted');
  if(blockers.some(p=>p.x===x&&p.y===y))cell.classList.add('los-blocker');
  const type=E.terrain.get(E.key(x,y));
  if(type)cell.classList.add(type==='rock'?'rock':type==='scrap barricade'?'scrap':'barrier');
  cell.dataset.square=E.key(x,y);
  cell.type='button';
  const p=dest.find(p=>p.x===x&&p.y===y);
  const mode=$('verbosity').value;
  const short=E.coord(x,y)+', '+(u?(u.team==='friendly'?'friendly ':'enemy ')+u.name+(u.id===unitId?', active':u.id===targetId?', targeted':''):type||'open');
  const description=mode==='brief'?short:u?short+'. Armor '+u.hp+' of '+u.max+'. Movement '+u.mp+'. Actions '+u.ap+'. '+(a&&u.team==='enemy'?describe(a,u):'')+(mode==='full'?'. '+intelligence(u):''):short+(p?', reachable, cost '+p.cost:!type?', not reachable':'');
  cell.setAttribute('aria-label',description);
  cell.onfocus=()=>{cursor={x,y};refreshCursor(false);}; // keyboard focus
  cell.onclick=()=>activateSquare(x,y); // contextual activation
  cell.onkeydown=event=>{
   const d={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[event.key];
   if(d){event.preventDefault();const next=board.querySelector('[data-square="'+E.key(x+d[0],y+d[1])+'"]');if(next)next.focus();}
  }; // native button keyboard exploration
  cell.removeAttribute('title');
  const mark=document.createElement('span');mark.className='tile-mark';mark.setAttribute('aria-hidden','true');mark.textContent=u?u.name[0]:type?(type==='rock'?'R':type==='scrap barricade'?'S':'B'):E.coord(x,y);cell.replaceChildren(mark);if(firstBuild)board.append(cell);
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
 keyboardLocked=false;$('cursorPad').classList.remove('locked');clearTimeout(actionTimer);lastAction='';$('actionSpeech').textContent='';
 g=E.newGame();cursor={x:1,y:7};unitId='atlas';targetId='reaper';delay=0;$('log').replaceChildren();$('fireResult').textContent='';$('scanResult').textContent='';$('setup').hidden=true;$('game').hidden=false;document.body.classList.add('in-mission');$('missionControls').append($('audioSettings'));render();report('Mission started. Round 1. Explore the battlefield.','turn');$('board').querySelector('[data-square="1,7"]').focus();
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
 if(g.done)return;delay=0;const entries=[];batching=true;
 E.enemyRound(g,(msg,sound)=>{entries.push(msg);report(msg,sound);});
 finish();render();
 if(!g.done){report('Round '+g.round+'. Friendly turn.','turn');$('announcement').textContent=entries.join(' ')+' Round '+g.round+'. Friendly turn.';if(keyboardLocked)returnSquare();else $('unit').focus();}
 else {$('announcement').textContent=entries.join(' ')+' '+E.outcome(g);if(keyboardLocked)leaveKeyboardMode();$('restart').focus();} // round end focus
 batching=false;announceAction($('announcement').textContent);
}; // enemy round

$('cursorPad').addEventListener('keydown',event=>{
 const dirs={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}; // directions
 const d=dirs[event.key];
 if(event.key==='Escape'||event.key==='Tab'){leaveKeyboardMode(event.key==='Tab'&&event.shiftKey);event.preventDefault();return;} // explicit exit
 if(d){event.preventDefault();setCursor(cursor.x+d[0],cursor.y+d[1]);}
 else if(event.key==='Enter'){event.preventDefault();activateSquare(cursor.x,cursor.y);}
 else if(event.key==='F1'){event.preventDefault();$('cursorSpeech').textContent=$('keyboardHelp').textContent;}
 else if(event.key.toLowerCase()==='r'&&!event.altKey&&!event.ctrlKey&&!event.metaKey){event.preventDefault();announceAction(lastAction||'No action result yet.');}
 else if(event.key==='Home'){event.preventDefault();const a=active();if(a)setCursor(a.x,a.y);} // return to active
}); // keyboard navigation
for(const btn of $('cursorDirections').querySelectorAll('button')){
 btn.onclick=()=>{const [dx,dy]=btn.dataset.cursorDir.split(',').map(Number);setCursor(cursor.x+dx,cursor.y+dy);}; // mobile navigation
} // directional buttons
$('cursorHome').onclick=()=>{const a=active();if(a)returnSquare(a.x,a.y);}; // jump home
$('cursorTarget').onclick=()=>{const b=target();if(b)setCursor(b.x,b.y);}; // jump target
$('cursorSelect').onclick=()=>selectCursor();
$('cursorMove').onclick=()=>{moveTo(cursor.x,cursor.y);$('cursorPad').focus();}; // explicit move

$('verbosity').onchange=()=>{if(g)render();}; // tile detail level
$('returnSquare').onclick=()=>returnSquare();
$('squareMenu').addEventListener('cancel',event=>{event.preventDefault();closeActions();}); // Escape
$('squareMenu').addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
 const items=[...$('squareActions').querySelectorAll('button')];
 const i=items.indexOf(document.activeElement);
 event.preventDefault();items[(i+(event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1)+items.length)%items.length]?.focus();
}); // menu keyboard

function audioStatus(){
 const status=A.status();if($('audioStatus').textContent!==status)$('audioStatus').textContent=status;
} // audioStatus
window.addEventListener('gameaudiochange',audioStatus);
document.addEventListener('click',()=>{if($('sound').checked)A.init().then(audioStatus);},true); // trusted activation, including VoiceOver clicks
$('testSound').onclick=()=>{
 $('sound').checked=true;A.settings(true,Number($('volume').value)/100);
 A.init().then(ok=>{audioStatus();if(ok)A.play('test');else $('audioStatus').textContent='Audio could not start. Try activating Test sound again.';});
}; // test audio
$('sound').addEventListener('change',audioStatus);

function enterKeyboardMode(){
 if(!g||$('game').hidden)return;
 if($('squareMenu').open)closeActions(false);
 keyboardLocked=true;$('cursorPad').classList.add('locked');
 $('cursorPad').focus({preventScroll:true});
 $('cursorSpeech').textContent=squareAt(cursor.x,cursor.y)?.getAttribute('aria-label')||E.coord(cursor.x,cursor.y);
} // enterKeyboardMode
function leaveKeyboardMode(backward=false){
 keyboardLocked=false;$('cursorPad').classList.remove('locked');
 (backward?$('returnSquare'):$('keyboardMode')).focus({preventScroll:true});
 $('cursorSpeech').textContent='Battlefield keyboard mode exited.';
} // leaveKeyboardMode
$('keyboardMode').onclick=enterKeyboardMode;
$('cursorPad').addEventListener('focus',()=>{keyboardLocked=true;$('cursorPad').classList.add('locked');}); // keyboard mode entry
$('cursorPad').addEventListener('blur',()=>{
 // A contextual dialog temporarily takes focus. Preserve mode until it closes.
 if(!$('squareMenu').open&&!menuOrigin){keyboardLocked=false;$('cursorPad').classList.remove('locked');} // ordinary focus departure
}); // blur
document.addEventListener('keydown',event=>{
 if(!g||$('game').hidden)return;
 if(event.altKey&&event.shiftKey&&!event.ctrlKey&&!event.metaKey&&event.code==='KeyG'){
  event.preventDefault();enterKeyboardMode();
 } // shortcut
},true); // global keyboard shortcut

$('repeatAction').onclick=()=>announceAction(lastAction||'No action result yet.'); // repeat result

$('showKeyboardHelp').onclick=()=>{$('cursorSpeech').textContent=$('keyboardHelp').textContent;}; // on-demand instructions
