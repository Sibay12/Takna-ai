package com.takna.ai.auth

import android.app.Application
import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.launch

class AuthViewModel(app: Application) : AndroidViewModel(app) {
    val repo = AuthRepository(app)
    var busy by mutableStateOf(false); private set
    var message by mutableStateOf<String?>(null); private set

    val isConfigured get() = repo.isConfigured
    val signedIn get() = repo.currentUser != null
    val verified get() = repo.currentUser?.isEmailVerified == true
    val email get() = repo.currentUser?.email

    fun clearMessage() { message = null }
    fun say(text: String) { message = text }

    private fun run(onOk: () -> Unit, okMessage: String? = null, block: suspend () -> Result<Unit>) {
        if (busy) return
        viewModelScope.launch {
            busy = true; message = null
            val r = block()
            busy = false
            r.fold(
                onSuccess = { okMessage?.let { message = it }; onOk() },
                onFailure = { message = friendlyAuthError(it) },
            )
        }
    }

    fun signIn(email: String, password: String, onOk: () -> Unit) {
        if (email.isBlank() || password.isBlank()) { message = "Enter your email and password."; return }
        run(onOk) { repo.signIn(email, password) }
    }

    fun register(name: String, email: String, password: String, onOk: () -> Unit) {
        if (email.isBlank() || password.length < 6) { message = "Enter a valid email and a password of 6+ characters."; return }
        run(onOk) { repo.register(name, email, password) }
    }

    fun google(context: Context, onOk: () -> Unit) = run(onOk) { repo.signInWithGoogle(context) }

    fun resetPassword(email: String, onOk: () -> Unit) {
        if (email.isBlank()) { message = "Enter your email first."; return }
        run(onOk, okMessage = "If an account exists, a reset link has been sent.") { repo.resetPassword(email) }
    }

    fun resendVerification() = run({}, okMessage = "Verification email sent. Check your inbox and spam folder.") { repo.sendVerification() }

    fun checkVerified(onVerified: () -> Unit) {
        if (busy) return
        viewModelScope.launch {
            busy = true; message = null
            val ok = repo.refreshVerified()
            busy = false
            if (ok) onVerified() else message = "Email is not verified yet."
        }
    }

    fun signOut() = repo.signOut()
}
