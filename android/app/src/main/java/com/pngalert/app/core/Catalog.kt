package com.pngalert.app.core

enum class Category(val key: String, val label: String, val freshnessHours: Int?) {
    ROADS_TRANSPORT("roads_transport", "Roads & transport", 12),
    UTILITIES("utilities", "Utilities", 12),
    PUBLIC_SERVICES("public_services", "Public services", 24),
    OFFICIAL_NOTICES("official_notices", "Official & community notices", null),
    NEWS_INFORMATION("news_information", "News & information", null);

    companion object {
        fun fromKey(key: String): Category? = values().firstOrNull { it.key == key }
    }
}

enum class Platform(val key: String, val label: String) {
    FACEBOOK("facebook", "Facebook post or Page"),
    OTHER_SOCIAL("other_social", "Other social media"),
    NEWS("news", "News article"),
    OFFICIAL_NOTICE("official_notice", "Official notice");

    companion object {
        fun fromKey(key: String): Platform? = values().firstOrNull { it.key == key }
    }
}

val PROVINCES: List<String> = listOf(
    "Bougainville", "Central", "Chimbu", "East New Britain", "East Sepik", "Eastern Highlands", "Enga", "Gulf", "Hela", "Jiwaka",
    "Madang", "Manus", "Milne Bay", "Morobe", "National Capital District", "New Ireland", "Oro", "Southern Highlands",
    "West New Britain", "West Sepik", "Western", "Western Highlands",
)
