package com.takna.ai.nav

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.takna.ai.ui.screens.AboutScreen
import com.takna.ai.ui.screens.ChatScreen
import com.takna.ai.ui.screens.HomeScreen
import com.takna.ai.ui.screens.LoginScreen
import com.takna.ai.ui.screens.MoreScreen
import com.takna.ai.ui.screens.OnboardingScreen
import com.takna.ai.ui.screens.PendingScreen
import com.takna.ai.ui.screens.RegisterScreen
import com.takna.ai.ui.screens.SplashScreenUi

@Composable
fun TaknaApp() {
    val nav = rememberNavController()
    val back: () -> Unit = { nav.popBackStack() }

    NavHost(navController = nav, startDestination = Routes.Splash) {
        composable(Routes.Splash) {
            SplashScreenUi(onDone = {
                nav.navigate(Routes.Onboarding) { popUpTo(Routes.Splash) { inclusive = true } }
            })
        }
        composable(Routes.Onboarding) {
            OnboardingScreen(onFinish = {
                nav.navigate(Routes.Login) { popUpTo(Routes.Onboarding) { inclusive = true } }
            })
        }
        composable(Routes.Login) {
            LoginScreen(
                onRegister = { nav.navigate(Routes.Register) },
                onForgot = { nav.navigate(Routes.ResetPassword) },
                onPreview = { nav.navigate(Routes.Home) { popUpTo(Routes.Login) { inclusive = true } } },
            )
        }
        composable(Routes.Register) { RegisterScreen(onBack = back) }
        composable(Routes.Home) {
            HomeScreen(
                onOpen = { nav.navigate(it) },
                onChat = { nav.navigate(Routes.chat(it)) },
            )
        }
        composable(
            route = Routes.ChatPattern,
            arguments = listOf(navArgument("q") { type = NavType.StringType; nullable = true; defaultValue = null }),
        ) { entry ->
            ChatScreen(initialMessage = entry.arguments?.getString("q"), onBack = back)
        }
        composable(Routes.More) { MoreScreen(onOpen = { nav.navigate(it) }, onBack = back) }
        composable(Routes.About) { AboutScreen(onBack = back) }
        pendingScreens.forEach { (route, info) ->
            composable(route) { PendingScreen(info, onBack = back) }
        }
    }
}
