package com.pngalert.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.pngalert.app.core.Authority
import com.pngalert.app.core.Category
import com.pngalert.app.core.Freshness
import com.pngalert.app.core.TimeUtil
import com.pngalert.app.core.TrustLabel
import com.pngalert.app.data.toState

@Composable
fun DetailScreen(vm: MainViewModel, id: String, onBack: () -> Unit) {
    val flow = remember(id) { vm.observeItem(id) }
    val item by flow.collectAsStateWithLifecycle(initialValue = null)
    val context = LocalContext.current

    ScreenScaffold("Report", onBack) {
        val i = item
        if (i == null) {
            Text("This item is not available on this phone.")
        } else {
            val now = System.currentTimeMillis()
            val state = i.toState()
            val trust = Freshness.trustLabel(state, now)
            val current = Freshness.isCurrent(state, now)
            val place = placeLine(i.locality, i.district, i.province)

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                TrustChip(trust)
                if (i.isDemo) LabelChip("Demo data", Color(0xFF5B6B73))
            }
            Text(i.title, style = MaterialTheme.typography.headlineSmall)
            Text(place + " · " + state.category.label, style = MaterialTheme.typography.bodySmall)
            if (!current) {
                Text(
                    if (trust == TrustLabel.STALE) "Not reconfirmed recently. This may no longer be the case."
                    else "Shown for history. This is not presented as a current disruption.",
                    color = Color(0xFF8A5A00),
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            Text(i.summary)
            Text(trust.help, style = MaterialTheme.typography.bodySmall)

            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text("Reported ${TimeUtil.timeAgo(i.reportedAt, now)} (${TimeUtil.formatPng(i.reportedAt)})", style = MaterialTheme.typography.bodySmall)
                i.occurredAt?.let { Text("Event time given by reporter: ${TimeUtil.formatPng(it)}", style = MaterialTheme.typography.bodySmall) }
                Text(
                    i.lastConfirmedAt?.let { "Last confirmed ${TimeUtil.timeAgo(it, now)} (${TimeUtil.formatPng(it)})" }
                        ?: "Not yet confirmed by another member",
                    style = MaterialTheme.typography.bodySmall,
                )
                i.validUntil?.let { Text("Valid until ${TimeUtil.formatPng(it)}", style = MaterialTheme.typography.bodySmall) }
                if (state.authority != Authority.NONE && i.authorityName != null) {
                    val verb = if (state.authority == Authority.OFFICIALLY_CONFIRMED) "Confirmed by" else "Published by"
                    Text("$verb ${i.authorityName}", style = MaterialTheme.typography.bodySmall)
                }
            }

            i.sourceUrl?.let { url -> TextButton(onClick = { openLink(context, url) }) { Text("Open the source link") } }

            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("Still the case?", style = MaterialTheme.typography.titleMedium)
                    Text("${i.confirmCount} confirmed · ${i.disputeCount} disputed. Counts show how many members responded; they do not prove the report is true.", style = MaterialTheme.typography.bodySmall)
                    Text("Confirming or disputing needs an account and a connection. That arrives with a later version.", style = MaterialTheme.typography.bodySmall)
                }
            }

            OutlinedButton(
                onClick = { shareText(context, "${i.title} (${place}). Reported ${TimeUtil.formatPng(i.reportedAt)}. Shared from PNG Alert.") },
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Share") }
            DisclaimerCard()
        }
    }
}
