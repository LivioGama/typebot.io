import { parseBlockCredentials, parseBlockSchema } from "@typebot.io/forge";
import { auth } from "./auth";
import { geminiBlock } from "./index";

export const geminiBlockSchema = parseBlockSchema(geminiBlock);
export const geminiCredentialsSchema = parseBlockCredentials(
  geminiBlock.id,
  auth.schema,
);
