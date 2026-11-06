package com.pngalert.app.data

import com.pngalert.app.core.Authority
import com.pngalert.app.core.Lifecycle

/**
 * Clearly labelled sample rows so the feed layout and every trust label can be tried on a test phone.
 * They are never real reports. Only the debug build offers a way to load them.
 */
object DemoData {
    const val PREFIX = "[DEMO] "
    private const val HOUR = 3_600_000L
    private const val NOTE = "Sample data for testing the app. Not a real report."

    private fun item(
        n: Int, now: Long, category: String, title: String, reportedHoursAgo: Long, confirmedHoursAgo: Long? = null,
        validForHours: Long? = null, corroborated: Boolean = false, authority: Authority = Authority.NONE,
        authorityName: String? = null, lifecycle: Lifecycle = Lifecycle.ACTIVE, confirms: Int = 0, disputes: Int = 0,
    ) = FeedItem(
        id = "demo-$n", category = category, title = PREFIX + title, summary = NOTE,
        province = "Western Highlands", district = "Demo district", locality = "Demo locality $n",
        occurredAt = null, sourceUrl = null, reportedAt = now - reportedHoursAgo * HOUR,
        lastConfirmedAt = confirmedHoursAgo?.let { now - it * HOUR }, validUntil = validForHours?.let { now + it * HOUR },
        corroborated = corroborated, authority = authority.name, authorityName = authorityName,
        lifecycle = lifecycle.name, confirmCount = confirms, disputeCount = disputes, isDemo = true,
    )

    fun items(now: Long): List<FeedItem> = listOf(
        item(1, now, "roads_transport", "Road partly blocked (recent, confirmed)", 2, 1, confirms = 3),
        item(2, now, "utilities", "Power outage (corroborated)", 5, corroborated = true, confirms = 1, disputes = 1),
        item(3, now, "public_services", "Clinic closed (not reconfirmed, stale)", 30),
        item(4, now, "official_notices", "Market notice (official source, valid 2 days)", 3, validForHours = 48,
            authority = Authority.OFFICIAL_SOURCE, authorityName = "Demo Agency"),
        item(5, now, "roads_transport", "Bridge repair finished (resolved)", 20, lifecycle = Lifecycle.RESOLVED),
        item(6, now, "roads_transport", "Highway closure (officially confirmed)", 1,
            authority = Authority.OFFICIALLY_CONFIRMED, authorityName = "Demo Authority"),
    )

    fun sources(now: Long): List<SourceItem> = listOf(
        SourceItem("demo-s1", "facebook", "https://example.com/demo-post", null, PREFIX + "Sample page post about market hours",
            NOTE, "Western Highlands", "Demo district", "Demo locality 1", null, now - 4 * HOUR, isOfficial = false, isDemo = true),
        SourceItem("demo-s2", "official_notice", "https://example.com/demo-notice", "Demo Agency", PREFIX + "Sample official notice",
            NOTE, "Western Highlands", "Demo district", "Demo locality 2", null, now - 26 * HOUR, isOfficial = true, isDemo = true),
    )
}
