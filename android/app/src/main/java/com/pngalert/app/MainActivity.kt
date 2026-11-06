package com.pngalert.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.compose.viewModel
import com.pngalert.app.ui.AppNav
import com.pngalert.app.ui.MainViewModel
import com.pngalert.app.ui.PngAlertTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val repo = (application as PngAlertApp).repository
        setContent {
            PngAlertTheme {
                val vm: MainViewModel = viewModel(factory = SimpleFactory { MainViewModel(repo) })
                AppNav(vm)
            }
        }
    }
}

/** Minimal ViewModel factory so no extra library or DI framework is needed. */
class SimpleFactory(private val build: () -> ViewModel) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T = build() as T
}
