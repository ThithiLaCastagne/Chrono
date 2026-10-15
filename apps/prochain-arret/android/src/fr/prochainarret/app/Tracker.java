package fr.prochainarret.app;
import org.json.*;
/** Same rules as dist/engine.js; runnable on the JVM with a JSON dependency. */
public final class Tracker {
 public static final double MAX_SPEED=200;
 public boolean early=false,arrived=false;public double distance=Double.NaN,approachRadius;public String status="waiting";public JSONObject lastGood=null;
 private int hits=0,closingCount=0;private long nearSince=-1;private final JSONObject config;private JSONObject trendFix=null;private final double[] closingSpeeds=new double[2];
 public Tracker(JSONObject c){if(!valid(c))throw new IllegalArgumentException("Invalid trip");try{config=new JSONObject(c.toString());}catch(JSONException e){throw new IllegalArgumentException("Invalid trip",e);}approachRadius=config.optDouble("radius");}
 private static boolean number(JSONObject p,String key){return p!=null&&p.opt(key) instanceof Number&&Double.isFinite(p.optDouble(key));}
 public static boolean point(JSONObject p){return number(p,"lat")&&number(p,"lon")&&Math.abs(p.optDouble("lat"))<=90&&Math.abs(p.optDouble("lon"))<=180;}
 private static boolean optionalNumber(JSONObject c,String key,double min,double max,boolean integer){return !c.has(key)||(number(c,key)&&c.optDouble(key)>=min&&c.optDouble(key)<=max&&(!integer||c.optDouble(key)==Math.floor(c.optDouble(key))));}
 public static boolean valid(JSONObject c){
  if(c==null)return false;JSONObject t=c.optJSONObject("target");
  return point(t)&&t.opt("name") instanceof String&&!t.optString("name").trim().isEmpty()&&t.optString("name").length()<=160&&
   number(c,"radius")&&c.optDouble("radius")>=300&&c.optDouble("radius")<=30000&&
   optionalNumber(c,"arrivalRadius",75,1000,false)&&(!c.has("arrivalRadius")||c.optDouble("arrivalRadius")<c.optDouble("radius"))&&
   optionalNumber(c,"backup",0,4320,true)&&optionalNumber(c,"leadSeconds",0,300,false)&&optionalNumber(c,"maxDurationHours",1,72,true)&&
   (!c.has("previous")||c.isNull("previous")||point(c.optJSONObject("previous")));
 }
 public static double distance(JSONObject a,JSONObject b){double r=Math.PI/180,pa=a.optDouble("lat")*r,pb=b.optDouble("lat")*r,dl=(b.optDouble("lon")-a.optDouble("lon"))*r,dp=pb-pa;double h=Math.pow(Math.sin(dp/2),2)+Math.cos(pa)*Math.cos(pb)*Math.pow(Math.sin(dl/2),2);return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
 private void resetApproach(){closingCount=0;trendFix=null;approachRadius=config.optDouble("radius");}
 private void updateApproach(JSONObject p){
  if(config.optDouble("leadSeconds",0)==0){resetApproach();return;}
  if(trendFix==null){trendFix=p;return;}
  JSONObject anchor=trendFix;double dt=(p.optLong("timestamp")-anchor.optLong("timestamp"))/1000d;
  if(dt<2)return;
  if(dt>30||p.optDouble("accuracy")>75||anchor.optDouble("accuracy")>75){resetApproach();trendFix=p;return;}
  trendFix=p;double closing=(distance(anchor,config.optJSONObject("target"))-distance(p,config.optJSONObject("target"))-p.optDouble("accuracy")-anchor.optDouble("accuracy"))/dt;
  if(closing<=0||closing>MAX_SPEED){closingCount=0;approachRadius=config.optDouble("radius");return;}
  if(closingCount<2)closingSpeeds[closingCount++]=closing;else{closingSpeeds[0]=closingSpeeds[1];closingSpeeds[1]=closing;}
  if(closingCount<2)return;
  double slow=Math.min(closingSpeeds[0],closingSpeeds[1]),fast=Math.max(closingSpeeds[0],closingSpeeds[1]);
  approachRadius=fast<=slow*1.8?Math.min(30000,Math.max(config.optDouble("radius"),slow*config.optDouble("leadSeconds"))):config.optDouble("radius");
 }
 public String ingest(JSONObject p,long now){
  double accuracy=p==null?-1:p.optDouble("accuracy",-1);long time=p==null?0:p.optLong("timestamp",0);
  if(!point(p)||!number(p,"accuracy")||accuracy<0||!number(p,"timestamp")||time>now+5000||now-time>30000){status="stale";hits=0;nearSince=-1;resetApproach();return null;}
  if(accuracy>150){status="weak";hits=0;nearSince=-1;resetApproach();return null;}
  if(lastGood!=null){long last=lastGood.optLong("timestamp");if(time<=last)return null;double dt=(time-last)/1000d;if(dt>30){hits=0;nearSince=-1;}if(dt<30&&distance(p,lastGood)>MAX_SPEED*dt+lastGood.optDouble("accuracy")+accuracy){status="jump";hits=0;nearSince=-1;resetApproach();return null;}}
  updateApproach(p);lastGood=p;distance=distance(p,config.optJSONObject("target"));status="good";if(arrived)return null;
  boolean near=distance+accuracy<=config.optDouble("arrivalRadius",130);if(!near){hits=0;nearSince=-1;}else if(nearSince<0){nearSince=time;hits=1;}else if(time-nearSince>=1500)hits=2;
  if(hits>=2||(near&&accuracy<=25)){arrived=true;early=true;return "arrived";}
  JSONObject previous=config.optJSONObject("previous");boolean before=previous!=null&&distance(p,previous)<=200;boolean fallback=distance-accuracy<=approachRadius;
  if(!early&&(before||fallback)){early=true;return before?"previous":"approach";}return null;
 }
 public String health(long now){return lastGood==null?status:now-lastGood.optLong("timestamp")>30000?"stale":"good";}
}
