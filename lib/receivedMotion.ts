/** Interpolates only between received positions. Never extrapolates beyond the latest fix. */
export interface MotionPoint {lat:number;lng:number}
const distance=(a:MotionPoint,b:MotionPoint)=>Math.hypot((b.lat-a.lat)*111320,(b.lng-a.lng)*111320*Math.cos((a.lat+b.lat)*Math.PI/360));
export function receivedPath(from:MotionPoint,to:MotionPoint,road:[number,number][]=[]):MotionPoint[]{
  if(road.length<2)return[from,to];
  const nearest=(p:MotionPoint)=>{let index=0,best=Infinity;road.forEach(([lat,lng],i)=>{const d=distance(p,{lat,lng});if(d<best){best=d;index=i}});return{index,distance:best}};
  const a=nearest(from),b=nearest(to);
  if(a.distance>60||b.distance>60||b.index<=a.index)return[from,to];
  const points=[from,...road.slice(a.index+1,b.index).map(([lat,lng])=>({lat,lng})),to];
  const length=points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);
  return length<=distance(from,to)*2.5+30?points:[from,to];
}
export function receivedPointAt(points:MotionPoint[],progress:number):MotionPoint{
  if(progress<=0)return points[0];if(progress>=1)return points[points.length-1];
  const lengths=points.slice(1).map((p,i)=>distance(points[i],p));let left=lengths.reduce((a,b)=>a+b,0)*progress;
  for(let i=0;i<lengths.length;i++){if(left<=lengths[i]||i===lengths.length-1){const t=lengths[i]?left/lengths[i]:1;return{lat:points[i].lat+(points[i+1].lat-points[i].lat)*t,lng:points[i].lng+(points[i+1].lng-points[i].lng)*t}}left-=lengths[i]}
  return points[points.length-1];
}
export function animateReceivedPoint(from:MotionPoint,to:MotionPoint,update:(point:MotionPoint,progress:number)=>void,options:{duration?:number;road?:[number,number][];reduced?:boolean}={},scheduler={now:()=>performance.now(),request:(fn:FrameRequestCallback)=>requestAnimationFrame(fn),cancel:(id:number)=>cancelAnimationFrame(id)}){
  if(options.reduced||distance(from,to)>600||distance(from,to)<.1){update(to,1);return()=>{}}
  const points=receivedPath(from,to,options.road);const start=scheduler.now();const duration=options.duration||900;let frame=0,stopped=false;
  const tick=(time:number)=>{if(stopped)return;const progress=Math.min(1,Math.max(0,(time-start)/duration));update(receivedPointAt(points,progress),progress);if(progress<1)frame=scheduler.request(tick)};
  frame=scheduler.request(tick);return()=>{stopped=true;scheduler.cancel(frame)};
}
export const receivedHeading=(from:number,to:number,progress:number)=>from+(((to-from+540)%360)-180)*progress;
