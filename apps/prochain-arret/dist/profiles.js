/** Explicit presets, not a claim of operator coverage or timetable prediction. */
export const TRANSPORTS=Object.freeze([
  {id:'bus',label:'Bus / car',description:'Bus urbain, trolleybus, navette ou autocar.',radius:800,arrivalRadius:130,leadSeconds:60,maxDurationHours:6},
  {id:'tram',label:'Tramway',description:'Tramway et train léger en surface.',radius:800,arrivalRadius:130,leadSeconds:60,maxDurationHours:6},
  {id:'metro',label:'Métro / urbain',description:'Métro, monorail et trains urbains. En tunnel, prévoyez un rappel.',radius:1000,arrivalRadius:150,leadSeconds:60,maxDurationHours:6},
  {id:'train',label:'Train',description:'Train régional, grandes lignes ou train de nuit.',radius:3000,arrivalRadius:250,leadSeconds:60,maxDurationHours:24},
  {id:'highspeed',label:'Train à grande vitesse',description:'Approche plus anticipée et zone de gare élargie.',radius:8000,arrivalRadius:300,leadSeconds:120,maxDurationHours:24},
  {id:'ferry',label:'Bateau / ferry',description:'Navette fluviale, bateau-bus ou ferry. Vérifiez le terminal.',radius:1500,arrivalRadius:250,leadSeconds:60,maxDurationHours:48},
  {id:'cable',label:'Funiculaire / câble',description:'Funiculaire, téléphérique ou télécabine. Le GPS ne distingue pas des stations superposées ou très proches.',radius:500,arrivalRadius:130,leadSeconds:60,maxDurationHours:2},
  {id:'other',label:'Autre transport',description:'Choisissez un point et ajustez les zones de rappel.',radius:1000,arrivalRadius:150,leadSeconds:60,maxDurationHours:12},
].map(Object.freeze));
export function transportProfile(id){return TRANSPORTS.find(p=>p.id===id)||TRANSPORTS[0];}
export function profileForRoute(mode){
  const id=({bus:'bus',trolleybus:'bus',minibus:'bus',share_taxi:'bus',coach:'bus',tram:'tram',light_rail:'metro',subway:'metro',monorail:'metro',train:'train',railway:'train',highspeed:'highspeed',high_speed:'highspeed',ferry:'ferry',boat:'ferry',funicular:'cable',cable_car:'cable',aerialway:'cable',gondola:'cable',chair_lift:'cable'})[mode];
  return transportProfile(id||'other');
}
