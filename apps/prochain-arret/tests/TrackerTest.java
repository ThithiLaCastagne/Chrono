import fr.prochainarret.app.Tracker;
import org.json.JSONObject;
public class TrackerTest {
 static final long NOW=1700000000000L;
 static JSONObject cfg() throws Exception{return new JSONObject().put("target",new JSONObject().put("name","Test").put("lat",48.85).put("lon",2.35)).put("radius",800).put("arrivalRadius",130);}
 static JSONObject point(double off,double acc,long time)throws Exception{return new JSONObject().put("lat",48.85+off).put("lon",2.35).put("accuracy",acc).put("timestamp",time);}
 static void equal(Object a,Object b){if(!java.util.Objects.equals(a,b))throw new AssertionError("Expected "+b+", got "+a);}
 public static void main(String[] args)throws Exception{
  Tracker t=new Tracker(cfg());equal(t.ingest(point(.02,20,NOW),NOW),null);equal(t.ingest(point(.006,20,NOW+20000),NOW+20000),"approach");equal(t.ingest(point(.005,20,NOW+23000),NOW+23000),null);equal(t.ingest(point(.0005,20,NOW+33000),NOW+33000),"arrived");equal(t.ingest(point(0,20,NOW+36000),NOW+36000),null);
  t=new Tracker(cfg());equal(t.ingest(point(0,500,NOW),NOW),null);equal(t.arrived,false);equal(t.status,"weak");
  t=new Tracker(cfg());equal(t.ingest(point(0,20,NOW-31000),NOW),null);equal(t.status,"stale");
  t=new Tracker(cfg());t.ingest(point(.1,20,NOW),NOW);equal(t.ingest(point(0,20,NOW+1000),NOW+1000),null);equal(t.status,"jump");equal(t.ingest(point(0,20,NOW+60000),NOW+60000),"arrived");
  t=new Tracker(cfg());equal(t.ingest(point(.0004,60,NOW),NOW),"approach");equal(t.arrived,false);equal(t.ingest(point(.0004,60,NOW+3000),NOW+3000),"arrived");
  t=new Tracker(cfg().put("radius",300).put("previous",new JSONObject().put("lat",48.87).put("lon",2.35)));equal(t.ingest(point(.02,20,NOW),NOW),"previous");
  t=new Tracker(cfg().put("radius",8000).put("arrivalRadius",300).put("maxDurationHours",24).put("leadSeconds",120));
  t.ingest(point(.09,20,NOW),NOW);t.ingest(point(.08375,20,NOW+5000),NOW+5000);equal(t.status,"good");
  t=new Tracker(cfg().put("arrivalRadius",250));equal(t.ingest(point(.00162,20,NOW),NOW),"arrived");
  t=new Tracker(cfg().put("leadSeconds",60));t.ingest(point(.045,20,NOW),NOW);t.ingest(point(.0405,20,NOW+10000),NOW+10000);t.ingest(point(.036,20,NOW+20000),NOW+20000);if(t.approachRadius<2700)throw new AssertionError("No adaptive approach margin");
  t.ingest(point(.035,1000,NOW+21000),NOW+21000);equal(t.health(NOW+21000),"good");equal(t.health(NOW+51000),"stale");
  equal(Tracker.valid(cfg().put("maxDurationHours",72).put("backup",4320)),true);equal(Tracker.valid(cfg().put("maxDurationHours",73)),false);equal(Tracker.valid(cfg().put("arrivalRadius",800)),false);
  System.out.println("Native tracker scenarios passed: baseline, fast rail, large stations, adaptive approach, provider health and bounded long journeys.");
 }
}
