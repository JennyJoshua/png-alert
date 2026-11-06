package com.pngalert.app.ui

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.pngalert.app.core.TrustLabel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppTopBar(title: String, onBack: (() -> Unit)?) {
    TopAppBar(
        title = { Text(title) },
        navigationIcon = {
            if (onBack != null) {
                IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back") }
            }
        },
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = MaterialTheme.colorScheme.primary,
            titleContentColor = Color.White,
            navigationIconContentColor = Color.White,
        ),
    )
}

/** Scrolling column screen for forms and detail pages. */
@Composable
fun ScreenScaffold(title: String, onBack: (() -> Unit)?, content: @Composable ColumnScope.() -> Unit) {
    Scaffold(topBar = { AppTopBar(title, onBack) }) { padding ->
        Column(
            modifier = Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content,
        )
    }
}

/** Lazy list screen for the feed. */
@Composable
fun ListScaffold(title: String, onBack: (() -> Unit)?, content: LazyListScope.() -> Unit) {
    Scaffold(topBar = { AppTopBar(title, onBack) }) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding).fillMaxSize(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content,
        )
    }
}

@Composable
fun LabelChip(text: String, color: Color, filled: Boolean = false) {
    Surface(
        shape = RoundedCornerShape(4.dp),
        color = if (filled) color else Color.Transparent,
        border = BorderStroke(1.dp, color),
    ) {
        Text(
            text,
            color = if (filled) Color.White else color,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
        )
    }
}

private fun trustColor(label: TrustLabel): Color = when (label) {
    TrustLabel.COMMUNITY_REPORT -> Color(0xFF5B6B73)
    TrustLabel.CORROBORATED -> Color(0xFF0B7A6B)
    TrustLabel.OFFICIAL_SOURCE -> Color(0xFF0B5FA5)
    TrustLabel.OFFICIALLY_CONFIRMED -> Color(0xFF0B5FA5)
    TrustLabel.RESOLVED -> Color(0xFF0B7A6B)
    TrustLabel.STALE -> Color(0xFF8A5A00)
}

@Composable
fun TrustChip(label: TrustLabel) {
    LabelChip(label.label, trustColor(label), filled = label == TrustLabel.OFFICIALLY_CONFIRMED)
}

@Composable
fun NoticeCard(text: String) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant), modifier = Modifier.fillMaxWidth()) {
        Text(text, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(12.dp))
    }
}

@Composable
fun DisclaimerCard() {
    NoticeCard(
        "PNG Alert is a community information service, not an emergency authority. In an emergency, follow official " +
            "instructions and contact the relevant authorities. Do not delay seeking help to save a report.",
    )
}

@Composable
fun TextInput(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    error: String? = null,
    hint: String? = null,
    multiline: Boolean = false,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        isError = error != null,
        supportingText = {
            val message = error ?: hint
            if (message != null) Text(message)
        },
        singleLine = !multiline,
        minLines = if (multiline) 3 else 1,
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
fun DropdownField(
    label: String,
    selected: String?,
    options: List<String>,
    onSelected: (String) -> Unit,
    clearLabel: String? = null,
    onCleared: (() -> Unit)? = null,
    error: String? = null,
) {
    var open by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label, style = MaterialTheme.typography.labelMedium)
        OutlinedButton(onClick = { open = true }, modifier = Modifier.fillMaxWidth()) {
            Text(selected ?: clearLabel ?: "Choose")
        }
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            if (clearLabel != null && onCleared != null) {
                DropdownMenuItem(text = { Text(clearLabel) }, onClick = { open = false; onCleared() })
            }
            options.forEach { option ->
                DropdownMenuItem(text = { Text(option) }, onClick = { open = false; onSelected(option) })
            }
        }
        if (error != null) Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
    }
}

fun placeLine(locality: String, district: String?, province: String): String =
    listOfNotNull(locality, district?.takeIf { it.isNotBlank() }, province).joinToString(", ")

fun openLink(context: Context, url: String) {
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
    } catch (e: ActivityNotFoundException) {
        // No browser installed; nothing else to do.
    }
}

fun shareText(context: Context, text: String) {
    val send = Intent(Intent.ACTION_SEND).apply {
        type = "text/plain"
        putExtra(Intent.EXTRA_TEXT, text)
    }
    context.startActivity(Intent.createChooser(send, "Share"))
}
