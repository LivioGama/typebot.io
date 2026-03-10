// Generate a mock typebot based on the actual filtered elements
import { createId } from "@typebot.io/lib/createId";

export const mockTypebot = ({
  typebotId,
  startEventId,
  processedElements,
  edgeIds,
}: {
  typebotId: string;
  startEventId: string;
  processedElements: any[];
  edgeIds: string[];
}) => {
  // Create one group per element
  const groups = processedElements.map((element, index) => {
    const blockType = element.type;

    // Create the block for this group
    let block;

    if (blockType === "text") {
      block = {
        id: element.blockId,
        type: blockType,
        content: element.content || {
          richText: [
            {
              type: "p",
              children: [{ text: element.label || "Text block" }],
            },
          ],
        },
      };
    } else if (blockType === "choice input") {
      const actualOptions =
        element.options && element.options.length > 0
          ? element.options
          : ["Option 1", "Option 2"];

      // Use enriched field config or fallback to element properties
      const isMultiple =
        element.fieldConfig?.isMultipleChoice ?? element.isMultiple ?? false;

      block = {
        id: element.blockId,
        type: blockType,
        items: actualOptions.map((option: any) => ({
          id: `item_${createId().substring(0, 8)}`,
          content: option,
        })),
        options: {
          variableId: element.variableId,
          isMultipleChoice: isMultiple,
          buttonLabel: element.fieldConfig?.buttonLabel || "Continue",
          isSearchable: element.fieldConfig?.isSearchable || false,
          searchInputPlaceholder:
            element.fieldConfig?.searchInputPlaceholder || "Search options...",
          areInitialSearchButtonsVisible:
            element.fieldConfig?.areInitialSearchButtonsVisible ?? true,
        },
      };
    } else if (blockType === "rating input") {
      block = {
        id: element.blockId,
        type: blockType,
        options: {
          variableId: element.variableId,
          buttonType: element.fieldConfig?.buttonType || "Numbers",
          length: element.fieldConfig?.length || 5,
          startsAt: element.fieldConfig?.startsAt || 1,
          isOneClickSubmitEnabled:
            element.fieldConfig?.isOneClickSubmitEnabled || false,
          labels: {
            button: element.fieldConfig?.labels?.button || "Continue",
            left: element.fieldConfig?.labels?.left,
            right: element.fieldConfig?.labels?.right,
          },
        },
      };
    } else if (blockType === "date input") {
      block = {
        id: element.blockId,
        type: blockType,
        options: {
          variableId: element.variableId,
          hasTime: element.fieldConfig?.hasTime || false,
          isRange: element.fieldConfig?.isRange || false,
          format: element.fieldConfig?.format || "dd/MM/yyyy",
          labels: {
            button: element.fieldConfig?.labels?.button || "Continue",
            from: element.fieldConfig?.labels?.from || "From:",
            to: element.fieldConfig?.labels?.to || "To:",
          },
        },
      };
    } else if (blockType === "file input") {
      block = {
        id: element.blockId,
        type: blockType,
        options: {
          variableId: element.variableId,
          isRequired: element.fieldConfig?.isRequired ?? true,
          isMultipleAllowed: element.fieldConfig?.isMultipleAllowed || false,
          visibility: element.fieldConfig?.visibility || "Auto",
          labels: {
            placeholder:
              element.fieldConfig?.labels?.placeholder ||
              "Click to upload or drag and drop",
            button: element.fieldConfig?.labels?.button || "Upload",
            clear: element.fieldConfig?.labels?.clear || "Clear",
            skip: element.fieldConfig?.labels?.skip,
          },
          allowedFileTypes: element.fieldConfig?.allowedFileTypes,
        },
      };
    } else if (
      [
        "text input",
        "number input",
        "email input",
        "phone number input",
      ].includes(blockType)
    ) {
      const options: any = {
        variableId: element.variableId,
        labels: {
          placeholder:
            element.fieldConfig?.labels?.placeholder ||
            element.placeholder ||
            "Type your answer...",
          button: element.fieldConfig?.labels?.button || "Continue",
        },
      };

      // Add type-specific configurations
      if (blockType === "email input") {
        options.retryMessageContent =
          element.fieldConfig?.retryMessageContent ||
          "Please enter a valid email address";
      } else if (blockType === "phone number input") {
        options.retryMessageContent =
          element.fieldConfig?.retryMessageContent ||
          "Please enter a valid phone number";
        options.defaultCountryCode =
          element.fieldConfig?.defaultCountryCode || "US";
      } else if (blockType === "text input") {
        options.isLong = element.fieldConfig?.isLong || false;
      } else if (blockType === "number input") {
        if (element.fieldConfig?.validation?.min !== undefined) {
          options.min = element.fieldConfig.validation.min;
        }
        if (element.fieldConfig?.validation?.max !== undefined) {
          options.max = element.fieldConfig.validation.max;
        }
        if (element.fieldConfig?.formatting?.style) {
          options.style = element.fieldConfig.formatting.style;
          if (element.fieldConfig.formatting.currency) {
            options.currency = element.fieldConfig.formatting.currency;
          }
        }
      }

      block = {
        id: element.blockId,
        type: blockType,
        options,
      };
    } else {
      block = {
        id: element.blockId,
        type: blockType,
      };
    }

    // Create group with this single block
    return {
      id: element.groupId,
      title: element.label || `${blockType} ${index + 1}`,
      graphCoordinates: { x: 200, y: index * 300 },
      blocks: [block],
    };
  });

  // Create edges to connect groups in sequence
  const edges = [];

  // Connect start event to first group
  if (processedElements.length > 0) {
    edges.push({
      id: `edge_start_${createId().substring(0, 8)}`,
      from: { eventId: startEventId },
      to: { groupId: processedElements[0].groupId },
    });
  }

  // Connect groups to each other in sequence
  for (let i = 0; i < processedElements.length - 1; i++) {
    const edgeId = edgeIds[i] || `edge_${i}_${createId().substring(0, 8)}`;
    edges.push({
      id: edgeId,
      from: { groupId: processedElements[i].groupId },
      to: { groupId: processedElements[i + 1].groupId },
    });
  }

  const mockTypebot = {
    version: "6.1" as const,
    id: typebotId,
    name: "Generated Typebot",
    events: [
      {
        id: startEventId,
        type: "start",
        graphCoordinates: { x: 0, y: 0 },
      },
    ],
    groups,
    edges,
    variables: processedElements
      .filter((element) => element.variableId)
      .map((element) => ({
        id: element.variableId!,
        name: element.variableName || element.variableId!, // Use variableName if available, fallback to variableId
      })),
    selectedThemeTemplateId: null,
    theme: {},
    settings: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    icon: null,
    folderId: null,
    publicId: null,
    customDomain: null,
    workspaceId: "default-workspace",
    resultsTablePreferences: null,
    isArchived: false,
    isClosed: false,
    whatsAppCredentialsId: null,
    riskLevel: null,
  };

  return JSON.stringify(mockTypebot);
};
