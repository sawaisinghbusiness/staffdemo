"use client";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Minus, Plus, X } from "lucide-react";
import { say } from "@/lib/i18n";
import "./photo-cropper.css";

type Mode = "profile" | "portrait";
type Point = { x: number; y: number };
const FRAME = 264;
const ROUND_Y = .22;

/** The selected crop is exported once; every app displays the same saved pixels. */
export function cropPhoto(file: File, options: { mode?: Mode } = {}): Promise<string | null> {
  if (!file.type.startsWith("image/")) return Promise.reject(new Error(say({ hi: "फ़ोटो चुनें।", en: "Choose an image file." })));
  if (file.size > 25 * 1024 * 1024) return Promise.reject(new Error(say({ hi: "25 MB से छोटी फ़ोटो चुनें।", en: "Choose a photo smaller than 25 MB." })));
  return new Promise((resolve, reject) => {
    const host = document.createElement("div"); document.body.append(host);
    const root = createRoot(host);
    const done = (value: string | null, error?: Error) => {
      queueMicrotask(() => { root.unmount(); host.remove(); });
      if (error) reject(error); else resolve(value);
    };
    root.render(<Cropper file={file} initialMode={options.mode || "profile"} onDone={value => done(value)} onError={error => done(null,error)} />);
  });
}

function Cropper({ file, initialMode, onDone, onError }: { file: File; initialMode: Mode; onDone: (value: string | null) => void; onError: (error: Error) => void }) {
  const [bmp,setBmp] = useState<ImageBitmap | null>(null);
  const [src,setSrc] = useState("");
  const [mode,setMode] = useState<Mode>(initialMode);
  const [view,setView] = useState({ x:0,y:0,zoom:1 });
  const [busy,setBusy] = useState(false);
  const current = useRef(view); current.current=view;
  const panel = useRef<HTMLDivElement>(null), frame = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number,Point>());
  const gesture = useRef<{ origin:Point; position:Point } | null>(null);
  const pinch = useRef<{ distance:number; zoom:number; image:Point } | null>(null);
  const height = mode === "profile" ? FRAME : FRAME*4/3;
  const base = bmp ? Math.max(FRAME/bmp.width,height/bmp.height) : 1;

  useEffect(() => {
    let live=true,url="",image:ImageBitmap|null=null;
    createImageBitmap(file).then(decoded=>{
      image=decoded;if(!live){image.close();return}
      url=URL.createObjectURL(file);setSrc(url);setBmp(decoded);
    }).catch(()=>{if(live)onError(new Error(say({hi:"यह फ़ोटो नहीं खुली। JPG या PNG फ़ोटो चुनें।",en:"This photo could not be opened. Choose a JPG or PNG image."})))});
    return()=>{live=false;if(url)URL.revokeObjectURL(url);image?.close()};
  },[file,onError]);
  useEffect(()=>{
    if(!bmp)return;const scale=Math.max(FRAME/bmp.width,height/bmp.height);
    const next={x:(FRAME-bmp.width*scale)/2,y:(height-bmp.height*scale)*ROUND_Y,zoom:1};current.current=next;setView(next);
  },[bmp,height]);
  useEffect(()=>{
    const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;
    document.body.style.overflow="hidden";panel.current?.focus();
    const key=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();onDone(null)}
      if(e.key==="Tab"){
        const items=Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')||[]),first=items[0],last=items.at(-1);
        if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last?.focus()}
        else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===panel.current)){e.preventDefault();first?.focus()}
      }
    };
    window.addEventListener("keydown",key,true);return()=>{document.body.style.overflow=overflow;window.removeEventListener("keydown",key,true);if(previous?.isConnected)previous.focus()};
  },[onDone]);

  function apply(x:number,y:number,zoom:number){
    if(!bmp)return;const z=Math.max(1,Math.min(4,zoom)),scale=base*z;
    const next={x:Math.max(FRAME-bmp.width*scale,Math.min(0,x)),y:Math.max(height-bmp.height*scale,Math.min(0,y)),zoom:z};current.current=next;setView(next);
  }
  function zoomTo(zoom:number){
    if(!bmp)return;const old=current.current,z=Math.max(1,Math.min(4,zoom));
    const image={x:(FRAME/2-old.x)/(base*old.zoom),y:(height/2-old.y)/(base*old.zoom)};
    apply(FRAME/2-image.x*base*z,height/2-image.y*base*z,z);
  }
  function beginPinch(){
    const [a,b]=Array.from(pointers.current.values()),rect=frame.current?.getBoundingClientRect();if(!a||!b||!rect)return;
    const v=current.current,center={x:(a.x+b.x)/2-rect.x,y:(a.y+b.y)/2-rect.y};
    pinch.current={distance:Math.max(1,Math.hypot(b.x-a.x,b.y-a.y)),zoom:v.zoom,image:{x:(center.x-v.x)/(base*v.zoom),y:(center.y-v.y)/(base*v.zoom)}};
  }
  function release(id:number){
    pointers.current.delete(id);pinch.current=null;
    const remaining=Array.from(pointers.current.values())[0];gesture.current=remaining?{origin:remaining,position:{x:current.current.x,y:current.current.y}}:null;
  }
  function save(){
    if(!bmp||busy)return;setBusy(true);
    try{
      const canvas=document.createElement("canvas");canvas.width=360;canvas.height=mode==="profile"?360:480;
      const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Photo processing is unavailable.");
      const v=current.current,scale=base*v.zoom;
      ctx.drawImage(bmp,-v.x/scale,-v.y/scale,FRAME/scale,height/scale,0,0,canvas.width,canvas.height);
      let quality=.85,out=canvas.toDataURL("image/jpeg",quality);
      while(out.length>300_000&&quality>.4){quality-=.15;out=canvas.toDataURL("image/jpeg",quality)}onDone(out);
    }catch(error){setBusy(false);onError(error instanceof Error?error:new Error("Photo processing failed."))}
  }
  const scale=base*view.zoom,width=bmp?bmp.width*scale:FRAME,imageHeight=bmp?bmp.height*scale:height;
  const image=(k:number,top=0)=>src?<img src={src} alt="" draggable={false} style={{position:"absolute",maxWidth:"none",width:width*k,height:imageHeight*k,left:view.x*k,top:view.y*k-top,pointerEvents:"none"}}/>:null;
  return <div className="photo-crop-overlay">
    <div className="photo-crop-panel" ref={panel} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="photo-crop-title" data-photo-crop>
      <header><h2 id="photo-crop-title">{say({hi:"फ़ोटो ठीक करें",en:"Adjust photo"})}</h2><button type="button" onClick={()=>onDone(null)} aria-label={say({hi:"बंद करें",en:"Close"})}><X size={20} aria-hidden/></button></header>
      <div className="photo-crop-modes" role="group" aria-label={say({hi:"फ़ोटो का आकार",en:"Photo format"})}>
        <button type="button" aria-pressed={mode==="profile"} onClick={()=>{pointers.current.clear();setMode("profile")}}>{say({hi:"प्रोफ़ाइल फ़ोटो",en:"Profile photo"})}</button>
        <button type="button" aria-pressed={mode==="portrait"} onClick={()=>{pointers.current.clear();setMode("portrait")}}>{say({hi:"ID फ़ोटो · 3:4",en:"ID photo · 3:4"})}</button>
      </div>
      <p className="photo-crop-hint">{say({hi:"खिसकाकर चेहरा बीच में रखें। दो उँगलियों से ज़ूम करें।",en:"Drag to centre the face. Pinch with two fingers to zoom."})}</p>
      <div className="photo-crop-stage"><div ref={frame} className="photo-crop-frame" data-mode={mode} style={{width:FRAME,height}} data-swipe
        onPointerDown={e=>{if(!bmp)return;e.preventDefault();e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.current.size===1)gesture.current={origin:{x:e.clientX,y:e.clientY},position:{x:current.current.x,y:current.current.y}};else beginPinch()}}
        onPointerMove={e=>{if(!pointers.current.has(e.pointerId))return;e.stopPropagation();pointers.current.set(e.pointerId,{x:e.clientX,y:e.clientY});const [a,b]=Array.from(pointers.current.values()),rect=frame.current?.getBoundingClientRect();if(b&&pinch.current&&rect){const p=pinch.current,z=Math.max(1,Math.min(4,p.zoom*Math.hypot(b.x-a.x,b.y-a.y)/p.distance));apply((a.x+b.x)/2-rect.x-p.image.x*base*z,(a.y+b.y)/2-rect.y-p.image.y*base*z,z)}else if(gesture.current){const g=gesture.current;apply(g.position.x+e.clientX-g.origin.x,g.position.y+e.clientY-g.origin.y,current.current.zoom)}}}
        onPointerUp={e=>release(e.pointerId)} onPointerCancel={e=>release(e.pointerId)} onLostPointerCapture={e=>release(e.pointerId)}>
        {image(1)}
        {mode==="profile"?<span className="photo-crop-circle" aria-hidden/>:<span className="photo-crop-portrait-guide" aria-hidden/>}
        {!bmp&&<span className="photo-crop-loading">{say({hi:"फ़ोटो खुल रही है…",en:"Opening photo…"})}</span>}
      </div></div>
      <div className="photo-crop-tools"><button type="button" disabled={!bmp} onClick={()=>zoomTo(view.zoom-.15)} aria-label={say({hi:"छोटा करें",en:"Zoom out"})}><Minus size={18}/></button><input type="range" min="1" max="4" step=".01" value={view.zoom} onChange={e=>zoomTo(Number(e.target.value))} aria-label={say({hi:"ज़ूम",en:"Zoom"})}/><button type="button" disabled={!bmp} onClick={()=>zoomTo(view.zoom+.15)} aria-label={say({hi:"बड़ा करें",en:"Zoom in"})}><Plus size={18}/></button></div>
      <div className="photo-crop-preview"><span className="photo-crop-avatar">{image(56/FRAME,(height-FRAME)*(56/FRAME)*ROUND_Y)}</span><span>{say({hi:"ऐप में यही crop दिखेगा",en:"This is the crop shown in the apps"})}</span></div>
      <footer><button type="button" className="photo-crop-cancel" onClick={()=>onDone(null)}>{say({hi:"रद्द करें",en:"Cancel"})}</button><button type="button" className="photo-crop-save" disabled={!bmp||busy} onClick={save}>{busy?say({hi:"तैयार हो रही है…",en:"Preparing…"}):say({hi:"यही फ़ोटो रखें",en:"Use photo"})}</button></footer>
    </div>
  </div>;
}
