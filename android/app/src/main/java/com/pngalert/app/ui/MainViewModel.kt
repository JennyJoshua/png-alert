package com.pngalert.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.pngalert.app.core.Category
import com.pngalert.app.core.Freshness
import com.pngalert.app.core.PROVINCES
import com.pngalert.app.core.ReportInput
import com.pngalert.app.core.SourceInput
import com.pngalert.app.core.TrustLabel
import com.pngalert.app.data.AppRepository
import com.pngalert.app.data.FeedItem
import com.pngalert.app.data.OutboxReport
import com.pngalert.app.data.OutboxSource
import com.pngalert.app.data.SourceItem
import com.pngalert.app.data.toState
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

enum class FeedTab { REPORTS, SOURCES }

data class FeedFilters(
    val tab: FeedTab = FeedTab.REPORTS,
    val query: String = "",
    val province: String? = null,
    val category: Category? = null,
    val currentOnly: Boolean = true,
)

data class FeedRow(val item: FeedItem, val trust: TrustLabel, val current: Boolean)

class MainViewModel(
    private val repo: AppRepository,
    private val clock: () -> Long = { System.currentTimeMillis() },
) : ViewModel() {
    private val _filters = MutableStateFlow(FeedFilters())
    val filters: StateFlow<FeedFilters> = _filters

    fun update(change: (FeedFilters) -> FeedFilters) {
        _filters.value = change(_filters.value)
    }

    val reportRows: StateFlow<List<FeedRow>> = combine(repo.feedItems, _filters) { items, f ->
        val now = clock()
        val q = f.query.trim()
        items
            .map { FeedRow(it, Freshness.trustLabel(it.toState(), now), Freshness.isCurrent(it.toState(), now)) }
            .filter { row ->
                (!f.currentOnly || row.current) &&
                    (f.province == null || row.item.province == f.province) &&
                    (f.category == null || row.item.category == f.category.key) &&
                    (q.isEmpty() || listOf(row.item.title, row.item.summary, row.item.locality).any { it.contains(q, ignoreCase = true) })
            }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val sourceRows: StateFlow<List<SourceItem>> = combine(repo.sourceItems, _filters) { items, f ->
        val q = f.query.trim()
        items.filter { s ->
            (f.province == null || s.province == f.province) &&
                (q.isEmpty() || listOf(s.title, s.summary, s.locality).any { it.contains(q, ignoreCase = true) })
        }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val myReports: StateFlow<List<OutboxReport>> = repo.myReports.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val mySources: StateFlow<List<OutboxSource>> = repo.mySources.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val provinces: List<String> = PROVINCES

    fun observeItem(id: String): Flow<FeedItem?> = repo.observeItem(id)
    suspend fun getReport(id: String): OutboxReport? = repo.getReport(id)
    suspend fun getSource(id: String): OutboxSource? = repo.getSource(id)
    suspend fun saveReport(input: ReportInput, existingId: String?) = repo.saveReport(input, existingId)
    suspend fun saveSource(input: SourceInput, existingId: String?) = repo.saveSource(input, existingId)

    fun deleteReport(id: String) { viewModelScope.launch { repo.deleteReport(id) } }
    fun deleteSource(id: String) { viewModelScope.launch { repo.deleteSource(id) } }
    fun loadDemoData() { viewModelScope.launch { repo.loadDemoData() } }
    fun removeDemoData() { viewModelScope.launch { repo.removeDemoData() } }
    fun deleteAllLocalData() { viewModelScope.launch { repo.deleteAllLocalData() } }
}
