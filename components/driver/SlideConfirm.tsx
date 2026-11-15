"use client";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, Check, LoaderCircle } from "lucide-react";
import { slideGrab, slideDrag, resetSlideDrag } from "@/lib/slideFeedback";
import { useL } from "@/lib/i18n";
import "./slide-confirm.css";

/** Pointer release confirms only after a deliberate right swipe. No action on tap. */
export function SlideConfirm({label,onConfirm,disabled=false,tone="dark",sound="latch"}:{label:string;onConfirm:()=>void|boolean|Promise<void|boolean>;disabled?:boolean;tone?:"dark"|"yellow";sound?:"latch"|"start"|"end"}){
 const helpId=useId();const L=useL();const track=useRef<HTMLDivElement>(null);const drag=useRef<{id:number;start:number;max:number}|null>(null);const progress=useRef(0);const locked=useRef(false);const mounted=useRef(true);
 const [pending,setPending]=useState(false);const [complete,setComplete]=useState(false);const [alternate,setAlternate]=useState(false);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;drag.current=null}},[]);
 const paint=(value:number)=>{progress.current=value;track.current?.style.setProperty("--slide-progress",String(value));const max=Math.max(1,(track.current?.clientWidth||300)-64);track.current?.style.setProperty("--slide-x",`${value*max}px`)};
 async function confirm(){
  if(disabled||locked.current)return;locked.current=true;setPending(true);paint(1);navigator.vibrate?.(sound==="latch"?10:[35,45,70]);
  let accepted=false;
  try{await new Promise(resolve=>setTimeout(resolve,170));if(!mounted.current)return;const result=await onConfirm();if(result===false){paint(0)}else if(mounted.current){accepted=true;setComplete(true);setTimeout(()=>{locked.current=false;if(mounted.current){setComplete(false);paint(0)}},450)}}catch{paint(0)}finally{if(!accepted)locked.current=false;if(mounted.current){setPending(false);setAlternate(false)}}
 }

 return <div className="slide-confirm" data-tone={tone} data-swipe="true"><div ref={track} className="slide-confirm-track" data-dragging={!!drag.current} aria-busy={pending} data-complete={complete}>
   <span className="slide-confirm-label" aria-hidden>{complete?L({hi:"हो गया",en:"Confirmed"}):label}</span><span className="slide-confirm-end" aria-hidden><ArrowRight size={18}/></span>
   <button type="button" className="slide-confirm-thumb" disabled={disabled||pending} aria-label={label} aria-describedby={helpId} onClick={e=>{if(e.detail===0)void confirm()}} onPointerDown={e=>{if(disabled||locked.current||e.button!==0||!e.isPrimary)return;resetSlideDrag();slideGrab();e.preventDefault();e.stopPropagation();const max=(track.current?.clientWidth||300)-64;drag.current={id:e.pointerId,start:e.clientX,max};e.currentTarget.setPointerCapture(e.pointerId);track.current?.setAttribute("data-dragging","true")}} onPointerMove={e=>{if(!drag.current||drag.current.id!==e.pointerId)return;e.stopPropagation();const next=Math.max(0,Math.min(1,(e.clientX-drag.current.start)/drag.current.max));paint(next);slideDrag(next)}} onPointerUp={e=>{if(!drag.current||drag.current.id!==e.pointerId)return;e.stopPropagation();drag.current=null;track.current?.setAttribute("data-dragging","false");if(progress.current>=.88)void confirm();else paint(0)}} onPointerCancel={()=>{drag.current=null;track.current?.setAttribute("data-dragging","false");paint(0)}} onLostPointerCapture={()=>{if(drag.current){drag.current=null;paint(0)}}}>{pending?<LoaderCircle size={22} className="animate-spin"/>:complete?<Check size={23}/>:<ArrowRight size={24}/>}</button>
 </div><span id={helpId} className="sr-only">{L({hi:"दाईं ओर पूरा स्वाइप करें। कीबोर्ड से Enter दबाएँ।",en:"Slide the handle right to confirm. With a keyboard, press Enter."})}</span>
 <div className="slide-confirm-alternative">{alternate?<><button type="button" disabled={pending||disabled} onClick={()=>void confirm()}>{L({hi:"पक्का करें",en:"Confirm"})}</button><button type="button" onClick={()=>setAlternate(false)}>{L({hi:"वापस",en:"Cancel"})}</button></>:<button type="button" onClick={()=>setAlternate(true)}>{L({hi:"स्वाइप नहीं कर पा रहे?",en:"Can't swipe?"})}</button>}</div></div>;
}
