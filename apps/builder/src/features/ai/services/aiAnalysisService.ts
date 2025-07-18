import { trpc } from "@/lib/queryClient";
import OpenAI from "openai";
import type {
  AnalysisResultWithCache,
  CachedAnalysisResult,
  DetectedElement,
} from "../types";
import {
  computeFileHash,
  createApiKeyHash,
  getFileMetadata,
  isValidImageFile,
} from "./hashUtils";

const analyzeImageWithOpenAI = async (
  imageData: string,
  apiKey: string,
): Promise<DetectedElement[]> => {
  // Use mock response in development to avoid API costs
  // if (process.env.NODE_ENV === "development") {
  //   console.log("🔧 Development mode: Using mock OpenAI response");

  //   // Simulate API delay for realistic testing
  //   await new Promise((resolve) => setTimeout(resolve, 1500));

  //   const content = mockAnalysisResponse.choices[0]?.message?.content;
  //   if (!content) {
  //     throw new Error("No response content from mock response");
  //   }

  //   try {
  //     const parsedResponse = parseJSONResponse(content);
  //     return parsedResponse.elements || [];
  //   } catch (parseError) {
  //     console.error("Failed to parse mock response:", content);
  //     throw new Error(
  //       `Failed to parse mock response: ${parseError instanceof Error ? parseError.message : "Invalid JSON"}`,
  //     );
  //   }
  // }

  // Production: Use real OpenAI API
  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const systemPrompt = `You are a UI analysis expert. Analyze the uploaded image and identify form elements, buttons, and interactive components.

Return ONLY valid JSON in this exact format:
{
  "elements": [
    {
      "type": "text_input" | "number_input" | "email_input" | "phone_input" | "date_input" | "choice" | "rating" | "file_upload" | "text" | "button" | "heading" | "checkbox" | "slider",
      "label": "Label text or null",
      "placeholder": "Placeholder text or null",
      "options": ["option1", "option2", "option3"] | null,
      "confidence": 0.1-1.0,
      "clarificationNeeded": boolean
    }
  ]
}

Guidelines:
- Use "text_input" for general text fields
- Use "number_input" for numeric inputs  
- Use "email_input" for email fields
- Use "phone_input" for phone fields
- Use "date_input" for date/time fields
- Use "choice" for dropdowns, radio buttons, checkboxes, or multiple choice
- Use "rating" for star ratings, scoring, or sliders with numeric scale
- Use "file_upload" for file upload areas
- Use "text" for labels, descriptions, or static text
- Use "button" for clickable buttons
- Use "heading" for titles and headings
- Set "clarificationNeeded" to true if the element could be multiple types
- Include confidence score based on how certain you are about the element type

IMPORTANT for choice elements:
- When you see multiple checkboxes, radio buttons, or options that belong to the same question/group, create ONE "choice" element with ALL options in the "options" array
- For example: if you see checkboxes for "Douleur", "Nausée", "Stress", "Fatigue" under the same question, create ONE choice element with options: ["Douleur", "Nausée", "Stress", "Fatigue"]
- Do NOT create separate choice elements for each option - group them together
- The "label" should be the question text, and "options" should contain all the individual choices
- If there's no clear grouping, you can still list the individual options you see

Note: "checkbox" and "slider" should be mapped to "choice" and "rating" respectively`;

  const userPrompt = `Analyze this form/interface image and identify all interactive elements. Focus on:
1. Input fields (text, email, phone, number, date)
2. Buttons and clickable elements  
3. Choice elements (dropdowns, radio buttons, checkboxes)
4. Text content (headings, labels, descriptions)
5. Any other interactive components

Return only the JSON response as specified in the system prompt.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: userPrompt,
            },
            {
              type: "image_url",
              image_url: {
                url: imageData,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response content from OpenAI");
    }

    try {
      const parsedResponse = parseJSONResponse(content);
      return parsedResponse.elements || [];
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", content);
      throw new Error(
        `Failed to parse OpenAI response: ${parseError instanceof Error ? parseError.message : "Invalid JSON"}`,
      );
    }
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error(
      `OpenAI analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

const parseJSONResponse = (
  content: string,
): { elements: DetectedElement[] } => {
  let jsonContent = content.trim();

  if (jsonContent.startsWith("```json")) {
    jsonContent = jsonContent.replace(/^```json\s*/, "").replace(/\s*```$/, "");
  } else if (jsonContent.startsWith("```")) {
    jsonContent = jsonContent.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }

  jsonContent = jsonContent.trim();

  try {
    return JSON.parse(jsonContent);
  } catch (error) {
    const match = jsonContent.match(/\{[\s\S]*\}/);
    if (match) {
      return JSON.parse(match[0]);
    }
    throw error;
  }
};

const convertFileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
};

/**
 * Checks if there's a cached analysis result for the given file hash and API key.
 * Returns the cached result if found, otherwise returns null.
 */
const checkCachedAnalysis = async (
  fileHash: string,
  apiKeyHash: string,
  workspaceId: string,
): Promise<CachedAnalysisResult | null> => {
  try {
    const cachedResult = await trpc.ai.getCachedAnalysis.query({
      fileHash,
      apiKeyHash,
      workspaceId,
    });
    return cachedResult;
  } catch (error) {
    console.warn("Failed to check cached analysis:", error);
    return null;
  }
};

/**
 * Saves the analysis result to cache for future reuse.
 */
const saveCachedAnalysis = async (
  fileHash: string,
  apiKeyHash: string,
  workspaceId: string,
  metadata: ReturnType<typeof getFileMetadata>,
  analysisResult: DetectedElement[],
): Promise<void> => {
  try {
    await trpc.ai.saveCachedAnalysis.mutate({
      fileHash,
      apiKeyHash,
      workspaceId,
      fileName: metadata.fileName,
      fileSize: metadata.fileSize,
      mimeType: metadata.mimeType,
      analysisResult,
    });
  } catch (error) {
    console.warn("Failed to save cached analysis:", error);
    // Don't throw error as this is not critical to the main flow
  }
};

export const analyzeImageWithCache = async (
  imageFile: File,
  apiKey: string,
  workspaceId: string,
  forceAnalysis = false,
): Promise<AnalysisResultWithCache> => {
  if (!isValidImageFile(imageFile)) {
    throw new Error("Invalid image file format");
  }

  const fileHash = await computeFileHash(imageFile);
  const apiKeyHash = await createApiKeyHash(apiKey);
  const metadata = getFileMetadata(imageFile);

  // Check cache first unless forced to reanalyze
  if (!forceAnalysis) {
    const cachedResult = await checkCachedAnalysis(
      fileHash,
      apiKeyHash,
      workspaceId,
    );
    if (cachedResult) {
      return {
        elements: cachedResult.analysisResult,
        cached: cachedResult,
        fromCache: true,
      };
    }
  }

  // Perform fresh analysis
  const base64Image = await convertFileToBase64(imageFile);
  const elements = await analyzeImageWithOpenAI(base64Image, apiKey);

  // Cache the results for future use
  await saveCachedAnalysis(
    fileHash,
    apiKeyHash,
    workspaceId,
    metadata,
    elements,
  );

  return {
    elements,
    fromCache: false,
  };
};

// Maintain backward compatibility
export const analyzeImage = async (
  imageFile: File,
  apiKey: string,
): Promise<DetectedElement[]> => {
  const base64Image = await convertFileToBase64(imageFile);
  return analyzeImageWithOpenAI(base64Image, apiKey);
};
