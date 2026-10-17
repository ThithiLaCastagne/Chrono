/** One web journey per origin. Native service ownership is handled by Android. */
export function createTripOwnership({storage,locks,now=Date.now,id=Math.random().toString(36).slice(2)}={}){
  const key='pa:owner',ttl=20000;let held=false,unlock=null,sequence=0,volatile=false;
  const read=()=>{try{return JSON.parse(storage.getItem(key))}catch{return null}};
  function release(){sequence++;held=false;if(unlock){unlock();unlock=null}try{if(read()?.id===id)storage.removeItem(key)}catch{}}
  async function acquire(){
    if(held)return true;const token=++sequence;
    if(locks?.request){
      return new Promise(resolve=>{
        let answered=false;const answer=value=>{if(!answered){answered=true;clearTimeout(timer);resolve(value)}};
        const timer=setTimeout(()=>{if(token===sequence)sequence++;answer(false)},3000);
        try{Promise.resolve(locks.request('prochain-arret-trip',{ifAvailable:true},lock=>{
          if(!lock||token!==sequence){answer(false);return}
          held=true;answer(true);return new Promise(done=>{unlock=done});
        })).catch(()=>answer(false))}catch{answer(false)}
      });
    }
    const other=read();if(other?.id&&other.id!==id&&Number.isFinite(other.at)&&now()-other.at<ttl)return false;
    try{storage.setItem(key,JSON.stringify({id,at:now()}));held=read()?.id===id;return held}catch{volatile=true;held=true;return true}
  }
  function renew(){
    if(!held)return false;if(unlock||volatile)return true;
    const other=read();if(other?.id&&other.id!==id){held=false;return false}
    try{storage.setItem(key,JSON.stringify({id,at:now()}));return true}catch{volatile=true;return true}
  }
  return {acquire,release,renew,get volatile(){return volatile},get held(){return held}};
}
