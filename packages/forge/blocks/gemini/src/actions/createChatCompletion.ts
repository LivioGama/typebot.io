import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { runChatCompletion } from "@typebot.io/ai/runChatCompletion";
import { runChatCompletionStream } from "@typebot.io/ai/runChatCompletionStream";
import { createAction, option } from "@typebot.io/forge";
import { isDefined } from "@typebot.io/lib/utils";
import { auth } from "../auth";

const nativeMessageContentSchema = {
  content: option.string.layout({
    inputType: "textarea",
    placeholder: "Content",
  }),
};

const systemMessageItemSchema = option
  .object({
    role: option.literal("system"),
  })
  .extend(nativeMessageContentSchema);

const userMessageItemSchema = option
  .object({
    role: option.literal("user"),
  })
  .extend(nativeMessageContentSchema);

const assistantMessageItemSchema = option
  .object({
    role: option.literal("assistant"),
  })
  .extend(nativeMessageContentSchema);

const dialogueMessageItemSchema = option.object({
  role: option.literal("Dialogue"),
  dialogueVariableId: option.string.layout({
    inputType: "variableDropdown",
    placeholder: "Dialogue variable",
  }),
  startsBy: option.enum(["user", "assistant"]).layout({
    label: "starts by",
    direction: "row",
    defaultValue: "user",
  }),
});

export const createChatCompletion = createAction({
  name: "Create chat completion",
  auth,
  options: option.object({
    model: option
      .enum(["gemini-2.5-flash-exp", "gemini-2.5-pro"] as const)
      .layout({
        placeholder: "Select a model",
      }),
    messages: option
      .array(
        option.discriminatedUnion("role", [
          systemMessageItemSchema,
          userMessageItemSchema,
          assistantMessageItemSchema,
          dialogueMessageItemSchema,
        ]),
      )
      .layout({ accordion: "Messages", itemLabel: "message" }),
    tools: option
      .array(
        option.object({
          type: option.literal("function"),
          function: option.object({
            name: option.string.layout({
              placeholder: "Function name",
            }),
            description: option.string.layout({
              inputType: "textarea",
              placeholder: "Function description",
            }),
            code: option.string.layout({
              lang: "javascript",
              inputType: "code",
              placeholder: "const result = myFunction();\nreturn result;",
            }),
          }),
        }),
      )
      .layout({ accordion: "Tools", itemLabel: "tool" }),
    temperature: option.number.layout({
      accordion: "Advanced settings",
      label: "Temperature",
      direction: "row",
      defaultValue: 1,
    }),
    responseMapping: option
      .saveResponseArray([
        "Message content",
        "Total tokens",
        "Prompt tokens",
        "Completion tokens",
      ] as const)
      .layout({
        accordion: "Save response",
      }),
  }),
  turnableInto: [
    {
      blockId: "openai",
      transform: (opts) => ({
        ...opts,
        model: undefined,
      }),
    },
    {
      blockId: "anthropic",
      transform: (options) => ({
        ...options,
        model: undefined,
        action: "Create Chat Message",
      }),
    },
    {
      blockId: "mistral",
      transform: (opts) => ({
        ...opts,
        model: undefined,
      }),
    },
    {
      blockId: "groq",
      transform: (opts) => ({
        ...opts,
        model: undefined,
      }),
    },
    {
      blockId: "together-ai",
    },
    { blockId: "open-router" },
    {
      blockId: "perplexity",
      transform: (options) => ({
        ...options,
        model: undefined,
      }),
    },
    {
      blockId: "deepseek",
      transform: (options) => ({
        ...options,
        model: undefined,
      }),
    },
  ],
  getSetVariableIds: (options) =>
    options.responseMapping?.map((r) => r.variableId).filter(isDefined) ?? [],
  run: {
    server: ({
      credentials: { apiKey },
      options,
      variables,
      logs,
      sessionStore,
    }) => {
      if (!apiKey) return logs.add("No API key provided");

      if (!options.model) return logs.add("No model provided");

      if (!options.messages) return logs.add("No messages provided");

      return runChatCompletion({
        model: createGoogleGenerativeAI({
          apiKey,
        })(options.model),
        messages: options.messages,
        temperature: options.temperature,
        tools: options.tools,
        isVisionEnabled: true,
        variables,
        responseMapping: options.responseMapping,
        logs,
        sessionStore,
      });
    },
    stream: {
      getStreamVariableId: (options) =>
        options.responseMapping?.find(
          (res) => res.item === "Message content" || !res.item,
        )?.variableId,
      run: async ({
        credentials: { apiKey },
        options,
        variables,
        sessionStore,
      }) => {
        const context = "While streaming Gemini chat completion";
        if (!apiKey)
          return {
            error: {
              description: "No API key provided",
              context,
            },
          };

        if (!options.model)
          return {
            error: {
              description: "No model provided",
              context,
            },
          };

        if (!options.messages)
          return {
            error: {
              description: "No messages provided",
              context,
            },
          };

        return runChatCompletionStream({
          model: createGoogleGenerativeAI({
            apiKey,
          })(options.model),
          messages: options.messages,
          temperature: options.temperature,
          tools: options.tools,
          isVisionEnabled: true,
          variables,
          responseMapping: options.responseMapping,
          sessionStore,
        });
      },
    },
  },
});
