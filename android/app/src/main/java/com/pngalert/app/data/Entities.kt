package com.pngalert.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.pngalert.app.core.Authority
import com.pngalert.app.core.Category
import com.pngalert.app.core.ItemState
import com.pngalert.app.core.Lifecycle

object SyncState {
    /** The only state in this version: nothing leaves the phone. Later versions add PENDING, SENT, REJECTED. */
    const val SAVED_ON_PHONE = "SAVED_ON_PHONE"
}

/** A published report as it would be cached from a shared server. Today only clearly labelled demo rows can exist. */
@Entity(tableName = "feed_items")
data class FeedItem(
    @PrimaryKey val id: String,
    val category: String,
    val title: String,
    val summary: String,
    val province: String,
    val district: String?,
    val locality: String,
    val occurredAt: Long?,
    val sourceUrl: String?,
    val reportedAt: Long,
    val lastConfirmedAt: Long?,
    val validUntil: Long?,
    val corroborated: Boolean,
    val authority: String,
    val authorityName: String?,
    val lifecycle: String,
    val confirmCount: Int,
    val disputeCount: Int,
    val isDemo: Boolean,
)

/** A published external source (link plus short moderator-written summary). */
@Entity(tableName = "source_items")
data class SourceItem(
    @PrimaryKey val id: String,
    val platform: String,
    val url: String,
    val sourceName: String?,
    val title: String,
    val summary: String,
    val province: String,
    val district: String?,
    val locality: String,
    val sourceDate: Long?,
    val addedAt: Long,
    val isOfficial: Boolean,
    val isDemo: Boolean,
)

/** A report written on this phone, waiting to be sent once sync exists. */
@Entity(tableName = "outbox_reports")
data class OutboxReport(
    @PrimaryKey val id: String,
    val category: String,
    val title: String,
    val description: String,
    val province: String,
    val district: String?,
    val locality: String,
    val occurredAt: Long?,
    val sourceUrl: String?,
    val riskFlags: String,
    val createdAt: Long,
    val updatedAt: Long,
    val syncState: String,
)

/** A link written on this phone, waiting to be sent once sync exists. */
@Entity(tableName = "outbox_sources")
data class OutboxSource(
    @PrimaryKey val id: String,
    val platform: String,
    val url: String,
    val canonicalUrl: String,
    val context: String,
    val province: String,
    val district: String?,
    val locality: String,
    val publishedAt: Long?,
    val riskFlags: String,
    val createdAt: Long,
    val updatedAt: Long,
    val syncState: String,
)

fun FeedItem.toState(): ItemState = ItemState(
    category = Category.fromKey(category) ?: Category.NEWS_INFORMATION,
    reportedAt = reportedAt,
    lastConfirmedAt = lastConfirmedAt,
    validUntil = validUntil,
    lifecycle = runCatching { Lifecycle.valueOf(lifecycle) }.getOrDefault(Lifecycle.ACTIVE),
    authority = runCatching { Authority.valueOf(authority) }.getOrDefault(Authority.NONE),
    corroborated = corroborated,
)
