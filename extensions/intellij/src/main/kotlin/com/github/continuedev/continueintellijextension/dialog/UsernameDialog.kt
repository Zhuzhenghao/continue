package com.github.continuedev.continueintellijextension.dialog

import com.intellij.openapi.ui.DialogWrapper
import com.intellij.ui.components.JBLabel
import com.intellij.ui.components.JBTextField
import com.intellij.util.ui.FormBuilder
import com.intellij.util.ui.JBUI
import java.awt.Font
import javax.swing.Action
import javax.swing.JComponent
import javax.swing.JPanel

class UsernameDialog : DialogWrapper(true) {
    private val usernameField = JBTextField()

    init {
        title = "登录识货 SSO"
        init()
    }

    override fun createCenterPanel(): JComponent {
        // Create welcome message
        val welcomeLabel = JBLabel("欢迎使用 Continue 插件").apply {
            font = font.deriveFont(Font.BOLD, 14f)
        }
        
        val descriptionLabel = JBLabel("请输入您的识货花名以继续使用").apply {
            foreground = JBUI.CurrentTheme.ContextHelp.FOREGROUND
        }
        
        val usernameLabel = JBLabel("花名:")
        
        // Set placeholder text
        usernameField.emptyText.text = "请输入识货花名"
        
        return FormBuilder.createFormBuilder()
            .addComponent(welcomeLabel)
            .addVerticalGap(5)
            .addComponent(descriptionLabel)
            .addVerticalGap(10)
            .addLabeledComponent(usernameLabel, usernameField, 1, false)
            .addComponentFillVertically(JPanel(), 0)
            .panel.apply {
                border = JBUI.Borders.empty(10)
            }
    }

    fun getUsername(): String {
        return usernameField.text.trim()
    }

    override fun getPreferredFocusedComponent(): JComponent {
        return usernameField
    }
    
    override fun getOKAction() = super.getOKAction().apply {
        putValue(Action.NAME, "登录")
    }
    
    override fun getCancelAction() = super.getCancelAction().apply {
        putValue(Action.NAME, "取消")
    }
}
