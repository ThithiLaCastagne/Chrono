package fr.prochainarret.app;
import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.*;
import android.location.*;
import android.media.*;
import android.os.*;
import android.provider.Settings;
import android.net.Uri;
import org.json.*;

public class TripService extends Service implements LocationListener {
 public static volatile boolean running=false;
 private LocationManager locations;private PowerManager.WakeLock lock;private Handler handler;private Tracker tracker;private JSONObject config;private long started;private boolean warned=false,reminded=false;private String event="";private Runnable repeatAlert;private static final int ONGOING=1;
 @Override public void onCreate(){super.onCreate();handler=new Handler(Looper.getMainLooper());locations=getSystemService(LocationManager.class);NotificationManager nm=getSystemService(NotificationManager.class);NotificationChannel c=new NotificationChannel("tracking","Suivi du trajet",NotificationManager.IMPORTANCE_LOW);c.setDescription("Notification permanente pendant un trajet");c.setSound(null,null);nm.createNotificationChannel(c);}
 private static PendingIntent open(Context c){return PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 private Notification ongoing(String text){Intent stop=new Intent(this,TripService.class).setAction("STOP");PendingIntent pi=PendingIntent.getService(this,1,stop,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);return new Notification.Builder(this,"tracking").setSmallIcon(R.drawable.notification_icon).setContentTitle("Prochain arrêt · "+config.optJSONObject("target").optString("name")).setContentText(text).setContentIntent(open(this)).setOngoing(true).setOnlyAlertOnce(true).setCategory(Notification.CATEGORY_SERVICE).addAction(new Notification.Action.Builder(null,"Arrêter le suivi",pi).build()).build();}
 @Override public int onStartCommand(Intent intent,int flags,int id){
  if(intent==null){stopSelf();return START_NOT_STICKY;}
  if("ACK".equals(intent.getAction())){if(repeatAlert!=null)handler.removeCallbacks(repeatAlert);getSystemService(NotificationManager.class).cancel(2);getSystemService(NotificationManager.class).cancel(3);getSystemService(NotificationManager.class).cancel(4);getSystemService(NotificationManager.class).cancel(5);return START_NOT_STICKY;}
  if("STOP".equals(intent.getAction())){getSharedPreferences("trip",0).edit().clear().apply();getSystemService(NotificationManager.class).cancelAll();stopSelf();return START_NOT_STICKY;}
  if(running)return START_NOT_STICKY;
  try{
   config=new JSONObject(intent.getStringExtra("config"));tracker=new Tracker(config);started=System.currentTimeMillis();config.put("started",started);
   if(Build.VERSION.SDK_INT>=29)startForeground(ONGOING,ongoing("Acquisition de votre position…"),ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);else startForeground(ONGOING,ongoing("Acquisition de votre position…"));
   running=true;lock=getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"ProchainArret:ActiveTrip");lock.setReferenceCounted(false);lock.acquire(6*60*60*1000L+60000);
   if(checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)!=PackageManager.PERMISSION_GRANTED)throw new SecurityException();
   boolean registered=false;
   if(locations.isProviderEnabled(LocationManager.GPS_PROVIDER)){locations.requestLocationUpdates(LocationManager.GPS_PROVIDER,2500,0,this,Looper.getMainLooper());registered=true;}
   if(locations.isProviderEnabled(LocationManager.NETWORK_PROVIDER)){locations.requestLocationUpdates(LocationManager.NETWORK_PROVIDER,3000,0,this,Looper.getMainLooper());registered=true;}
   if(!registered)throw new IllegalStateException("GPS disabled");
   persist(null);handler.post(tick);
  }catch(Exception e){persist("Impossible de démarrer le GPS. Vérifiez les autorisations et la localisation.");stopSelf();}
  return START_NOT_STICKY;
 }
 @Override public void onLocationChanged(Location l){if(tracker==null)return;try{
   long age=SystemClock.elapsedRealtimeNanos()-l.getElapsedRealtimeNanos();if(age<0||age>30000000000L)return;
   JSONObject p=new JSONObject().put("lat",l.getLatitude()).put("lon",l.getLongitude()).put("accuracy",l.hasAccuracy()?l.getAccuracy():10000).put("timestamp",System.currentTimeMillis()-age/1000000L);
   String result=tracker.ingest(p,System.currentTimeMillis());if("good".equals(tracker.health(System.currentTimeMillis())))warned=false;if(result!=null)alert(result);persist(null);
  }catch(Exception ignored){}}
 private final Runnable tick=new Runnable(){public void run(){if(!running||tracker==null)return;long now=System.currentTimeMillis();
   if(now-started>6*60*60*1000L){alert("expired");stopSelf();return;}
   if(now-started>45000&&!"good".equals(tracker.health(now))&&!warned){warned=true;alert("signal");}
   int backup=config.optInt("backup",0);if(backup>0&&!reminded&&now>=started+backup*60000L){reminded=true;alert("reminder");}
   String text=tracker.lastGood==null&&now-started<45000?"Acquisition de votre position…":tracker.arrived?"Destination atteinte · arrêtez le suivi après votre descente":"good".equals(tracker.health(now))?(tracker.distance>=1000?String.format(java.util.Locale.FRANCE,"À %.1f km de votre arrêt",tracker.distance/1000):"À "+Math.round(tracker.distance/10)*10+" m de votre arrêt"):"GPS perdu ou imprécis · vérifiez votre trajet";
   getSystemService(NotificationManager.class).notify(ONGOING,ongoing(text));persist(null);handler.postDelayed(this,5000);
 }};
 private void persist(String error){try{JSONObject s=new JSONObject().put("running",running).put("config",config).put("error",error).put("event",event).put("started",started).put("reminded",reminded);if(tracker!=null){s.put("early",tracker.early).put("arrived",tracker.arrived).put("status",tracker.health(System.currentTimeMillis())).put("lastGood",tracker.lastGood);if(Double.isFinite(tracker.distance))s.put("distance",tracker.distance);}getSharedPreferences("trip",0).edit().putString("state",s.toString()).apply();}catch(Exception ignored){}}
 private void alert(String kind){event=kind+":"+System.currentTimeMillis();String name=config.optJSONObject("target").optString("name");String title,body;
  switch(kind){case "arrived":title="C’est votre arrêt !";body=name+" est tout près. Vérifiez l’annonce avant de descendre.";break;case "previous":title="Plus qu’un arrêt";body="L’arrêt précédent est tout près. Préparez-vous pour "+name+".";break;case "approach":title="Votre arrêt approche";body="Vous entrez dans la zone d’approche de "+name+".";break;case "signal":title="Vérifiez votre trajet";body="GPS perdu ou imprécis. Les alertes peuvent être manquées. Restez attentif aux annonces.";break;case "expired":title="Suivi arrêté après 6 heures";body="Relancez un trajet si vous êtes toujours en route.";break;default:title="Votre rappel de secours";body="Le délai choisi est écoulé. Vérifiez votre progression vers "+name+".";}
  final int alertId=kind.equals("arrived")?3:kind.equals("signal")?4:kind.equals("reminder")?5:2;
  notifyAlert(this,config,title,body,alertId);
  if(repeatAlert!=null)handler.removeCallbacks(repeatAlert);
  final String alertTitle=title,alertBody=body;final String token=event;
  if(kind.equals("arrived")||kind.equals("previous")||kind.equals("approach")){
   repeatAlert=new Runnable(){int count=0;public void run(){if(!running||!event.equals(token)||count++>=3)return;notifyAlert(TripService.this,config,alertTitle,alertBody,alertId);handler.postDelayed(this,8000);}};
   handler.postDelayed(repeatAlert,8000);
  }
  persist(null);
 }
 public static void test(Context c,JSONObject prefs){notifyAlert(c,prefs==null?new JSONObject():prefs,"Test · Prochain arrêt","C’est le son et la vibration de votre prochaine alerte. Vérifiez le volume.",9);}
 private static void notifyAlert(Context c,JSONObject prefs,String title,String body,int id){try{
  boolean sound=prefs.optBoolean("sound",true),vibrate=prefs.optBoolean("vibration",true);String channel="alerts-"+(sound?"sound":"silent")+(vibrate?"-vibrate":"-still");
  NotificationManager nm=c.getSystemService(NotificationManager.class);NotificationChannel ch=new NotificationChannel(channel,"Alertes de trajet"+(sound?" · son":" · sans son")+(vibrate?" · vibrations":""),NotificationManager.IMPORTANCE_HIGH);
  ch.setDescription("Approche, arrivée et perte de signal");ch.enableVibration(vibrate);ch.setVibrationPattern(vibrate?new long[]{0,400,150,600,150,600}:new long[]{0});
  ch.setSound(sound?Settings.System.DEFAULT_NOTIFICATION_URI:null,new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).build());nm.createNotificationChannel(ch);
  Notification n=new Notification.Builder(c,channel).setSmallIcon(R.drawable.notification_icon).setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body)).setContentIntent(open(c)).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER).setVisibility(Notification.VISIBILITY_PRIVATE).build();nm.notify(id,n);
 }catch(Exception ignored){}}
 @Override public void onProviderDisabled(String provider){if(running&&!warned){warned=true;alert("signal");}}
 @Override public void onProviderEnabled(String provider){if(running)try{locations.requestLocationUpdates(provider,2500,0,this,Looper.getMainLooper());}catch(SecurityException ignored){}}
 @Override public void onStatusChanged(String provider,int status,Bundle extras){}
 @Override public IBinder onBind(Intent i){return null;}
 @Override public void onDestroy(){running=false;if(handler!=null)handler.removeCallbacksAndMessages(null);if(locations!=null)locations.removeUpdates(this);if(lock!=null&&lock.isHeld())lock.release();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
}
