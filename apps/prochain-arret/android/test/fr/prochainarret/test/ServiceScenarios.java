package fr.prochainarret.test;
import android.app.*;
import android.content.*;
import android.location.*;
import android.os.*;
import android.service.notification.StatusBarNotification;
import fr.prochainarret.app.*;
import org.json.*;
import java.util.function.BooleanSupplier;

/** Native service/lifecycle tests. Does not control or evaluate the embedded browser. */
public class ServiceScenarios extends Instrumentation {
 private Bundle arguments;private Context context;private LocationManager locations;private int assertions=0;
 @Override public void onCreate(Bundle args){super.onCreate(args);arguments=args;start();}
 private void check(boolean value,String label){if(!value)throw new AssertionError(label);assertions++;}
 private void eventually(BooleanSupplier condition,long timeout,String label){long deadline=SystemClock.elapsedRealtime()+timeout;while(!condition.getAsBoolean()&&SystemClock.elapsedRealtime()<deadline)SystemClock.sleep(100);check(condition.getAsBoolean(),label);}
 private JSONObject state(){try{return new JSONObject(context.getSharedPreferences("trip",0).getString("state","{}"));}catch(Exception e){throw new RuntimeException(e);}}
 private boolean notification(int id){for(StatusBarNotification n:context.getSystemService(NotificationManager.class).getActiveNotifications())if(n.getId()==id)return true;return false;}
 private void shell(String command)throws Exception{try(ParcelFileDescriptor fd=getUiAutomation().executeShellCommand(command);java.io.InputStream in=new ParcelFileDescriptor.AutoCloseInputStream(fd)){byte[] buf=new byte[1024];while(in.read(buf)!=-1){}}}
 private void fix(double offset,float accuracy){Location l=new Location(LocationManager.GPS_PROVIDER);l.setLatitude(48.85+offset);l.setLongitude(2.35);l.setAccuracy(accuracy);l.setTime(System.currentTimeMillis());l.setElapsedRealtimeNanos(SystemClock.elapsedRealtimeNanos());locations.setTestProviderLocation(LocationManager.GPS_PROVIDER,l);}
 private void mockProviders(){locations=context.getSystemService(LocationManager.class);for(String p:new String[]{LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER}){locations.addTestProvider(p,false,false,false,false,true,true,true,Criteria.POWER_LOW,Criteria.ACCURACY_FINE);locations.setTestProviderEnabled(p,true);}}
 private Activity visible()throws Exception{shell("input keyevent 224");shell("wm dismiss-keyguard");Activity a=startActivitySync(new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));waitForIdleSync();return a;}
 private void startTrip()throws Exception{JSONObject c=new JSONObject().put("id","instrumented-"+System.currentTimeMillis()).put("target",new JSONObject().put("name","Test terminus").put("lat",48.85).put("lon",2.35)).put("radius",800).put("arrivalRadius",130).put("backup",1).put("sound",true).put("vibration",true);context.startForegroundService(new Intent(context,TripService.class).setAction("START").putExtra("config",c.toString()));eventually(()->TripService.running&&notification(1),10000,"foreground service and permanent notification");}
 @Override public void onStart(){super.onStart();context=getTargetContext();Bundle result=new Bundle();String phase=arguments.getString("phase","background");
  try{
   if(phase.equals("recovery")){
    check(!TripService.running,"force-stop leaves service stopped");check(state().has("config"),"interrupted trip remains available for explicit recovery");
    Activity activity=visible();SystemClock.sleep(2000);check(!TripService.running,"opening the app does not silently resume GPS");check(!notification(1),"no misleading ongoing notification after force-stop");runOnMainSync(()->activity.finish());
   }else if(phase.equals("denied")){
    visible();JSONObject c=new JSONObject().put("target",new JSONObject().put("name","Test").put("lat",48.85).put("lon",2.35)).put("radius",800);
    context.startForegroundService(new Intent(context,TripService.class).setAction("START").putExtra("config",c.toString()));
    eventually(()->state().has("error")&&!state().isNull("error"),10000,"permission denial persisted as an explicit error");eventually(()->!TripService.running,5000,"denied service stopped");check(!notification(1),"denied tracking does not leave an ongoing notification");
   }else{
    Activity activity=visible();mockProviders();startTrip();
    if(phase.equals("prepare-interruption")){fix(.012,20);eventually(()->"good".equals(state().optString("status")),10000,"valid initial fix before interruption");}
    else{
     fix(.012,20);eventually(()->"good".equals(state().optString("status")),10000,"initial GPS received");check(!state().optBoolean("early"),"far away: no approach alert");
     runOnMainSync(()->activity.moveTaskToBack(true));shell("input keyevent 223");eventually(()->!context.getSystemService(PowerManager.class).isInteractive(),5000,"screen is off");
     eventually(()->notification(4),60000,"GPS-loss notification while backgrounded and screen off");check(!state().optBoolean("arrived"),"missing GPS cannot cause arrival");
     eventually(()->notification(5),25000,"backup timer delivered without GPS while screen off");
     fix(.006,20);eventually(()->state().optBoolean("early")&&notification(2),10000,"approach delivered while backgrounded and screen off");
     check(TripService.running,"service remains alive in background");SystemClock.sleep(7000);fix(.0004,20);
     eventually(()->state().optBoolean("arrived")&&notification(3),10000,"arrival delivered while backgrounded and screen off");
     context.startService(new Intent(context,TripService.class).setAction("ACK"));eventually(()->!notification(2)&&!notification(3),5000,"acknowledgement dismisses alerts");SystemClock.sleep(9000);check(!notification(3),"acknowledgement cancels repeated arrival alarm");SystemClock.sleep(36000);check(!notification(4)&&!notification(5),"no later GPS or timer alert replaces arrival");
     context.startService(new Intent(context,TripService.class).setAction("STOP"));eventually(()->!TripService.running&&!notification(1),5000,"stop destroys service and foreground notification");
     check(context.getSharedPreferences("trip",0).getAll().isEmpty(),"stop clears persisted active journey");
     check(context.getSystemService(NotificationManager.class).getActiveNotifications().length==0,"stop clears every notification");
    }
   }
   result.putString("stream","PROCHAIN_ARRET_TESTS_PASSED phase="+phase+" assertions="+assertions+"\n");finish(Activity.RESULT_OK,result);
  }catch(Throwable e){result.putString("stream","PROCHAIN_ARRET_TESTS_FAILED phase="+phase+" "+android.util.Log.getStackTraceString(e));finish(Activity.RESULT_CANCELED,result);}
 }
}
