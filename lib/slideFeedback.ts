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

/** One note: a short bell-like tone at `offset` seconds. */
function tone(audio: AudioContext, out: AudioNode, frequency: number, offset: number, length: number, level: number, type: OscillatorType = "sine") {
  const time = audio.currentTime + offset;
  const oscillator = audio.createOscillator();
  const envelope = audio.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  envelope.gain.setValueAtTime(0.0001, time);
  envelope.gain.exponentialRampToValueAtTime(level, time + 0.015);
  envelope.gain.exponentialRampToValueAtTime(0.0001, time + length);
  oscillator.connect(envelope);
  envelope.connect(out);
  oscillator.start(time);
  oscillator.stop(time + length + 0.02);
  oscillator.onended = () => {
    oscillator.disconnect();
    envelope.disconnect();
  };
}

function melody(notes: [number, number, number, OscillatorType?][]) {
  primeSlideFeedback();
  const audio = context;
  if (!audio || audio.state !== "running") return;
  try {
    const output = audio.createGain();
    output.gain.value = 0.5; // louder than the quiet latch: the cab has an engine
    output.connect(audio.destination);
    for (const [f, at, len, type] of notes) tone(audio, output, f, at, len, 0.5, type);
    setTimeout(() => output.disconnect(), 1500);
  } catch {
    /* Muted/unsupported devices keep the visual feedback. */
  }
}

/** Slide finished, trip starting: C5 E5 G5 climbing, then a bright high C. "Go." */
export function playTripStart() {
  melody([[523.25, 0, 0.2], [659.25, 0.09, 0.2], [783.99, 0.18, 0.2], [1046.5, 0.27, 0.5], [523.25, 0.27, 0.5, "triangle"]]);
}

/** Trip ended: G5 E5 C5 coming down, then a soft low C+G to close it. "Done, well driven." */
export function playTripEnd() {
  melody([[783.99, 0, 0.22], [659.25, 0.11, 0.22], [523.25, 0.22, 0.24], [261.63, 0.36, 0.7, "triangle"], [392, 0.36, 0.7, "triangle"]]);
}

/** Ask the phone for its location now (the "Allow location?" question), so it is not asked mid-trip. */
export function askForLocation(done?: (state: "ok" | "denied") => void) {
  try {
    if (!("geolocation" in navigator)) return done?.("denied");
    navigator.geolocation.getCurrentPosition(
      () => done?.("ok"),
      (e) => done?.(e.code === 1 ? "denied" : "ok"),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 }
    );
  } catch {
    done?.("denied");
  }
}
