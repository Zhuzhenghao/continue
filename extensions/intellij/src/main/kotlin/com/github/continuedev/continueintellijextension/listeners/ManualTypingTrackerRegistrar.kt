package com.github.continuedev.continueintellijextension.listeners

import com.github.continuedev.continueintellijextension.services.ManualTypingStatisticsService
import com.intellij.openapi.Disposable
import com.intellij.openapi.actionSystem.DataContext
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.service
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.Editor
import com.intellij.openapi.editor.actionSystem.TypedAction
import com.intellij.openapi.editor.actionSystem.TypedActionHandler

@Service(Service.Level.APP)
class ManualTypingTrackerRegistrar : Disposable {

    private val log = Logger.getInstance(ManualTypingTrackerRegistrar::class.java)
    private val statisticsService = service<ManualTypingStatisticsService>()
    private val typedAction: TypedAction = TypedAction.getInstance()
    private val originalHandler: TypedActionHandler = typedAction.handler
    private val manualTypingHandler = ManualTypingTypedActionHandler(
        delegate = originalHandler,
        statisticsService = statisticsService,
        log = log
    )

    init {
        typedAction.setupHandler(manualTypingHandler)
    }

    override fun dispose() {
        typedAction.setupHandler(originalHandler)
    }

    private class ManualTypingTypedActionHandler(
        private val delegate: TypedActionHandler,
        private val statisticsService: ManualTypingStatisticsService,
        private val log: Logger
    ) : TypedActionHandler {

        override fun execute(editor: Editor, charTyped: Char, dataContext: DataContext) {
            try {
                trackManualTyping(charTyped)
            } catch (error: Exception) {
                log.warn("Failed to track manual typing input", error)
            } finally {
                delegate.execute(editor, charTyped, dataContext)
            }
        }

        private fun trackManualTyping(charTyped: Char) {
            if (!shouldTrack(charTyped)) {
                return
            }

            val linesAdded = if (charTyped == '\n') 1 else 0
            statisticsService.trackManualTyping(1, linesAdded)
        }

        private fun shouldTrack(charTyped: Char): Boolean {
            if (charTyped == Char.MIN_VALUE) {
                return false
            }
            if (charTyped == '\u0000') {
                return false
            }

            // Allow newline and tab even though they are control characters
            if (Character.isISOControl(charTyped) && charTyped != '\n' && charTyped != '\t') {
                return false
            }

            return true
        }
    }
}

