import fr.prochainarret.app.Tracker;
import org.json.*;
import java.nio.file.*;
import java.util.*;
public class ParityTest {
 public static void main(String[] args)throws Exception{
  int reports=0,journeys=0;
  for(String line:Files.readAllLines(Paths.get(args[0]))){JSONObject fixture=new JSONObject(line);Tracker t=new Tracker(fixture.getJSONObject("config"));JSONArray points=fixture.getJSONArray("points");journeys++;
   for(int i=0;i<points.length();i++){JSONObject row=points.getJSONObject(i);long now=row.getLong("now");String actual=t.ingest(row.optJSONObject("p"),now),expected=row.isNull("event")?null:row.getString("event");String label=fixture.getString("name")+" report "+i;
    if(!Objects.equals(actual,expected)||t.early!=row.getBoolean("early")||t.arrived!=row.getBoolean("arrived")||!t.health(now).equals(row.getString("status")))throw new AssertionError(label+" event="+actual+" expected="+expected+" status="+t.health(now));
    if(!row.isNull("distance")&&Math.abs(t.distance-row.getDouble("distance"))>0.001)throw new AssertionError(label+" distance differs");reports++;
   }
  }
  System.out.println("Web/native parity passed: "+journeys+" trajectories, "+reports+" GPS reports.");
 }
}
