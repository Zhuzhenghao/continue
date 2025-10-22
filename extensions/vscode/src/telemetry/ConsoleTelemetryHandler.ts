import { Telemetry } from "core/util/posthog.js";

/**
 * 独立的Console Telemetry处理器
 * 通过扩展模式而非直接修改核心文件来减少合并冲突
 */
export class ConsoleTelemetryHandler {
  /**
   * 处理来自GUI的telemetry统计消息
   */
  static handleGuiTelemetryStats(data: { eventType: string; eventData: any }) {
    try {
      console.log(`[ConsoleTelemetry] 📨 Received GUI telemetry:`, data);

      // 使用Core层的Telemetry服务上报事件
      void Telemetry.capture(data.eventType, data.eventData);
      console.log(
        `[ConsoleTelemetry] ✅ GUI telemetry event sent: ${data.eventType}`,
      );
    } catch (error) {
      console.error(
        `[ConsoleTelemetry] ❌ Failed to send GUI telemetry:`,
        error,
      );
    }
  }

  /**
   * 检查消息是否为GUI telemetry统计消息
   */
  static isGuiTelemetryMessage(message: any): boolean {
    return message.messageType === "guiTelemetryStats" && message.data;
  }
}
