package com.takna.ai.nav

object Routes {
    const val Splash = "splash"
    const val Onboarding = "onboarding"
    const val Login = "login"
    const val Register = "register"
    const val VerifyEmail = "verify_email"
    const val ResetPassword = "reset_password"
    const val Home = "home"
    const val Chat = "chat"
    const val More = "more"
    const val VoiceSettings = "voice_settings"
    const val AppLauncher = "app_launcher"
    const val YouTube = "youtube"
    const val CodingStudio = "coding_studio"
    const val FileExplorer = "file_explorer"
    const val CodeEditor = "code_editor"
    const val WebsitePreview = "website_preview"
    const val ProjectExport = "project_export"
    const val History = "history"
    const val Profile = "profile"
    const val Plans = "plans"
    const val Billing = "billing"
    const val Privacy = "privacy"
    const val Settings = "settings"
    const val About = "about"

    const val ChatPattern = "chat?q={q}"
    fun chat(query: String? = null) =
        if (query.isNullOrBlank()) Chat else "chat?q=" + android.net.Uri.encode(query)
}

/** Screens whose real implementation belongs to a later phase. Shown honestly as "coming", never faked. */
data class Pending(val title: String, val phase: String, val note: String)

val pendingScreens: Map<String, Pending> = mapOf(
    Routes.AppLauncher to Pending("App launcher", "Phase 6", "Allow-listed app opening (YouTube, Chrome, Calculator) through standard Android intents."),
    Routes.YouTube to Pending("YouTube assistant", "Phase 6", "Search and open YouTube through supported intents."),
    Routes.CodingStudio to Pending("Coding Studio", "Phase 7", "Backend project and file APIs exist. The workspace UI comes next."),
    Routes.FileExplorer to Pending("File explorer", "Phase 7", "Project files, folders, create, rename and delete."),
    Routes.CodeEditor to Pending("Code editor", "Phase 7", "Syntax-highlighting editor with AI help."),
    Routes.WebsitePreview to Pending("Website preview", "Phase 7", "Secure WebView preview of static websites."),
    Routes.ProjectExport to Pending("Project export", "Phase 7", "Export a project as a ZIP using the Android file picker."),
    Routes.History to Pending("Conversation history", "Phase 5", "Chats are kept for 7 days on the server. The list appears after sign-in."),
    Routes.Plans to Pending("Subscription plans", "Phase 10", "Plans and entitlements. Payments through TaknaPay are blocked until its official API documentation is available."),
    Routes.Billing to Pending("Billing history", "Phase 10", "Appears after subscriptions and payments are live."),
    Routes.Privacy to Pending("Privacy settings", "Phase 9", "Delete-chat-now and 7-day retention controls (backend ready)."),
    Routes.Settings to Pending("Settings", "Phase 5", "General app settings."),
)
