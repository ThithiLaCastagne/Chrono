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
 private LocationManager locations;private PowerManager.WakeLock lock;private Handler handler;private Tracker tracker;private JSONObject config;private long started,startedElapsed,completedAt;private boolean warned=false,reminded=false,completed=false;private String event="",acknowledgedEvent="";private Runnable repeatAlert;private static final int ONGOING=1;
 @Override public void onCreate(){super.onCreate();handler=new Handler(Looper.getMainLooper());locations=getSystemService(LocationManager.class);NotificationManager nm=getSystemService(NotificationManager.class);NotificationChannel c=new NotificationChannel("tracking","Suivi du trajet",NotificationManager.IMPORTANCE_LOW);c.setDescription("Notification permanente pendant un trajet");c.setSound(null,null);nm.createNotificationChannel(c);}
 private static PendingIntent open(Context c){return PendingIntent.getActivity(c,0,new Intent(c,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);}
 private Notification ongoing(String text){Intent stop=new Intent(this,TripService.class).setAction("STOP");PendingIntent pi=PendingIntent.getService(this,1,stop,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);return new Notification.Builder(this,"tracking").setSmallIcon(R.drawable.notification_icon).setContentTitle("Prochain arrêt · "+config.optJSONObject("target").optString("name")).setContentText(text).setContentIntent(open(this)).setOngoing(true).setOnlyAlertOnce(true).setCategory(Notification.CATEGORY_SERVICE).addAction(new Notification.Action.Builder(null,"Arrêter le suivi",pi).build()).build();}
 @Override public int onStartCommand(Intent intent,int flags,int id){
  if(intent==null){stopSelf();return START_NOT_STICKY;}
  if("ACK".equals(intent.getAction())){
   if(!running){stopSelf();return START_NOT_STICKY;}
   String token=intent.getStringExtra("event");if(token==null||token.isEmpty()||!token.equals(event)||!config.optString("runToken").equals(intent.getStringExtra("journey")))return START_NOT_STICKY;
   if(repeatAlert!=null)handler.removeCallbacks(repeatAlert);clearAlerts();acknowledgedEvent=event;
   if(tracker!=null&&tracker.arrived){completed=true;completedAt=System.currentTimeMillis();running=false;persist(null);stopSelf();}else persist(null);
   return START_NOT_STICKY;
  }
  if("STOP".equals(intent.getAction())){getSharedPreferences("trip",0).edit().clear().apply();getSystemService(NotificationManager.class).cancelAll();stopSelf();return START_NOT_STICKY;}
  if(running)return START_NOT_STICKY;
  try{
   config=new JSONObject(intent.getStringExtra("config"));tracker=new Tracker(config);
   completed=false;completedAt=0;warned=false;reminded=false;event="";acknowledgedEvent="";handler.removeCallbacksAndMessages(null);clearAlerts();
   started=System.currentTimeMillis();startedElapsed=SystemClock.elapsedRealtime();config.put("started",started).put("runToken",java.util.UUID.randomUUID().toString());
   if(Build.VERSION.SDK_INT>=29)startForeground(ONGOING,ongoing("Acquisition de votre position…"),ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);else startForeground(ONGOING,ongoing("Acquisition de votre position…"));
   running=true;lock=getSystemService(PowerManager.class).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"ProchainArret:ActiveTrip");lock.setReferenceCounted(false);lock.acquire(maxDurationMillis()+60000);
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
   JSONObject p=new JSONObject().put("lat",l.getLatitude()).put("lon",l.getLongitude()).put("accuracy",l.hasAccuracy()?l.getAccuracy():10000).put("timestamp",logicalNow()-age/1000000L);
   String result=tracker.ingest(p,logicalNow());if("good".equals(tracker.health(logicalNow())))warned=false;if(result!=null)alert(result);persist(null);
  }catch(Exception ignored){}}
 private final Runnable tick=new Runnable(){public void run(){if(!running||tracker==null)return;long now=logicalNow();
   if(now-started>maxDurationMillis()){alert("expired");stopSelf();return;}
   if(!tracker.arrived&&now-started>45000&&!"good".equals(tracker.health(now))&&!warned){warned=true;alert("signal");}
   int backup=config.optInt("backup",0);if(!tracker.arrived&&backup>0&&!reminded&&now>=started+backup*60000L){reminded=true;alert("reminder");}
   String text=tracker.lastGood==null&&now-started<45000?"Acquisition de votre position…":tracker.arrived?"Destination atteinte · arrêtez le suivi après votre descente":"good".equals(tracker.health(now))?(tracker.distance>=1000?String.format(java.util.Locale.FRANCE,"À %.1f km de votre arrêt",tracker.distance/1000):"À "+Math.round(tracker.distance/10)*10+" m de votre arrêt"):"GPS perdu ou imprécis · vérifiez votre trajet";
   getSystemService(NotificationManager.class).notify(ONGOING,ongoing(text));persist(null);handler.postDelayed(this,5000);
 }};
 private long logicalNow(){return started+Math.max(0,SystemClock.elapsedRealtime()-startedElapsed);}
 private long maxDurationMillis(){return (config==null?6:config.optInt("maxDurationHours",6))*60*60*1000L;}
 private void clearAlerts(){NotificationManager nm=getSystemService(NotificationManager.class);for(int i=2;i<=5;i++)nm.cancel(i);}
 private void persist(String error){try{JSONObject s=new JSONObject().put("running",running).put("config",config).put("error",error).put("event",event).put("acknowledgedEvent",acknowledgedEvent).put("completed",completed).put("completedAt",completedAt).put("started",started).put("elapsed",Math.max(0,SystemClock.elapsedRealtime()-startedElapsed)).put("reminded",reminded);if(tracker!=null){s.put("early",tracker.early).put("arrived",tracker.arrived).put("status",completed?"completed":tracker.health(logicalNow())).put("lastGood",tracker.lastGood).put("approachRadius",tracker.approachRadius);if(tracker.lastGood!=null)s.put("age",Math.max(0,logicalNow()-tracker.lastGood.optLong("timestamp")));if(Double.isFinite(tracker.distance))s.put("distance",tracker.distance);}getSharedPreferences("trip",0).edit().putString("state",s.toString()).apply();}catch(Exception ignored){}}
 private void alert(String kind){if(tracker!=null&&tracker.arrived&&(kind.equals("signal")||kind.equals("reminder")))return;event=kind+":"+System.currentTimeMillis();String name=config.optJSONObject("target").optString("name");String title,body;
  switch(kind){case "arrived":title="C’est votre arrêt !";body=name+" est tout près. Vérifiez l’annonce avant de descendre. Bien reçu arrête le suivi.";break;case "previous":title="Plus qu’un arrêt";body="L’arrêt précédent est tout près. Préparez-vous pour "+name+".";break;case "approach":title="Votre arrêt approche";body="Vous entrez dans la zone d’approche de "+name+".";break;case "signal":title="Vérifiez votre trajet";body="GPS perdu ou imprécis. Les alertes peuvent être manquées. Restez attentif aux annonces.";break;case "expired":title="Durée de suivi atteinte";body="Le suivi s’est arrêté après "+config.optInt("maxDurationHours",6)+" heures. Relancez un trajet si nécessaire.";break;default:title="Votre rappel de secours";body="Le délai choisi est écoulé. Vérifiez votre progression vers "+name+".";}
  final int alertId=kind.equals("arrived")?3:kind.equals("signal")?4:kind.equals("reminder")?5:2;
  clearAlerts();notifyAlert(this,config,title,body,alertId,event);
  if(repeatAlert!=null)handler.removeCallbacks(repeatAlert);
  final String alertTitle=title,alertBody=body;final String token=event;
  if(kind.equals("arrived")||kind.equals("previous")||kind.equals("approach")){
   repeatAlert=new Runnable(){int count=0;public void run(){if(!running||!event.equals(token)||count++>=3)return;notifyAlert(TripService.this,config,alertTitle,alertBody,alertId,token);handler.postDelayed(this,8000);}};
   handler.postDelayed(repeatAlert,8000);
  }
  persist(null);
 }
 public static void test(Context c,JSONObject prefs){notifyAlert(c,prefs==null?new JSONObject():prefs,"Test · Prochain arrêt","C’est le son et la vibration de votre prochaine alerte. Vérifiez le volume.",9,null);}
 public static String alertChannel(JSONObject prefs){return "alerts-"+(prefs.optBoolean("sound",true)?"sound":"silent")+(prefs.optBoolean("vibration",true)?"-vibrate":"-still");}
 public static boolean alertsEnabled(Context c,JSONObject prefs){
  NotificationManager nm=c.getSystemService(NotificationManager.class);if(!nm.areNotificationsEnabled())return false;
  NotificationChannel ch=nm.getNotificationChannel(alertChannel(prefs));if(ch!=null&&ch.getImportance()<NotificationManager.IMPORTANCE_DEFAULT)return false;
  boolean sound=prefs.optBoolean("sound",true)&&(ch==null||ch.getSound()!=null);
  Vibrator vibrator=(Vibrator)c.getSystemService(Context.VIBRATOR_SERVICE);boolean vibration=prefs.optBoolean("vibration",true)&&vibrator!=null&&vibrator.hasVibrator()&&(ch==null||ch.shouldVibrate());
  return sound||vibration;
 }
 private static void notifyAlert(Context c,JSONObject prefs,String title,String body,int id,String token){try{
  boolean sound=prefs.optBoolean("sound",true),vibrate=prefs.optBoolean("vibration",true);String channel=alertChannel(prefs);
  NotificationManager nm=c.getSystemService(NotificationManager.class);NotificationChannel ch=new NotificationChannel(channel,"Alertes de trajet"+(sound?" · son":" · sans son")+(vibrate?" · vibrations":""),NotificationManager.IMPORTANCE_HIGH);
  ch.setDescription("Approche, arrivée et perte de signal");ch.enableVibration(vibrate);ch.setVibrationPattern(vibrate?new long[]{0,400,150,600,150,600}:new long[]{0});
  ch.setSound(sound?Settings.System.DEFAULT_NOTIFICATION_URI:null,new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT).build());nm.createNotificationChannel(ch);
  Notification.Builder builder=new Notification.Builder(c,channel).setSmallIcon(R.drawable.notification_icon).setContentTitle(title).setContentText(body).setStyle(new Notification.BigTextStyle().bigText(body)).setContentIntent(open(c)).setAutoCancel(true).setCategory(Notification.CATEGORY_REMINDER).setVisibility(Notification.VISIBILITY_PRIVATE);
  if(token!=null){
   // PendingIntent identity ignores extras. Include journey and event in data so
   // retaining an earlier notification action cannot mutate into a later ACK.
   String journey=prefs.optString("runToken"),identity=journey+"|"+token;
   Intent ack=new Intent(c,TripService.class).setAction("ACK").setData(Uri.parse("prochain-arret://ack/"+Uri.encode(identity))).putExtra("event",token).putExtra("journey",journey);
   PendingIntent acknowledge=PendingIntent.getService(c,100+id,ack,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
   builder.addAction(new Notification.Action.Builder(null,id==3?"Bien reçu · arrêter":"Bien reçu",acknowledge).build()).setDeleteIntent(acknowledge);
  }
  nm.notify(id,builder.build());
 }catch(Exception ignored){}}
 @Override public void onProviderDisabled(String provider){if(running&&!warned&&!locations.isProviderEnabled(LocationManager.GPS_PROVIDER)&&!locations.isProviderEnabled(LocationManager.NETWORK_PROVIDER)){warned=true;alert("signal");}}
 @Override public void onProviderEnabled(String provider){if(running)try{locations.requestLocationUpdates(provider,2500,0,this,Looper.getMainLooper());}catch(SecurityException ignored){}}
 @Override public void onStatusChanged(String provider,int status,Bundle extras){}
 @Override public IBinder onBind(Intent i){return null;}
 @Override public void onDestroy(){running=false;if(handler!=null)handler.removeCallbacksAndMessages(null);if(locations!=null)locations.removeUpdates(this);if(lock!=null&&lock.isHeld())lock.release();stopForeground(STOP_FOREGROUND_REMOVE);super.onDestroy();}
}
