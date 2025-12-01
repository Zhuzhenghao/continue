package com.github.continuedev.continueintellijextension.services

import com.github.continuedev.continueintellijextension.error.ContinuePostHogService
import com.intellij.openapi.application.ApplicationNamesInfo
import com.intellij.openapi.Disposable
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.isActive
import java.util.concurrent.atomic.AtomicReference
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.nio.file.Files
import java.nio.file.Paths
import java.util.UUID

data class ManualTypingStatistics(
    val totalCharactersTyped: Int,
    val totalLinesTyped: Int,
    val totalKeystrokes: Int,
    val lastTypingTime: Long
)

data class ManualTypingConfig(
    val enabled: Boolean = true,
    val reportEnabled: Boolean = true,
    val reportInterval: Long = DEFAULT_REPORT_INTERVAL
) {
    companion object {
        private const val DEFAULT_REPORT_INTERVAL: Long = 10 * 1000 // 10 seconds
    }
}


@Service(Service.Level.APP)
class ManualTypingStatisticsService(
    private val telemetryService: ContinuePostHogService = service()
) : Disposable {

    private val log = Logger.getInstance(ManualTypingStatisticsService::class.java)

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    private val statisticsRef = AtomicReference(
        ManualTypingStatistics(
            totalCharactersTyped = 0,
            totalLinesTyped = 0,
            totalKeystrokes = 0,
            lastTypingTime = 0
        )
    )
    private var config: ManualTypingConfig = ManualTypingConfig()
    private var reportJob: Job? = null

    init {
        startPeriodicReporting()
    }

    fun trackManualTyping(charactersAdded: Int, linesAdded: Int) {
        if (!isEnabled()) return
        if (!validateInput(charactersAdded, linesAdded)) {
            log.warn("Invalid manual typing statistics input: characters=$charactersAdded, lines=$linesAdded")
            return
        }

        val timestamp = System.currentTimeMillis()
        statisticsRef.updateAndGet { current ->
            current.copy(
                totalCharactersTyped = current.totalCharactersTyped + charactersAdded,
                totalLinesTyped = current.totalLinesTyped + linesAdded,
                totalKeystrokes = current.totalKeystrokes + 1,
                lastTypingTime = timestamp
            )
        }
    }

    fun getStatistics(): ManualTypingStatistics = statisticsRef.get()

    fun resetStatistics() {
        statisticsRef.set(
            ManualTypingStatistics(
                totalCharactersTyped = 0,
                totalLinesTyped = 0,
                totalKeystrokes = 0,
                lastTypingTime = 0
            )
        )
    }

    fun configure(newConfig: ManualTypingConfig) {
        config = newConfig
        restartReportingJob()
    }

    fun configure(partialConfig: Map<String, Any?>) {
        val current = config
        val updated = ManualTypingConfig(
            enabled = partialConfig["enabled"] as? Boolean ?: current.enabled,
            reportEnabled = partialConfig["reportEnabled"] as? Boolean ?: current.reportEnabled,
            reportInterval = (partialConfig["reportInterval"] as? Number)?.toLong() ?: current.reportInterval
        )
        configure(updated)
    }

    fun isEnabled(): Boolean = config.enabled

    suspend fun forceReport() {
        reportStatistics()
    }

    private fun startPeriodicReporting() {
        if (!config.reportEnabled) return
        reportJob = scope.launch {
            while (isActive) {
                delay(config.reportInterval)
                reportStatistics()
            }
        }
    }

    private fun restartReportingJob() {
        reportJob?.cancel()
        reportJob = null
        if (config.reportEnabled) {
            startPeriodicReporting()
        }
    }

    private suspend fun reportStatistics() {
        val snapshot = statisticsRef.get()
        log.info("Reporting manual typing statistics: $snapshot")
        if (snapshot.totalCharactersTyped == 0 &&
            snapshot.totalLinesTyped == 0 &&
            snapshot.totalKeystrokes == 0
        ) {
            return
        }

        try {
            // telemetryService.capture(
            //     "manual_typing_statistics",
            //     mapOf(
            //         "totalCharactersTyped" to snapshot.totalCharactersTyped,
            //         "totalLinesTyped" to snapshot.totalLinesTyped,
            //         "totalKeystrokes" to snapshot.totalKeystrokes,
            //         "lastTypingTime" to snapshot.lastTypingTime,
            //         "reportTimestamp" to System.currentTimeMillis()
            //     )
            // )
            // Only send to Shihuo for now
            sendToShihuo(snapshot)
            resetStatisticsAfterReport()
        } catch (error: Exception) {
            log.warn("Failed to report manual typing statistics", error)
        }
    }

    private fun resetStatisticsAfterReport() {
        val lastTypingTime = statisticsRef.get().lastTypingTime
        statisticsRef.set(
            ManualTypingStatistics(
                totalCharactersTyped = 0,
                totalLinesTyped = 0,
                totalKeystrokes = 0,
                lastTypingTime = lastTypingTime
            )
        )
    }

    private fun validateInput(charactersAdded: Int, linesAdded: Int): Boolean {
        if (charactersAdded < 0 || linesAdded < 0) {
            return false
        }
        if (charactersAdded > 10_000 || linesAdded > 1_000) {
            return false
        }
        return true
    }

    override fun dispose() {
        reportJob?.cancel()
        scope.cancel()
    }

    private fun sendToShihuo(snapshot: ManualTypingStatistics) {
        try {
            val deviceId = getOrCreateDeviceId()
            val ideName = ApplicationNamesInfo.getInstance().fullProductName
            val osName = System.getProperty("os.name")
            val event = mapOf(
                "event" to "manual_typing_statistics",
                "properties" to mapOf(
                    "totalCharactersTyped" to snapshot.totalCharactersTyped,
                    "totalLinesTyped" to snapshot.totalLinesTyped,
                    "totalKeystrokes" to snapshot.totalKeystrokes,
                    "lastTypingTime" to snapshot.lastTypingTime
                ),
                "timestamp" to System.currentTimeMillis().let { ts -> java.time.Instant.ofEpochMilli(ts).toString() },
                "distinctId" to deviceId,
                "os" to osName,
                "extensionVersion" to null,
                "ideName" to ideName,
                "ideType" to "jetbrains"
            )

            // Get username from PropertiesComponent instead of environment variable
            val propertiesComponent = com.intellij.ide.util.PropertiesComponent.getInstance()
            val username = propertiesComponent.getValue("continue.username").orEmpty()
            
            val bizData = mapOf(
                "events" to listOf(event),
                "event_count" to 1,
                "name" to username,
                "dept_name" to "",
                "timestamp" to java.time.Instant.now().toString(),
                "summary" to mapOf(
                    "manual_typing" to mapOf(
                        "total_characters" to snapshot.totalCharactersTyped,
                        "total_lines" to snapshot.totalLinesTyped,
                        "total_keystrokes" to snapshot.totalKeystrokes
                    )
                )
            )

            val params = mapOf(
                "pti" to mapOf(
                    "id" to "continue_telemetry",
                    "biz" to com.google.gson.Gson().toJson(bizData)
                ),
                "device_id" to deviceId,
                "client_code" to username.ifEmpty { deviceId },
                "channel" to "Continue",
                "action_time" to System.currentTimeMillis(),
                "APIVersion" to "0.6.0"
            )

            val paramsStr = "?" + params.entries.joinToString("&") { (key, value) ->
                val stringValue = when (value) {
                    is String -> value
                    is Number, is Boolean -> value.toString()
                    else -> com.google.gson.Gson().toJson(value)
                }
                key + "=" + URLEncoder.encode(stringValue, StandardCharsets.UTF_8)
            }

            val client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build()
            val request = HttpRequest.newBuilder()
                .uri(URI.create("https://sh-gateway.shihuo.cn/v4/services/sh-elance-api/track/auto_track"))
                .timeout(Duration.ofSeconds(10))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"raw\":\"${escapeJson(paramsStr)}\"}"))
                .build()
            client.send(request, HttpResponse.BodyHandlers.ofString())
        } catch (e: Exception) {
            log.warn("Failed to send manual typing statistics to Shihuo", e)
        }
    }

    private fun escapeJson(input: String): String {
        return input
            .replace("\\", "\\\\")
            .replace("\"", "\\\"")
    }

    private fun getContinueDataPath(): String {
        return try {
            val envDir = System.getenv("CONTINUE_GLOBAL_DIR")
            val baseDir = if (envDir != null && envDir.isNotBlank()) {
                Paths.get(envDir)
            } else {
                Paths.get(System.getProperty("user.home"), ".continue")
            }
            val continueDir = baseDir.resolve(Paths.get("dev_data", "0.2.0"))
            if (!Files.exists(continueDir)) {
                Files.createDirectories(continueDir)
            }
            continueDir.toString()
        } catch (e: Exception) {
            val fallback = Paths.get(System.getProperty("user.dir"), ".continue")
            if (!Files.exists(fallback)) {
                Files.createDirectories(fallback)
            }
            fallback.toString()
        }
    }

    private fun getDeviceIdPath(): String {
        return Paths.get(getContinueDataPath(), "shihuo-device-id.txt").toString()
    }

    private fun getOrCreateDeviceId(): String {
        return try {
            val path = Paths.get(getDeviceIdPath())
            if (Files.exists(path)) {
                val content = Files.readString(path).trim()
                if (content.isNotEmpty()) return content
            }
            val id = UUID.randomUUID().toString()
            Files.writeString(path, id)
            id
        } catch (e: Exception) {
            UUID.randomUUID().toString()
        }
    }
}

