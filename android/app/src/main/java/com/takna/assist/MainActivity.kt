package com.takna.assist

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import android.app.SearchManager
import android.content.Context
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.provider.AlarmClock
import android.provider.Settings
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    // Your Render server. Change this if your URL changes.
    private val base = "https://takna-ai.onrender.com/"
    private lateinit var web: WebView
    private var rec: SpeechRecognizer? = null
    private var pendingLang: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        setContentView(web)
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.mediaPlaybackRequiresUserGesture = false
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(v: WebView, r: WebResourceRequest): Boolean {
                if (r.url.toString().startsWith(base)) return false
                startActivity(Intent(Intent.ACTION_VIEW, r.url)) // payment pages, ads, APK downloads open outside
                return true
            }
        }
        web.addJavascriptInterface(Bridge(), "AndroidBridge")
        web.loadUrl(base)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { if (web.canGoBack()) web.goBack() else finish() }
        })
    }

    inner class Bridge {
        @JavascriptInterface
        fun version(): String = packageManager.getPackageInfo(packageName, 0).versionName ?: "0.0.0"
        @JavascriptInterface
        fun listen(lang: String) { runOnUiThread { start(lang) } }
        @JavascriptInterface
        fun stop() { runOnUiThread { rec?.stopListening() } }

        // Phone actions for the voice assistant. Returns false if it could not be done.
        @JavascriptInterface
        fun act(type: String, arg: String): Boolean = try { doAct(type, arg) } catch (e: Exception) { false }
    }

    private fun launch(i: Intent): Boolean {
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        runOnUiThread { try { startActivity(i) } catch (e: Exception) { } }
        return true
    }

    private fun doAct(type: String, arg: String): Boolean = when (type) {
        "app" -> {
            val q = arg.lowercase().trim()
            val apps = packageManager.queryIntentActivities(Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER), 0)
            val hit = apps.firstOrNull { it.loadLabel(packageManager).toString().lowercase() == q }
                ?: apps.firstOrNull { it.loadLabel(packageManager).toString().lowercase().contains(q) }
            val li = hit?.let { packageManager.getLaunchIntentForPackage(it.activityInfo.packageName) }
            if (li != null) launch(li) else false
        }
        "call" -> launch(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + Uri.encode(arg))))
        "alarm" -> { val p = arg.split(":"); launch(Intent(AlarmClock.ACTION_SET_ALARM)
            .putExtra(AlarmClock.EXTRA_HOUR, p[0].toInt()).putExtra(AlarmClock.EXTRA_MINUTES, p[1].toInt())
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true)) }
        "timer" -> launch(Intent(AlarmClock.ACTION_SET_TIMER).putExtra(AlarmClock.EXTRA_LENGTH, arg.toInt())
            .putExtra(AlarmClock.EXTRA_SKIP_UI, true))
        "nav" -> launch(Intent(Intent.ACTION_VIEW, Uri.parse("google.navigation:q=" + Uri.encode(arg))))
        "music" -> launch(Intent(Intent.ACTION_VIEW, Uri.parse("https://www.youtube.com/results?search_query=" + Uri.encode(arg))))
        "web" -> launch(Intent(Intent.ACTION_WEB_SEARCH).putExtra(SearchManager.QUERY, arg))
        "wa" -> { val p = arg.split("|", limit = 2); launch(Intent(Intent.ACTION_VIEW,
            Uri.parse("https://wa.me/" + p[0].trimStart('+') + "?text=" + Uri.encode(p.getOrElse(1) { "" })))) }
        "settings" -> launch(Intent(if (arg == "bluetooth") Settings.ACTION_BLUETOOTH_SETTINGS else Settings.ACTION_WIFI_SETTINGS))
        "camera" -> launch(Intent("android.media.action.STILL_IMAGE_CAMERA"))
        "volume" -> { (getSystemService(Context.AUDIO_SERVICE) as AudioManager).adjustStreamVolume(AudioManager.STREAM_MUSIC,
            if (arg == "up") AudioManager.ADJUST_RAISE else AudioManager.ADJUST_LOWER, AudioManager.FLAG_SHOW_UI); true }
        "torch" -> {
            val cm = getSystemService(Context.CAMERA_SERVICE) as CameraManager
            val id = cm.cameraIdList.firstOrNull { cm.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true }
            if (id == null) false else { cm.setTorchMode(id, arg == "on"); true }
        }
        else -> false
    }

    private fun start(lang: String) {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            pendingLang = lang
            ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.RECORD_AUDIO), 1)
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(this)) { js("onNativeSpeech('',true)"); return }
        rec?.destroy()
        val r = SpeechRecognizer.createSpeechRecognizer(this)
        r.setRecognitionListener(object : RecognitionListener {
            override fun onResults(b: Bundle?) { push(b, true) }
            override fun onPartialResults(b: Bundle?) { push(b, false) }
            override fun onError(e: Int) { js("onNativeSpeech('',true)") }
            override fun onReadyForSpeech(p: Bundle?) {}
            override fun onBeginningOfSpeech() {}
            override fun onRmsChanged(v: Float) {}
            override fun onBufferReceived(b: ByteArray?) {}
            override fun onEndOfSpeech() {}
            override fun onEvent(t: Int, p: Bundle?) {}
        })
        r.startListening(Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
            .putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true))
        rec = r
    }

    private fun push(b: Bundle?, fin: Boolean) {
        val t = b?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: ""
        js("onNativeSpeech(${JSONObject.quote(t)},$fin)")
    }

    private fun js(code: String) { web.post { web.evaluateJavascript(code, null) } }

    override fun onRequestPermissionsResult(rc: Int, p: Array<out String>, g: IntArray) {
        super.onRequestPermissionsResult(rc, p, g)
        if (g.firstOrNull() == PackageManager.PERMISSION_GRANTED) pendingLang?.let { start(it) }
        else js("onNativeSpeech('',true)")
        pendingLang = null
    }

    override fun onDestroy() { rec?.destroy(); super.onDestroy() }
}
