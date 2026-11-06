package com.pngalert.app.core

import java.net.URI

object UrlUtil {
    private val TRACKING = Regex("^(utm_|fbclid$|gclid$|mc_|igshid$|ref$|ref_src$)", RegexOption.IGNORE_CASE)

    fun parseHttpUrl(input: String): URI? = try {
        val u = URI(input.trim())
        val scheme = u.scheme?.lowercase()
        if ((scheme == "http" || scheme == "https") && !u.host.isNullOrEmpty() && u.userInfo == null) u else null
    } catch (e: Exception) {
        null
    }

    /** Stable form of a link for duplicate detection. Never fetches anything. */
    fun canonicalize(input: String): String? {
        val u = parseHttpUrl(input) ?: return null
        val host = u.host.lowercase().removePrefix("www.")
        val port = if (u.port == -1) "" else ":${u.port}"
        val rawPath = u.rawPath ?: ""
        val path = if (rawPath.length > 1) rawPath.trimEnd('/').ifEmpty { "/" } else "/"
        val query = (u.rawQuery ?: "").split("&")
            .filter { it.isNotEmpty() && !TRACKING.containsMatchIn(it.substringBefore("=")) }
            .sorted()
            .joinToString("&")
        return "${u.scheme.lowercase()}://$host$port$path" + if (query.isEmpty()) "" else "?$query"
    }
}
