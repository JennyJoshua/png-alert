package com.pngalert.app.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration

/**
 * Schema version 1. For future changes: bump version, add a Migration to MIGRATIONS.
 * Destructive migration is deliberately NOT enabled, so an app update can never wipe what is saved on the phone.
 */
@Database(
    entities = [FeedItem::class, SourceItem::class, OutboxReport::class, OutboxSource::class],
    version = 1,
    exportSchema = false,
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun feedDao(): FeedDao
    abstract fun outboxDao(): OutboxDao

    companion object {
        val MIGRATIONS: Array<Migration> = arrayOf()

        fun build(context: Context): AppDatabase =
            Room.databaseBuilder(context.applicationContext, AppDatabase::class.java, "pngalert.db")
                .addMigrations(*MIGRATIONS)
                .build()
    }
}
