package com.takna.ai.api

import com.takna.ai.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

class ApiException(val status: Int, val code: String, override val message: String) : Exception(message)

data class ChatReply(val conversationId: String, val text: String, val used: Int, val limit: Int)
data class AiModel(val id: String, val name: String)
data class Usage(val used: Int, val limit: Int)

/** Minimal HTTPS JSON client for the TAKNA AI backend. The Firebase ID token is sent as a Bearer token; no secrets live in the app. */
object ApiClient {
    // The free Render server can take up to ~60s to wake up after being idle.
    private const val CONNECT_MS = 30_000
    private const val READ_MS = 90_000

    private suspend fun call(method: String, path: String, token: String, body: JSONObject? = null): JSONObject =
        withContext(Dispatchers.IO) {
            val conn = URL(BuildConfig.API_BASE + path).openConnection() as HttpURLConnection
            try {
                conn.requestMethod = method
                conn.connectTimeout = CONNECT_MS
                conn.readTimeout = READ_MS
                conn.setRequestProperty("Authorization", "Bearer $token")
                conn.setRequestProperty("Accept", "application/json")
                if (body != null) {
                    conn.doOutput = true
                    conn.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                    conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                }
                val status = conn.responseCode
                val stream = if (status in 200..299) conn.inputStream else conn.errorStream
                val text = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
                val json = try { JSONObject(text) } catch (e: Exception) { JSONObject() }
                if (status !in 200..299) {
                    val err = json.optJSONObject("error")
                    throw ApiException(
                        status,
                        err?.optString("code").orEmpty().ifEmpty { "http_$status" },
                        err?.optString("message").orEmpty().ifEmpty { "Something went wrong. Please try again." },
                    )
                }
                json
            } finally {
                conn.disconnect()
            }
        }

    suspend fun chat(token: String, message: String, conversationId: String?, modelId: String? = null): ChatReply {
        val body = JSONObject().put("message", message).put("language", "auto").put("mode", "text")
        if (conversationId != null) body.put("conversationId", conversationId)
        if (modelId != null) body.put("modelId", modelId)
        val r = call("POST", "/ai/chat", token, body)
        val usage = r.optJSONObject("usage")
        return ChatReply(
            conversationId = r.optString("conversationId"),
            text = r.getJSONObject("reply").getString("content"),
            used = usage?.optInt("used") ?: 0,
            limit = usage?.optInt("limit") ?: 0,
        )
    }

    suspend fun models(token: String): List<AiModel> {
        val arr = call("GET", "/ai/models", token).optJSONArray("models") ?: return emptyList()
        return (0 until arr.length()).map { arr.getJSONObject(it) }.map { AiModel(it.getString("id"), it.getString("displayName")) }
    }

    suspend fun usage(token: String): Usage {
        val r = call("GET", "/usage", token)
        return Usage(r.optInt("used"), r.optInt("limit"))
    }
}

fun friendlyApiError(e: Throwable): String = when (e) {
    is ApiException -> when (e.status) {
        401 -> "Your session expired. Please sign in again."
        403 -> "This account cannot use that right now."
        else -> e.message
    }
    is IOException -> "Could not reach TAKNA AI. Check your internet. If the server was idle, wait a minute and try again."
    else -> "Something went wrong. Please try again."
}
