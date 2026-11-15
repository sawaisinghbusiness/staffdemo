"use client";
let context:AudioContext|null=null;
/** Prime only from an explicit gesture; iOS may otherwise keep Web Audio suspended. */
export function primeSlideFeedback(){
 try{const Constructor=window.AudioContext||(window as typeof window&{webkitAudioContext?:typeof AudioContext}).webkitAudioContext;if(!Constructor)return;if(!context||context.state==="closed")context=new Constructor();if(context.state==="suspended")void context.resume().catch(()=>{})}catch{/* Feedback never blocks a trip action. */}
}
/** A quiet, short tonal latch: no noise burst, loop, imported alert or autoplay. */
export function playSlideFeedback(){
 primeSlideFeedback();const audio=context;if(!audio||audio.state!=="running")return;
 try{const time=audio.currentTime;const output=audio.createGain();output.gain.value=.16;output.connect(audio.destination);
  for(const [frequency,offset,level] of [[554.37,0,.28],[830.61,.025,.12]]){
   const oscillator=audio.createOscillator(),envelope=audio.createGain();oscillator.type="sine";oscillator.frequency.setValueAtTime(frequency*.985,time+offset);oscillator.frequency.exponentialRampToValueAtTime(frequency,time+offset+.045);
   envelope.gain.setValueAtTime(.0001,time+offset);envelope.gain.exponentialRampToValueAtTime(level,time+offset+.012);envelope.gain.exponentialRampToValueAtTime(.0001,time+offset+.17);
   oscillator.connect(envelope);envelope.connect(output);oscillator.start(time+offset);oscillator.stop(time+offset+.19);oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect()};
  }
  setTimeout(()=>output.disconnect(),300);
 }catch{/* Muted/unsupported devices retain visual feedback. */}
}
