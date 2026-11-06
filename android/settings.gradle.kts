pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal() // only needed so the KSP plugin resolves; free and public
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "png-alert-android"
include(":app")
