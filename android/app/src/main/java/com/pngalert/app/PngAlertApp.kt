package com.pngalert.app

import android.app.Application
import com.pngalert.app.data.AppDatabase
import com.pngalert.app.data.AppRepository

class PngAlertApp : Application() {
    val repository: AppRepository by lazy { AppRepository(AppDatabase.build(this)) }
}
