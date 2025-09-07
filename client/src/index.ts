import { A2AClient, SendMessageSuccessResponse } from "@a2a-js/sdk/client";
import { randomUUID } from "node:crypto";

const serverUrl = "http://localhost:41241";
// const serverUrl = "http://localhost:4000";
const client = new A2AClient(serverUrl);

async function main() {
  try {
    const response = await client.sendMessage({
      message: {
        messageId: randomUUID(),
        kind: "message",
        role: "user",
        // parts: [{ kind: "text", text: "サイコロを振ってください" }],
        parts: [{ kind: "text", text: "サイコロを2回振って結果を教えて" }],
      },
    });
    console.log(response)

    // response は SendMessageResponse 型であり、
    // JSONRPCErrorResponse | SendMessageSuccessResponse のいずれか
    // JSONRPCErrorResponse の場合はエラー error プロパティが存在するので、これで判定
    if ("error" in response) {
      console.error("Error sending message:", response.error.message);
      return;
    }

    if (response.result.kind === "message") {
      console.log("Agent response:");
      response.result.parts.forEach((part) => {
        if (part.kind === "text") {
          console.log(part.text);
          console.log("\n");
        }
      });
    } else if (response.result.kind === "task") {
      console.log("Task created with ID:", response.result.id);
      console.log("Task status:", response.result.status);

      if (response.result.status.state === "completed") {
        console.log("Task message:");
        response.result.status.message?.parts.forEach((part) => {
          if (part.kind === "text") {
            console.log(part.text);
            console.log("\n");
          }
        });
      }
    }
  } catch (error) {
    console.error("Failed to send message:", error);
  }
}

main().catch((error) => {
  console.error("An error occurred:", error);
});
