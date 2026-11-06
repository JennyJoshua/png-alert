package com.pngalert.app.data

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import com.pngalert.app.core.Category
import com.pngalert.app.core.Freshness
import com.pngalert.app.core.Platform
import com.pngalert.app.core.ReportInput
import com.pngalert.app.core.SourceInput
import com.pngalert.app.core.TrustLabel
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** Room runs on the JVM here through Robolectric, using an in-memory database. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
class RepositoryTest {
    private lateinit var db: AppDatabase
    private lateinit var repo: AppRepository
    private var now = 1_800_000_000_000L
    private var counter = 0

    @Before fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        db = Room.inMemoryDatabaseBuilder(context, AppDatabase::class.java).allowMainThreadQueries().build()
        repo = AppRepository(db, clock = { now }, newId = { "id-${counter++}" })
    }

    @After fun tearDown() {
        db.close()
    }

    private val report = ReportInput(
        Category.ROADS_TRANSPORT, "Landslide on highway", "Road is blocked near the turn-off.",
        "Western Highlands", "", "Kagamuga", "", "",
    )
    private val source = SourceInput(
        Platform.FACEBOOK, "https://facebook.com/x/posts/1", "Page post about road works", "Western Highlands", "", "Hagen", "",
    )

    @Test fun savesAValidReportOnThePhone() = runBlocking {
        val result = repo.saveReport(report)
        assertEquals("id-0", result.id)
        val saved = repo.myReports.first().single()
        assertEquals(SyncState.SAVED_ON_PHONE, saved.syncState)
        assertEquals("roads_transport", saved.category)
        assertNull(saved.district)
    }

    @Test fun invalidReportIsNotStoredAndReturnsErrors() = runBlocking {
        val result = repo.saveReport(report.copy(description = "Call me on 71234567 about it"))
        assertNull(result.id)
        assertTrue("description" in result.errors)
        assertTrue(repo.myReports.first().isEmpty())
    }

    @Test fun editingKeepsTheIdAndCreationTimeButUpdatesTheRest() = runBlocking {
        val id = repo.saveReport(report).id!!
        now += 60_000
        repo.saveReport(report.copy(title = "Landslide cleared partly"), existingId = id)
        val saved = repo.myReports.first().single()
        assertEquals(id, saved.id)
        assertEquals("Landslide cleared partly", saved.title)
        assertEquals(1_800_000_000_000L, saved.createdAt)
        assertEquals(1_800_000_060_000L, saved.updatedAt)
    }

    @Test fun riskFlagsAreRecordedForModerators() = runBlocking {
        repo.saveReport(report.copy(title = "Road closed after tribal fight"))
        assertEquals("conflict", repo.myReports.first().single().riskFlags)
    }

    @Test fun duplicateLinksAreRejectedEvenWithTrackingParameters() = runBlocking {
        assertNotNull(repo.saveSource(source).id)
        val again = repo.saveSource(source.copy(url = "https://www.facebook.com/x/posts/1/?utm_source=share"))
        assertNull(again.id)
        assertTrue("url" in again.errors)
        assertEquals(1, repo.mySources.first().size)
    }

    @Test fun editingASavedLinkIsNotTreatedAsADuplicateOfItself() = runBlocking {
        val id = repo.saveSource(source).id!!
        val edited = repo.saveSource(source.copy(context = "Updated reason for saving this link"), existingId = id)
        assertEquals(id, edited.id)
        assertEquals("Updated reason for saving this link", repo.mySources.first().single().context)
    }

    @Test fun deletingRemovesOnlyThatItem() = runBlocking {
        val a = repo.saveReport(report).id!!
        repo.saveReport(report.copy(title = "A second different report"))
        repo.deleteReport(a)
        assertEquals(listOf("A second different report"), repo.myReports.first().map { it.title })
    }

    @Test fun demoDataIsClearlyLabelledAndCoversEveryTrustLabel() = runBlocking {
        repo.loadDemoData()
        val items = repo.feedItems.first()
        assertTrue(items.isNotEmpty())
        assertTrue(items.all { it.isDemo && it.title.startsWith(DemoData.PREFIX) })
        assertTrue(repo.sourceItems.first().all { it.isDemo && it.title.startsWith(DemoData.PREFIX) })
        val labels = items.map { Freshness.trustLabel(it.toState(), now) }.toSet()
        assertEquals(TrustLabel.values().toSet(), labels)
    }

    @Test fun removingDemoDataLeavesTheUsersOwnItems() = runBlocking {
        repo.saveReport(report)
        repo.saveSource(source)
        repo.loadDemoData()
        repo.removeDemoData()
        assertTrue(repo.feedItems.first().isEmpty())
        assertTrue(repo.sourceItems.first().isEmpty())
        assertEquals(1, repo.myReports.first().size)
        assertEquals(1, repo.mySources.first().size)
    }

    @Test fun deleteAllClearsEverythingOnThePhone() = runBlocking {
        repo.saveReport(report)
        repo.saveSource(source)
        repo.loadDemoData()
        repo.deleteAllLocalData()
        assertTrue(repo.feedItems.first().isEmpty())
        assertTrue(repo.sourceItems.first().isEmpty())
        assertTrue(repo.myReports.first().isEmpty())
        assertTrue(repo.mySources.first().isEmpty())
    }
}
