package com.pngalert.app.ui

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument

private const val NEW = "new"

@Composable
fun AppNav(vm: MainViewModel) {
    val nav = rememberNavController()
    val stringArg = { name: String -> listOf(navArgument(name) { type = NavType.StringType }) }

    NavHost(navController = nav, startDestination = "feed") {
        composable("feed") {
            FeedScreen(
                vm,
                onOpen = { nav.navigate("incident/$it") },
                onReport = { nav.navigate("report/$NEW") },
                onShareLink = { nav.navigate("source/$NEW") },
                onSubmissions = { nav.navigate("submissions") },
                onInfo = { nav.navigate("info/rules") },
                onSettings = { nav.navigate("settings") },
            )
        }
        composable("incident/{id}", arguments = stringArg("id")) { entry ->
            DetailScreen(vm, entry.arguments?.getString("id").orEmpty(), onBack = { nav.popBackStack() })
        }
        composable("report/{id}", arguments = stringArg("id")) { entry ->
            val id = entry.arguments?.getString("id")?.takeIf { it != NEW }
            ReportFormScreen(
                vm, id,
                onBack = { nav.popBackStack() },
                onSaved = { nav.navigate("submissions") { popUpTo("feed") } },
            )
        }
        composable("source/{id}", arguments = stringArg("id")) { entry ->
            val id = entry.arguments?.getString("id")?.takeIf { it != NEW }
            SourceFormScreen(
                vm, id,
                onBack = { nav.popBackStack() },
                onSaved = { nav.navigate("submissions") { popUpTo("feed") } },
            )
        }
        composable("submissions") {
            SubmissionsScreen(
                vm,
                onBack = { nav.popBackStack() },
                onEditReport = { nav.navigate("report/$it") },
                onEditSource = { nav.navigate("source/$it") },
            )
        }
        composable("info/{slug}", arguments = stringArg("slug")) { entry ->
            InfoScreen(
                entry.arguments?.getString("slug").orEmpty(),
                onBack = { nav.popBackStack() },
                onOpen = { nav.navigate("info/$it") },
            )
        }
        composable("settings") { SettingsScreen(vm, onBack = { nav.popBackStack() }) }
    }
}
