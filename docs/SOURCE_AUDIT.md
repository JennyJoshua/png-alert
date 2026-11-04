# Source audit (feeds and permissions)

Status: **not verified. No automatic importer is built.**

The specification asks for approved PNG news and agency sources to be audited before any importer is enabled. In this implementation session:

- The build sandbox cannot reach PNG news sites or agency sites, so no feed was fetched or parsed directly.
- A web search for the Post-Courier feed returned only third-party republications and aggregator listings. One third-party directory lists `https://www.postcourier.com.pg/feed/` as a feed, marked verified on a date by that directory. That is not independent verification, and it says nothing about the publisher's reuse terms.
- Nothing was found that establishes permission to reuse headlines or summaries automatically.

Candidates to check manually before enabling any importer (all **unverified**): Post-Courier, The National, EMTV, PNG Business News, plus agency notice pages (for example the National Disaster Centre named in the specification). For each, record: working feed URL, robots/terms position, whether headline plus link is permitted, update cadence, and who approved it, in the source registry (`terms_note`).

Until then, items enter only via manually submitted links, with a moderator-written summary and a link to the original. The registry stores `enabled = false` and `ingestion_method = 'manual'`, and the admin route forces that.
