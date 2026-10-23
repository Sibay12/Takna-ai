package com.takna.ai.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import com.takna.ai.R
import com.takna.ai.nav.Pending
import com.takna.ai.nav.Routes
import com.takna.ai.ui.components.AwaitingCard
import com.takna.ai.ui.components.SignOutDialog
import com.takna.ai.ui.components.TaknaScreen
import com.takna.ai.ui.theme.TaknaColors

private val items = listOf(
    "Voice settings" to Routes.VoiceSettings,
    "App launcher" to Routes.AppLauncher,
    "YouTube assistant" to Routes.YouTube,
    "Coding Studio" to Routes.CodingStudio,
    "File explorer" to Routes.FileExplorer,
    "Code editor" to Routes.CodeEditor,
    "Website preview" to Routes.WebsitePreview,
    "Project export" to Routes.ProjectExport,
    "Conversation history" to Routes.History,
    "Profile" to Routes.Profile,
    "Subscription plans" to Routes.Plans,
    "Billing history" to Routes.Billing,
    "Privacy settings" to Routes.Privacy,
    "Settings" to Routes.Settings,
    "About TAKNA AI" to Routes.About,
)

@Composable
fun MoreScreen(onOpen: (String) -> Unit, canSignOut: Boolean, onSignOut: () -> Unit, onBack: () -> Unit) {
    var confirm by remember { mutableStateOf(false) }
    if (confirm) SignOutDialog(onConfirm = { confirm = false; onSignOut() }, onDismiss = { confirm = false })
    TaknaScreen(title = "More", onBack = onBack) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).verticalScroll(rememberScrollState())) {
            items.forEach { (label, route) ->
                Text(
                    label,
                    color = TaknaColors.TextPrimary,
                    modifier = Modifier.fillMaxWidth().clickable { onOpen(route) }.padding(horizontal = 24.dp, vertical = 16.dp),
                )
                HorizontalDivider(color = TaknaColors.NavyLight)
            }
            if (canSignOut) {
                Text(
                    "Sign out",
                    color = TaknaColors.Danger,
                    modifier = Modifier.fillMaxWidth().clickable { confirm = true }.padding(horizontal = 24.dp, vertical = 16.dp),
                )
            }
        }
    }
}

@Composable
fun PendingScreen(info: Pending, onBack: () -> Unit) {
    TaknaScreen(title = info.title, onBack = onBack) { pad ->
        Column(Modifier.fillMaxSize().padding(pad).padding(24.dp)) {
            AwaitingCard("Coming in ${info.phase}", info.note, Modifier.fillMaxWidth())
        }
    }
}

@Composable
fun AboutScreen(onBack: () -> Unit) {
    TaknaScreen(title = "About TAKNA AI", onBack = onBack) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).padding(24.dp).verticalScroll(rememberScrollState()),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Image(painterResource(R.drawable.takna_logo), "TAKNA AI logo", Modifier.fillMaxWidth(0.7f))
            Text("Version 0.1.0 (foundation preview)", color = TaknaColors.TextMuted, modifier = Modifier.padding(top = 12.dp))
            Text("A product of TAKNA TECHNOLOGY", color = TaknaColors.Cyan, modifier = Modifier.padding(top = 16.dp))
            Text("SIBAYAN ENTERPRISE", color = TaknaColors.TextPrimary)
        }
    }
}
