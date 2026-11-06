package com.pngalert.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FreshnessTest {
    private val now = 1_800_000_000_000L
    private val hour = 3_600_000L

    private fun road(reportedHoursAgo: Long, confirmedHoursAgo: Long? = null, extra: (ItemState) -> ItemState = { it }) =
        extra(ItemState(Category.ROADS_TRANSPORT, now - reportedHoursAgo * hour, confirmedHoursAgo?.let { now - it * hour }))

    @Test fun recentRoadReportIsCurrentCommunityReport() {
        val s = road(2)
        assertTrue(Freshness.isCurrent(s, now))
        assertEquals(TrustLabel.COMMUNITY_REPORT, Freshness.trustLabel(s, now))
    }

    @Test fun roadReportGoesStaleAfterTwelveHours() {
        val s = road(13)
        assertTrue(Freshness.isStale(s, now))
        assertFalse(Freshness.isCurrent(s, now))
        assertEquals(TrustLabel.STALE, Freshness.trustLabel(s, now))
    }

    @Test fun confirmationRevivesButReportedAtIsUnchanged() {
        val s = road(13, confirmedHoursAgo = 1)
        assertFalse(Freshness.isStale(s, now))
        assertTrue(Freshness.isCurrent(s, now))
        assertEquals(now - 13 * hour, s.reportedAt)
    }

    @Test fun publicServiceWindowIsTwentyFourHours() {
        val base = ItemState(Category.PUBLIC_SERVICES, now - 23 * hour)
        assertFalse(Freshness.isStale(base, now))
        assertTrue(Freshness.isStale(base.copy(reportedAt = now - 25 * hour), now))
    }

    @Test fun noticesAreArchiveUnlessTheyHaveAValidityPeriod() {
        val notice = ItemState(Category.OFFICIAL_NOTICES, now - hour)
        assertFalse(Freshness.isCurrent(notice, now))
        assertFalse(Freshness.isStale(notice, now))
        assertTrue(Freshness.isCurrent(notice.copy(validUntil = now + hour), now))
        assertTrue(Freshness.isStale(notice.copy(validUntil = now - 1), now))
    }

    @Test fun resolvedAndExpiredAreNeverCurrent() {
        assertEquals(TrustLabel.RESOLVED, Freshness.trustLabel(road(1) { it.copy(lifecycle = Lifecycle.RESOLVED) }, now))
        assertFalse(Freshness.isCurrent(road(1) { it.copy(lifecycle = Lifecycle.RESOLVED) }, now))
        assertEquals(TrustLabel.STALE, Freshness.trustLabel(road(1) { it.copy(lifecycle = Lifecycle.EXPIRED) }, now))
    }

    @Test fun officialSourceAndOfficiallyConfirmedStayDistinct() {
        assertEquals(TrustLabel.OFFICIAL_SOURCE, Freshness.trustLabel(road(1) { it.copy(authority = Authority.OFFICIAL_SOURCE) }, now))
        assertEquals(TrustLabel.OFFICIALLY_CONFIRMED, Freshness.trustLabel(road(1) { it.copy(authority = Authority.OFFICIALLY_CONFIRMED) }, now))
        assertEquals(TrustLabel.CORROBORATED, Freshness.trustLabel(road(1) { it.copy(corroborated = true) }, now))
    }
}
