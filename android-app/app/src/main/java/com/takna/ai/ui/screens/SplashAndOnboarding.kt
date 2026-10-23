package com.takna.ai.ui.screens

import androidx.compose.animation.core.Animatable
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.takna.ai.R
import com.takna.ai.ui.components.AiOrb
import com.takna.ai.ui.components.OrbState
import com.takna.ai.ui.theme.TaknaColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@Composable
fun SplashScreenUi(onDone: () -> Unit) {
    val alpha = remember { Animatable(0f) }
    LaunchedEffect(Unit) {
        alpha.animateTo(1f, androidx.compose.animation.core.tween(700))
        delay(900)
        onDone()
    }
    Box(Modifier.fillMaxSize().background(TaknaColors.backgroundBrush), contentAlignment = Alignment.Center) {
        Image(
            painter = painterResource(R.drawable.takna_logo),
            contentDescription = "TAKNA AI logo",
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxWidth(0.8f).alpha(alpha.value),
        )
    }
}

private data class OnboardingPage(val title: String, val body: String)

private val pages = listOf(
    OnboardingPage("Your intelligent assistant", "Talk or type in Hindi, English or Hinglish. TAKNA AI answers using Google Gemini."),
    OnboardingPage("Code and build", "Create code, plan websites and keep your projects organised in the Coding Studio."),
    OnboardingPage("You stay in control", "The mic listens only when you tap it. Chats are kept for 7 days and you can delete them any time."),
)

@Composable
fun OnboardingScreen(onFinish: () -> Unit) {
    val pager = rememberPagerState(pageCount = { pages.size })
    val scope = rememberCoroutineScope()
    Column(
        Modifier.fillMaxSize().background(TaknaColors.backgroundBrush).padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
            TextButton(onClick = onFinish) { Text("Skip", color = TaknaColors.TextMuted) }
        }
        HorizontalPager(state = pager, modifier = Modifier.weight(1f)) { index ->
            Column(
                Modifier.fillMaxSize(),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center,
            ) {
                AiOrb(OrbState.Idle, orbSize = 200.dp)
                Text(
                    pages[index].title,
                    style = MaterialTheme.typography.headlineSmall,
                    color = TaknaColors.TextPrimary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 32.dp),
                )
                Text(
                    pages[index].body,
                    style = MaterialTheme.typography.bodyLarge,
                    color = TaknaColors.TextMuted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 12.dp, start = 12.dp, end = 12.dp),
                )
            }
        }
        Row(Modifier.padding(vertical = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            repeat(pages.size) { i ->
                Box(
                    Modifier.size(if (i == pager.currentPage) 10.dp else 7.dp).clip(CircleShape)
                        .background(if (i == pager.currentPage) TaknaColors.Cyan else TaknaColors.TextMuted),
                )
            }
        }
        Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                if (pager.currentPage == pages.lastIndex) onFinish()
                else scope.launch { pager.animateScrollToPage(pager.currentPage + 1) }
            },
        ) { Text(if (pager.currentPage == pages.lastIndex) "Get started" else "Next") }
    }
}
