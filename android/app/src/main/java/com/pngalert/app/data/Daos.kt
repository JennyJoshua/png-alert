package com.pngalert.app.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface FeedDao {
    @Query("SELECT * FROM feed_items ORDER BY reportedAt DESC")
    fun observeItems(): Flow<List<FeedItem>>

    @Query("SELECT * FROM feed_items WHERE id = :id")
    fun observe(id: String): Flow<FeedItem?>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertItems(items: List<FeedItem>)

    @Query("DELETE FROM feed_items WHERE isDemo = 1")
    suspend fun deleteDemoItems()

    @Query("DELETE FROM feed_items")
    suspend fun deleteAllItems()

    @Query("SELECT * FROM source_items ORDER BY addedAt DESC")
    fun observeSources(): Flow<List<SourceItem>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSources(items: List<SourceItem>)

    @Query("DELETE FROM source_items WHERE isDemo = 1")
    suspend fun deleteDemoSources()

    @Query("DELETE FROM source_items")
    suspend fun deleteAllSources()
}

@Dao
interface OutboxDao {
    @Query("SELECT * FROM outbox_reports ORDER BY updatedAt DESC")
    fun observeReports(): Flow<List<OutboxReport>>

    @Query("SELECT * FROM outbox_reports WHERE id = :id")
    suspend fun getReport(id: String): OutboxReport?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertReport(report: OutboxReport)

    @Query("DELETE FROM outbox_reports WHERE id = :id")
    suspend fun deleteReport(id: String)

    @Query("DELETE FROM outbox_reports")
    suspend fun deleteAllReports()

    @Query("SELECT * FROM outbox_sources ORDER BY updatedAt DESC")
    fun observeSources(): Flow<List<OutboxSource>>

    @Query("SELECT * FROM outbox_sources WHERE id = :id")
    suspend fun getSource(id: String): OutboxSource?

    @Query("SELECT * FROM outbox_sources WHERE canonicalUrl = :canonical LIMIT 1")
    suspend fun findSourceByCanonical(canonical: String): OutboxSource?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSource(source: OutboxSource)

    @Query("DELETE FROM outbox_sources WHERE id = :id")
    suspend fun deleteSource(id: String)

    @Query("DELETE FROM outbox_sources")
    suspend fun deleteAllSources()
}
