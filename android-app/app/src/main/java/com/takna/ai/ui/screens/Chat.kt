package com.takna.ai.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.takna.ai.ui.components.AwaitingCard
import com.takna.ai.ui.components.TaknaScreen
import com.takna.ai.ui.theme.TaknaColors

private data class Msg(val fromUser: Boolean, val text: String)

private const val NOT_CONNECTED =
    "Replies are not connected in this preview yet. They start working in an upcoming update."

@Composable
fun ChatScreen(initialMessage: String?, onBack: () -> Unit) {
    val messages = remember { mutableStateListOf<Msg>() }
    var text by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    fun post(q: String) {
        messages.add(Msg(true, q))
        messages.add(Msg(false, NOT_CONNECTED))
    }
    LaunchedEffect(initialMessage) {
        if (!initialMessage.isNullOrBlank() && messages.isEmpty()) post(initialMessage)
    }
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.animateScrollToItem(messages.lastIndex)
    }

    TaknaScreen(title = "Chat", onBack = onBack) { pad ->
        Column(Modifier.fillMaxSize().padding(pad)) {
            AwaitingCard(
                "Preview", "This chat screen is a preview. Messages are not sent anywhere and nothing is stored.",
                Modifier.padding(horizontal = 16.dp),
            )
            LazyColumn(
                state = listState,
                modifier = Modifier.weight(1f).fillMaxWidth().padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                items(messages) { m ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (m.fromUser) Arrangement.End else Arrangement.Start) {
                        Box(
                            Modifier.background(
                                if (m.fromUser) TaknaColors.ElectricBlue else TaknaColors.NavyLight,
                                RoundedCornerShape(16.dp),
                            ).padding(12.dp),
                        ) { Text(m.text, color = TaknaColors.TextPrimary) }
                    }
                }
            }
            Row(
                Modifier.fillMaxWidth().padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                OutlinedTextField(
                    value = text, onValueChange = { text = it },
                    placeholder = { Text("Message") }, modifier = Modifier.weight(1f),
                )
                FilledIconButton(onClick = {
                    val q = text.trim()
                    if (q.isNotEmpty()) { post(q); text = "" }
                }) { Icon(Icons.Filled.Send, "Send") }
            }
        }
    }
}
