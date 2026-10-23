package com.takna.ai.nav

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.lifecycle.viewmodel.compose.viewModel
import com.takna.ai.auth.AuthViewModel
import com.takna.ai.ui.screens.AboutScreen
import com.takna.ai.ui.screens.ProfileScreen
import com.takna.ai.ui.screens.ResetPasswordScreen
import com.takna.ai.ui.screens.VerifyEmailScreen
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
    val auth: AuthViewModel = viewModel()
    val toHome: () -> Unit = { nav.navigate(Routes.Home) { popUpTo(0) { inclusive = true } } }
    val toVerify: () -> Unit = { nav.navigate(Routes.VerifyEmail) { popUpTo(0) { inclusive = true } } }
    val toLogin: () -> Unit = { nav.navigate(Routes.Login) { popUpTo(0) { inclusive = true } } }

    NavHost(navController = nav, startDestination = Routes.Splash) {
        composable(Routes.Splash) {
            SplashScreenUi(onDone = {
                when {
                    auth.signedIn && auth.verified -> toHome()
                    auth.signedIn -> toVerify()
                    else -> nav.navigate(Routes.Onboarding) { popUpTo(Routes.Splash) { inclusive = true } }
                }
            })
        }
        composable(Routes.Onboarding) {
            OnboardingScreen(onFinish = {
                nav.navigate(Routes.Login) { popUpTo(Routes.Onboarding) { inclusive = true } }
            })
        }
        composable(Routes.Login) {
            LoginScreen(
                vm = auth,
                onSignedIn = { verified -> if (verified) toHome() else toVerify() },
                onRegister = { nav.navigate(Routes.Register) },
                onForgot = { nav.navigate(Routes.ResetPassword) },
                onPreview = toHome,
            )
        }
        composable(Routes.Register) { RegisterScreen(vm = auth, onRegistered = toVerify, onBack = back) }
        composable(Routes.ResetPassword) { ResetPasswordScreen(vm = auth, onBack = back) }
        composable(Routes.VerifyEmail) {
            VerifyEmailScreen(vm = auth, onVerified = toHome, onSignOut = { auth.signOut(); toLogin() })
        }
        composable(Routes.Profile) { ProfileScreen(vm = auth, onSignedOut = toLogin, onBack = back) }
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
