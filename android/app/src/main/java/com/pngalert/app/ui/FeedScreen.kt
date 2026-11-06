package com.pngalert.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pngalert.app.core.Category
import com.pngalert.app.core.PROVINCES
import com.pngalert.app.core.Platform
import com.pngalert.app.core.TimeUtil
import com.pngalert.app.core.TrustLabel
import com.pngalert.app.data.SourceItem

@Composable
fun FeedScreen(
    vm: MainViewModel,
    onOpen: (String) -> Unit,
    onReport: () -> Unit,
    onShareLink: () -> Unit,
    onSubmissions: () -> Unit,
    onInfo: () -> Unit,
    onSettings: () -> Unit,
) {
    val filters by vm.filters.collectAsStateWithLifecycle()
    val reports by vm.reportRows.collectAsStateWithLifecycle()
    val sources by vm.sourceRows.collectAsStateWithLifecycle()
    val now = System.currentTimeMillis()
    val showingReports = filters.tab == FeedTab.REPORTS

    ListScaffold("PNG Alert", onBack = null) {
        item { DisclaimerCard() }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = onReport, modifier = Modifier.weight(1f)) { Text("Report") }
                OutlinedButton(onClick = onShareLink, modifier = Modifier.weight(1f)) { Text("Share a link") }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                TextButton(onClick = onSubmissions) { Text("My saved items") }
                TextButton(onClick = onInfo) { Text("Rules & safety") }
                TextButton(onClick = onSettings) { Text("Settings") }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TabButton("Reports", showingReports, Modifier.weight(1f)) { vm.update { it.copy(tab = FeedTab.REPORTS) } }
                TabButton("Linked sources", !showingReports, Modifier.weight(1f)) { vm.update { it.copy(tab = FeedTab.SOURCES) } }
            }
        }
        item {
            OutlinedTextField(
                value = filters.query,
                onValueChange = { q -> vm.update { it.copy(query = q.take(60)) } },
                label = { Text("Search") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        item {
            DropdownField(
                label = "Province",
                selected = filters.province,
                options = PROVINCES,
                onSelected = { p -> vm.update { it.copy(province = p) } },
                clearLabel = "All provinces",
                onCleared = { vm.update { it.copy(province = null) } },
            )
        }
        if (showingReports) {
            item {
                DropdownField(
                    label = "Category",
                    selected = filters.category?.label,
                    options = Category.values().map { it.label },
                    onSelected = { label -> vm.update { f -> f.copy(category = Category.values().firstOrNull { it.label == label }) } },
                    clearLabel = "All categories",
                    onCleared = { vm.update { it.copy(category = null) } },
                )
            }
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Switch(checked = filters.currentOnly, onCheckedChange = { c -> vm.update { it.copy(currentOnly = c) } })
                    Spacer(Modifier.width(8.dp))
                    Text(if (filters.currentOnly) "Current only" else "Current and past")
                }
            }
        }

        val empty = if (showingReports) reports.isEmpty() else sources.isEmpty()
        if (empty) {
            item {
                NoticeCard(
                    "Nothing to show on this phone yet. The shared community feed arrives with a later version that can sync. " +
                        "You can already save reports and links on this phone with the buttons above.",
                )
            }
        }
        if (showingReports) {
            items(reports, key = { it.item.id }) { row ->
                val i = row.item
                Card(modifier = Modifier.fillMaxWidth().clickable { onOpen(i.id) }) {
                    Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            TrustChip(row.trust)
                            if (i.isDemo) LabelChip("Demo data", Color(0xFF5B6B73))
                        }
                        Text(i.title, style = MaterialTheme.typography.titleMedium)
                        Text(placeLine(i.locality, i.district, i.province), style = MaterialTheme.typography.bodySmall)
                        val confirmed = i.lastConfirmedAt?.let { " · last confirmed ${TimeUtil.timeAgo(it, now)}" } ?: ""
                        Text("Reported ${TimeUtil.timeAgo(i.reportedAt, now)}$confirmed", style = MaterialTheme.typography.bodySmall)
                        Text(i.summary, maxLines = 3, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        } else {
            items(sources, key = { it.id }) { s -> SourceCard(s, now) }
        }
    }
}

@Composable
private fun TabButton(text: String, selected: Boolean, modifier: Modifier, onClick: () -> Unit) {
    if (selected) Button(onClick = onClick, modifier = modifier) { Text(text) }
    else OutlinedButton(onClick = onClick, modifier = modifier) { Text(text) }
}

@Composable
fun SourceCard(s: SourceItem, now: Long) {
    val context = LocalContext.current
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                LabelChip("External source", Color(0xFF5B6B73))
                if (s.isOfficial) TrustChip(TrustLabel.OFFICIAL_SOURCE)
                if (s.isDemo) LabelChip("Demo data", Color(0xFF5B6B73))
            }
            Text(s.title, style = MaterialTheme.typography.titleMedium)
            val platform = Platform.fromKey(s.platform)?.label ?: s.platform
            Text(placeLine(s.locality, s.district, s.province) + " · " + platform + (s.sourceName?.let { " · $it" } ?: ""), style = MaterialTheme.typography.bodySmall)
            Text(s.summary)
            Text("Added ${TimeUtil.timeAgo(s.addedAt, now)}", style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = { openLink(context, s.url) }) { Text("Open the original source") }
        }
    }
}
