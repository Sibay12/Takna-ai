package com.takna.ai.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Code
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.VolumeOff
import androidx.compose.material3.AssistChip
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.takna.ai.nav.Routes
import com.takna.ai.ui.components.AiOrb
import com.takna.ai.ui.components.AwaitingCard
import com.takna.ai.ui.components.SignOutDialog
import com.takna.ai.ui.components.TaknaScreen
import com.takna.ai.ui.theme.TaknaColors
import com.takna.ai.voice.VoiceController
import com.takna.ai.voice.rememberMicPermission
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(
    onOpen: (String) -> Unit,
    onChat: (String?) -> Unit,
    canSignOut: Boolean,
    onSignOut: () -> Unit,
    loadUsage: suspend () -> String?,
    voice: VoiceController = viewModel(),
) {
    val usageText by androidx.compose.runtime.produceState<String?>(initialValue = null) { value = loadUsage() }
    var confirmSignOut by remember { mutableStateOf(false) }
    var text by remember { mutableStateOf("") }
    val snack = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    fun send() {
        val q = text.trim()
        if (q.isNotEmpty()) { text = ""; onChat(q) }
    }
    val askMic = rememberMicPermission(
        onDenied = { scope.launch { snack.showSnackbar("Microphone permission is needed to listen.") } },
        onGranted = {
            voice.startListening(
                onResult = { heard -> onChat(heard) },
                onError = { msg -> scope.launch { snack.showSnackbar(msg) } },
            )
        },
    )

    if (confirmSignOut) SignOutDialog(onConfirm = { confirmSignOut = false; onSignOut() }, onDismiss = { confirmSignOut = false })
    TaknaScreen(
        title = "TAKNA AI",
        snackbarHostState = snack,
        actions = {
            if (canSignOut) IconButton(onClick = { confirmSignOut = true }) {
                Icon(Icons.AutoMirrored.Filled.Logout, contentDescription = "Sign out")
            }
        },
    ) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).padding(horizontal = 20.dp).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            AiOrb(voice.orbState, Modifier.padding(top = 12.dp), orbSize = 200.dp)
            Text(
                if (voice.partialText.isNotBlank()) voice.partialText else "Hello, I'm TAKNA AI. How can I help you?",
                color = TaknaColors.TextPrimary,
                modifier = Modifier.padding(top = 8.dp, bottom = 16.dp),
            )

            Row(
                Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = text, onValueChange = { text = it },
                    placeholder = { Text("Ask TAKNA AI…") },
                    modifier = Modifier.weight(1f),
                    keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
                    keyboardActions = KeyboardActions(onSend = { send() }),
                )
                FilledIconButton(onClick = { send() }) { Icon(Icons.AutoMirrored.Filled.Send, "Send") }
            }
            Row(Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                FilledIconButton(
                    onClick = {
                        if (voice.orbState == com.takna.ai.ui.components.OrbState.Listening) voice.stopListening() else askMic()
                    },
                    modifier = Modifier.size(64.dp),
                ) {
                    Icon(Icons.Filled.Mic, "Microphone", Modifier.size(30.dp))
                }
                IconButton(
                    onClick = { voice.stopSpeaking() },
                    enabled = voice.isSpeaking,
                    modifier = Modifier.size(64.dp),
                ) {
                    Icon(
                        Icons.Filled.VolumeOff,
                        "Stop speaking",
                        tint = if (voice.isSpeaking) TaknaColors.Cyan else TaknaColors.TextMuted,
                        modifier = Modifier.size(28.dp),
                    )
                }
            }

            Text("Quick actions", color = TaknaColors.TextMuted, modifier = Modifier.padding(top = 20.dp, bottom = 8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AssistChip(onClick = { onOpen(Routes.CodingStudio) }, label = { Text("Coding") },
                    leadingIcon = { Icon(Icons.Filled.Code, null, Modifier.size(18.dp)) })
                AssistChip(onClick = { onOpen(Routes.WebsitePreview) }, label = { Text("Websites") },
                    leadingIcon = { Icon(Icons.Filled.Language, null, Modifier.size(18.dp)) })
            }
            Row(Modifier.padding(top = 4.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AssistChip(onClick = { onOpen(Routes.YouTube) }, label = { Text("YouTube") },
                    leadingIcon = { Icon(Icons.Filled.PlayCircle, null, Modifier.size(18.dp)) })
                AssistChip(onClick = { onOpen(Routes.Settings) }, label = { Text("Settings") },
                    leadingIcon = { Icon(Icons.Filled.Settings, null, Modifier.size(18.dp)) })
                AssistChip(onClick = { onOpen(Routes.More) }, label = { Text("More") },
                    leadingIcon = { Icon(Icons.Filled.Menu, null, Modifier.size(18.dp)) })
            }

            AwaitingCard("Recent projects", "No projects yet. They appear here after sign-in (Phase 3) and the Coding Studio (Phase 7).",
                Modifier.fillMaxWidth().padding(top = 20.dp))
            AwaitingCard("Recent conversations", "Your chats from the last 7 days will appear here after sign-in.",
                Modifier.fillMaxWidth().padding(top = 12.dp))
            if (usageText != null) {
                AwaitingCard("Plan and usage", usageText!!, Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 24.dp))
            } else {
                AwaitingCard("Plan and usage", "Sign in to see your daily usage here.", Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 24.dp))
            }
        }
    }
}
