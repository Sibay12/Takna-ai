package com.takna.ai.api

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.takna.ai.auth.AuthRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.launch

data class ChatMessage(val fromUser: Boolean, val text: String, val isError: Boolean = false)

class ChatViewModel(app: Application) : AndroidViewModel(app) {
    private val auth = AuthRepository(app)
    val messages = mutableStateListOf<ChatMessage>()
    var busy by mutableStateOf(false); private set
    var usageLine by mutableStateOf<String?>(null); private set
    val models = mutableStateListOf<AiModel>()
    var selected by mutableStateOf<AiModel?>(null)
    private var conversationId: String? = null
    private var initialSent = false

    fun loadModels() {
        if (models.isNotEmpty() || auth.currentUser == null) return
        viewModelScope.launch {
            try {
                val token = auth.idToken() ?: return@launch
                val list = ApiClient.models(token)
                models.clear(); models.addAll(list)
                if (selected == null) selected = list.firstOrNull()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // The picker simply stays hidden; chatting still works with the default.
            }
        }
    }

    fun sendInitial(text: String?, voiceMode: Boolean = false, language: String = "auto") {
        if (initialSent || text.isNullOrBlank()) return
        initialSent = true
        send(text, voiceMode, language)
    }

    fun send(raw: String, voiceMode: Boolean = false, language: String = "auto") {
        val text = raw.trim()
        if (text.isEmpty() || busy) return
        messages.add(ChatMessage(true, text))
        if (auth.currentUser == null) {
            messages.add(ChatMessage(false, "Please sign in to chat with TAKNA AI.", isError = true))
            return
        }
        viewModelScope.launch {
            busy = true
            try {
                val token = auth.idToken() ?: throw ApiException(401, "no_token", "")
                val reply = ApiClient.chat(token, text, conversationId, selected?.id, language = language, voiceMode = voiceMode)
                if (reply.conversationId.isNotEmpty()) conversationId = reply.conversationId
                messages.add(ChatMessage(false, reply.text))
                usageLine = "${reply.used} / ${reply.limit} requests used today"
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                messages.add(ChatMessage(false, friendlyApiError(e), isError = true))
            } finally {
                busy = false
            }
        }
    }
}
