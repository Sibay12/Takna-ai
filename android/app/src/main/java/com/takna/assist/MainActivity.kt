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
