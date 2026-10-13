package fr.prochainarret.app;
import org.json.*;
/** Same rules as dist/engine.js; runnable on the JVM with a JSON dependency. */
public final class Tracker {
 public boolean early=false,arrived=false;public double distance=Double.NaN;public String status="waiting";public JSONObject lastGood=null;private int hits=0;private long nearSince=-1;private final JSONObject config;
 public Tracker(JSONObject c){if(!valid(c))throw new IllegalArgumentException("Invalid trip");config=c;}
 private static boolean number(JSONObject p,String key){return p!=null&&p.opt(key) instanceof Number&&Double.isFinite(p.optDouble(key));}
 public static boolean point(JSONObject p){return number(p,"lat")&&number(p,"lon")&&Math.abs(p.optDouble("lat"))<=90&&Math.abs(p.optDouble("lon"))<=180;}
 public static boolean valid(JSONObject c){
  if(c==null)return false;JSONObject t=c.optJSONObject("target");
  return point(t)&&t.opt("name") instanceof String&&!t.optString("name").trim().isEmpty()&&t.optString("name").length()<=160&&
   number(c,"radius")&&c.optDouble("radius")>=300&&c.optDouble("radius")<=5000&&
   (!c.has("arrivalRadius")||(number(c,"arrivalRadius")&&c.optDouble("arrivalRadius")>=75&&c.optDouble("arrivalRadius")<=250))&&
   (!c.has("backup")||(number(c,"backup")&&c.optDouble("backup")>=0&&c.optDouble("backup")<=360&&c.optDouble("backup")==Math.floor(c.optDouble("backup"))))&&
   (!c.has("previous")||c.isNull("previous")||point(c.optJSONObject("previous")));
 }
 public static double distance(JSONObject a,JSONObject b){double r=Math.PI/180,pa=a.optDouble("lat")*r,pb=b.optDouble("lat")*r,dl=(b.optDouble("lon")-a.optDouble("lon"))*r,dp=pb-pa;double h=Math.pow(Math.sin(dp/2),2)+Math.cos(pa)*Math.cos(pb)*Math.pow(Math.sin(dl/2),2);return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
 public String ingest(JSONObject p,long now){
  double accuracy=p==null?-1:p.optDouble("accuracy",-1);long time=p==null?0:p.optLong("timestamp",0);
  if(!point(p)||!number(p,"accuracy")||accuracy<0||!number(p,"timestamp")||time>now+5000||now-time>30000){status="stale";hits=0;nearSince=-1;return null;}
  if(accuracy>150){status="weak";hits=0;nearSince=-1;return null;}
  if(lastGood!=null){long last=lastGood.optLong("timestamp");if(time<=last)return null;double dt=(time-last)/1000d;if(dt>30){hits=0;nearSince=-1;}if(dt<30&&distance(p,lastGood)>110*dt+lastGood.optDouble("accuracy")+accuracy){status="jump";hits=0;nearSince=-1;return null;}}
  lastGood=p;distance=distance(p,config.optJSONObject("target"));status="good";if(arrived)return null;
  boolean near=distance+accuracy<=config.optDouble("arrivalRadius",130);if(!near){hits=0;nearSince=-1;}else if(nearSince<0){nearSince=time;hits=1;}else if(time-nearSince>=1500)hits=2;
  if(hits>=2||(near&&accuracy<=25)){arrived=true;early=true;return "arrived";}
  JSONObject previous=config.optJSONObject("previous");boolean before=previous!=null&&distance(p,previous)<=200;boolean fallback=distance-accuracy<=config.optDouble("radius");
  if(!early&&(before||fallback)){early=true;return before?"previous":"approach";}return null;
 }
 public String health(long now){return lastGood==null?status:now-lastGood.optLong("timestamp")>30000?"stale":status;}
}
