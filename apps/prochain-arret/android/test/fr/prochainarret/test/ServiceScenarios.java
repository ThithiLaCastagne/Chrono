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
 private void progress(String label){Bundle status=new Bundle();status.putString("stream","PROCHAIN_ARRET_PROGRESS "+label+"\n");sendStatus(0,status);}
 private void check(boolean value,String label){if(!value)throw new AssertionError(label);assertions++;progress("check="+assertions+" "+label);}
 private void eventually(BooleanSupplier condition,long timeout,String label){long deadline=SystemClock.elapsedRealtime()+timeout;while(!condition.getAsBoolean()&&SystemClock.elapsedRealtime()<deadline)SystemClock.sleep(100);check(condition.getAsBoolean(),label);}
 private JSONObject state(){try{return new JSONObject(context.getSharedPreferences("trip",0).getString("state","{}"));}catch(Exception e){throw new RuntimeException(e);}}
 private boolean notification(int id){for(StatusBarNotification n:context.getSystemService(NotificationManager.class).getActiveNotifications())if(n.getId()==id)return true;return false;}
 private Notification notificationValue(int id){for(StatusBarNotification n:context.getSystemService(NotificationManager.class).getActiveNotifications())if(n.getId()==id)return n.getNotification();throw new AssertionError("Missing notification "+id);}
 private void shell(String command)throws Exception{try(ParcelFileDescriptor fd=getUiAutomation().executeShellCommand(command);java.io.InputStream in=new ParcelFileDescriptor.AutoCloseInputStream(fd)){byte[] buf=new byte[1024];while(in.read(buf)!=-1){}}}
 private void fix(double offset,float accuracy){Location l=new Location(LocationManager.GPS_PROVIDER);l.setLatitude(48.85+offset);l.setLongitude(2.35);l.setAccuracy(accuracy);l.setTime(System.currentTimeMillis());l.setElapsedRealtimeNanos(SystemClock.elapsedRealtimeNanos());locations.setTestProviderLocation(LocationManager.GPS_PROVIDER,l);}
 private void mockProviders(){locations=context.getSystemService(LocationManager.class);for(String p:new String[]{LocationManager.GPS_PROVIDER,LocationManager.NETWORK_PROVIDER}){locations.addTestProvider(p,false,false,false,false,true,true,true,Criteria.POWER_LOW,Criteria.ACCURACY_FINE);locations.setTestProviderEnabled(p,true);}}
 private Activity visible()throws Exception{
  progress("waking device before activity launch");shell("input keyevent 224");shell("wm dismiss-keyguard");
  // startActivitySync waits for a newly created Activity. NEW_TASK alone can
  // bring an existing task forward and leave that waiter blocked indefinitely.
  progress("creating a fresh visible activity");
  Activity a=startActivitySync(new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK));
  waitForIdleSync();progress("fresh activity visible");return a;
 }
 private void startTrip()throws Exception{JSONObject c=new JSONObject().put("id","instrumented-"+System.currentTimeMillis()).put("target",new JSONObject().put("name","Test terminus").put("lat",48.85).put("lon",2.35)).put("radius",800).put("arrivalRadius",130).put("backup",1).put("maxDurationHours",24).put("leadSeconds",60).put("sound",true).put("vibration",true);context.startForegroundService(new Intent(context,TripService.class).setAction("START").putExtra("config",c.toString()));eventually(()->TripService.running&&notification(1),10000,"foreground service and permanent notification");eventually(()->state().optJSONObject("config")!=null&&state().optJSONObject("config").optInt("maxDurationHours")==24,5000,"chosen long journey duration is retained");}
 @Override public void onStart(){super.onStart();context=getTargetContext();Bundle result=new Bundle();String phase=arguments.getString("phase","background");
  try{
   progress("phase="+phase+" started");
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
     check(!notification(4)&&!notification(5),"approach removes obsolete GPS and timer warnings");
     Notification approach=notificationValue(2);check(approach.actions!=null&&approach.actions.length==1,"approach has acknowledgement action");check(approach.deleteIntent!=null,"dismissing an alert can cancel its repetitions");
     String displayedEvent=state().optString("event"),displayedJourney=state().optJSONObject("config").optString("runToken");
     PendingIntent oldAcknowledgement=approach.actions[0].actionIntent;oldAcknowledgement.send();eventually(()->!notification(2),5000,"approach action acknowledges without opening the app");
     check(TripService.running,"acknowledging approach keeps tracking active");SystemClock.sleep(9000);check(!notification(2),"approach acknowledgement stops repetitions");fix(.0004,20);
     eventually(()->state().optBoolean("arrived")&&notification(3),10000,"arrival delivered while backgrounded and screen off");
     oldAcknowledgement.send();SystemClock.sleep(1000);check(TripService.running&&notification(3),"old approach action cannot acknowledge a later arrival");
     ((MainActivity)activity).new Bridge().acknowledge(displayedEvent,displayedJourney);SystemClock.sleep(1000);check(TripService.running&&notification(3),"stale UI bridge acknowledgement cannot complete a newer arrival");
     ((MainActivity)activity).new Bridge().acknowledge("","");SystemClock.sleep(500);check(TripService.running&&notification(3),"bridge rejects an acknowledgement without event identity");
     Notification arrival=notificationValue(3);check(arrival.actions!=null&&arrival.actions.length==1,"arrival has acknowledgement action");arrival.actions[0].actionIntent.send();
     eventually(()->!TripService.running&&!notification(1)&&!notification(3),5000,"arrival acknowledgement releases native tracking and ongoing notification");
     check(state().optBoolean("completed")&&state().optBoolean("arrived"),"acknowledged arrival persists a completed journey");check(state().optLong("completedAt")>0,"completion timestamp is retained");check(state().optString("event").equals(state().optString("acknowledgedEvent")),"acknowledged event cannot be replayed as new");
     SystemClock.sleep(9000);check(!notification(3),"acknowledgement cancels repeated arrival alarm");check(!notification(4)&&!notification(5),"no later GPS or timer alert replaces completion");
     visible();startTrip();fix(.0004,20);eventually(()->state().optBoolean("arrived")&&notification(3),10000,"a new journey gets its own arrival notification");
     Notification nextArrival=notificationValue(3);check(!arrival.actions[0].actionIntent.equals(nextArrival.actions[0].actionIntent),"same-kind actions have distinct identities across journeys");
     arrival.actions[0].actionIntent.send();SystemClock.sleep(1000);check(TripService.running&&notification(3),"retained old arrival action cannot acknowledge a new journey");
     nextArrival.actions[0].actionIntent.send();eventually(()->!TripService.running&&!notification(1),5000,"current arrival action completes the new journey");
     // Start from a visible activity because a completed service no longer grants
     // the background-service exemption needed for a direct test STOP command.
     visible();context.startService(new Intent(context,TripService.class).setAction("STOP"));eventually(()->!TripService.running&&!notification(1),5000,"stop leaves no service or foreground notification");
     eventually(()->context.getSharedPreferences("trip",0).getAll().isEmpty(),5000,"stop request clears persisted journey");
     check(context.getSharedPreferences("trip",0).getAll().isEmpty(),"stop clears persisted active journey");
     check(context.getSystemService(NotificationManager.class).getActiveNotifications().length==0,"stop clears every notification");
     JSONObject soundOnly=new JSONObject().put("sound",true).put("vibration",false);NotificationManager manager=context.getSystemService(NotificationManager.class);
     NotificationChannel silent=new NotificationChannel(TripService.alertChannel(soundOnly),"Test muted channel",NotificationManager.IMPORTANCE_DEFAULT);silent.setSound(null,null);silent.enableVibration(false);manager.createNotificationChannel(silent);
     check(!TripService.alertsEnabled(context,soundOnly),"a muted selected sound channel fails the alert preflight");manager.deleteNotificationChannel(silent.getId());
     check(!TripService.alertsEnabled(context,new JSONObject().put("sound",false).put("vibration",false)),"no selected audible or haptic modality fails preflight");
    }
   }
   android.content.pm.PackageInfo webview=android.webkit.WebView.getCurrentWebViewPackage();
   result.putString("stream","PROCHAIN_ARRET_TESTS_PASSED phase="+phase+" assertions="+assertions+" WebView="+(webview==null?"none":webview.packageName+"/"+webview.versionName)+" (native service tests; web interface not exercised)\n");finish(Activity.RESULT_OK,result);
  }catch(Throwable e){result.putString("stream","PROCHAIN_ARRET_TESTS_FAILED phase="+phase+" "+android.util.Log.getStackTraceString(e));finish(Activity.RESULT_CANCELED,result);}
 }
}
