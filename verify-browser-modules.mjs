import assert from 'node:assert/strict';
const saved=new Map([['paper-wind-language','ko']]);
globalThis.localStorage={getItem:k=>saved.get(k),setItem:(k,v)=>saved.set(k,v)};
globalThis.NodeFilter={SHOW_TEXT:4};globalThis.document={body:{},documentElement:{},createTreeWalker:()=>({nextNode:()=>null}),getElementById:()=>null};globalThis.window={dispatchEvent:()=>{}};
const {t,setLanguage,getLanguage}=await import('./dist/i18n.js');
assert.equal(getLanguage(),'ko');assert.equal(t('Godot용 내보내기 ↓'),'Godot용 내보내기 ↓');setLanguage('en');assert.equal(t('Godot용 내보내기 ↓'),'Export for Godot ↓');assert.equal(t('접힘 {folds}개 · 고정점 {pins}개',{folds:3,pins:1}),'Folds 3 · Pins 1');assert.equal(saved.get('paper-wind-language'),'en');setLanguage('ko');assert.equal(t('작업을 불러왔습니다.'),'작업을 불러왔습니다.');
const {zipStore}=await import('./dist/godot-export.js');const zip=new Uint8Array(await zipStore({'hello.txt':'hello','한글.txt':'종이와 바람'}).arrayBuffer()),view=new DataView(zip.buffer);assert.equal(view.getUint32(0,true),0x04034b50);assert.equal(view.getUint32(zip.length-22,true),0x06054b50);assert.equal(view.getUint16(zip.length-14,true),2);assert.equal(view.getUint16(6,true),0x800);console.log('PASS: Korean/English messages, formatted counters, preference storage, UTF-8 ZIP entries.');
