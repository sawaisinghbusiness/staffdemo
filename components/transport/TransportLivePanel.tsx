"use client";
import { useEffect, useRef, useState } from "react";
import { ChevronRight, RefreshCw, X, ExternalLink } from "lucide-react";
import { loadTransportLive, type TransportSnapshot } from "@/lib/transportLive";
import "./transport-live.css";
type FleetRoute=TransportSnapshot["routes"][number];
const clock=(iso:string)=>new Date(iso).toLocaleTimeString("en-IN",{hour:"numeric",minute:"2-digit",timeZone:"Asia/Kolkata"});
const stateText=(r:FleetRoute)=>!r.trip?"Not started":r.trip.state==="completed"?"Completed":r.trip.delay?`${r.trip.delay.minutes>=30?"30+":r.trip.delay.minutes} min delay`:"Running";
/** Compact overview; detail never displaces the route register. */
export function TransportLivePanel(){
 const [snapshot,setSnapshot]=useState<TransportSnapshot>();
 const [error,setError]=useState("");const [retry,setRetry]=useState(0);const [loading,setLoading]=useState(true);const [now,setNow]=useState(Date.now);const [selected,setSelected]=useState<string|null>(null);const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{let gone=false,busy=false;const load=async()=>{if(busy)return;busy=true;setLoading(true);try{const result=await loadTransportLive();if(!gone){setSnapshot(result);setError("")}}catch(e){if(!gone)setError(e instanceof Error?e.message:"Could not refresh trips.")}finally{busy=false;if(!gone)setLoading(false)}};void load();const timer=setInterval(()=>{setNow(Date.now());if(document.visibilityState==="visible")void load()},15000);const visible=()=>{if(document.visibilityState==="visible")void load()};document.addEventListener("visibilitychange",visible);return()=>{gone=true;clearInterval(timer);document.removeEventListener("visibilitychange",visible)}},[retry]);
 useEffect(()=>{const panel=dialog.current;if(selected&&panel&&!panel.open)panel.showModal();if(!selected&&panel?.open)panel.close()},[selected]);
 const routes=snapshot?.routes||[];const active=routes.filter(r=>r.trip?.state==="running");
 const isFresh=(r:FleetRoute)=>!!r.trip&&r.trip.state==="running"&&!error&&r.trip.locationStatus==="fresh"&&!!r.trip.at&&now-Date.parse(r.trip.at)>=-30000&&now-Date.parse(r.trip.at)<=120000;
 const attention=(r:FleetRoute)=>r.trip?.state==="running"&&(!!r.trip.delay||!isFresh(r));
 const featured=[...active].sort((a,b)=>Number(attention(b))-Number(attention(a))).slice(0,2);const current=routes.find(r=>r.routeId===selected);
 const row=(r:FleetRoute)=><button type="button" className="fleet-compact-row" key={r.routeId} onClick={()=>setSelected(r.routeId)}><span className="fleet-route-name"><strong>{r.routeName}</strong><small>{r.vehicleNo||"Vehicle not set"}{r.trip?.state==="running"?` · ${r.trip.nextStop?`Next: ${r.trip.nextStop}`:"Route stops completed"}`:""}</small></span><span className={`fleet-state ${r.trip?.delay?"is-delay":r.trip?.state==="running"?"is-running":r.trip?.state==="completed"?"is-complete":""}`}>{stateText(r)}</span><ChevronRight size={16} aria-hidden/></button>;
 return <>
 <section className="transport-live" aria-labelledby="transport-live-title"><header><div><h2 id="transport-live-title">Bus activity</h2><p>{snapshot?`${active.length} running · ${active.filter(attention).length} need attention`:"Checking today's trips…"}</p></div><button type="button" className="fleet-view-all" onClick={()=>setSelected("all")} disabled={!snapshot}>View status<ChevronRight size={15} aria-hidden/></button></header>
 {error&&<p className="fleet-error" role="alert">{snapshot?"Update failed. Last received status is shown.":"Bus status is unavailable."}<button type="button" disabled={loading} onClick={()=>setRetry(x=>x+1)}>Retry</button></p>}
 {!snapshot&&!error?<p className="fleet-quiet">Loading trips…</p>:featured.length?<div>{featured.map(row)}</div>:snapshot?<p className="fleet-quiet">No trips running right now. Open status for today's route records.</p>:null}
 {snapshot&&<footer><span>Updated {clock(snapshot.asOf)}</span><button type="button" onClick={()=>setRetry(x=>x+1)} disabled={loading} aria-label="Refresh bus status"><RefreshCw size={14} aria-hidden/>Refresh</button></footer>}</section>
 <dialog ref={dialog} className="transport-live-dialog" aria-labelledby="fleet-dialog-title" onCancel={()=>setSelected(null)} onClose={()=>setSelected(null)} onClick={e=>{if(e.target===dialog.current){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)setSelected(null)}}}>
 <header><div><h2 id="fleet-dialog-title">{current?current.routeName:"Today's bus status"}</h2><p>{current?`${current.vehicleNo||"No vehicle"} · ${current.driverName||"Driver not assigned"}`:`${routes.length} routes · ${active.length} running`}</p></div><button type="button" onClick={()=>setSelected(null)} aria-label="Close bus status"><X size={20}/></button></header>
 <div className="fleet-dialog-body">{error&&<p role="alert" className="fleet-error">Connection lost. This is the last received snapshot.</p>}{!current?<div>{routes.map(row)}</div>:<>

 <div className="fleet-stop-box"><div className="fleet-stop-top"><h3>{current.trip?.state==="running"?"Next stop":current.trip?.state==="completed"?"Trip finished":"Trip status"}</h3>{current.trip?.position&&!error&&<a href={`https://www.google.com/maps/search/?api=1&query=${current.trip.position.lat},${current.trip.position.lng}`} target="_blank" rel="noopener noreferrer">{isFresh(current)?"View location":"View last location"}<ExternalLink size={12}/></a>}</div>
 <div className="fleet-stop-name"><p>{current.trip?.state==="running"?current.trip.nextStop||"All stops completed":current.trip?.endedAt?clock(current.trip.endedAt):"Not started today"}</p><span className={`fleet-state ${current.trip?.delay?"is-delay":current.trip?.state==="running"?"is-running":current.trip?.state==="completed"?"is-complete":""}`}>{stateText(current)}</span></div></div>
 {current.trip&&<div className="fleet-progress-inline"><span><b>{current.trip.stopsDone}/{current.stopsTotal}</b> stops complete</span><span><b>{current.trip.childrenMarked}</b> marked {current.trip.kind==="morning"?"on":"off"}</span></div>}
 {current.trip?.state==="running"&&<p className={isFresh(current)?"fleet-location-line":"fleet-location-line is-old"}>{!current.trip.at?"Waiting for the first location update":isFresh(current)?`Location updated ${clock(current.trip.at)}`:`Location unavailable - last update ${clock(current.trip.at)}`}</p>}
 {current.driverPhone&&<div className="fleet-detail-actions"><a href={`tel:${current.driverPhone}`}>Call driver</a></div>}

 </>}</div></dialog></>;
}
