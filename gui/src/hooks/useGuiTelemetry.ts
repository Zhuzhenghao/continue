import { useContext } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";

/**
 * Hook for sending GUI telemetry events directly to telemetry services
 */
export function useGuiTelemetry() {
  const ideMessenger = useContext(IdeMessengerContext);

  const sendTelemetry = (eventType: string, eventData: any) => {
    console.log(`[GUI] 📊 Sending telemetry: ${eventType}`, eventData);

    if (ideMessenger) {
      try {
        ideMessenger.post("guiTelemetryStats", {
          eventType,
          eventData,
        });
      } catch (error) {
        console.error(
          `[GUI] ❌ Failed to send ${eventType} to core layer:`,
          error,
        );
      }
    }
  };

  return { sendTelemetry };
}
