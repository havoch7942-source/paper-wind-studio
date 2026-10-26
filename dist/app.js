import * as THREE from './three.module.js';
import {panelsFor,rigidPose} from './paper-model.js';
import {exportGodot} from './godot-export.js';
import {t,initLanguage} from './i18n.js';
const $=id=>document.getElementById(id);
const state={folds:[],pins:[{x:.5,y:.045}],settings:{depth:.35,strength:.7,gust:.65,stiff:.6,direction:20,sway:.3},mode:'fold',running:true,image:'sample.svg'};
const history=[];let image=new Image(),geometry,mesh,points=[],hinges=[],width=2.6,height=3.4,time=0,accumulator=0,drag=null,fit;
const editor=$('editor'),ctx=editor.getContext('2d'),view=$('viewport');
let renderer;
try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});}catch(e){$('status').textContent=t('WebGL을 시작할 수 없습니다. 브라우저의 하드웨어 가속을 켜 주세요.');throw e;}
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;view.append(renderer.domElement);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(37,1,.1,100);let yaw=-.15,pitch=.04,distance=7;
scene.add(new THREE.HemisphereLight(0xfff9e4,0x687268,2.3));const light=new THREE.DirectionalLight(0xfff0d2,2.4);light.position.set(-3,4,5);scene.add(light);
const pinGroup=new THREE.Group();scene.add(pinGroup);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
let statusKey="준비 중…",statusValues={};function notify(s,values={}){statusKey=s;statusValues=values;$('status').textContent=t(s,values);}
function snapshot(){history.push(JSON.stringify({folds:state.folds,pins:state.pins}));if(history.length>35)history.shift();}
function segment(x,y,f){const dx=f.b.x-f.a.x,dy=f.b.y-f.a.y,l=dx*dx+dy*dy,t=clamp(((x-f.a.x)*dx+(y-f.a.y)*dy)/l,0,1);return {d:Math.hypot(x-f.a.x-t*dx,y-f.a.y-t*dy),t};}
function rebuild(){
 if(!image.naturalWidth)return;
 const ratio=image.naturalWidth/image.naturalHeight;height=3.5;width=height*ratio;if(width>4){height*=4/width;width=4;}
 if(mesh){scene.remove(mesh);geometry.dispose();mesh.material.map.dispose();mesh.material.dispose();}
 points=[];const vertices=[],uvs=[];
 for(const polygon of panelsFor(state.folds)){for(let i=1;i<polygon.length-1;i++){for(const p of [polygon[0],polygon[i],polygon[i+1]]){points.push({u:p.x,v:p.y,x:(p.x-.5)*width,y:(.5-p.y)*height,z:0});vertices.push((p.x-.5)*width,(.5-p.y)*height,0);uvs.push(p.x,1-p.y);}}}
 geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
 hinges=state.folds.map(f=>({angle:0,velocity:0}));eventStart=time;eventNumber=0;
 for(let i=pinGroup.children.length-1;i>=0;i--){const o=pinGroup.children[i];o.geometry.dispose();o.material.dispose();pinGroup.remove(o);}
 for(const p of state.pins){const ball=new THREE.Mesh(new THREE.SphereGeometry(.035,12,8),new THREE.MeshStandardMaterial({color:0xb7c9a1,metalness:.5,roughness:.35}));ball.position.set((p.x-.5)*width,(.5-p.y)*height,.035);pinGroup.add(ball);}
 const tex=new THREE.Texture(image);tex.colorSpace=THREE.SRGBColorSpace;tex.needsUpdate=true;mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map:tex,side:THREE.DoubleSide,roughness:.9,metalness:0,transparent:true,alphaTest:.03}));mesh.frustumCulled=false;scene.add(mesh);pose();uploadPositions();drawEditor();updateLanguageLabels();notify('힌지 회전 모드 · 종이 면의 크기를 유지합니다. 교차 방향은 번갈아 움직이며 접힘 축은 경계까지 이어집니다.');
}
function pose(){const posed=rigidPose(points.map(p=>({x:p.u,y:p.v})),state.folds,hinges.map(h=>h.angle),width,height,state.pins);const anchor=state.pins[0]||{x:.5,y:0},ax=(anchor.x-.5)*width,ay=(.5-anchor.y)*height,a=state.pins.length<=1?swayAngle:0,c=Math.cos(a),s=Math.sin(a);points.forEach((p,i)=>{const q=posed[i],dx=q[0]-ax,dy=q[1]-ay;p.x=ax+dx*c-dy*s;p.y=ay+dx*s+dy*c;p.z=q[2];});}
function uploadPositions(){if(!geometry)return;const a=geometry.attributes.position;points.forEach((p,i)=>a.setXYZ(i,p.x,p.y,p.z));a.needsUpdate=true;geometry.computeVertexNormals();}
const hash=n=>{const s=Math.sin(n*127.1+311.7)*43758.5453;return s-Math.floor(s);};
function noise(t,seed=0){const i=Math.floor(t),f=t-i,k=f*f*(3-2*f);return hash(i+seed)*(1-k)+hash(i+1+seed)*k;}
function wind(t){return state.settings.strength*(.2+.45*noise(t*.31,7)+state.settings.gust*1.8*Math.pow(noise(t*.18,27),3));}
let swayAngle=0,swayVelocity=0,eventStart=0,eventNumber=0;function simulate(dt){
 time+=dt;const force=wind(time),dir=state.settings.direction*Math.PI/180;
 const groups=[];for(let j=0;j<state.folds.length;j++){const f=state.folds[j],a=Math.atan2(f.b.y-f.a.y,f.b.x-f.a.x);let g=groups.find(g=>Math.abs(Math.sin(a-g.angle))<.0001);if(!g){g={angle:a,indices:[]};groups.push(g);}g.indices.push(j);}
 const duration=4+hash(eventNumber+103)*3,elapsed=time-eventStart;
 if(elapsed>duration&&hinges.every(h=>Math.abs(h.angle)<.002&&Math.abs(h.velocity)<.01)){eventNumber++;eventStart=time;}
 const active=groups.length?groups[eventNumber%groups.length].indices:[],progress=clamp((time-eventStart)/duration,0,1),envelope=Math.sin(Math.PI*progress)**1.3;
 for(let j=0;j<hinges.length;j++){const h=hinges[j],f=state.folds[j],orientation=Math.atan2(f.b.y-f.a.y,f.b.x-f.a.x),response=.65+.35*Math.abs(Math.cos(dir-orientation)),surge=noise(time*.65-j*.17,91+j*7);const target=active.includes(j)?f.sign*clamp(force*response*(1.8+3.2*surge)+state.settings.depth*.2,0,1.35)*envelope:0;h.velocity+=((target-h.angle)*(24+state.settings.stiff*10)-h.velocity*7)*dt;h.angle+=h.velocity*dt;}
 const swayTarget=(noise(time*.4,201)-.5)*state.settings.sway*Math.min(force*1.5,1)*.5;swayVelocity+=((swayTarget-swayAngle)*5-swayVelocity*3)*dt;swayAngle+=swayVelocity*dt;pose();
}
function drawEditor(){const w=editor.width,h=editor.height;ctx.clearRect(0,0,w,h);if(!image.naturalWidth)return;const s=Math.min((w-36)/image.naturalWidth,(h-36)/image.naturalHeight);fit={x:(w-image.naturalWidth*s)/2,y:(h-image.naturalHeight*s)/2,w:image.naturalWidth*s,h:image.naturalHeight*s};ctx.drawImage(image,fit.x,fit.y,fit.w,fit.h);
 const line=f=>{ctx.beginPath();ctx.moveTo(fit.x+f.a.x*fit.w,fit.y+f.a.y*fit.h);ctx.lineTo(fit.x+f.b.x*fit.w,fit.y+f.b.y*fit.h);ctx.strokeStyle=f.sign>0?'#dfec9e':'#98d5ed';ctx.lineWidth=3;ctx.setLineDash(f.sign>0?[]:[9,6]);ctx.stroke();ctx.setLineDash([]);for(const p of [f.a,f.b]){ctx.beginPath();ctx.arc(fit.x+p.x*fit.w,fit.y+p.y*fit.h,4,0,7);ctx.fillStyle=ctx.strokeStyle;ctx.fill();}};
 state.folds.forEach(line);if(drag)line({...drag,sign:Number($('sign').value)});
 for(const p of state.pins){const x=fit.x+p.x*fit.w,y=fit.y+p.y*fit.h;ctx.beginPath();ctx.arc(x,y,10,0,7);ctx.fillStyle='#d2e2ba';ctx.fill();ctx.strokeStyle='#22331e';ctx.lineWidth=3;ctx.stroke();ctx.beginPath();ctx.arc(x,y,3,0,7);ctx.fillStyle='#22331e';ctx.fill();}}
function uv(e){if(!fit)return null;const r=editor.getBoundingClientRect(),x=((e.clientX-r.left)*editor.width/r.width-fit.x)/fit.w,y=((e.clientY-r.top)*editor.height/r.height-fit.y)/fit.h;return x>=0&&x<=1&&y>=0&&y<=1?{x,y}:null;}
editor.addEventListener('pointerdown',e=>{const p=uv(e);if(!p)return;editor.setPointerCapture(e.pointerId);if(state.mode==='fold'){drag={a:p,b:p};}else if(state.mode==='pin'){snapshot();state.pins.push(p);rebuild();}else{const choices=[...state.pins.map((q,i)=>({type:'pins',i,d:Math.hypot(q.x-p.x,q.y-p.y)})),...state.folds.map((f,i)=>({type:'folds',i,d:segment(p.x,p.y,f).d}))].sort((a,b)=>a.d-b.d);if(choices[0]?.d<.065){snapshot();state[choices[0].type].splice(choices[0].i,1);rebuild();}}});
editor.addEventListener('pointermove',e=>{if(drag){const p=uv(e);if(p)drag.b=p;drawEditor();}});
editor.addEventListener('pointerup',()=>{if(!drag)return;if(Math.hypot(drag.a.x-drag.b.x,drag.a.y-drag.b.y)>.025){snapshot();state.folds.push({...drag,sign:Number($('sign').value)});}drag=null;rebuild();});editor.addEventListener('pointercancel',()=>{drag=null;drawEditor();});
for(const mode of ['fold','valley','pin','erase'])$(mode).onclick=()=>{state.mode=mode==='valley'?'fold':mode;if(mode==='fold'||mode==='valley')$('sign').value=mode==='valley'?'-1':'1';for(const m of ['fold','valley','pin','erase'])$(m).classList.toggle('active',m===mode);updateLanguageLabels();};
function updateLanguageLabels(){$('count').textContent=t('접힘 {folds}개 · 고정점 {pins}개',{folds:state.folds.length,pins:state.pins.length});$('pause').textContent=t(state.running?'Ⅱ 일시정지':'▶ 재생');$('editHint').textContent=t({fold:'녹색 산접기 · 파란색 골접기. 평면을 유지하려고 접힘 축을 종이 경계까지 연장합니다.',pin:'종이를 붙잡을 위치를 클릭하세요. 여러 곳을 고정할 수 있어요.',erase:'삭제할 접힘 선이나 고정점을 클릭하세요.'}[state.mode]);$('status').textContent=t(statusKey,statusValues);}
window.addEventListener('paper-language-change',updateLanguageLabels);
$('undo').onclick=()=>{if(history.length){Object.assign(state,JSON.parse(history.pop()));rebuild();}};$('clear').onclick=()=>{snapshot();state.folds=[];state.pins=[];rebuild();};
function controls(){for(const key of Object.keys(state.settings)){$(key).value=state.settings[key];$(key+'Value').textContent=key==='direction'?state.settings[key]+'°':Math.round(state.settings[key]*100)+'%';}}
for(const key of Object.keys(state.settings))$(key).oninput=()=>{state.settings[key]=Number($(key).value);controls();if(key==='depth')rebuild();};
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>{Object.assign(state.settings,b.dataset.preset==='soft'?{strength:.45,gust:.35}:{strength:1.15,gust:1});controls();});
$('pause').onclick=()=>{state.running=!state.running;updateLanguageLabels();};$('resetView').onclick=()=>{yaw=0;pitch=0;distance=7;};$('sideView').onclick=()=>{yaw=.65;pitch=.12;distance=7;};
let orbit;renderer.domElement.addEventListener('pointerdown',e=>{orbit={x:e.clientX,y:e.clientY};renderer.domElement.setPointerCapture(e.pointerId);});renderer.domElement.addEventListener('pointermove',e=>{if(!orbit)return;yaw+=(e.clientX-orbit.x)*.006;pitch=clamp(pitch+(e.clientY-orbit.y)*.005,-1.1,1.1);orbit={x:e.clientX,y:e.clientY};});renderer.domElement.addEventListener('pointerup',()=>orbit=null);renderer.domElement.addEventListener('pointercancel',()=>orbit=null);renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();distance=clamp(distance+e.deltaY*.004,3,13);},{passive:false});
async function loadImage(src){const next=new Image();await new Promise((resolve,reject)=>{next.onload=resolve;next.onerror=reject;next.src=src;});image=next;state.image=src;rebuild();}
function read(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});}
$('upload').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>20*1024*1024)throw Error(t('20MB 이하 이미지를 사용해 주세요.'));const src=await read(file);await loadImage(src);snapshot();state.folds=[];state.pins=[{x:.5,y:.045}];rebuild();}catch(err){notify('이미지 불러오기 실패. {error}',{error:err.message});}e.target.value='';};
function download(name,content,type){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('godotExport').onclick=async()=>{const button=$('godotExport');button.disabled=true;try{notify('Godot 장면과 이미지를 ZIP으로 묶는 중입니다.');const zip=await exportGodot(state,image,points,width,height);download('paper-wind-godot.zip',zip,'application/zip');notify('Godot ZIP을 저장했습니다. paper_wind 폴더를 프로젝트에 복사하고 demo.tscn을 실행하세요.');}catch(error){notify('Godot 내보내기 실패. {error}',{error:error.message});}finally{button.disabled=false;}};
$('save').onclick=()=>{const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;c.getContext('2d').drawImage(image,0,0);download('paper-wind.json',JSON.stringify({version:1,folds:state.folds,pins:state.pins,settings:state.settings,image:c.toDataURL('image/png')}),'application/json');notify('이미지와 접힘·고정점·바람 설정을 함께 저장했습니다.');};
$('open').onclick=()=>$('project').click();
function validate(p){const pt=q=>q&&Number.isFinite(q.x)&&Number.isFinite(q.y)&&q.x>=0&&q.x<=1&&q.y>=0&&q.y<=1;if(p.version!==1||!Array.isArray(p.folds)||p.folds.length>100||!Array.isArray(p.pins)||p.pins.length>100||!p.folds.every(f=>pt(f.a)&&pt(f.b)&&[1,-1].includes(f.sign)&&Math.hypot(f.a.x-f.b.x,f.a.y-f.b.y)>.001)||!p.pins.every(pt)||typeof p.image!=='string'||!/^data:image\/(png|jpeg|webp);base64,/.test(p.image))throw Error(t('올바른 종이와 바람 작업 파일이 아닙니다.'));for(const k of Object.keys(state.settings)){if(k==="sway"&&p.settings?.sway===undefined)p.settings.sway=.3;const n=p.settings?.[k],a=Number($(k).min),b=Number($(k).max);if(!Number.isFinite(n)||n<a||n>b)throw Error(t('바람 설정 값이 올바르지 않습니다.'));}return p;}
$('project').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>35*1024*1024)throw Error(t('파일이 너무 큽니다.'));const p=validate(JSON.parse(await f.text()));const test=new Image();await new Promise((res,rej)=>{test.onload=res;test.onerror=rej;test.src=p.image;});image=test;Object.assign(state,{folds:p.folds,pins:p.pins,settings:p.settings,image:p.image});history.length=0;controls();rebuild();notify('작업을 불러왔습니다.');}catch(err){notify('작업 불러오기 실패. {error}',{error:err.message});}e.target.value='';};
new ResizeObserver(()=>{const w=view.clientWidth,h=view.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(view);
let last=performance.now();function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;if(state.running&&points.length){accumulator+=dt;while(accumulator>=1/60){simulate(1/60);accumulator-=1/60;}uploadPositions();}camera.position.set(Math.sin(yaw)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(0,0,0);renderer.render(scene,camera);const w=wind(time);$('windRead').textContent=t(w<.3?'가벼운 잔바람':w<.8?'부드러운 바람':'돌풍이 지나가는 중');$('windBar').style.width=Math.min(100,w*65)+'%';}
initLanguage();controls();await loadImage('sample.svg');state.folds=[{a:{x:.1,y:.39},b:{x:.85,y:.39},sign:1},{a:{x:.1,y:.64},b:{x:.85,y:.64},sign:-1},{a:{x:.39,y:.06},b:{x:.42,y:.92},sign:1},{a:{x:.69,y:.08},b:{x:.71,y:.93},sign:-1}];rebuild();requestAnimationFrame(frame);












