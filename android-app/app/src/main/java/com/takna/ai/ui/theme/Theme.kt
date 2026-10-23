package com.takna.ai.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color

object TaknaColors {
    val Black = Color(0xFF05070F)
    val Navy = Color(0xFF0A1530)
    val NavyLight = Color(0xFF12254F)
    val Cyan = Color(0xFF22D3EE)
    val ElectricBlue = Color(0xFF2F7BFF)
    val TextPrimary = Color(0xFFEAF2FF)
    val TextMuted = Color(0xFF8CA0C4)
    val Danger = Color(0xFFFF5C7A)
    val backgroundBrush = Brush.verticalGradient(listOf(Black, Navy))
}

private val Scheme = darkColorScheme(
    primary = TaknaColors.Cyan,
    onPrimary = TaknaColors.Black,
    secondary = TaknaColors.ElectricBlue,
    onSecondary = Color.White,
    background = TaknaColors.Black,
    onBackground = TaknaColors.TextPrimary,
    surface = TaknaColors.Navy,
    onSurface = TaknaColors.TextPrimary,
    surfaceVariant = TaknaColors.NavyLight,
    onSurfaceVariant = TaknaColors.TextMuted,
    error = TaknaColors.Danger,
)

/** TAKNA AI is a dark, Jarvis-style brand: the dark scheme is always used. */
@Composable
fun TaknaTheme(content: @Composable () -> Unit) {
    @Suppress("UNUSED_VARIABLE") val system = isSystemInDarkTheme()
    MaterialTheme(colorScheme = Scheme, content = content)
}
