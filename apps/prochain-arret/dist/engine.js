/** Pure, deterministic geofence state machine. No network or platform dependency. */
export const MAX_AGE = 30000;
export const MAX_SPEED = 200; // 720 km/h: accepts fast rail while rejecting teleports.
export function distance(a,b) {
  const r=Math.PI/180, p1=a.lat*r,p2=b.lat*r,dl=(b.lon-a.lon)*r,dp=p2-p1;
  const h=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function validPoint(p) {return !!p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;}
export function validTrip(c) {
  return !!c&&validPoint(c.target)&&typeof c.target.name==='string'&&c.target.name.trim().length>0&&c.target.name.length<=160&&
    Number.isFinite(c.radius)&&c.radius>=300&&c.radius<=30000&&
    (c.arrivalRadius===undefined||(Number.isFinite(c.arrivalRadius)&&c.arrivalRadius>=75&&c.arrivalRadius<=1000&&c.arrivalRadius<c.radius))&&
    (c.backup===undefined||(Number.isInteger(c.backup)&&c.backup>=0&&c.backup<=4320))&&
    (c.leadSeconds===undefined||(Number.isFinite(c.leadSeconds)&&c.leadSeconds>=0&&c.leadSeconds<=300))&&
    (c.maxDurationHours===undefined||(Number.isInteger(c.maxDurationHours)&&c.maxDurationHours>=1&&c.maxDurationHours<=72))&&
    (c.previous==null||validPoint(c.previous));
}
export class TripEngine {
  constructor(config,saved={}) {
    if(!validTrip(config))throw new Error('Destination invalide');
    this.config={...config,target:{...config.target},previous:config.previous?{...config.previous}:null};this.early=saved?.early===true;this.arrived=saved?.arrived===true;
    this.last=null;this.lastGood=null;this.distance=null;this.hits=0;this.nearSince=null;this.status='waiting';this.started=Date.now();
    this.closingSpeeds=[];this.trendFix=null;this.approachRadius=config.radius;
  }
  ingest(p, now=Date.now()) {
    const events=[];
    if(!validPoint(p)||!Number.isFinite(p.accuracy)||p.accuracy<0||!Number.isFinite(p.timestamp)||p.timestamp>now+5000||now-p.timestamp>MAX_AGE){this.status='stale';this.hits=0;this.nearSince=null;this.resetApproach();return events;}
    if(p.accuracy>150){this.status='weak';this.hits=0;this.nearSince=null;this.resetApproach();return events;}
    if(this.lastGood&&p.timestamp<=this.lastGood.timestamp)return events;
    if(this.lastGood) {
      const dt=(p.timestamp-this.lastGood.timestamp)/1000;if(dt>30){this.hits=0;this.nearSince=null;}
      if(dt<30&&distance(p,this.lastGood)>MAX_SPEED*dt+this.lastGood.accuracy+p.accuracy){this.status='jump';this.hits=0;this.nearSince=null;this.resetApproach();return events;}
    }
    this.updateApproach(p);
    this.last=p;this.lastGood=p;this.distance=distance(p,this.config.target);this.status='good';
    if(this.arrived)return events;
    const arrivalRadius=this.config.arrivalRadius||130;
    const near=this.distance+p.accuracy<=arrivalRadius;
    if(!near){this.hits=0;this.nearSince=null;}else if(this.nearSince===null){this.nearSince=p.timestamp;this.hits=1;}else if(p.timestamp-this.nearSince>=1500)this.hits=2;
    if(this.hits>=2||(near&&p.accuracy<=25)) {
      this.arrived=true;this.early=true;events.push('arrived');return events;
    }
    const prev=this.config.previous;
    const nearPrevious=prev&&distance(p,prev)<=200;
    // Distance fallback is always retained: a missing stop fix must not suppress the warning.
    const fallback=this.distance-p.accuracy<=this.approachRadius;
    if(!this.early&&(nearPrevious||fallback)) {this.early=true;events.push(nearPrevious?'previous':'approach');}
    return events;
  }
  resetApproach(){this.closingSpeeds=[];this.trendFix=null;this.approachRadius=this.config.radius;}
  updateApproach(p){
    if(!this.config.leadSeconds){this.resetApproach();return;}
    if(!this.trendFix){this.trendFix={...p};return;}
    const anchor=this.trendFix,dt=(p.timestamp-anchor.timestamp)/1000;
    // Ignore same-moment providers, noisy fixes and gaps: none establish a trend.
    if(dt<2)return;
    if(dt>30||p.accuracy>75||anchor.accuracy>75){this.resetApproach();this.trendFix={...p};return;}
    this.trendFix={...p};
    const closing=(distance(anchor,this.config.target)-distance(p,this.config.target)-p.accuracy-anchor.accuracy)/dt;
    if(closing<=0||closing>MAX_SPEED){this.closingSpeeds=[];this.approachRadius=this.config.radius;return;}
    this.closingSpeeds.push(closing);if(this.closingSpeeds.length>2)this.closingSpeeds.shift();
    if(this.closingSpeeds.length<2)return;
    const slow=Math.min(...this.closingSpeeds),fast=Math.max(...this.closingSpeeds);
    this.approachRadius=fast<=slow*1.8?Math.min(30000,Math.max(this.config.radius,slow*this.config.leadSeconds)):this.config.radius;
  }
  health(now=Date.now()) {if(!this.lastGood)return this.status;if(now-this.lastGood.timestamp>MAX_AGE)return 'stale';return 'good';}
  snapshot(){return {early:this.early,arrived:this.arrived};}
}
