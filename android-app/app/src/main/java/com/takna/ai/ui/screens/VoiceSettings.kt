package com.takna.ai.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.takna.ai.ui.components.AwaitingCard
import com.takna.ai.ui.components.TaknaScreen
import com.takna.ai.ui.theme.TaknaColors
import com.takna.ai.voice.VoiceController

private val languages = listOf("auto" to "Auto", "hi" to "Hindi", "en" to "English", "hinglish" to "Hinglish")

@Composable
fun VoiceSettingsScreen(voice: VoiceController, onBack: () -> Unit) {
    var autoSpeak by remember { mutableStateOf(voice.autoSpeak) }
    var rate by remember { mutableFloatStateOf(voice.speechRate) }
    var pitch by remember { mutableFloatStateOf(voice.speechPitch) }
    var language by remember { mutableStateOf(voice.replyLanguage) }
    var voiceMenuOpen by remember { mutableStateOf(false) }
    var selectedVoiceName by remember { mutableStateOf(voice.voiceName) }

    TaknaScreen(title = "Voice settings", onBack = onBack) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(horizontal = 24.dp).verticalScroll(rememberScrollState())) {
            Row(Modifier.fillMaxWidth().padding(top = 16.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Speak replies out loud", color = TaknaColors.TextPrimary, modifier = Modifier.weight(1f))
                Switch(checked = autoSpeak, onCheckedChange = { autoSpeak = it; voice.autoSpeak = it })
            }
            Text(
                "When on, TAKNA AI reads its chat replies aloud and keeps them short and spoken-style.",
                color = TaknaColors.TextMuted,
            )

            HorizontalDivider(color = TaknaColors.NavyLight, modifier = Modifier.padding(vertical = 20.dp))

            Text("Reply language", color = TaknaColors.TextPrimary)
            Row(Modifier.padding(top = 8.dp)) {
                languages.forEach { (code, label) ->
                    FilterChip(
                        selected = language == code,
                        onClick = { language = code; voice.replyLanguage = code },
                        label = { Text(label) },
                        modifier = Modifier.padding(end = 8.dp),
                    )
                }
            }

            HorizontalDivider(color = TaknaColors.NavyLight, modifier = Modifier.padding(vertical = 20.dp))

            Text("Speaking rate: ${"%.1f".format(rate)}x", color = TaknaColors.TextPrimary)
            Slider(
                value = rate, onValueChange = { rate = it; voice.speechRate = it },
                valueRange = 0.5f..2.0f, steps = 5,
            )
            Text("Pitch: ${"%.1f".format(pitch)}", color = TaknaColors.TextPrimary, modifier = Modifier.padding(top = 12.dp))
            Slider(
                value = pitch, onValueChange = { pitch = it; voice.speechPitch = it },
                valueRange = 0.5f..1.5f, steps = 4,
            )

            HorizontalDivider(color = TaknaColors.NavyLight, modifier = Modifier.padding(vertical = 20.dp))

            Text("Voice", color = TaknaColors.TextPrimary)
            if (!voice.ttsReady) {
                Text("Starting the voice engine…", color = TaknaColors.TextMuted, modifier = Modifier.padding(top = 4.dp))
            } else if (voice.ttsVoices.isEmpty()) {
                AwaitingCard(
                    "No extra voices found",
                    "This phone only offers its default voice. The device language's default voice will be used.",
                    Modifier.fillMaxWidth().padding(top = 8.dp),
                )
            } else {
                Row(Modifier.padding(top = 8.dp)) {
                    OutlinedButton(onClick = { voiceMenuOpen = true }) {
                        Text(if (selectedVoiceName.isBlank()) "Device default" else selectedVoiceName)
                    }
                    DropdownMenu(expanded = voiceMenuOpen, onDismissRequest = { voiceMenuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text("Device default") },
                            onClick = { selectedVoiceName = ""; voice.voiceName = ""; voiceMenuOpen = false },
                        )
                        // Only this phone's installed, non-network-only voices are offered — never a promised voice it doesn't have.
                        voice.ttsVoices.filter { !it.isNetworkConnectionRequired }.take(30).forEach { v ->
                            DropdownMenuItem(
                                text = { Text("${v.locale.displayName} · ${v.name}") },
                                onClick = { selectedVoiceName = v.name; voice.voiceName = v.name; voiceMenuOpen = false },
                            )
                        }
                    }
                }
            }
            Button(
                onClick = { voice.speak("Hello, I'm TAKNA AI. This is how I will sound.") },
                enabled = voice.ttsReady,
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp, bottom = 32.dp),
            ) { Text("Test voice") }
        }
    }
}
