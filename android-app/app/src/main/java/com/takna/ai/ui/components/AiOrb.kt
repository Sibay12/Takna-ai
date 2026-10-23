package com.takna.ai.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.takna.ai.ui.theme.TaknaColors

enum class OrbState { Idle, Listening, Speaking }

/** Animated TAKNA AI orb. The state only changes the animation; it never records audio by itself. */
@Composable
fun AiOrb(state: OrbState, modifier: Modifier = Modifier, orbSize: Dp = 220.dp) {
    val transition = rememberInfiniteTransition(label = "orb")
    val pulse by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            tween(if (state == OrbState.Idle) 3200 else 1000, easing = LinearEasing),
            RepeatMode.Reverse,
        ),
        label = "pulse",
    )
    val spin by transition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(14000, easing = LinearEasing)),
        label = "spin",
    )
    val amplitude = when (state) {
        OrbState.Idle -> 0.04f
        OrbState.Listening -> 0.10f
        OrbState.Speaking -> 0.14f
    }

    Canvas(modifier.size(orbSize)) {
        val c = center
        val r = this.size.minDimension / 2f
        val scale = 1f + amplitude * pulse

        drawCircle(
            brush = Brush.radialGradient(
                listOf(TaknaColors.Cyan.copy(alpha = 0.35f), Color.Transparent),
                center = c,
                radius = r,
            ),
            radius = r,
            center = c,
        )
        drawCircle(
            brush = Brush.radialGradient(
                listOf(Color(0xFF9CF6FF), TaknaColors.ElectricBlue, TaknaColors.Navy),
                center = c - Offset(r * 0.12f, r * 0.12f),
                radius = r * 0.6f * scale,
            ),
            radius = r * 0.55f * scale,
            center = c,
        )
        val ringSize = Size(r * 1.6f, r * 1.6f)
        val ringTopLeft = Offset(c.x - r * 0.8f, c.y - r * 0.8f)
        rotate(spin, c) {
            drawArc(
                color = TaknaColors.Cyan,
                startAngle = 0f,
                sweepAngle = 100f,
                useCenter = false,
                topLeft = ringTopLeft,
                size = ringSize,
                style = Stroke(width = r * 0.03f, cap = StrokeCap.Round),
            )
            drawArc(
                color = TaknaColors.ElectricBlue,
                startAngle = 180f,
                sweepAngle = 70f,
                useCenter = false,
                topLeft = ringTopLeft,
                size = ringSize,
                style = Stroke(width = r * 0.03f, cap = StrokeCap.Round),
            )
        }
    }
}
