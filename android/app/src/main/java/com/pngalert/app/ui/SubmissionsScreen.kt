package com.pngalert.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pngalert.app.core.Category
import com.pngalert.app.core.Platform
import com.pngalert.app.core.TimeUtil
import com.pngalert.app.data.SyncState

private fun statusText(syncState: String): String =
    if (syncState == SyncState.SAVED_ON_PHONE) "Saved on this phone. Not sent yet." else syncState

@Composable
fun SubmissionsScreen(
    vm: MainViewModel,
    onBack: () -> Unit,
    onEditReport: (String) -> Unit,
    onEditSource: (String) -> Unit,
) {
    val reports by vm.myReports.collectAsStateWithLifecycle()
    val sources by vm.mySources.collectAsStateWithLifecycle()
    var pendingDelete by remember { mutableStateOf<Pair<String, String>?>(null) }

    ScreenScaffold("My saved items", onBack) {
        NoticeCard("Nothing here has been sent or published. Items wait on your phone until a later version can send them for moderator review.")
        Text("Reports (${reports.size})", style = MaterialTheme.typography.titleMedium)
        if (reports.isEmpty()) Text("No saved reports yet.", style = MaterialTheme.typography.bodySmall)
        reports.forEach { r ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(r.title, style = MaterialTheme.typography.titleSmall)
                    Text((Category.fromKey(r.category)?.label ?: r.category) + " · " + placeLine(r.locality, r.district, r.province), style = MaterialTheme.typography.bodySmall)
                    Text("Saved ${TimeUtil.formatPng(r.updatedAt)}", style = MaterialTheme.typography.bodySmall)
                    Text(statusText(r.syncState), style = MaterialTheme.typography.bodySmall)
                    if (r.riskFlags.isNotEmpty()) Text("Moderators will look closely at this one: ${r.riskFlags.replace(",", ", ")}.", style = MaterialTheme.typography.bodySmall)
                    Row {
                        TextButton(onClick = { onEditReport(r.id) }) { Text("Edit") }
                        TextButton(onClick = { pendingDelete = "report" to r.id }) { Text("Delete") }
                    }
                }
            }
        }
        Text("Links (${sources.size})", style = MaterialTheme.typography.titleMedium)
        if (sources.isEmpty()) Text("No saved links yet.", style = MaterialTheme.typography.bodySmall)
        sources.forEach { s ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text(s.url, style = MaterialTheme.typography.titleSmall)
                    Text((Platform.fromKey(s.platform)?.label ?: s.platform) + " · " + placeLine(s.locality, s.district, s.province), style = MaterialTheme.typography.bodySmall)
                    Text(s.context, style = MaterialTheme.typography.bodySmall)
                    Text(statusText(s.syncState), style = MaterialTheme.typography.bodySmall)
                    Row {
                        TextButton(onClick = { onEditSource(s.id) }) { Text("Edit") }
                        TextButton(onClick = { pendingDelete = "source" to s.id }) { Text("Delete") }
                    }
                }
            }
        }
    }

    pendingDelete?.let { (kind, id) ->
        AlertDialog(
            onDismissRequest = { pendingDelete = null },
            title = { Text("Delete this item?") },
            text = { Text("It will be removed from this phone. This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    if (kind == "report") vm.deleteReport(id) else vm.deleteSource(id)
                    pendingDelete = null
                }) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { pendingDelete = null }) { Text("Cancel") } },
        )
    }
}
