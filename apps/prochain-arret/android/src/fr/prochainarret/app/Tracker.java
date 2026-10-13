package fr.prochainarret.app;
import org.json.*;
/** Same rules as dist/engine.js; runnable on the JVM with a JSON dependency. */
public final class Tracker {
 public boolean early=false,arrived=false;public double distance=Double.NaN;public String status="waiting";public JSONObject lastGood=null;private int hits=0;private final JSONObject config;
 public Tracker(JSONObject c){if(!valid(c))throw new IllegalArgumentException("Invalid trip");config=c;}
 public static boolean point(JSONObject p){return p!=null&&Double.isFinite(p.optDouble("lat"))&&Double.isFinite(p.optDouble("lon"))&&Math.abs(p.optDouble("lat"))<=90&&Math.abs(p.optDouble("lon"))<=180;}
 public static boolean valid(JSONObject c){return c!=null&&point(c.optJSONObject("target"))&&!c.optJSONObject("target").optString("name").isEmpty()&&c.optInt("radius")>=300&&c.optInt("radius")<=5000&&(!c.has("previous")||c.isNull("previous")||point(c.optJSONObject("previous")));}
 public static double distance(JSONObject a,JSONObject b){double r=Math.PI/180,pa=a.optDouble("lat")*r,pb=b.optDouble("lat")*r,dl=(b.optDouble("lon")-a.optDouble("lon"))*r,dp=pb-pa;double h=Math.pow(Math.sin(dp/2),2)+Math.cos(pa)*Math.cos(pb)*Math.pow(Math.sin(dl/2),2);return 6371000*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
 public String ingest(JSONObject p,long now){
  double accuracy=p.optDouble("accuracy",-1);long time=p.optLong("timestamp",0);
  if(!point(p)||!Double.isFinite(accuracy)||accuracy<0||time==0||time>now+5000||now-time>30000){status="stale";return null;}
  if(accuracy>150){status="weak";hits=0;return null;}
  if(lastGood!=null){long last=lastGood.optLong("timestamp");if(time<=last)return null;double dt=(time-last)/1000d;if(dt<30&&distance(p,lastGood)>110*dt+lastGood.optDouble("accuracy")+accuracy){status="jump";hits=0;return null;}}
  lastGood=p;distance=distance(p,config.optJSONObject("target"));status="good";if(arrived)return null;
  boolean near=distance+Math.min(accuracy,50)<=config.optInt("arrivalRadius",130);hits=near?hits+1:0;
  if(hits>=2||(near&&accuracy<=25)){arrived=true;early=true;return "arrived";}
  JSONObject previous=config.optJSONObject("previous");boolean before=previous!=null&&distance(p,previous)<=200;boolean fallback=distance-accuracy<=config.optInt("radius");
  if(!early&&(before||fallback)){early=true;return before?"previous":"approach";}return null;
 }
 public String health(long now){return lastGood==null||now-lastGood.optLong("timestamp")>30000?"stale":status;}
}
