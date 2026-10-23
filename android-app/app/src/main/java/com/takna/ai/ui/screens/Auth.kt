package com.takna.ai.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.takna.ai.R
import com.takna.ai.auth.AuthViewModel
import com.takna.ai.ui.components.AwaitingCard
import com.takna.ai.ui.components.TaknaScreen
import com.takna.ai.ui.theme.TaknaColors

/** Shows vm.message as a snackbar whenever it changes. */
@Composable
private fun rememberAuthSnackbar(vm: AuthViewModel): SnackbarHostState {
    val snack = remember { SnackbarHostState() }
    val msg = vm.message
    LaunchedEffect(msg) {
        if (msg != null) { snack.showSnackbar(msg); vm.clearMessage() }
    }
    return snack
}

/** After sign-in: unverified email addresses go to the verification screen first. */
@Composable
fun LoginScreen(
    vm: AuthViewModel,
    onSignedIn: (verified: Boolean) -> Unit,
    onRegister: () -> Unit,
    onForgot: () -> Unit,
    onPreview: () -> Unit,
) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val snack = rememberAuthSnackbar(vm)
    val context = LocalContext.current
    val done = { onSignedIn(vm.verified) }

    TaknaScreen(title = "Sign in", snackbarHostState = snack) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).padding(horizontal = 24.dp).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Image(painterResource(R.drawable.takna_emblem), "TAKNA AI", Modifier.size(120.dp))
            OutlinedTextField(
                value = email, onValueChange = { email = it }, label = { Text("Email") },
                singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            )
            OutlinedTextField(
                value = password, onValueChange = { password = it }, label = { Text("Password") },
                singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            )
            Button(
                onClick = { vm.signIn(email, password, done) },
                enabled = !vm.busy,
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            ) {
                if (vm.busy) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) else Text("Sign in")
            }
            OutlinedButton(
                onClick = { vm.google(context, done) },
                enabled = !vm.busy,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            ) { Text("Continue with Google") }
            TextButton(onClick = onForgot) { Text("Forgot password?", color = TaknaColors.TextMuted) }
            TextButton(onClick = onRegister) { Text("Create an account") }
            if (!vm.isConfigured) {
                AwaitingCard(
                    heading = "Sign-in not configured in this build",
                    body = "The Firebase file (google-services.json) is missing, so accounts cannot be used yet. You can still look around in preview mode. Nothing is saved.",
                    modifier = Modifier.padding(top = 8.dp),
                )
                OutlinedButton(onClick = onPreview, modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp)) {
                    Text("Explore the app (preview)")
                }
            }
            Text("TAKNA TECHNOLOGY · SIBAYAN ENTERPRISE", color = TaknaColors.TextMuted, modifier = Modifier.padding(vertical = 16.dp))
        }
    }
}

@Composable
fun RegisterScreen(vm: AuthViewModel, onRegistered: () -> Unit, onBack: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val snack = rememberAuthSnackbar(vm)

    TaknaScreen(title = "Create account", onBack = onBack, snackbarHostState = snack) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(horizontal = 24.dp).verticalScroll(rememberScrollState())) {
            OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(
                email, { email = it }, label = { Text("Email") }, singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            )
            OutlinedTextField(
                password, { password = it }, label = { Text("Password (6+ characters)") }, singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            )
            Button(
                onClick = { vm.register(name, email, password, onRegistered) },
                enabled = !vm.busy,
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            ) { Text("Create account") }
            Text(
                "A verification email will be sent to this address.",
                color = TaknaColors.TextMuted, modifier = Modifier.padding(top = 12.dp),
            )
        }
    }
}

@Composable
fun ResetPasswordScreen(vm: AuthViewModel, onBack: () -> Unit) {
    var email by remember { mutableStateOf("") }
    val snack = rememberAuthSnackbar(vm)
    TaknaScreen(title = "Reset password", onBack = onBack, snackbarHostState = snack) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(horizontal = 24.dp)) {
            Text("Enter your account email. We will send a reset link.", color = TaknaColors.TextMuted)
            OutlinedTextField(
                email, { email = it }, label = { Text("Email") }, singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            )
            Button(
                onClick = { vm.resetPassword(email) {} },
                enabled = !vm.busy,
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            ) { Text("Send reset link") }
        }
    }
}

@Composable
fun VerifyEmailScreen(vm: AuthViewModel, onVerified: () -> Unit, onSignOut: () -> Unit) {
    val snack = rememberAuthSnackbar(vm)
    TaknaScreen(title = "Verify your email", snackbarHostState = snack) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(24.dp)) {
            Text(
                "We sent a verification link to ${vm.email ?: "your email"}. Open it, then come back and tap the button below.",
                color = TaknaColors.TextPrimary,
            )
            Button(
                onClick = { vm.checkVerified(onVerified) },
                enabled = !vm.busy,
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            ) { Text("I have verified") }
            OutlinedButton(
                onClick = { vm.resendVerification() },
                enabled = !vm.busy,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            ) { Text("Resend email") }
            TextButton(onClick = onSignOut) { Text("Use a different account", color = TaknaColors.TextMuted) }
        }
    }
}

@Composable
fun ProfileScreen(vm: AuthViewModel, onSignedOut: () -> Unit, onBack: () -> Unit) {
    TaknaScreen(title = "Profile", onBack = onBack) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(24.dp)) {
            if (!vm.signedIn) {
                AwaitingCard("Not signed in", "Sign in to see your account.", Modifier.fillMaxWidth())
            } else {
                Text(vm.repo.currentUser?.displayName ?: "TAKNA AI user", color = TaknaColors.TextPrimary)
                Text(vm.email ?: "", color = TaknaColors.TextMuted, modifier = Modifier.padding(top = 4.dp))
                Text(
                    if (vm.verified) "Email verified" else "Email not verified",
                    color = if (vm.verified) TaknaColors.Cyan else TaknaColors.Danger,
                    modifier = Modifier.padding(top = 4.dp),
                )
                OutlinedButton(
                    onClick = { vm.signOut(); onSignedOut() },
                    modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
                ) { Text("Sign out") }
            }
        }
    }
}
