const wrap = document.getElementById("mindmap-container");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// === Minimalist Gradient Scheme ===
const gradientStart = "#00BCD4";   // cyan — human / interaction
const gradientEnd   = "#7C4DFF";   // violet — AI / creativity
const labelColor    = "#f2f2f4";

// === Map Structure ===
const mindmapData = [
  { text: "HCI", connections: [
    "IUI","Human-Centered AI","Sketching","Multimodal Interaction",
    "Generative AI","Hybrid Intelligence","Co-Creative Systems","Creativity"
  ]},
  { text: "IUI", connections: ["HCI","Multimodal Interaction","Sketching"] },
  { text: "Multimodal Interaction", connections: ["HCI","IUI"] },
  { text: "Sketching", connections: ["HCI","IUI","Creativity"] },
  { text: "Human-Centered AI", connections: ["HCI","Generative AI","Hybrid Intelligence"] },
  { text: "Hybrid Intelligence", connections: ["HCI","Human-Centered AI","Co-Creative Systems"] },
  { text: "Generative AI", connections: ["HCI","Human-Centered AI","Creativity","Co-Creative Systems"] },
  { text: "Co-Creative Systems", connections: ["HCI","Generative AI","Hybrid Intelligence","Creativity"] },
  { text: "Creativity", connections: ["HCI","Sketching","Generative AI","Co-Creative Systems"] }
];

let nodes=[],edges=[];
const mouse={x:null,y:null};
let activeNode=null,highlightedSet=null;
let pulsePhase=0;

// === Helpers ===
function hexToRgb(hex){
  const m=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m?{r:parseInt(m[1],16),g:parseInt(m[2],16),b:parseInt(m[3],16)}:{r:255,g:255,b:255};
}
function lerp(a,b,t){return a+(b-a)*t;}
function lerpColor(c1,c2,t){
  return {
    r:Math.round(lerp(c1.r,c2.r,t)),
    g:Math.round(lerp(c1.g,c2.g,t)),
    b:Math.round(lerp(c1.b,c2.b,t))
  };
}
function rgba(rgb,a){return`rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;}

const cStart=hexToRgb(gradientStart), cEnd=hexToRgb(gradientEnd);

// === Node / Edge Classes ===
class Node{
  constructor(x,y,label,isCenter=false,huePos=0){
    this.baseX=x;this.baseY=y;this.x=x;this.y=y;
    this.label=label;this.isCenter=isCenter;
    this.size=isCenter?28:12;this.renderSize=this.size;
    this.phase=Math.random()*Math.PI*2;
    this.speed=(Math.random()*0.6+0.6)*0.008;
    this.ampX=Math.random()*8+5;this.ampY=Math.random()*6+3;
    this.hover=0;this.connections=[];this.huePos=huePos; // 0..1 along gradient
  }
  update(dt){
    if(!this.isCenter){
      this.phase+=this.speed*dt;
      this.x=this.baseX+Math.cos(this.phase)*this.ampX;
      this.y=this.baseY+Math.sin(this.phase*1.18)*this.ampY;
    }
    const mx=mouse.x??-9999,my=mouse.y??-9999;
    const d=Math.hypot(mx-this.x,my-this.y);
    const target=(!this.isCenter&&d<(this.size+42))?1:0;
    this.hover+=(target-this.hover)*0.14;
    this.renderSize+=((this.size+this.hover*8)-this.renderSize)*0.12;
  }
}
class Edge{constructor(a,b){this.a=a;this.b=b;this.focus=0;}}

// === Layout ===
function resize(){
  const rect=wrap.getBoundingClientRect();
  const dpr=Math.max(1,window.devicePixelRatio||1);
  canvas.width=Math.floor(rect.width*dpr);
  canvas.height=Math.floor(rect.height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  createNodes();
}

function createNodes(){
  nodes=[];edges=[];
  const dpr=Math.max(1,window.devicePixelRatio||1);
  const cw=canvas.width/dpr,ch=canvas.height/dpr;
  const cx=cw*0.5,cy=ch*0.55;
  const center=new Node(cx,cy,"HCI",true,0.5);
  nodes.push(center);

  const others=mindmapData.filter(n=>n.text!=="HCI");
  const count=others.length;
  const radius=Math.min(cw,ch)*0.37;
  const startAngle=-Math.PI/2,step=(Math.PI*2)/count;
  const nameToNode=new Map();
  nameToNode.set("HCI",center);

  others.forEach((item,i)=>{
    const a=startAngle+i*step;
    const x=cx+Math.cos(a)*radius;
    const y=cy+Math.sin(a)*radius;
    const huePos=i/(count-1); // used for gradient color
    const node=new Node(x,y,item.text,false,huePos);
    nodes.push(node);
    nameToNode.set(item.text,node);
  });

  const seen=new Set();
  mindmapData.forEach(item=>{
    const from=nameToNode.get(item.text);
    if(!from||!item.connections)return;
    item.connections.forEach(conn=>{
      const to=nameToNode.get(conn);
      if(!to)return;
      const key=from.label<to.label?`${from.label}|${to.label}`:`${to.label}|${from.label}`;
      if(seen.has(key))return;seen.add(key);
      const e=new Edge(from,to);
      edges.push(e);
      from.connections.push(to);
      to.connections.push(from);
    });
  });
}

// === Render ===
let last=performance.now();
function animate(now){
  const dt=Math.min(60,now-last)*0.06;last=now;
  pulsePhase+=dt*0.04;
  const dpr=Math.max(1,window.devicePixelRatio||1);
  const cw=canvas.width/dpr,ch=canvas.height/dpr;
  ctx.clearRect(0,0,cw,ch);

  // Edges
  ctx.save();ctx.lineCap="round";
  edges.forEach(e=>{
    const active=highlightedSet&&highlightedSet.has(e.a)&&highlightedSet.has(e.b);
    const target=active?1:0;
    e.focus+=(target-e.focus)*0.12;

    const base={r:150,g:160,b:255}, hi={r:210,g:220,b:255};
    const mix=lerpColor(base,hi,e.focus);
    const alpha=0.18+0.42*e.focus;

    ctx.beginPath();
    ctx.moveTo(e.a.x,e.a.y);
    ctx.lineTo(e.b.x,e.b.y);
    ctx.strokeStyle=`rgba(${mix.r},${mix.g},${mix.b},${alpha})`;
    ctx.lineWidth=1+e.focus*0.4;
    ctx.stroke();
  });
  ctx.restore();

  // Nodes
  nodes.forEach(n=>{
    n.update(dt);
    const highlight=highlightedSet?highlightedSet.has(n):false;
    const alpha=highlight?1:(activeNode?0.35:1);
    const pulse=highlight?(1+Math.sin(pulsePhase)*0.08):1;

    const col=lerpColor(cStart,cEnd,n.huePos);
    const g=ctx.createRadialGradient(n.x,n.y,1,n.x,n.y,n.renderSize*2*pulse);
    g.addColorStop(0,rgba(col,alpha));
    g.addColorStop(0.6,rgba(col,0.5*alpha));
    g.addColorStop(1,"rgba(20,20,30,0.02)");

    ctx.beginPath();
    ctx.arc(n.x,n.y,n.renderSize*pulse,0,Math.PI*2);
    ctx.fillStyle=g;
    ctx.fill();

    ctx.fillStyle=labelColor;
    ctx.font=n.isCenter?"700 14px Karla, sans-serif":"12px Karla, sans-serif";
    ctx.textAlign="center";ctx.textBaseline="alphabetic";
    ctx.fillText(n.label,n.x,n.y-(n.isCenter?(n.renderSize+8):(n.renderSize+6)));
  });

  requestAnimationFrame(animate);
}

// === Events ===
canvas.addEventListener("mousemove",e=>{
  const r=canvas.getBoundingClientRect();
  mouse.x=e.clientX-r.left;mouse.y=e.clientY-r.top;

  activeNode=null;
  let nearest=null,minDist=9999;
  nodes.forEach(n=>{
    const d=Math.hypot(mouse.x-n.x,mouse.y-n.y);
    if(d<n.renderSize+12&&d<minDist){nearest=n;minDist=d;}
  });
  activeNode=nearest;
  highlightedSet=activeNode?new Set([activeNode,...activeNode.connections]):null;
});
canvas.addEventListener("mouseleave",()=>{mouse.x=mouse.y=null;activeNode=null;highlightedSet=null;});
window.addEventListener("load",()=>{resize();last=performance.now();requestAnimationFrame(animate);});
window.addEventListener("resize",()=>{clearTimeout(window._mmr);window._mmr=setTimeout(resize,120);});
