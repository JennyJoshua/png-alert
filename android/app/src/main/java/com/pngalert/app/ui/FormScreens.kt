package com.pngalert.app.ui

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import com.pngalert.app.core.Category
import com.pngalert.app.core.PROVINCES
import com.pngalert.app.core.Platform
import com.pngalert.app.core.ReportInput
import com.pngalert.app.core.Safety
import com.pngalert.app.core.SourceInput
import com.pngalert.app.core.TimeUtil
import kotlinx.coroutines.launch

@Composable
fun ReportFormScreen(vm: MainViewModel, editId: String?, onBack: () -> Unit, onSaved: () -> Unit) {
    var category by rememberSaveable { mutableStateOf<String?>(null) }
    var title by rememberSaveable { mutableStateOf("") }
    var description by rememberSaveable { mutableStateOf("") }
    var province by rememberSaveable { mutableStateOf<String?>(null) }
    var district by rememberSaveable { mutableStateOf("") }
    var locality by rememberSaveable { mutableStateOf("") }
    var occurredAt by rememberSaveable { mutableStateOf("") }
    var sourceUrl by rememberSaveable { mutableStateOf("") }
    var loaded by rememberSaveable { mutableStateOf(false) }
    var errors by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(editId) {
        if (editId != null && !loaded) {
            vm.getReport(editId)?.let { r ->
                category = r.category
                title = r.title
                description = r.description
                province = r.province
                district = r.district.orEmpty()
                locality = r.locality
                occurredAt = r.occurredAt?.let { TimeUtil.formatPngInput(it) }.orEmpty()
                sourceUrl = r.sourceUrl.orEmpty()
            }
            loaded = true
        }
    }

    ScreenScaffold(if (editId == null) "Report a disruption" else "Edit saved report", onBack) {
        DisclaimerCard()
        NoticeCard("This version keeps reports on your phone only. They are not sent or published. They will go for moderator review once sync is added.")
        DropdownField(
            label = "Category",
            selected = Category.fromKey(category.orEmpty())?.label,
            options = Category.values().map { it.label },
            onSelected = { label -> category = Category.values().firstOrNull { it.label == label }?.key },
            error = errors["category"],
        )
        TextInput("Short title", title, { title = it }, error = errors["title"])
        TextInput("What is happening?", description, { description = it }, error = errors["description"], hint = "Facts only: what, where, what you saw. No names of people, no phone numbers.", multiline = true)
        DropdownField("Province", province, PROVINCES, onSelected = { province = it }, error = errors["province"])
        TextInput("District (optional)", district, { district = it }, error = errors["district"])
        TextInput("Locality", locality, { locality = it }, error = errors["locality"], hint = "Town, road or area. Do not give a home address.")
        TextInput("When did it start? (optional)", occurredAt, { occurredAt = it }, error = errors["occurredAt"], hint = TimeUtil.INPUT_HINT)
        TextInput("Link to supporting source (optional)", sourceUrl, { sourceUrl = it }, error = errors["sourceUrl"], hint = "https://")
        if (Safety.riskFlags(title, description).isNotEmpty()) {
            NoticeCard("This mentions a sensitive topic (violence, conflict or accusations). Reports about crime, tribal conflict or political violence are not published. Describe only the road, service or utility situation.")
        }
        Button(
            onClick = {
                scope.launch {
                    val result = vm.saveReport(
                        ReportInput(Category.fromKey(category.orEmpty()), title, description, province.orEmpty(), district, locality, occurredAt, sourceUrl),
                        editId,
                    )
                    if (result.id != null) onSaved() else errors = result.errors
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Save on this phone") }
    }
}

@Composable
fun SourceFormScreen(vm: MainViewModel, editId: String?, onBack: () -> Unit, onSaved: () -> Unit) {
    var platform by rememberSaveable { mutableStateOf<String?>(null) }
    var url by rememberSaveable { mutableStateOf("") }
    var context by rememberSaveable { mutableStateOf("") }
    var province by rememberSaveable { mutableStateOf<String?>(null) }
    var district by rememberSaveable { mutableStateOf("") }
    var locality by rememberSaveable { mutableStateOf("") }
    var publishedAt by rememberSaveable { mutableStateOf("") }
    var loaded by rememberSaveable { mutableStateOf(false) }
    var errors by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(editId) {
        if (editId != null && !loaded) {
            vm.getSource(editId)?.let { s ->
                platform = s.platform
                url = s.url
                context = s.context
                province = s.province
                district = s.district.orEmpty()
                locality = s.locality
                publishedAt = s.publishedAt?.let { TimeUtil.formatPngInput(it) }.orEmpty()
            }
            loaded = true
        }
    }

    ScreenScaffold(if (editId == null) "Share a link" else "Edit saved link", onBack) {
        NoticeCard("Save a public Facebook post or Page, news article or official notice. PNG Alert does not copy articles or images and never reads private groups. This version keeps the link on your phone only.")
        DropdownField(
            label = "What kind of source is it?",
            selected = Platform.fromKey(platform.orEmpty())?.label,
            options = Platform.values().map { it.label },
            onSelected = { label -> platform = Platform.values().firstOrNull { it.label == label }?.key },
            error = errors["platform"],
        )
        TextInput("Link", url, { url = it }, error = errors["url"], hint = "https://")
        TextInput("Why is it useful?", context, { context = it }, error = errors["context"], hint = "One or two sentences in your own words.", multiline = true)
        DropdownField("Province", province, PROVINCES, onSelected = { province = it }, error = errors["province"])
        TextInput("District (optional)", district, { district = it }, error = errors["district"])
        TextInput("Locality", locality, { locality = it }, error = errors["locality"])
        TextInput("Date the source was published (optional)", publishedAt, { publishedAt = it }, error = errors["publishedAt"], hint = TimeUtil.INPUT_HINT)
        Button(
            onClick = {
                scope.launch {
                    val result = vm.saveSource(
                        SourceInput(Platform.fromKey(platform.orEmpty()), url, context, province.orEmpty(), district, locality, publishedAt),
                        editId,
                    )
                    if (result.id != null) onSaved() else errors = result.errors
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Save on this phone") }
    }
}
