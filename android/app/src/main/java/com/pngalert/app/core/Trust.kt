package com.pngalert.app.core

enum class Lifecycle { ACTIVE, RESOLVED, EXPIRED }
enum class Authority { NONE, OFFICIAL_SOURCE, OFFICIALLY_CONFIRMED }

/** "Official source" = linked to the authority's own publication. "Officially confirmed" = the authority explicitly confirmed it. */
enum class TrustLabel(val label: String, val help: String) {
    COMMUNITY_REPORT("Community report", "Submitted by a community member and checked by a moderator. Not independently confirmed."),
    CORROBORATED("Corroborated", "A moderator found support from independent reports or credible separate sources. Confirmation taps alone do not count."),
    OFFICIAL_SOURCE("Official source", "Links to the responsible authority's own notice or page. This is not the same as official confirmation."),
    OFFICIALLY_CONFIRMED("Officially confirmed", "The responsible authority has explicitly confirmed this."),
    RESOLVED("Resolved", "A moderator found reliable evidence the disruption has ended."),
    STALE("Stale", "Not reconfirmed within its freshness window. Shown for history, not as current."),
}

/** The facts the freshness and label rules depend on. Times are epoch milliseconds. */
data class ItemState(
    val category: Category,
    val reportedAt: Long,
    val lastConfirmedAt: Long? = null,
    val validUntil: Long? = null,
    val lifecycle: Lifecycle = Lifecycle.ACTIVE,
    val authority: Authority = Authority.NONE,
    val corroborated: Boolean = false,
)

/** Same rules as the web app's public_incidents view. reportedAt never changes; only lastConfirmedAt moves on confirmation. */
object Freshness {
    private const val HOUR_MS = 3_600_000L

    fun isStale(s: ItemState, now: Long): Boolean {
        if (s.lifecycle != Lifecycle.ACTIVE) return false
        val until = s.validUntil
        if (until != null) return until < now
        val hours = s.category.freshnessHours ?: return false
        val last = maxOf(s.reportedAt, s.lastConfirmedAt ?: s.reportedAt)
        return now > last + hours * HOUR_MS
    }

    fun isCurrent(s: ItemState, now: Long): Boolean {
        if (s.lifecycle != Lifecycle.ACTIVE || isStale(s, now)) return false
        val until = s.validUntil
        return s.category.freshnessHours != null || (until != null && until > now)
    }

    fun trustLabel(s: ItemState, now: Long): TrustLabel = when {
        s.lifecycle == Lifecycle.RESOLVED -> TrustLabel.RESOLVED
        s.lifecycle == Lifecycle.EXPIRED || isStale(s, now) -> TrustLabel.STALE
        s.authority == Authority.OFFICIALLY_CONFIRMED -> TrustLabel.OFFICIALLY_CONFIRMED
        s.authority == Authority.OFFICIAL_SOURCE -> TrustLabel.OFFICIAL_SOURCE
        s.corroborated -> TrustLabel.CORROBORATED
        else -> TrustLabel.COMMUNITY_REPORT
    }
}
