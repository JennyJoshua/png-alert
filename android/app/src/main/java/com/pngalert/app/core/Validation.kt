package com.pngalert.app.core

const val NO_CONTACT_MESSAGE = "Remove phone numbers and email addresses. PNG Alert never publishes contact details."

data class ReportInput(
    val category: Category?,
    val title: String,
    val description: String,
    val province: String,
    val district: String,
    val locality: String,
    val occurredAtText: String,
    val sourceUrl: String,
)

data class ReportCheck(val errors: Map<String, String>, val occurredAt: Long?, val riskFlags: List<String>) {
    val ok get() = errors.isEmpty()
}

data class SourceInput(
    val platform: Platform?,
    val url: String,
    val context: String,
    val province: String,
    val district: String,
    val locality: String,
    val publishedAtText: String,
)

data class SourceCheck(val errors: Map<String, String>, val canonicalUrl: String?, val publishedAt: Long?, val riskFlags: List<String>) {
    val ok get() = errors.isEmpty()
}

/** Same limits and rules as the web app. */
object Validation {
    private fun MutableMap<String, String>.length(field: String, label: String, value: String, min: Int, max: Int) {
        val n = value.trim().length
        if (n < min) put(field, "$label: use at least $min characters.")
        else if (n > max) put(field, "$label: use at most $max characters.")
    }

    private fun MutableMap<String, String>.optionalLength(field: String, label: String, value: String, min: Int, max: Int) {
        if (value.isNotBlank()) length(field, label, value, min, max)
    }

    fun checkReport(i: ReportInput): ReportCheck {
        val e = linkedMapOf<String, String>()
        if (i.category == null) e["category"] = "Category: choose a category."
        e.length("title", "Title", i.title, 5, 120)
        e.length("description", "Description", i.description, 10, 2000)
        if (i.province !in PROVINCES) e["province"] = "Province: choose a province."
        e.optionalLength("district", "District", i.district, 2, 80)
        e.length("locality", "Locality", i.locality, 2, 120)
        for ((field, text) in listOf("title" to i.title, "description" to i.description, "locality" to i.locality)) {
            if (field !in e && Safety.containsContactInfo(text)) e[field] = NO_CONTACT_MESSAGE
        }
        var occurred: Long? = null
        if (i.occurredAtText.isNotBlank()) {
            occurred = TimeUtil.parsePng(i.occurredAtText)
            if (occurred == null) e["occurredAt"] = "Start time: use ${TimeUtil.INPUT_HINT}."
        }
        if (i.sourceUrl.isNotBlank() && (i.sourceUrl.trim().length > 500 || UrlUtil.parseHttpUrl(i.sourceUrl) == null)) {
            e["sourceUrl"] = "Link: enter a full link starting with http:// or https://"
        }
        return ReportCheck(e, occurred, Safety.riskFlags(i.title, i.description))
    }

    fun checkSource(i: SourceInput): SourceCheck {
        val e = linkedMapOf<String, String>()
        if (i.platform == null) e["platform"] = "Source type: choose the source type."
        val canonical = if (i.url.trim().length <= 500) UrlUtil.canonicalize(i.url) else null
        if (canonical == null) e["url"] = "Link: enter a full link starting with http:// or https://"
        e.length("context", "Why it is useful", i.context, 5, 500)
        if (i.province !in PROVINCES) e["province"] = "Province: choose a province."
        e.optionalLength("district", "District", i.district, 2, 80)
        e.length("locality", "Locality", i.locality, 2, 120)
        for ((field, text) in listOf("context" to i.context, "locality" to i.locality)) {
            if (field !in e && Safety.containsContactInfo(text)) e[field] = NO_CONTACT_MESSAGE
        }
        var published: Long? = null
        if (i.publishedAtText.isNotBlank()) {
            published = TimeUtil.parsePng(i.publishedAtText)
            if (published == null) e["publishedAt"] = "Date published: use ${TimeUtil.INPUT_HINT}."
        }
        return SourceCheck(e, canonical, published, Safety.riskFlags(i.context))
    }
}
