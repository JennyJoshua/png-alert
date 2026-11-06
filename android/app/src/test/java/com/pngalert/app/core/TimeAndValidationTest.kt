package com.pngalert.app.core

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TimeAndValidationTest {
    private val goodReport = ReportInput(
        Category.ROADS_TRANSPORT, "Landslide on highway", "Road is blocked near the turn-off.",
        "Western Highlands", "", "Kagamuga", "", "",
    )

    @Test fun pngTimeIsUtcPlusTen() {
        assertEquals(Instant.parse("2026-11-03T22:00:00Z").toEpochMilli(), TimeUtil.parsePng("2026-11-04 08:00"))
        assertNull(TimeUtil.parsePng("garbage"))
        assertNull(TimeUtil.parsePng("2026-13-45 99:99"))
    }

    @Test fun editFieldFormatRoundTrips() {
        val t = Instant.parse("2026-11-03T22:05:00Z").toEpochMilli()
        assertEquals("2026-11-04 08:05", TimeUtil.formatPngInput(t))
        assertEquals(t, TimeUtil.parsePng(TimeUtil.formatPngInput(t)))
    }

    @Test fun formatsInPngTime() {
        assertEquals("4 Nov 2026, 8:00 AM", TimeUtil.formatPng(Instant.parse("2026-11-03T22:00:00Z").toEpochMilli()))
    }

    @Test fun describesAge() {
        val now = 10_000_000_000L
        assertEquals("30 min ago", TimeUtil.timeAgo(now - 30 * 60_000L, now))
        assertEquals("6 h ago", TimeUtil.timeAgo(now - 6 * 3_600_000L, now))
        assertEquals("just now", TimeUtil.timeAgo(now, now))
    }

    @Test fun acceptsAValidReportAndTreatsBlankOptionalsAsAbsent() {
        val c = Validation.checkReport(goodReport)
        assertTrue(c.errors.toString(), c.ok)
        assertNull(c.occurredAt)
    }

    @Test fun rejectsContactDetailsBadProvinceShortTitleAndBadLink() {
        assertEquals(NO_CONTACT_MESSAGE, Validation.checkReport(goodReport.copy(description = "Call me on 71234567 about it")).errors["description"])
        assertTrue("province" in Validation.checkReport(goodReport.copy(province = "Atlantis")).errors)
        assertTrue("title" in Validation.checkReport(goodReport.copy(title = "Hi")).errors)
        assertTrue("sourceUrl" in Validation.checkReport(goodReport.copy(sourceUrl = "ftp://x")).errors)
        assertTrue("category" in Validation.checkReport(goodReport.copy(category = null)).errors)
        assertTrue("occurredAt" in Validation.checkReport(goodReport.copy(occurredAtText = "yesterday")).errors)
    }

    @Test fun flagsRiskWordingForModeratorsWithoutRejecting() {
        val c = Validation.checkReport(goodReport.copy(title = "Road closed after tribal fight"))
        assertTrue(c.ok)
        assertEquals(listOf("conflict"), c.riskFlags)
    }

    @Test fun sourceNeedsARealLinkAndCanonicalisesIt() {
        val base = SourceInput(Platform.FACEBOOK, "https://facebook.com/x/posts/1?utm_source=a", "Page post about road works", "Western Highlands", "", "Hagen", "")
        val ok = Validation.checkSource(base)
        assertTrue(ok.errors.toString(), ok.ok)
        assertEquals("https://facebook.com/x/posts/1", ok.canonicalUrl)
        assertFalse(Validation.checkSource(base.copy(url = "javascript:alert(1)")).ok)
        assertFalse(Validation.checkSource(base.copy(platform = null)).ok)
    }
}
