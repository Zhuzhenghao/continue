package com.github.continuedev.continueintellijextension.services

import com.github.continuedev.continueintellijextension.browser.ContinueBrowserService.Companion.getBrowser
import com.github.continuedev.continueintellijextension.constants.getContinueGlobalPath
import com.github.continuedev.continueintellijextension.dialog.UsernameDialog
import com.intellij.ide.util.PropertiesComponent
import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.components.Service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.project.Project
import java.io.File
import java.nio.file.Paths

/**
 * Service for managing Shihuo authentication with username-based login
 * Supports cross-process synchronization through file-based storage
 */
@Service(Service.Level.APP)
class ShihuoAuthService {
    private val log = Logger.getInstance(ShihuoAuthService::class.java)
    
    init {
        // Load username from file on startup
        loadUsernameFromFile()
    }
    
    companion object {
        private const val USERNAME_KEY = "continue.username"
        private const val TIMESTAMP_KEY = "continue.username.timestamp"
        
        fun getInstance(): ShihuoAuthService {
            return ApplicationManager.getApplication().getService(ShihuoAuthService::class.java)
        }
    }
    
    /**
     * Load username from file on startup
     */
    private fun loadUsernameFromFile() {
        try {
            val filePath = getUsernameFilePath()
            val file = File(filePath)
            
            if (file.exists()) {
                val fileUsername = file.readText().trim()
                if (fileUsername.isNotBlank()) {
                    val propertiesComponent = PropertiesComponent.getInstance()
                    propertiesComponent.setValue(USERNAME_KEY, fileUsername)
                    propertiesComponent.setValue(TIMESTAMP_KEY, System.currentTimeMillis().toString())
                    log.info("Loaded username from file on startup: $fileUsername")
                }
            }
        } catch (e: Exception) {
            log.error("Failed to load username from file on startup", e)
        }
    }
    
    /**
     * Get stored username
     */
    fun getUsername(): String? {
        val propertiesComponent = PropertiesComponent.getInstance()
        return propertiesComponent.getValue(USERNAME_KEY)
    }
    
    /**
     * Check if user is authenticated
     */
    fun isAuthenticated(): Boolean {
        val username = getUsername()
        return !username.isNullOrBlank()
    }
    
    /**
     * Store username
     */
    fun setUsername(username: String) {
        val propertiesComponent = PropertiesComponent.getInstance()
        propertiesComponent.setValue(USERNAME_KEY, username)
        propertiesComponent.setValue(TIMESTAMP_KEY, System.currentTimeMillis().toString())
        log.info("Shihuo username stored: $username")
        
        // Write to file for cross-process sync
        writeUsernameToFile(username)
    }
    
    /**
     * Clear stored username (logout)
     */
    fun clearUsername() {
        val propertiesComponent = PropertiesComponent.getInstance()
        propertiesComponent.unsetValue(USERNAME_KEY)
        propertiesComponent.unsetValue(TIMESTAMP_KEY)
        log.info("Shihuo username cleared")
        
        // Delete file for cross-process sync
        deleteUsernameFile()
    }
    
    /**
     * Get login timestamp
     */
    fun getLoginTimestamp(): Long? {
        val propertiesComponent = PropertiesComponent.getInstance()
        val timestampStr = propertiesComponent.getValue(TIMESTAMP_KEY)
        return timestampStr?.toLongOrNull()
    }
    
    /**
     * Write username to file for cross-process sync
     */
    private fun writeUsernameToFile(username: String) {
        try {
            val filePath = getUsernameFilePath()
            val file = File(filePath)
            
            // Ensure directory exists
            file.parentFile?.mkdirs()
            
            // Write username
            file.writeText(username)
            log.info("Username written to file: $filePath")
        } catch (e: Exception) {
            log.error("Failed to write username to file", e)
        }
    }
    
    /**
     * Delete username file for cross-process sync
     */
    private fun deleteUsernameFile() {
        try {
            val filePath = getUsernameFilePath()
            val file = File(filePath)
            
            if (file.exists()) {
                file.delete()
                log.info("Username file deleted: $filePath")
            }
        } catch (e: Exception) {
            log.error("Failed to delete username file", e)
        }
    }
    
    /**
     * Get username file path
     */
    private fun getUsernameFilePath(): String {
        val continueGlobalPath = getContinueGlobalPath()
        return Paths.get(continueGlobalPath, "jetbrains-username.txt").toString()
    }
    
    /**
     * Show login dialog and authenticate
     * @return username if successful, null if cancelled
     */
    fun showLoginDialog(): String? {
        var result: String? = null
        
        ApplicationManager.getApplication().invokeAndWait {
            val dialog = UsernameDialog()
            if (dialog.showAndGet()) {
                val username = dialog.getUsername()
                if (username.isNotBlank()) {
                    setUsername(username)
                    result = username
                }
            }
        }
        
        return result
    }
    
    /**
     * Ensure user is authenticated, show dialog if not
     * @return true if authenticated, false if cancelled
     */
    fun ensureAuthentication(): Boolean {
        if (isAuthenticated()) {
            return true
        }
        
        return showLoginDialog() != null
    }
    
    /**
     * Get session info for GUI
     */
    fun getSessionInfo(): Map<String, Any>? {
        val username = getUsername()
        if (username.isNullOrBlank()) {
            return null
        }
        
        return mapOf(
            "AUTH_TYPE" to "shihuo-sso",
            "accessToken" to "",
            "account" to mapOf(
                "label" to username,
                "id" to username
            )
        )
    }
    
    /**
     * Notify core messenger about username change
     */
    fun notifyCore(project: Project, username: String) {
        try {
            val continuePluginService = project.getService(ContinuePluginService::class.java)
            continuePluginService.coreMessenger?.request(
                "jetbrains/setUsername",
                mapOf("username" to username),
                null
            ) { _ -> 
                log.info("Username sent to core: $username")
            }
        } catch (e: Exception) {
            log.error("Failed to notify core about username", e)
        }
    }
    
    /**
     * Notify GUI about session update
     */
    fun notifyGui(project: Project) {
        try {
            val sessionInfo = getSessionInfo()
            if (sessionInfo != null) {
                project.getBrowser()?.sendToWebview(
                    "sessionUpdate",
                    mapOf("sessionInfo" to sessionInfo)
                )
                log.info("Session update sent to GUI")
            }
        } catch (e: Exception) {
            log.error("Failed to notify GUI about session update", e)
        }
    }
    
    /**
     * Complete login flow: dialog -> store -> notify
     */
    fun login(project: Project): Boolean {
        val username = showLoginDialog()
        if (username != null) {
            notifyCore(project, username)
            notifyGui(project)
            return true
        }
        return false
    }
    
    /**
     * Complete logout flow: clear -> notify
     */
    fun logout(project: Project) {
        clearUsername()
        notifyCore(project, "")
        
        // Notify GUI about logout (send null session)
        try {
            project.getBrowser()?.sendToWebview(
                "sessionUpdate",
                mapOf("sessionInfo" to null)
            )
            log.info("Logout notification sent to GUI")
        } catch (e: Exception) {
            log.error("Failed to notify GUI about logout", e)
        }
    }
    
    /**
     * Notify on startup: send saved username to core and GUI
     * This is called when a new IDE window/project opens
     */
    fun notifyOnStartup(project: Project) {
        val username = getUsername()
        if (username.isNullOrBlank()) {
            log.info("[Startup] No saved username found")
            return
        }
        
        log.info("[Startup] Found saved username: $username")
        
        // Send username to core
        notifyCore(project, username)
        
        // Send session info to GUI via core messenger
        try {
            val sessionInfo = getSessionInfo()
            if (sessionInfo != null) {
                val continuePluginService = project.getService(ContinuePluginService::class.java)
                continuePluginService.coreMessenger?.request(
                    "didChangeControlPlaneSessionInfo",
                    mapOf(
                        "sessionInfo" to sessionInfo,
                        "sessionType" to "shihuo"
                    ),
                    null
                ) { _ -> 
                    log.info("[Startup] Session info sent to GUI")
                }
            }
        } catch (e: Exception) {
            log.error("[Startup] Failed to send session info to GUI", e)
        }
    }
}
