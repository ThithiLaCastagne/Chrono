package fr.prochainarret.app;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.*;
import android.provider.Settings;
import android.webkit.*;
import android.view.*;
import android.widget.FrameLayout;
import org.json.*;
import java.util.*;
import java.io.*;

public class MainActivity extends Activity {
  private WebView web;
  private String pendingConfig=null;
  private GeolocationPermissions.Callback geoCallback;
  private String geoOrigin;
  private boolean testing=false;
  private JSONObject testPrefs;
  private static final String ORIGIN="https://appassets.androidplatform.net";

  @Override public void onCreate(Bundle saved) {
    super.onCreate(saved);
    getWindow().setStatusBarColor(Color.rgb(246,248,245));
    getWindow().setNavigationBarColor(Color.WHITE);
    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR|View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
    FrameLayout frame=new FrameLayout(this);
    web=new WebView(this);frame.addView(web);setContentView(frame);
    frame.setOnApplyWindowInsetsListener((v,insets)->{
      if(Build.VERSION.SDK_INT>=30){android.graphics.Insets i=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());v.setPadding(i.left,i.top,i.right,i.bottom);}return insets;
    });
    WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setGeolocationEnabled(true);
    s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
    s.setMediaPlaybackRequiresUserGesture(true);s.setSupportMultipleWindows(false);
    web.setBackgroundColor(Color.WHITE);web.addJavascriptInterface(new Bridge(),"Android");
    web.setWebViewClient(new WebViewClient(){
      @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest request){
        Uri u=request.getUrl();if(!ORIGIN.equals(u.getScheme()+"://"+u.getHost()))return null;
        String path=u.getPath();if(path==null||path.equals("/"))path="/index.html";
        if(path.contains(".."))return new WebResourceResponse("text/plain","UTF-8",new ByteArrayInputStream(new byte[0]));
        String mime=path.endsWith(".js")?"text/javascript":path.endsWith(".css")?"text/css":path.endsWith(".svg")?"image/svg+xml":path.endsWith(".png")?"image/png":path.endsWith(".json")?"application/json":path.endsWith(".webmanifest")?"application/manifest+json":"text/html";
        try{WebResourceResponse r=new WebResourceResponse(mime,"UTF-8",getAssets().open(path.substring(1)));Map<String,String> headers=new HashMap<>();headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://photon.komoot.io https://overpass-api.de; object-src 'none'; base-uri 'self'; frame-src 'none'");r.setResponseHeaders(headers);return r;}catch(IOException e){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
      }
      @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){Uri u=r.getUrl();if(ORIGIN.equals(u.getScheme()+"://"+u.getHost()))return false;if("https".equals(u.getScheme())){try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(Exception ignored){}}return true;}
    });
    web.setWebChromeClient(new WebChromeClient(){
      @Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback callback){
        if(!origin.equals(ORIGIN)){callback.invoke(origin,false,false);return;}
        if(hasLocation()){callback.invoke(origin,true,false);return;}
        geoCallback=callback;geoOrigin=origin;requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,Manifest.permission.ACCESS_COARSE_LOCATION},101);
      }
    });
    web.loadUrl(ORIGIN+"/");
  }
  private boolean hasLocation(){return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED;}
  private boolean hasNotifications(){return Build.VERSION.SDK_INT<33||checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)==PackageManager.PERMISSION_GRANTED;}
  private void error(String s){if(web!=null)web.evaluateJavascript("window.onAndroidError && window.onAndroidError("+JSONObject.quote(s)+")",null);}
  private void startPending(){
    if(pendingConfig==null)return;
    if(!hasLocation()||!hasNotifications()){List<String> p=new ArrayList<>();if(!hasLocation()){p.add(Manifest.permission.ACCESS_FINE_LOCATION);p.add(Manifest.permission.ACCESS_COARSE_LOCATION);}if(!hasNotifications()&&Build.VERSION.SDK_INT>=33)p.add(Manifest.permission.POST_NOTIFICATIONS);requestPermissions(p.toArray(new String[0]),102);return;}
    NotificationManager nm=getSystemService(NotificationManager.class);
    JSONObject preferences;try{preferences=new JSONObject(pendingConfig);}catch(Exception e){pendingConfig=null;error("Destination invalide.");return;}
    if(!TripService.alertsEnabled(this,preferences)){pendingConfig=null;error("Les notifications sont désactivées. Activez-les dans les réglages Android avant de démarrer.");return;}
    android.location.LocationManager lm=getSystemService(android.location.LocationManager.class);
    if(!lm.isProviderEnabled(android.location.LocationManager.GPS_PROVIDER)&&!lm.isProviderEnabled(android.location.LocationManager.NETWORK_PROVIDER)){pendingConfig=null;error("Activez la localisation du téléphone avant de démarrer.");return;}
    Intent i=new Intent(this,TripService.class).setAction("START").putExtra("config",pendingConfig);pendingConfig=null;
    try{startForegroundService(i);}catch(Exception e){error("Le suivi n’a pas pu démarrer. Revenez dans l’app et réessayez.");}
  }
  @Override public void onRequestPermissionsResult(int req,String[] perms,int[] results){super.onRequestPermissionsResult(req,perms,results);
    if(req==101&&geoCallback!=null){geoCallback.invoke(geoOrigin,hasLocation(),false);geoCallback=null;}
    if(req==102){if(hasLocation()&&hasNotifications())startPending();else{pendingConfig=null;error("Autorisez la position précise et les notifications pour activer le suivi.");}}
    if(req==103&&testing){testing=false;if(hasNotifications())TripService.test(this,testPrefs);else error("Autorisez les notifications pour tester l’alerte.");}
  }
  public class Bridge {
    @JavascriptInterface public void start(String config){runOnUiThread(()->{try{JSONObject c=new JSONObject(config);if(!Tracker.valid(c))throw new Exception();pendingConfig=config;startPending();}catch(Exception e){error("Destination invalide.");}});}
    @JavascriptInterface public String state(){try{JSONObject s=new JSONObject(getSharedPreferences("trip",0).getString("state","{}"));s.put("running",TripService.running);if(!TripService.running&&!s.optBoolean("arrived"))s.put("status","interrupted");return s.toString();}catch(Exception e){return "{}";}}
    @JavascriptInterface public void stop(){runOnUiThread(()->{pendingConfig=null;stopService(new Intent(MainActivity.this,TripService.class));getSharedPreferences("trip",0).edit().clear().apply();getSystemService(NotificationManager.class).cancelAll();});}
    @JavascriptInterface public void clear(){stop();}
    @JavascriptInterface public void acknowledge(){runOnUiThread(()->{if(TripService.running)startService(new Intent(MainActivity.this,TripService.class).setAction("ACK"));});}
    @JavascriptInterface public void test(String preferences){runOnUiThread(()->{try{testPrefs=new JSONObject(preferences);if(!hasNotifications()&&Build.VERSION.SDK_INT>=33){testing=true;requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS},103);}else if(!TripService.alertsEnabled(MainActivity.this,testPrefs))error("Les alertes sont désactivées dans les réglages Android.");else TripService.test(MainActivity.this,testPrefs);}catch(Exception e){error("Test impossible. Vérifiez les autorisations.");}});}
    @JavascriptInterface public void settings(String type){runOnUiThread(()->{try{Intent i;if("notifications".equals(type)){i=new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,getPackageName());}else{i=new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,Uri.parse("package:"+getPackageName()));}startActivity(i);}catch(Exception ignored){}});}
  }
  @Override public void onBackPressed(){web.evaluateJavascript("window.closeTopOverlay && window.closeTopOverlay()",closed->{if(!"true".equals(closed)){if(!TripService.running)MainActivity.super.onBackPressed();else moveTaskToBack(true);}});}
  @Override protected void onDestroy(){if(web!=null){web.removeJavascriptInterface("Android");web.destroy();web=null;}super.onDestroy();}
}
