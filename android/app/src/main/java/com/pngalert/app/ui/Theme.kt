package com.pngalert.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Scheme = lightColorScheme(
    primary = Color(0xFFB5121B),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFFADADD),
    onPrimaryContainer = Color(0xFF410004),
    secondary = Color(0xFF14262E),
    onSecondary = Color.White,
    background = Color(0xFFEEF2F4),
    surface = Color.White,
    surfaceVariant = Color(0xFFE3EAED),
    error = Color(0xFFB3261E),
)

@Composable
fun PngAlertTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = Scheme, content = content)
}
