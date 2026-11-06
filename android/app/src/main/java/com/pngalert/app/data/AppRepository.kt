package com.pngalert.app.data

import com.pngalert.app.core.ReportInput
import com.pngalert.app.core.SourceInput
import com.pngalert.app.core.Validation
import java.util.UUID
import kotlinx.coroutines.flow.Flow

/**
 * Single access point to everything stored on the phone. Network sync is a later phase: when it exists it will
 * read OutboxReport/OutboxSource rows in SAVED_ON_PHONE state and fill FeedItem/SourceItem from a shared server.
 */
class AppRepository(
    db: AppDatabase,
    private val clock: () -> Long = { System.currentTimeMillis() },
    private val newId: () -> String = { UUID.randomUUID().toString() },
) {
    private val feedDao = db.feedDao()
    private val outbox = db.outboxDao()

    val feedItems: Flow<List<FeedItem>> = feedDao.observeItems()
    val sourceItems: Flow<List<SourceItem>> = feedDao.observeSources()
    val myReports: Flow<List<OutboxReport>> = outbox.observeReports()
    val mySources: Flow<List<OutboxSource>> = outbox.observeSources()

    fun observeItem(id: String): Flow<FeedItem?> = feedDao.observe(id)
    suspend fun getReport(id: String): OutboxReport? = outbox.getReport(id)
    suspend fun getSource(id: String): OutboxSource? = outbox.getSource(id)

    data class SaveResult(val id: String?, val errors: Map<String, String>)

    suspend fun saveReport(input: ReportInput, existingId: String? = null): SaveResult {
        val check = Validation.checkReport(input)
        if (!check.ok) return SaveResult(null, check.errors)
        val now = clock()
        val existing = existingId?.let { outbox.getReport(it) }
        val entity = OutboxReport(
            id = existing?.id ?: newId(),
            category = input.category!!.key,
            title = input.title.trim(),
            description = input.description.trim(),
            province = input.province,
            district = input.district.trim().ifEmpty { null },
            locality = input.locality.trim(),
            occurredAt = check.occurredAt,
            sourceUrl = input.sourceUrl.trim().ifEmpty { null },
            riskFlags = check.riskFlags.joinToString(","),
            createdAt = existing?.createdAt ?: now,
            updatedAt = now,
            syncState = SyncState.SAVED_ON_PHONE,
        )
        outbox.upsertReport(entity)
        return SaveResult(entity.id, emptyMap())
    }

    suspend fun saveSource(input: SourceInput, existingId: String? = null): SaveResult {
        val check = Validation.checkSource(input)
        if (!check.ok) return SaveResult(null, check.errors)
        val canonical = check.canonicalUrl!!
        val duplicate = outbox.findSourceByCanonical(canonical)
        if (duplicate != null && duplicate.id != existingId) {
            return SaveResult(null, mapOf("url" to "That link is already saved on this phone."))
        }
        val now = clock()
        val existing = existingId?.let { outbox.getSource(it) }
        val entity = OutboxSource(
            id = existing?.id ?: newId(),
            platform = input.platform!!.key,
            url = input.url.trim(),
            canonicalUrl = canonical,
            context = input.context.trim(),
            province = input.province,
            district = input.district.trim().ifEmpty { null },
            locality = input.locality.trim(),
            publishedAt = check.publishedAt,
            riskFlags = check.riskFlags.joinToString(","),
            createdAt = existing?.createdAt ?: now,
            updatedAt = now,
            syncState = SyncState.SAVED_ON_PHONE,
        )
        outbox.upsertSource(entity)
        return SaveResult(entity.id, emptyMap())
    }

    suspend fun deleteReport(id: String) = outbox.deleteReport(id)
    suspend fun deleteSource(id: String) = outbox.deleteSource(id)

    suspend fun loadDemoData() {
        val now = clock()
        feedDao.insertItems(DemoData.items(now))
        feedDao.insertSources(DemoData.sources(now))
    }

    suspend fun removeDemoData() {
        feedDao.deleteDemoItems()
        feedDao.deleteDemoSources()
    }

    /** Removes everything stored by the app: cached feed, demo rows and the person's own saved reports and links. */
    suspend fun deleteAllLocalData() {
        feedDao.deleteAllItems()
        feedDao.deleteAllSources()
        outbox.deleteAllReports()
        outbox.deleteAllSources()
    }
}
