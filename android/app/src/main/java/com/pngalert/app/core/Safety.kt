package com.pngalert.app.core

/** Lightweight triage only. Flags never decide anything by themselves; they ask a moderator to look closely. */
object Safety {
    private val RULES: Map<String, Regex> = linkedMapOf(
        "violence" to Regex("""\b(kill(ed|ing)?|murder(ed)?|stab(bed)?|shot|shooting|rape[sd]?|assault(ed)?|beaten|machete|gunmen|gunshots?)\b""", RegexOption.IGNORE_CASE),
        "conflict" to Regex("""\b(tribal|clan fight|payback|riot(s|ing)?|unrest|mob)\b""", RegexOption.IGNORE_CASE),
        "accusation" to Regex("""\b(thief|thieves|robber(s|y)?|raskol|rascals?|criminals?|hold-?up|hijack(ed|ers?)?|suspect(s|ed)?)\b""", RegexOption.IGNORE_CASE),
        "political" to Regex("""\b(election fraud|rigged|corrupt(ion)?)\b""", RegexOption.IGNORE_CASE),
    )
    private val EMAIL = Regex("""[^\s@]+@[^\s@]+\.[^\s@]+""")
    private val PHONE = Regex("""(?:\+?\d[\s().-]?){8,}""")

    fun riskFlags(vararg texts: String?): List<String> {
        val joined = texts.filterNotNull().joinToString(" \n ")
        return RULES.filter { (_, re) -> re.containsMatchIn(joined) }.keys.toList()
    }

    /** Reporter or third-party contact details must not be published. */
    fun containsContactInfo(vararg texts: String?): Boolean {
        val joined = texts.filterNotNull().joinToString(" \n ")
        return EMAIL.containsMatchIn(joined) || PHONE.containsMatchIn(joined)
    }
}
