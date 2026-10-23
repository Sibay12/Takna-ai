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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.takna.ai.R
import com.takna.ai.ui.components.AwaitingCard
import com.takna.ai.ui.components.TaknaScreen
import com.takna.ai.ui.theme.TaknaColors
import kotlinx.coroutines.launch

private const val AWAITING_AUTH =
    "Sign-in is not connected yet. It goes live in Phase 3 once the Firebase project is configured."

@Composable
fun LoginScreen(onRegister: () -> Unit, onForgot: () -> Unit, onPreview: () -> Unit) {
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val snack = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

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
                onClick = { scope.launch { snack.showSnackbar(AWAITING_AUTH) } },
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            ) { Text("Sign in") }
            OutlinedButton(
                onClick = { scope.launch { snack.showSnackbar(AWAITING_AUTH) } },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            ) { Text("Continue with Google") }
            TextButton(onClick = onForgot) { Text("Forgot password?", color = TaknaColors.TextMuted) }
            TextButton(onClick = onRegister) { Text("Create an account") }
            AwaitingCard(
                heading = "Preview mode",
                body = "Real sign-in arrives in Phase 3. Until then you can look around the app. Nothing is saved to any account.",
                modifier = Modifier.padding(top = 8.dp),
            )
            OutlinedButton(onClick = onPreview, modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp)) {
                Text("Explore the app (preview)")
            }
            Text("TAKNA TECHNOLOGY · SIBAYAN ENTERPRISE", color = TaknaColors.TextMuted, modifier = Modifier.padding(bottom = 16.dp))
        }
    }
}

@Composable
fun RegisterScreen(onBack: () -> Unit) {
    var name by remember { mutableStateOf("") }
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    val snack = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    TaknaScreen(title = "Create account", onBack = onBack, snackbarHostState = snack) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).padding(horizontal = 24.dp).verticalScroll(rememberScrollState()),
        ) {
            OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(
                email, { email = it }, label = { Text("Email") }, singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
            )
            OutlinedTextField(
                password, { password = it }, label = { Text("Password") }, singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            )
            Button(
                onClick = { scope.launch { snack.showSnackbar(AWAITING_AUTH) } },
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            ) { Text("Create account") }
        }
    }
}
