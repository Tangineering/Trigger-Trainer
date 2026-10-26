// Reference SVG diagrams for the drill picker (D-93..D-98). Mockup source, not loaded by the app:
// WQ-027..WQ-029 port the strings into index.html. Each export is a 360x200 SVG string.
// Rendered examples: picker-*.png in this folder (Playwright screenshots of the start screen with the picker injected).
// SVG diagrams for the drill picker mockup (viewBox 360x200).
const C = { safe:'#2fbf71', warn:'#f0a020', bad:'#e5484d', trig:'#3b82f6', ink:'#e9ecef', muted:'#9aa3ad', line:'#2c3138', steel:'#4c535c', frame:'#24282e' };
const T = (x,y,s,o={}) => `<text x="${x}" y="${y}" font-size="${o.fs||11}" fill="${o.c||C.ink}" text-anchor="${o.a||'start'}" font-weight="${o.w||400}" font-family="system-ui,sans-serif">${s}</text>`;
const defs = `<defs>${['safe','warn','muted','trig','bad'].map(k=>`<marker id="ah-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${C[k]}"/></marker>`).join('')}</defs>`;
// side view of the phone-as-pistol: muzzle at +x
const gun = (x,y,rot,{w=120,h=56,finger='frame',dim=false}={}) => {
  const op = dim ? .35 : 1;
  const fr = finger==='frame' ? `<rect x="${w*.28}" y="${-h*.22}" width="${w*.6}" height="${h*.16}" rx="${h*.08}" fill="#d8dde2" opacity=".9"/>` :
    `<rect x="${w*.02}" y="${-h*.04}" width="${w*.3}" height="${h*.16}" rx="${h*.08}" fill="#d8dde2" opacity=".9" transform="rotate(14 ${w*.3} ${h*.04})"/>`;
  return `<g transform="translate(${x},${y}) rotate(${rot})" opacity="${op}">
    <rect x="0" y="${-h/2}" width="${w}" height="${h}" rx="8" fill="${C.frame}" stroke="${C.steel}" stroke-width="1.5"/>
    <line x1="${w*.25}" y1="${-h*.14}" x2="${w*.92}" y2="${-h*.14}" stroke="${C.safe}" stroke-width="2" stroke-dasharray="5 4"/>
    <circle cx="${w*.32}" cy="${h*.1}" r="${h*.11}" fill="none" stroke="${C.trig}" stroke-width="2"/>
    ${fr}
    <path d="M${w+4},0 l10,0" stroke="${C.muted}" stroke-width="2" marker-end="url(#ah-muted)"/>
  </g>`;
};
const target = (x,y,r,holes=[]) => `<g>${[1,.66,.33].map((k,i)=>`<circle cx="${x}" cy="${y}" r="${r*k}" fill="${i==2?'#3a2a2b':'none'}" stroke="${C.muted}" stroke-width="1.2"/>`).join('')}${holes.map(([dx,dy])=>`<circle cx="${x+dx}" cy="${y+dy}" r="2.6" fill="${C.ink}"/>`).join('')}</g>`;
const svg = body => `<svg viewBox="0 0 360 200" xmlns="http://www.w3.org/2000/svg">${defs}${body}</svg>`;

// three short beeps (the move / back-to-low-ready cue) and the completion tone, as legend icons
const beeps3 = (x,y) => [0,9,18].map(d=>`<rect x="${x+d}" y="${y-6}" width="5" height="12" rx="1.5" fill="${C.warn}"/>`).join('');
const done = (x,y) => `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${C.safe}" stroke-width="2"/><path d="M${x-4},${y} l3,3 l5,-6" fill="none" stroke="${C.safe}" stroke-width="2"/>`;
const freestyle = svg(`
  ${T(90,18,'MOVING',{c:C.safe,w:700,a:'middle'})}
  ${gun(30,75,0,{finger:'frame'})}
  <path d="M28,118 q60,22 124,0" fill="none" stroke="${C.safe}" stroke-width="1.6" stroke-dasharray="4 3" marker-start="url(#ah-safe)" marker-end="url(#ah-safe)"/>
  ${T(90,146,'Finger flat on the frame',{a:'middle'})}${T(90,160,'— move freely',{a:'middle',c:C.muted})}
  <line x1="180" y1="10" x2="180" y2="168" stroke="${C.line}"/>
  ${T(270,18,'STILL',{c:C.trig,w:700,a:'middle'})}
  ${gun(205,75,0,{finger:'trigger'})}
  <path d="M252,108 l-20,0" stroke="${C.trig}" stroke-width="2" marker-end="url(#ah-trig)"/>${T(256,112,'pull back',{fs:10,c:C.trig})}
  ${T(270,146,'Sights on, phone still:',{a:'middle'})}${T(270,160,'finger to trigger, pull back',{a:'middle',c:C.muted})}
  <rect x="40" y="174" width="280" height="22" rx="6" fill="#2a1416" stroke="${C.bad}"/>
  ${T(180,189,'Phone moves with finger off the frame → ALARM',{a:'middle',c:C.bad,fs:10.5})}`);

const lr = svg(`
  ${target(196,44,16)}
  <line x1="150" y1="44" x2="178" y2="44" stroke="${C.muted}" stroke-width="1" stroke-dasharray="2 4"/>
  ${gun(52,44,0,{w:84,h:34,finger:'trigger'})}
  ${gun(52,140,0,{w:84,h:34,finger:'frame'})}
  <line x1="150" y1="140" x2="178" y2="140" stroke="${C.muted}" stroke-width="1" stroke-dasharray="2 4"/>
  <path d="M162,124 L162,70" stroke="${C.safe}" stroke-width="2" marker-end="url(#ah-safe)"/>
  <path d="M34,66 L34,118" stroke="${C.muted}" stroke-width="1.6" stroke-dasharray="4 3" marker-end="url(#ah-muted)"/>
  ${T(174,100,'raise',{fs:10,c:C.safe})}${T(40,96,'down',{fs:10,c:C.muted})}
  ${T(94,178,'Low ready: muzzle still downrange,',{a:'middle',fs:9.5,c:C.muted})}${T(94,190,'gun lowered, finger on frame',{a:'middle',fs:9.5,c:C.muted})}
  ${T(222,18,'1  Low ready, finger on',{fs:10.5})}
  ${T(236,32,'the frame',{fs:10.5,c:C.muted})}${T(222,48,'2  Beep: raise, fire 2',{fs:10.5,c:C.warn})}
  ${T(222,64,'3  Finger back on frame',{fs:10.5})}
  ${beeps3(236,77)}${T(264,81,'¾ s later:',{fs:10.5,c:C.muted})}
  ${T(236,97,'back to low ready',{fs:10.5,c:C.warn})}
  ${T(222,121,'4  Next beep in 2–5 s',{fs:10.5})}
  ${T(222,145,'↻ 5 reps',{fs:10.5,w:700})}
  ${done(229,166)}${T(244,170,'Finish tone after rep 5',{fs:10.5,c:C.safe})}`);

const P = [[60,158],[60,62],[180,62],[180,158]];
const box = svg(`
  ${T(120,14,'▲ DOWNRANGE',{a:'middle',c:C.muted,fs:10,w:600})}
  ${target(85,30,11)}${target(155,30,11)}
  ${P.map((p,i)=>{const q=P[(i+1)%4];const dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy),ux=dx/L,uy=dy/L;
    return `<line x1="${p[0]+ux*20}" y1="${p[1]+uy*20}" x2="${q[0]-ux*22}" y2="${q[1]-uy*22}" stroke="${C.safe}" stroke-width="2" stroke-dasharray="6 4" marker-end="url(#ah-safe)"/>`}).join('')}
  ${P.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="15" fill="#0f1113" stroke="${C.warn}" stroke-width="2"/>${T(p[0],p[1]+4.5,i?i+1:'1·5',{a:'middle',w:700,fs:i?13:10.5})}`).join('')}
  ${T(120,106,'Start at 1, clockwise,',{a:'middle',c:C.muted,fs:10})}${T(120,119,'finish back at 1',{a:'middle',c:C.muted,fs:10})}
  <circle cx="236" cy="30" r="9" fill="#0f1113" stroke="${C.warn}" stroke-width="2"/>
  ${T(254,27,'At each spot:',{fs:10.5})}${T(254,40,'fire 2 or more',{fs:10.5,c:C.muted})}
  ${beeps3(222,72)}
  ${T(254,69,'Finger back on frame',{fs:10.5})}${T(254,82,'→ 3 beeps: move',{fs:10.5,c:C.warn})}
  <line x1="222" y1="112" x2="248" y2="112" stroke="${C.safe}" stroke-width="2" stroke-dasharray="6 4"/>
  ${T(254,109,'Move at your pace,',{fs:10.5})}${T(254,122,'finger on the frame',{fs:10.5,c:C.muted})}
  ${done(231,152)}
  ${T(254,149,'Back at 1: 2+ shots,',{fs:10.5})}${T(254,162,'frame → finish tone',{fs:10.5,c:C.safe})}
  ${T(180,192,'Trigger touch while moving → ALARM',{fs:10,c:C.bad,a:'middle'})}`);

const xs=[118,154,186,218,250,282]; 
const bill = svg(`
  <line x1="20" y1="58" x2="340" y2="58" stroke="${C.steel}" stroke-width="2"/>
  <path d="M22,50 h6 l8,-7 v30 l-8,-7 h-6z" fill="${C.warn}"/><path d="M40,50 q5,8 0,16" fill="none" stroke="${C.warn}" stroke-width="1.6"/>
  ${T(32,84,'BEEP',{a:'middle',c:C.warn,w:700,fs:10})}${T(32,97,'0.00',{a:'middle',c:C.muted,fs:10})}
  ${xs.map((x,i)=>`<line x1="${x}" y1="44" x2="${x}" y2="72" stroke="${C.bad}" stroke-width="3"/>${T(x,38,i+1,{a:'middle',w:700,fs:11})}`).join('')}
  <path d="M50,66 L${xs[0]-4},66" stroke="${C.muted}" stroke-width="1.2" marker-start="url(#ah-muted)" marker-end="url(#ah-muted)"/>
  ${T(78,84,'first shot',{a:'middle',fs:10})}${T(78,97,'1.62 s',{a:'middle',fs:10,c:C.muted})}
  ${xs.slice(1).map((x,i)=>T((x+xs[i])/2,84,['.31','.27','.29','.26','.28'][i],{a:'middle',fs:10,c:C.muted})).join('')}
  ${T(200,97,'splits (s)',{a:'middle',fs:10})}${T(330,84,'total',{a:'end',fs:10})}${T(330,97,'2.03 s',{a:'end',fs:10,c:C.muted})}
  ${target(70,150,38,[[-4,-3],[3,-6],[6,2],[-2,5],[9,-1],[-8,1]])}
  ${T(124,134,'On the beep: six shots, one target.')}
  ${T(124,150,'As fast as you can while the phone',{c:C.muted})}
  ${T(124,164,'stays still. Full trigger reset each shot.',{c:C.muted})}
  ${done(130,180)}${T(144,184,'Finger back on frame → finish tone',{c:C.safe,fs:10.5})}`);

// Transitions (mockup for the next queue item): low ready, one beep, five pairs of two shots across targets;
// from the first to the tenth shot movement with the finger on the trigger does not alarm.
const TX=[62,180,298];
const pairX=[96,148,200,252,304];
const transitions = svg(`
  ${T(180,12,'▲ DOWNRANGE',{a:'middle',c:C.muted,fs:9.5,w:600})}
  ${TX.map(x=>target(x,40,15)).join('')}
  ${T(62,70,'pairs 1 · 5',{a:'middle',fs:9.5,c:C.muted})}${T(180,70,'pairs 2 · 4',{a:'middle',fs:9.5,c:C.muted})}${T(298,70,'pair 3',{a:'middle',fs:9.5,c:C.muted})}
  <path d="M84,32 Q121,14 156,32" fill="none" stroke="${C.trig}" stroke-width="2" stroke-dasharray="5 3" marker-end="url(#ah-trig)"/>
  <path d="M202,32 Q239,14 274,32" fill="none" stroke="${C.trig}" stroke-width="2" stroke-dasharray="5 3" marker-end="url(#ah-trig)"/>
  <path d="M274,50 Q239,64 204,50" fill="none" stroke="${C.trig}" stroke-width="1.4" stroke-dasharray="3 3" stroke-opacity=".7" marker-end="url(#ah-trig)"/>
  <path d="M156,50 Q121,64 86,50" fill="none" stroke="${C.trig}" stroke-width="1.4" stroke-dasharray="3 3" stroke-opacity=".7" marker-end="url(#ah-trig)"/>
  ${T(180,86,'Transition with the finger on the trigger',{a:'middle',fs:10,c:C.trig})}
  <rect x="${pairX[0]-10}" y="98" width="${pairX[4]+22-pairX[0]}" height="40" rx="6" fill="${C.trig}" fill-opacity=".14" stroke="${C.trig}" stroke-width="1.2"/>
  <line x1="14" y1="124" x2="346" y2="124" stroke="${C.steel}" stroke-width="2"/>
  <path d="M18,118 h5 l7,-6 v24 l-7,-6 h-5z" fill="${C.warn}"/>
  ${T(26,150,'BEEP',{a:'middle',c:C.warn,w:700,fs:9.5})}
  ${pairX.map((x,i)=>`<line x1="${x}" y1="114" x2="${x}" y2="134" stroke="${C.bad}" stroke-width="3"/><line x1="${x+12}" y1="114" x2="${x+12}" y2="134" stroke="${C.bad}" stroke-width="3"/>${T(x+6,110,i+1,{a:'middle',w:700,fs:10})}`).join('')}
  ${pairX.slice(1).map((x,i)=>`<path d="M${pairX[i]+16},128 Q${(pairX[i]+12+x)/2},120 ${x-4},128" fill="none" stroke="${C.trig}" stroke-width="1.4"/>`).join('')}
  ${T(200,150,'movement on the trigger allowed: shot 1 → shot 10',{a:'middle',fs:9.5,c:C.trig})}
  ${T(50,104,'normal',{a:'middle',fs:9,c:C.muted})}${T(50,114,'alarms',{a:'middle',fs:9,c:C.muted})}
  ${T(336,104,'normal',{a:'middle',fs:9,c:C.muted})}${T(336,114,'alarms',{a:'middle',fs:9,c:C.muted})}
  ${T(14,172,'Low ready, finger on the frame → beep → raise,',{fs:10.5})}
  ${T(14,186,'two shots per target, five pairs',{fs:10.5,c:C.muted})}
  ${done(262,180)}${T(276,177,'Finger on frame',{fs:10,c:C.safe})}${T(276,189,'→ finish tone',{fs:10,c:C.safe})}`);

module.exports = { freestyle, box, bill, lr, transitions };
