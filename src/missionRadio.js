// Optional browser speech; subtitles remain in the mission panel if unavailable.
export function createMissionRadio(synth,Utterance){
 let enabled=false,lastKey=null;
 const available=!!synth&&typeof Utterance==='function';
 return {
  get available(){return available;},get enabled(){return enabled;},
  setEnabled(value){enabled=available&&!!value;lastKey=null;if(!enabled&&available)synth.cancel();return enabled;},
  announce(key,text){if(!enabled||!key||key===lastKey||!text)return false;lastKey=key;try{synth.cancel();const speech=new Utterance(text);speech.lang='en-US';speech.rate=.95;synth.speak(speech);return true;}catch{return false;}},
  stop(){if(available)synth.cancel();lastKey=null;}
 };
}
