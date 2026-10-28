package com.takna.ai.voice

import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.speech.tts.Voice
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import com.takna.ai.ui.components.OrbState
import java.util.Locale
import java.util.UUID

/**
 * One assistant-wide controller for the mic and the voice, shared by every screen (created once,
 * at the top of the navigation graph, so Home, Chat and Voice settings all see the same state).
 *
 * The mic is only ever opened by [startListening], which is only ever called after the user taps
 * a mic button and RECORD_AUDIO permission has been granted. Nothing here records on its own.
 */
class VoiceController(app: Application) : AndroidViewModel(app) {

    private val prefs: SharedPreferences = app.getSharedPreferences("takna_voice_prefs", Context.MODE_PRIVATE)

    // --- state the UI observes ---
    var orbState by mutableStateOf(OrbState.Idle); private set
    var partialText by mutableStateOf(""); private set
    var recognitionAvailable by mutableStateOf(true); private set
    var ttsVoices by mutableStateOf<List<Voice>>(emptyList()); private set
    var ttsReady by mutableStateOf(false); private set
    private var onFinalResult: ((String) -> Unit)? = null
    private var onListenError: ((String) -> Unit)? = null

    // --- persisted preferences (plain SharedPreferences; simpler than DataStore for this small set) ---
    var autoSpeak: Boolean
        get() = prefs.getBoolean("auto_speak", false)
        set(v) = prefs.edit().putBoolean("auto_speak", v).apply()

    var speechRate: Float
        get() = prefs.getFloat("rate", 1.0f)
        set(v) { prefs.edit().putFloat("rate", v).apply(); tts?.setSpeechRate(v) }

    var speechPitch: Float
        get() = prefs.getFloat("pitch", 1.0f)
        set(v) { prefs.edit().putFloat("pitch", v).apply(); tts?.setPitch(v) }

    /** A voice's [Voice.getName], or "" to let the engine pick the default for the device language. */
    var voiceName: String
        get() = prefs.getString("voice_name", "") ?: ""
        set(v) { prefs.edit().putString("voice_name", v).apply(); applyVoice() }

    /** Preferred reply language sent with every chat message: "auto", "hi", "en" or "hinglish". */
    var replyLanguage: String
        get() = prefs.getString("reply_language", "auto") ?: "auto"
        set(v) = prefs.edit().putString("reply_language", v).apply()

    // ================= Text to speech =================

    private var tts: TextToSpeech? = null

    private fun ensureTts() {
        if (tts != null) return
        tts = TextToSpeech(getApplication<Application>().applicationContext) { status ->
            ttsReady = status == TextToSpeech.SUCCESS
            if (ttsReady) {
                tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                    override fun onStart(utteranceId: String?) { orbState = OrbState.Speaking }
                    override fun onDone(utteranceId: String?) { if (orbState == OrbState.Speaking) orbState = OrbState.Idle }
                    @Deprecated("deprecated in API") override fun onError(utteranceId: String?) {
                        if (orbState == OrbState.Speaking) orbState = OrbState.Idle
                    }
                })
                ttsVoices = try { tts?.voices?.toList().orEmpty() } catch (e: Exception) { emptyList() }
                applyVoice()
                tts?.setSpeechRate(speechRate)
                tts?.setPitch(speechPitch)
            }
        }
    }

    private fun applyVoice() {
        val engine = tts ?: return
        if (!ttsReady) return
        val wanted = voiceName
        val voice = if (wanted.isNotBlank()) ttsVoices.firstOrNull { it.name == wanted } else null
        if (voice != null) {
            engine.voice = voice
        } else {
            engine.language = Locale.getDefault()
        }
    }

    /** Speaks [text]. Interrupts whatever was being said before. Safe to call even if TTS failed to init. */
    fun speak(text: String) {
        if (text.isBlank()) return
        ensureTts()
        val engine = tts ?: return
        if (!ttsReady) return
        orbState = OrbState.Speaking
        engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, UUID.randomUUID().toString())
    }

    fun stopSpeaking() {
        tts?.stop()
        if (orbState == OrbState.Speaking) orbState = OrbState.Idle
    }

    val isSpeaking: Boolean get() = orbState == OrbState.Speaking

    // ================= Speech to text =================

    private var recognizer: SpeechRecognizer? = null

    /**
     * Starts listening once. Call only after RECORD_AUDIO permission has been granted.
     * [onResult] fires once with the recognised text; [onError] fires with a message fit to show the user.
     */
    fun startListening(onResult: (String) -> Unit, onError: (String) -> Unit) {
        stopSpeaking()
        val ctx = getApplication<Application>().applicationContext
        if (!SpeechRecognizer.isRecognitionAvailable(ctx)) {
            recognitionAvailable = false
            onError("This phone has no speech recognition service installed.")
            return
        }
        onFinalResult = onResult
        onListenError = onError
        recognizer?.destroy()
        val r = SpeechRecognizer.createSpeechRecognizer(ctx)
        recognizer = r
        r.setRecognitionListener(listener)
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
            putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, ctx.packageName)
        }
        partialText = ""
        orbState = OrbState.Listening
        r.startListening(intent)
    }

    fun stopListening() {
        recognizer?.stopListening()
    }

    private fun finishListening() {
        if (orbState == OrbState.Listening) orbState = OrbState.Idle
    }

    private val listener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}

        override fun onPartialResults(partialResults: Bundle?) {
            val text = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
            if (!text.isNullOrBlank()) partialText = text
        }

        override fun onResults(results: Bundle?) {
            finishListening()
            val text = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()
            partialText = ""
            if (!text.isNullOrBlank()) onFinalResult?.invoke(text) else onListenError?.invoke("I didn't catch that. Please try again.")
        }

        override fun onError(error: Int) {
            finishListening()
            partialText = ""
            val message = when (error) {
                SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "I didn't catch that. Please try again."
                SpeechRecognizer.ERROR_AUDIO -> "Microphone error. Please try again."
                SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "No internet connection for speech recognition."
                SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is needed."
                SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Still listening to the previous request. Please wait."
                else -> "Could not understand. Please try again."
            }
            onListenError?.invoke(message)
        }

        override fun onEvent(eventType: Int, params: Bundle?) {}
    }

    override fun onCleared() {
        recognizer?.destroy()
        recognizer = null
        tts?.stop()
        tts?.shutdown()
        tts = null
        super.onCleared()
    }
}
