// Native Web Audio synthesis: no remote dependency or audio assets.
let ctx,master,enabled=true,level=.35;
export async function init(){
 try{
  if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.gain.value=enabled?level:0;master.connect(ctx.destination);} // create audio graph
  await ctx.resume();
 }catch(e){console.warn('Audio unavailable',e);} // graceful fallback
} // init
export function settings(on,vol){
 enabled=on;level=vol;if(master)master.gain.value=on?vol:0;
} // settings
function tone(f,end,duration,vol,type='sine',delay=0){
 const t=ctx.currentTime+delay,o=ctx.createOscillator(),g=ctx.createGain();
 o.type=type;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(end,t+duration);
 g.gain.setValueAtTime(.001,t);g.gain.exponentialRampToValueAtTime(vol,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+duration);
 o.connect(g);g.connect(master);o.start(t);o.stop(t+duration+.01);
} // tone
function noise(duration,vol,freq,delay=0){
 const t=ctx.currentTime+delay,b=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*duration),ctx.sampleRate),a=b.getChannelData(0);
 for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;
 const s=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();s.buffer=b;f.type='lowpass';f.frequency.value=freq;
 g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.001,t+duration);s.connect(f);f.connect(g);g.connect(master);s.start(t);
} // noise
export function play(kind,delay=0){
 if(!enabled||!ctx||ctx.state!=='running')return;
 switch(kind){
 case 'move':tone(90,40,.18,.23,'triangle',delay);noise(.16,.15,350,delay);break;
 case 'gun':for(let i=0;i<3;i++)noise(.12,.35,1500,delay+i*.09);break;
 case 'laser':tone(1400,180,.34,.2,'sawtooth',delay);break;
 case 'missile':noise(.55,.3,850,delay);tone(110,45,.6,.22,'triangle',delay+.15);break;
 case 'victory': [440,554,659,880].forEach((f,i)=>tone(f,f,.3,.16,'triangle',delay+i*.15));break;
 case 'defeat':tone(220,50,.7,.16,'triangle',delay);break;
 case 'turn':tone(520,780,.16,.15,'sine',delay);break;
 case 'select':tone(700,950,.08,.09,'sine',delay);break;
 } // switch
} // play
