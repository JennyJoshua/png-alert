package com.pngalert.app.core

import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/** All times the person types or reads are PNG time (UTC+10, no daylight saving). */
object TimeUtil {
    val PNG_ZONE: TimeZone = TimeZone.getTimeZone("Pacific/Port_Moresby")
    const val INPUT_HINT = "YYYY-MM-DD HH:MM (PNG time)"
    private val INPUT_SHAPE = Regex("""\d{4}-\d{2}-\d{2} \d{2}:\d{2}""")

    /** Parses "2026-11-04 08:00" as PNG time. Returns null if empty-shaped wrongly or not a real date. */
    fun parsePng(value: String): Long? {
        val v = value.trim()
        if (!INPUT_SHAPE.matches(v)) return null
        return try {
            val f = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US)
            f.timeZone = PNG_ZONE
            f.isLenient = false
            f.parse(v)?.time
        } catch (e: Exception) {
            null
        }
    }

    /** Formats a time the way the edit fields expect it, so a saved value can be shown and parsed again. */
    fun formatPngInput(millis: Long): String {
        val f = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US)
        f.timeZone = PNG_ZONE
        return f.format(Date(millis))
    }

    fun formatPng(millis: Long): String {
        val f = SimpleDateFormat("d MMM yyyy, h:mm a", Locale.ENGLISH)
        f.timeZone = PNG_ZONE
        return f.format(Date(millis))
    }

    fun timeAgo(millis: Long, now: Long): String {
        val mins = maxOf(0L, (now - millis) / 60_000L)
        if (mins < 1) return "just now"
        if (mins < 60) return "$mins min ago"
        val hours = (mins + 30) / 60
        if (hours < 48) return "$hours h ago"
        return "${(hours + 12) / 24} days ago"
    }
}
