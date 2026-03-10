import { createBlock } from "@typebot.io/forge";
import { createChatCompletion } from "./actions/createChatCompletion";
import { auth } from "./auth";
import { GeminiLogo } from "./logo";

export const geminiBlock = createBlock({
  id: "gemini",
  name: "Google Gemini",
  tags: ["ai", "chat", "completion", "google", "gemini"],
  LightLogo: GeminiLogo,
  auth,
  actions: [createChatCompletion],
});
