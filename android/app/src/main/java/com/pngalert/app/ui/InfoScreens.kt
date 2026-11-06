package com.pngalert.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.pngalert.app.BuildConfig

object InfoContent {
    val pages: Map<String, Pair<String, List<String>>> = linkedMapOf(
        "rules" to ("Community rules" to listOf(
            "Report facts you saw or have good reason to rely on: what, where and when. Keep it short.",
            "Do not post phone numbers, email addresses, home locations, names of private people, patient information, graphic images, or accusations against named people.",
            "Reports about crime, tribal conflict or political violence are not published on PNG Alert. If someone is in danger, contact the relevant authorities instead.",
            "Moderators may edit the public wording for clarity, reject items, merge duplicates and mark items resolved or expired. Original submissions are kept and every moderator action is logged.",
            "Confirming or disputing a report records your view once per account. Counts do not prove that a report is true.",
        )),
        "privacy" to ("Privacy notice" to listOf(
            "In this version PNG Alert collects no personal data. Everything you save stays on your phone.",
            "The app asks for no permissions, including internet, so it cannot send anything anywhere.",
            "Reports and links you save are not reviewed or published. They wait on your phone until a later version can send them to moderators.",
            "You can delete everything in Settings. Uninstalling the app also removes it.",
            "When sync is added, this notice will be updated before anything is sent, including how to ask for a correction or removal.",
            "This notice is a plain-language summary for the pilot and has not had legal review.",
        )),
        "terms" to ("Terms and safety disclaimer" to listOf(
            "PNG Alert is a community information service. It is not an emergency authority and does not issue evacuation orders, official warnings or emergency instructions.",
            "Information may be incomplete, out of date or wrong. Labels show how an item was sourced and checked; they are not a guarantee. Check with the responsible authority before relying on any item.",
            "'Official source' means the item links to the authority's own publication. 'Officially confirmed' means the authority explicitly confirmed it.",
            "Linked sources belong to their publishers. PNG Alert shows short summaries with a link to the original and does not imply any endorsement or partnership.",
            "These terms are a pilot summary and have not had legal review.",
        )),
    )
}

@Composable
fun InfoScreen(slug: String, onBack: () -> Unit, onOpen: (String) -> Unit) {
    val page = InfoContent.pages[slug] ?: InfoContent.pages.getValue("rules")
    ScreenScaffold(page.first, onBack) {
        page.second.forEach { Text(it) }
        DisclaimerCard()
        InfoContent.pages.forEach { (key, value) ->
            if (key != slug) TextButton(onClick = { onOpen(key) }) { Text(value.first) }
        }
    }
}

@Composable
fun SettingsScreen(vm: MainViewModel, onBack: () -> Unit) {
    var confirmDeleteAll by remember { mutableStateOf(false) }
    ScreenScaffold("Settings", onBack) {
        Text("PNG Alert ${BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.titleMedium)
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("Sync", style = MaterialTheme.typography.titleSmall)
                Text("Not connected. Sending reports and receiving the shared community feed is not built yet. This version works fully on the phone.", style = MaterialTheme.typography.bodySmall)
            }
        }
        if (BuildConfig.DEBUG) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Test data (debug build only)", style = MaterialTheme.typography.titleSmall)
                    Text("Adds clearly labelled sample items so you can see every label and layout. They are not real reports.", style = MaterialTheme.typography.bodySmall)
                    Button(onClick = { vm.loadDemoData() }, modifier = Modifier.fillMaxWidth()) { Text("Load demo data") }
                    OutlinedButton(onClick = { vm.removeDemoData() }, modifier = Modifier.fillMaxWidth()) { Text("Remove demo data") }
                }
            }
        }
        Button(
            onClick = { confirmDeleteAll = true },
            colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error),
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Delete everything on this phone") }
    }
    if (confirmDeleteAll) {
        AlertDialog(
            onDismissRequest = { confirmDeleteAll = false },
            title = { Text("Delete everything?") },
            text = { Text("This removes your saved reports and links and any sample data from this phone. It cannot be undone.") },
            confirmButton = { TextButton(onClick = { vm.deleteAllLocalData(); confirmDeleteAll = false }) { Text("Delete") } },
            dismissButton = { TextButton(onClick = { confirmDeleteAll = false }) { Text("Cancel") } },
        )
    }
}
