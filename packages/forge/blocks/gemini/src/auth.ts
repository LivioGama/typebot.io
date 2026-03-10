import { option } from "@typebot.io/forge";
import type { AuthDefinition } from "@typebot.io/forge/types";

export const auth = {
  type: "encryptedCredentials",
  name: "Google Gemini account",
  schema: option.object({
    apiKey: option.string.layout({
      label: "API key",
      isRequired: true,
      inputType: "password",
      withVariableButton: false,
      helperText:
        "You can generate an API key [here](https://aistudio.google.com/app/apikey).",
      isDebounceDisabled: true,
    }),
  }),
} satisfies AuthDefinition;
