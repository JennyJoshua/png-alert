package com.pngalert.app.core

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SafetyAndUrlTest {
    @Test fun flagsViolenceConflictAndAccusationButNotRoadReports() {
        assertTrue("conflict" in Safety.riskFlags("Tribal fight closed the road"))
        assertTrue("violence" in Safety.riskFlags("A man was stabbed near the market"))
        assertTrue("accusation" in Safety.riskFlags("Thieves are at the bus stop"))
        assertEquals(emptyList<String>(), Safety.riskFlags("Landslide blocks Highlands Highway", "Vehicles are turning back"))
    }

    @Test fun detectsPhoneNumbersAndEmails() {
        assertTrue(Safety.containsContactInfo("call 7123 4567 now"))
        assertTrue(Safety.containsContactInfo("write to a@b.com"))
        assertFalse(Safety.containsContactInfo("Bridge at km 12 is closed"))
    }

    @Test fun canonicalizesTrackingHashWwwAndTrailingSlash() {
        assertEquals("https://example.com/a/b?id=2", UrlUtil.canonicalize("https://WWW.Example.com/a/b/?utm_source=x&id=2&fbclid=z#top"))
        assertEquals("https://example.com/", UrlUtil.canonicalize("https://example.com"))
    }

    @Test fun rejectsNonHttpSchemesCredentialsAndGarbage() {
        assertNull(UrlUtil.canonicalize("javascript:alert(1)"))
        assertNull(UrlUtil.canonicalize("https://user:pw@example.com"))
        assertNull(UrlUtil.canonicalize("not a url"))
        assertNotNull(UrlUtil.parseHttpUrl("http://example.com/x"))
    }
}
