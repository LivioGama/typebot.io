import { mockTypebot } from "@/features/ai/services/mockTypebotResponse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createId } from "@typebot.io/lib/createId";
import type { TypebotV6 } from "@typebot.io/typebot/schemas/typebot";
import type { DetectedElement } from "../types"; // Helper function to generate content-aware IDs

// Helper function to generate content-aware IDs
const generateContentAwareId = (
  type: string,
  content?: string | null,
  index?: number,
): string => {
  const baseId = createId();
  const typePrefix = type.replace(/\s+/g, "").toLowerCase();
  const contentHash = content
    ? content
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .substring(0, 8)
    : "";
  const indexSuffix = index !== undefined ? `-${index}` : "";

  return `${typePrefix}_${contentHash}${indexSuffix}_${baseId.substring(0, 8)}`;
};

// Helper function to generate camelCase variable names from element labels
const generateCamelCaseVariableName = (
  element: DetectedElement,
  index: number,
): string => {
  let baseName = element.label || element.type;

  // Clean and convert to camelCase
  const words = baseName
    .toLowerCase()
    // Split on spaces, hyphens, underscores, and other word boundaries
    .split(/[\s\-_,.;:!?()[\]{}'"]+/)
    // Filter out empty strings and common words that add no value
    .filter(
      (word) =>
        word.length > 0 &&
        ![
          "the",
          "a",
          "an",
          "and",
          "or",
          "but",
          "in",
          "on",
          "at",
          "to",
          "for",
          "of",
          "with",
          "by",
        ].includes(word),
    )
    // Take only the first 3-4 meaningful words to keep names concise
    .slice(0, 4);

  if (words.length === 0) {
    // Fallback to element type if no meaningful words found
    baseName = element.type.replace(/\s+/g, "");
  } else {
    // Convert to camelCase: first word lowercase, subsequent words capitalized
    baseName =
      words[0] +
      words
        .slice(1)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("");
  }

  // Ensure it starts with a letter (JavaScript variable naming rule)
  if (!/^[a-zA-Z]/.test(baseName)) {
    baseName = "input" + baseName.charAt(0).toUpperCase() + baseName.slice(1);
  }

  // Add suffix if it's a generic name to make it unique
  if (baseName === "input" || baseName === "field" || baseName === "value") {
    baseName += (index + 1).toString();
  }

  return baseName;
};

// Helper function to generate variable ID based on element
const generateVariableId = (
  element: DetectedElement,
  index: number,
): string => {
  const baseId = createId();
  const cleanLabel = element.label
    ? element.label
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "")
        .substring(0, 12)
    : element.type.replace(/\s+/g, "").toLowerCase();

  return `var_${cleanLabel}_${index}_${baseId.substring(0, 8)}`;
};

const mapElementTypeToBlockType = (elementType: string): string => {
  const typeMapping: Record<string, string> = {
    text_input: "text input",
    number_input: "number input",
    email_input: "email input",
    phone_input: "phone number input",
    date_input: "date input",
    choice: "choice input",
    rating: "rating input",
    file_upload: "file input",
    text: "text",
    button: "choice input", // buttons become choice inputs for selection
    heading: "text",
    checkbox: "choice input", // legacy mapping
    slider: "rating input", // legacy mapping
    textInput: "text input", // camelCase fallback
    numberInput: "number input", // camelCase fallback
    emailInput: "email input", // camelCase fallback
  };

  return typeMapping[elementType] || "text";
};

const parseJSONResponse = (content: string) => {
  // First, try to parse as direct JSON
  try {
    return JSON.parse(content.trim());
  } catch {
    // If that fails, try to extract from markdown code blocks
    const markdownMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (markdownMatch) {
      try {
        return JSON.parse(markdownMatch[1].trim());
      } catch {
        // If still fails, try with additional cleaning
        const cleaned = markdownMatch[1]
          .trim()
          .replace(/\\'/g, "'") // Fix escaped single quotes
          .replace(/\n\s*\/\/.*$/gm, ""); // Remove any comment lines
        return JSON.parse(cleaned);
      }
    }

    // Legacy fallback for simple markdown blocks
    let jsonContent = content.trim();
    if (jsonContent.startsWith("```json")) {
      jsonContent = jsonContent
        .replace(/^```json\s*/, "")
        .replace(/\s*```$/, "");
    } else if (jsonContent.startsWith("```")) {
      jsonContent = jsonContent.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    // Last resort: try cleaning and parsing
    const cleaned = jsonContent.trim().replace(/\\'/g, "'");

    try {
      return JSON.parse(cleaned);
    } catch (error) {
      console.error("Failed to parse JSON:", content);
      throw new Error(
        `Invalid JSON response: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }
};

const generateWithOpenAI = async (
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
): Promise<string> => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(
      `OpenAI API error: ${errorData.error?.message || "Unknown error"}`,
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response content from OpenAI");
  }

  return content;
};

const generateWithGemini = async (
  systemPrompt: string,
  userPrompt: string,
  apiKey: string,
): Promise<string> => {
  const genAI = new GoogleGenerativeAI(apiKey);

  // Use structured output to ensure clean JSON response from Gemini
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-pro",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const combinedPrompt = `${systemPrompt}\n\n${userPrompt}`;

  try {
    const result = await model.generateContent(combinedPrompt);
    const response = result.response;
    const content = response.text();

    if (!content) {
      throw new Error("No response content from Gemini");
    }

    return content;
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(
      `Gemini API error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

export const generateTypebot = async (
  elements: DetectedElement[],
  apiKey: string,
  provider: "openai" | "gemini" = "openai",
): Promise<TypebotV6> => {
  const typebotId = createId();
  const startEventId = createId();

  // Pre-generate consistent IDs for elements, groups, and variables
  const processedElements = elements.map((element, index) => {
    const blockType = mapElementTypeToBlockType(element.type);
    const blockId = generateContentAwareId(blockType, element.label, index);
    const groupId = generateContentAwareId("group", element.label, index);
    const hasVariable = [
      "text input",
      "number input",
      "email input",
      "phone number input",
      "date input",
      "choice input",
      "rating input",
      "file input",
    ].includes(blockType);

    const variableId = hasVariable
      ? generateVariableId(element, index)
      : undefined;
    const variableName = hasVariable
      ? generateCamelCaseVariableName(element, index)
      : undefined;

    return {
      ...element,
      type: blockType,
      blockId,
      groupId,
      variableId,
      variableName,
      index,
    };
  });

  // Generate edge IDs for connecting groups
  const edgeIds = processedElements
    .slice(0, -1)
    .map((_, index) => generateContentAwareId("edge", `flow_${index}`, index));

  const systemPrompt = `You are a Typebot generator. Create a complete TypebotV6 JSON structure based on the detected form elements.

CRITICAL: Use the EXACT IDs provided in the user prompt for ALL blocks, groups, variables, and edges. Do not generate your own IDs.

Important requirements:
1. ALWAYS include ALL required fields with correct structure
2. version MUST be exactly "6.1" (string)
3. events MUST be an array with at least one START event
4. groups MUST have title, graphCoordinates {x, y}, and blocks array
5. Each group MUST contain exactly ONE block
6. blocks MUST have id and type fields at minimum
7. Use the exact block, group, variable, and edge IDs provided in the user prompt
8. Include proper variables, theme, settings
9. Create edges to connect groups in sequence (first group to second, second to third, etc.)

Required structure template:
{
  "version": "6.1",
  "id": "${typebotId}",
  "name": "Generated Typebot",
  "events": [{"id": "${startEventId}", "type": "start", "graphCoordinates": {"x": 0, "y": 0}}],
  "groups": [
    {
      "id": "EXACT_GROUP_ID_FROM_USER_PROMPT", 
      "title": "Question 1", 
      "graphCoordinates": {"x": 200, "y": 0}, 
      "blocks": [
        {"id": "EXACT_BLOCK_ID_FROM_USER_PROMPT", "type": "text", "content": {"richText": [{"type": "p", "children": [{"text": "Welcome!"}]}]}}
      ]
    },
    {
      "id": "EXACT_GROUP_ID_FROM_USER_PROMPT_2", 
      "title": "Question 2", 
      "graphCoordinates": {"x": 200, "y": 300}, 
      "blocks": [
        {"id": "EXACT_BLOCK_ID_FROM_USER_PROMPT_2", "type": "text input", "options": {"variableId": "EXACT_VARIABLE_ID_FROM_USER_PROMPT"}}
      ]
    }
  ],
  "edges": [
    {"id": "EXACT_EDGE_ID_FROM_USER_PROMPT", "from": {"groupId": "EXACT_GROUP_ID_1"}, "to": {"groupId": "EXACT_GROUP_ID_2"}}
  ],
  "variables": [{"id": "EXACT_VARIABLE_ID_FROM_USER_PROMPT", "name": "Variable Name"}],
  "theme": {},
  "settings": {},
  "createdAt": "${new Date().toISOString()}",
  "updatedAt": "${new Date().toISOString()}",
  "icon": null,
  "folderId": null,
  "publicId": null,
  "customDomain": null,
  "workspaceId": "default-workspace",
  "resultsTablePreferences": null,
  "isArchived": false,
  "isClosed": false,
  "whatsAppCredentialsId": null,
  "riskLevel": null
}

Block types (use EXACT type strings):
- text: {"id": "EXACT_ID", "type": "text", "content": {"richText": [{"type": "p", "children": [{"text": "..."}]}]}}
- text input: {"id": "EXACT_ID", "type": "text input", "options": {"variableId": "EXACT_VARIABLE_ID", "labels": {"placeholder": "...", "button": "Continue"}, "isLong": false}}  
- number input: {"id": "EXACT_ID", "type": "number input", "options": {"variableId": "EXACT_VARIABLE_ID", "labels": {"placeholder": "...", "button": "Continue"}, "min": 0, "max": 100}}
- email input: {"id": "EXACT_ID", "type": "email input", "options": {"variableId": "EXACT_VARIABLE_ID", "labels": {"placeholder": "Enter your email address", "button": "Continue"}, "retryMessageContent": "Please enter a valid email address"}}
- phone number input: {"id": "EXACT_ID", "type": "phone number input", "options": {"variableId": "EXACT_VARIABLE_ID", "labels": {"placeholder": "Enter your phone number", "button": "Continue"}, "retryMessageContent": "Please enter a valid phone number", "defaultCountryCode": "US"}}
- date input: {"id": "EXACT_ID", "type": "date input", "options": {"variableId": "EXACT_VARIABLE_ID", "labels": {"button": "Continue", "from": "From:", "to": "To:"}, "hasTime": false, "isRange": false, "format": "dd/MM/yyyy"}}
- choice input: {"id": "EXACT_ID", "type": "choice input", "items": [{"id": "UNIQUE_ITEM_ID", "content": "Option"}], "options": {"variableId": "EXACT_VARIABLE_ID", "isMultipleChoice": false, "buttonLabel": "Continue", "isSearchable": false}}
- rating input: {"id": "EXACT_ID", "type": "rating input", "options": {"variableId": "EXACT_VARIABLE_ID", "buttonType": "Numbers", "length": 5, "startsAt": 1, "labels": {"button": "Continue"}}}
- file input: {"id": "EXACT_ID", "type": "file input", "options": {"variableId": "EXACT_VARIABLE_ID", "isRequired": true, "isMultipleAllowed": false, "visibility": "Auto", "labels": {"placeholder": "Click to upload or drag and drop", "button": "Upload"}}}
- image: {"id": "EXACT_ID", "type": "image", "content": {"url": "..."}}

CRITICAL FIELD CONFIGURATION:
- Each element comes with enriched fieldConfig containing intelligent defaults based on the field type and context
- Use these fieldConfig properties to create well-configured blocks with proper placeholders, validation, formatting, and user experience
- For text inputs: use fieldConfig.isLong for textarea vs input, fieldConfig.labels.placeholder for smart placeholders
- For choice inputs: use fieldConfig.isMultipleChoice, fieldConfig.isSearchable, fieldConfig.searchInputPlaceholder
- For rating inputs: use fieldConfig.buttonType ("Numbers"/"Icons"), fieldConfig.length, fieldConfig.startsAt, fieldConfig.labels.left/right
- For date inputs: use fieldConfig.hasTime, fieldConfig.isRange, fieldConfig.format
- For file inputs: use fieldConfig.isMultipleAllowed, fieldConfig.allowedFileTypes, fieldConfig.labels
- For email/phone inputs: use fieldConfig.retryMessageContent, fieldConfig.defaultCountryCode
- For number inputs: use fieldConfig.validation.min/max, fieldConfig.formatting.style/currency

CRITICAL FLOW STRUCTURE:
- Create ONE group per element
- Each group contains exactly ONE block
- Position groups vertically: first group at y=0, second at y=300, third at y=600, etc.
- Connect groups with edges in sequence: group 1 → group 2 → group 3, etc.
- Use meaningful group titles based on the element label/content

Edge structure:
{"id": "EXACT_EDGE_ID", "from": {"groupId": "SOURCE_GROUP_ID"}, "to": {"groupId": "TARGET_GROUP_ID"}}

CRITICAL: 
- Use spaces in type names exactly as shown (e.g., "text input" not "textInput")
- For choice input: items array goes at block level, NOT inside options
- For variables: use format {"id": "exact-variable-id", "name": "exactCamelCaseName"} - use the EXACT variableName provided in the user prompt for each element (these follow JavaScript camelCase naming conventions)
- For choice input items: generate unique IDs using createId pattern (e.g., "item_${createId().substring(0, 8)}")
- ALWAYS use the fieldConfig properties from each element to create intelligent, well-configured blocks

Return ONLY valid JSON, no markdown or explanations.`;

  const userPrompt = `Create a complete Typebot using these EXACT IDs and elements:

Typebot ID: ${typebotId}
Start Event ID: ${startEventId}

Elements with their assigned IDs and enriched configurations:
${JSON.stringify(processedElements, null, 2)}

Edge IDs for connecting groups in sequence:
${JSON.stringify(edgeIds, null, 2)}

IMPORTANT: Each element includes enriched fieldConfig properties with intelligent defaults based on field type and context. Use these configurations to create well-configured blocks:

Make sure to:
1. Create ONE group per element using the EXACT groupId for each element
2. Place each element's block in its corresponding group using the EXACT blockId
3. Use the EXACT variableId for input blocks in their "options.variableId" field
4. Create corresponding variables using the exact variableId and the EXACT variableName provided (these are pre-generated camelCase names following JavaScript naming conventions)
5. For choice input blocks, include an "items" array with choice options using unique generated item IDs
6. For text blocks, include "content" with "richText" array containing proper paragraph structure
7. Position groups vertically with 300px spacing: y=0, y=300, y=600, etc.
8. Create edges to connect groups in sequence using the provided edge IDs
9. Give each group a meaningful title based on the element's label or type
10. CRITICAL: Use the fieldConfig properties from each element to set proper block options (placeholders, validation, formatting, etc.)

Group positioning pattern:
- Group 0: {"x": 200, "y": 0}
- Group 1: {"x": 200, "y": 300}
- Group 2: {"x": 200, "y": 600}
- Group N: {"x": 200, "y": ${300 * "N"}}

Edge connection pattern:
- Edge 0: connects Group 0 → Group 1
- Edge 1: connects Group 1 → Group 2
- Edge N: connects Group N → Group N+1

Example with enriched configurations:
For a text input element with fieldConfig containing labels.placeholder="Enter your name", isLong=false, validation.required=true:
{
  "id": "EXACT_BLOCK_ID_FROM_LIST",
  "type": "text input", 
  "options": {
    "variableId": "EXACT_VARIABLE_ID_FROM_LIST",
    "labels": {
      "placeholder": "Enter your name",
      "button": "Continue"
    },
    "isLong": false
  }
}

For a choice input with fieldConfig containing isMultipleChoice=true, isSearchable=true:
{
  "id": "EXACT_BLOCK_ID_FROM_LIST",
  "type": "choice input", 
  "items": [
    {"id": "item_abc123de", "content": "Option 1"},
    {"id": "item_xyz789fg", "content": "Option 2"}
  ],
  "options": {
    "variableId": "EXACT_VARIABLE_ID_FROM_LIST",
    "isMultipleChoice": true,
    "isSearchable": true,
    "buttonLabel": "Continue"
  }
}`;

  try {
    console.log(
      `🚀 Starting ${provider.toUpperCase()} typebot generation for ${elements.length} elements...`,
    );
    const generationStartTime = performance.now();

    // Use mock response in development to avoid API costs
    if (process.env.NODE_ENV === "development") {
      console.log("🔧 Development mode: Using mock generation");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const mockResult = JSON.parse(
        mockTypebot({
          typebotId,
          startEventId,
          processedElements,
          edgeIds,
        }),
      );

      const mockTime = (
        (performance.now() - generationStartTime) /
        1000
      ).toFixed(1);
      console.log(`✅ Mock generation completed in ${mockTime}s`);
      return mockResult;
    }

    // Production: Use selected AI provider
    console.log(
      `🤖 Calling ${provider.toUpperCase()} API for typebot generation...`,
    );
    const apiStartTime = performance.now();

    const content =
      provider === "gemini"
        ? await generateWithGemini(systemPrompt, userPrompt, apiKey)
        : await generateWithOpenAI(systemPrompt, userPrompt, apiKey);

    const apiTime = ((performance.now() - apiStartTime) / 1000).toFixed(1);
    console.log(
      `📡 ${provider.toUpperCase()} API call completed in ${apiTime}s`,
    );
    console.log(`📋 Parsing and validating generated typebot...`);

    try {
      const parsedContent = parseJSONResponse(content);

      // Enhanced validation with ID consistency checks
      if (!parsedContent.version) {
        throw new Error("Missing required field: version");
      }
      if (!parsedContent.id) {
        throw new Error("Missing required field: id");
      }
      if (parsedContent.id !== typebotId) {
        throw new Error(
          `Typebot ID mismatch: expected ${typebotId}, got ${parsedContent.id}`,
        );
      }
      if (!parsedContent.groups || !Array.isArray(parsedContent.groups)) {
        throw new Error("Missing or invalid groups array");
      }
      if (!parsedContent.events || !Array.isArray(parsedContent.events)) {
        throw new Error("Missing or invalid events array");
      }

      // Validate groups structure with ID consistency
      for (const group of parsedContent.groups) {
        if (!group.id) {
          throw new Error("Group missing id field");
        }
        if (!group.title) {
          throw new Error("Group missing title field");
        }
        if (
          !group.graphCoordinates ||
          typeof group.graphCoordinates.x !== "number" ||
          typeof group.graphCoordinates.y !== "number"
        ) {
          throw new Error("Group missing or invalid graphCoordinates");
        }
        if (!group.blocks || !Array.isArray(group.blocks)) {
          throw new Error("Group missing or invalid blocks array");
        }

        // Validate each group has exactly one block
        if (group.blocks.length !== 1) {
          throw new Error(
            `Group ${group.id} should have exactly one block, got ${group.blocks.length}`,
          );
        }

        // Validate block IDs match our generated ones
        group.blocks.forEach((block: any, index: number) => {
          if (!block.id) {
            throw new Error(`Block ${index} missing id field`);
          }
          const expectedElement = processedElements.find(
            (el) => el.blockId === block.id,
          );
          if (!expectedElement) {
            console.warn(`Block ID ${block.id} not found in expected elements`);
          }
        });
      }

      // Validate events structure with ID consistency
      for (const event of parsedContent.events) {
        if (!event.id) {
          throw new Error("Event missing id field");
        }
        if (!event.type) {
          throw new Error("Event missing type field");
        }
        if (
          !event.graphCoordinates ||
          typeof event.graphCoordinates.x !== "number" ||
          typeof event.graphCoordinates.y !== "number"
        ) {
          throw new Error("Event missing or invalid graphCoordinates");
        }
      }

      // Ensure all required fields have defaults
      const typebot = {
        ...parsedContent,
        createdAt: parsedContent.createdAt || new Date().toISOString(),
        updatedAt: parsedContent.updatedAt || new Date().toISOString(),
        icon: parsedContent.icon !== undefined ? parsedContent.icon : null,
        folderId:
          parsedContent.folderId !== undefined ? parsedContent.folderId : null,
        publicId:
          parsedContent.publicId !== undefined ? parsedContent.publicId : null,
        customDomain:
          parsedContent.customDomain !== undefined
            ? parsedContent.customDomain
            : null,
        workspaceId: parsedContent.workspaceId || "default-workspace",
        resultsTablePreferences:
          parsedContent.resultsTablePreferences !== undefined
            ? parsedContent.resultsTablePreferences
            : null,
        isArchived: parsedContent.isArchived || false,
        isClosed: parsedContent.isClosed || false,
        whatsAppCredentialsId:
          parsedContent.whatsAppCredentialsId !== undefined
            ? parsedContent.whatsAppCredentialsId
            : null,
        riskLevel:
          parsedContent.riskLevel !== undefined
            ? parsedContent.riskLevel
            : null,
        edges: parsedContent.edges || [],
        variables: parsedContent.variables || [],
        theme: parsedContent.theme || {},
        settings: parsedContent.settings || {},
      };

      const totalTime = (
        (performance.now() - generationStartTime) /
        1000
      ).toFixed(1);
      console.log(
        `✅ ${provider.toUpperCase()} typebot generation completed successfully in ${totalTime}s`,
      );
      console.log(
        `📊 Generated typebot with ${typebot.groups.length} groups, ${typebot.variables.length} variables, ${typebot.events.length} events`,
      );

      return typebot as TypebotV6;
    } catch (parseError: any) {
      console.error("Failed to parse OpenAI response:", content);
      if (parseError instanceof SyntaxError) {
        throw new Error("Invalid JSON syntax in generated response");
      }
      throw new Error(`Typebot validation failed: ${parseError.message}`);
    }
  } catch (error) {
    console.error("Typebot generation error:", error);
    throw error;
  }
};
