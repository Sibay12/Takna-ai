package com.takna.ai.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.takna.ai.api.ChatViewModel
import com.takna.ai.ui.components.TaknaScreen
import com.takna.ai.ui.theme.TaknaColors

@Composable
fun ChatScreen(initialMessage: String?, onBack: () -> Unit, vm: ChatViewModel = viewModel()) {
    var text by remember { mutableStateOf("") }
    val listState = rememberLazyListState()
    val messages = vm.messages

    LaunchedEffect(initialMessage) { vm.sendInitial(initialMessage) }
    LaunchedEffect(messages.size, vm.busy) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
    }

    TaknaScreen(title = "Chat", onBack = onBack) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).imePadding()) {
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (messages.isEmpty()) item {
                    Text("Ask me anything. I reply in the language you write in.", color = TaknaColors.TextMuted, modifier = Modifier.padding(top = 16.dp))
                }
                items(messages) { m ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (m.fromUser) Arrangement.End else Arrangement.Start) {
                        Box(
                            Modifier.background(
                                when {
                                    m.fromUser -> TaknaColors.ElectricBlue
                                    m.isError -> TaknaColors.Danger.copy(alpha = 0.25f)
                                    else -> TaknaColors.NavyLight
                                },
                                RoundedCornerShape(16.dp),
                            ).padding(12.dp),
                        ) { Text(m.text, color = TaknaColors.TextPrimary) }
                    }
                }
                if (vm.busy) item {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                        Text("Thinking… (the first reply can take up to a minute if the server was idle)", color = TaknaColors.TextMuted)
                    }
                }
            }
            vm.usageLine?.let { Text(it, color = TaknaColors.TextMuted, modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)) }
            Row(
                Modifier.fillMaxWidth().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = text, onValueChange = { text = it },
                    placeholder = { Text("Message") }, modifier = Modifier.weight(1f),
                )
                FilledIconButton(onClick = { vm.send(text); text = "" }, enabled = !vm.busy) {
                    Icon(Icons.AutoMirrored.Filled.Send, "Send")
                }
            }
        }
    }
}
