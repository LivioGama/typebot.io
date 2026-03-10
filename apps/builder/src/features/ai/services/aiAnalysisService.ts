import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import type { DetectedElement } from "../types";
import { getCachedAnalysis, setCachedAnalysis } from "./localImageCache";

/**
 * Validates if a file is a supported image format for AI analysis
 */
const isValidImageFile = (file: File): boolean => {
  const supportedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/bmp",
    "image/avif",
  ];
  return supportedTypes.includes(file.type);
};

/**
 * Creates a simple hash for text prompts to use in caching
 */
const createTextHash = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
};

const analyzeTextPromptWithOpenAI = async (
  textPrompt: string,
  apiKey: string,
): Promise<DetectedElement[]> => {
  const openai = new OpenAI({
    apiKey,
    dangerouslyAllowBrowser: true,
  });

  const systemPrompt = `You are a UI/UX expert and form builder specialist. Based on the user's text description, analyze and identify the form elements, components, and user flow they want to create.

Return ONLY valid JSON in this exact format:
{
  "elements": [
    {
      "type": "text_input" | "number_input" | "email_input" | "phone_input" | "date_input" | "choice" | "rating" | "file_upload" | "text" | "button" | "heading",
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
- Use "text" for labels, descriptions, welcome messages, or static text
- Use "button" for clickable buttons or CTAs
- Use "heading" for titles and headings
- Set "clarificationNeeded" to true if the element could be multiple types
- Include confidence score based on how certain you are about the element type
- For choice elements, include all options in the "options" array
- Create logical flow: welcome message → form fields → thank you message/button
- Infer common form patterns and best practices`;

  const userPrompt = `Based on this description, identify all the form elements, messages, and components needed:

"${textPrompt}"

Analyze this and create a comprehensive list of elements that would make up this typebot/form. Include welcome messages, all form fields mentioned or implied, navigation buttons, and closing messages. Return only the JSON response as specified.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response content from OpenAI");
    }

    try {
      const parsedResponse = parseJSONResponse(content);
      const elements = parsedResponse.elements || [];
      return enrichElementsWithSmartDefaults(elements);
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

const analyzeTextPromptWithGemini = async (
  textPrompt: string,
  apiKey: string,
): Promise<DetectedElement[]> => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash-exp",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const systemPrompt = `You are a UI/UX expert and form builder specialist. Based on the user's text description, analyze and identify the form elements, components, and user flow they want to create.

Return ONLY valid JSON in this exact format:
{
  "elements": [
    {
      "type": "text_input" | "number_input" | "email_input" | "phone_input" | "date_input" | "choice" | "rating" | "file_upload" | "text" | "button" | "heading",
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
- Use "text" for labels, descriptions, welcome messages, or static text
- Use "button" for clickable buttons or CTAs
- Use "heading" for titles and headings
- Set "clarificationNeeded" to true if the element could be multiple types
- Include confidence score based on how certain you are about the element type
- For choice elements, include all options in the "options" array
- Create logical flow: welcome message → form fields → thank you message/button
- Infer common form patterns and best practices`;

  const userPrompt = `Based on this description, identify all the form elements, messages, and components needed:

"${textPrompt}"

Analyze this and create a comprehensive list of elements that would make up this typebot/form. Include welcome messages, all form fields mentioned or implied, navigation buttons, and closing messages. Return only the JSON response as specified.`;

  try {
    const result = await model.generateContent([
      systemPrompt + "\n\n" + userPrompt,
    ]);
    const response = result.response;
    const content = response.text();

    if (!content) {
      throw new Error("No response content from Gemini");
    }

    try {
      const parsedResponse = parseJSONResponse(content);
      const elements = parsedResponse.elements || [];
      return enrichElementsWithSmartDefaults(elements);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", content);
      throw new Error(
        `Failed to parse Gemini response: ${parseError instanceof Error ? parseError.message : "Invalid JSON"}`,
      );
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(
      `Gemini analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Caches text prompt analysis results
 */
const getCachedTextAnalysis = async (
  textPrompt: string,
  provider: "openai" | "gemini",
  apiKey: string,
): Promise<DetectedElement[] | null> => {
  try {
    const textHash = createTextHash(textPrompt);
    const cacheKey = `text-analysis-${textHash}-${provider}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      const parsedCache = JSON.parse(cached);
      // Check if cache is less than 24 hours old
      const cacheAge = Date.now() - new Date(parsedCache.timestamp).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (cacheAge < maxAge) {
        return parsedCache.elements;
      } else {
        localStorage.removeItem(cacheKey);
      }
    }

    return null;
  } catch (error) {
    console.warn("Failed to retrieve cached text analysis:", error);
    return null;
  }
};

/**
 * Saves text prompt analysis results to cache
 */
const setCachedTextAnalysis = async (
  textPrompt: string,
  provider: "openai" | "gemini",
  apiKey: string,
  elements: DetectedElement[],
): Promise<void> => {
  try {
    const textHash = createTextHash(textPrompt);
    const cacheKey = `text-analysis-${textHash}-${provider}`;
    const cacheData = {
      elements,
      timestamp: new Date().toISOString(),
      provider,
    };

    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.warn("Failed to cache text analysis:", error);
  }
};

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
      const elements = parsedResponse.elements || [];
      return enrichElementsWithSmartDefaults(elements);
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

const analyzeImageWithGemini = async (
  imageData: string,
  apiKey: string,
): Promise<DetectedElement[]> => {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
    },
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
    // Convert base64 data URL to just base64 data
    const base64Data = imageData.split(",")[1] || imageData;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: "image/png",
      },
    };

    const result = await model.generateContent([userPrompt, imagePart]);
    const response = result.response;
    const content = response.text();

    if (!content) {
      throw new Error("No response content from Gemini");
    }

    try {
      // Gemini might return different response formats, handle both
      let parsedResponse;
      try {
        parsedResponse = parseJSONResponse(content);

        // Debug logging to understand what Gemini returns
        console.log("Gemini raw response structure:", {
          hasElements: !!parsedResponse.elements,
          isArray: Array.isArray(parsedResponse),
          keys: Object.keys(parsedResponse),
          type: typeof parsedResponse,
        });
      } catch (initialParseError) {
        // If parseJSONResponse fails, try parsing as direct JSON
        try {
          const directParsed = JSON.parse(content);
          // If it's an array, convert to expected format
          if (Array.isArray(directParsed)) {
            parsedResponse = { elements: directParsed };
          } else {
            parsedResponse = directParsed;
          }
        } catch (directParseError) {
          console.error("Failed to parse Gemini response:", content);
          throw new Error(
            `Failed to parse Gemini response: ${initialParseError instanceof Error ? initialParseError.message : "Invalid JSON"}`,
          );
        }
      }

      // Convert Gemini's detailed format to our expected DetectedElement format
      const elementsArray =
        parsedResponse.elements ||
        (Array.isArray(parsedResponse) ? parsedResponse : []);

      // If Gemini didn't follow the expected format, try to extract what we can
      if (!Array.isArray(elementsArray)) {
        console.warn(
          "Gemini returned unexpected response format:",
          parsedResponse,
        );

        // Check if Gemini provided some kind of description instead
        if (parsedResponse.form_description || parsedResponse.description) {
          console.warn(
            "Gemini returned a description instead of structured elements:",
            parsedResponse.form_description || parsedResponse.description,
          );
        }

        // For now, return empty array - in the future we could try to parse the description
        console.warn(
          "Expected format: { elements: [...] }, got:",
          typeof parsedResponse,
        );
        console.warn(
          "Returning empty elements array. Consider re-analyzing the image.",
        );
        return [];
      }

      const elements = elementsArray
        .map((item: any): DetectedElement => {
          // Map Gemini's element types to our supported types
          let type: DetectedElement["type"];

          if (item.type === "text_input") {
            if (item.input_type === "email") type = "email_input";
            else if (item.input_type === "tel") type = "phone_input";
            else if (item.input_type === "number") type = "number_input";
            else type = "text_input";
          } else if (
            ["choice", "dropdown", "radio_group", "checkbox"].includes(
              item.type,
            )
          ) {
            type = "choice";
          } else if (["rating", "rating_input"].includes(item.type)) {
            type = "rating";
          } else if (item.type === "file_upload") {
            type = "file_upload";
          } else if (item.type === "button") {
            type = "button";
          } else if (item.type === "heading") {
            type = "heading";
          } else {
            type = "text";
          }

          return {
            type,
            label: item.label || item.text || null,
            placeholder: item.placeholder || null,
            options:
              item.options ||
              (item.type === "radio_group" && item.options
                ? item.options.map((opt: any) => opt.label || opt.value || opt)
                : null),
            confidence: item.confidence || 0.8,
            clarificationNeeded:
              item.clarificationNeeded ||
              item.type === "choice" ||
              item.type === "dropdown" ||
              item.type === "radio_group",
            isMultiple: item.isMultiple || item.type === "checkbox",
          };
        })
        .filter(
          (element: DetectedElement) =>
            // Filter out elements that don't add value or are duplicates
            element.type !== "text" ||
            (element.label && element.label.trim().length > 0),
        );

      return enrichElementsWithSmartDefaults(elements);
    } catch (parseError) {
      console.error("Failed to parse Gemini response:", content);
      throw new Error(
        `Failed to parse Gemini response: ${parseError instanceof Error ? parseError.message : "Invalid JSON"}`,
      );
    }
  } catch (error) {
    console.error("Gemini API error:", error);
    throw new Error(
      `Gemini API error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

const parseJSONResponse = (
  content: string,
): { elements: DetectedElement[] } => {
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
      // Final fallback: try to extract just the JSON object
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]);
        } catch {
          console.error("Failed to parse JSON from analysis service:", content);
          throw new Error(
            `Invalid JSON response from analysis service: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
        }
      }
      throw error;
    }
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
 * Enriches detected elements with intelligent field configurations and defaults
 * based on field type, context, and form best practices
 */
const enrichElementsWithSmartDefaults = (
  elements: DetectedElement[],
): DetectedElement[] => {
  return elements.map((element, index) => {
    const enrichedElement = { ...element };

    // Add field-specific configurations based on type
    switch (element.type) {
      case "text_input":
        enrichedElement.fieldConfig = {
          placeholder:
            element.placeholder || inferPlaceholder(element.label, "text"),
          isRequired: inferIsRequired(element.label, index, elements.length),
          labels: {
            placeholder:
              element.placeholder || inferPlaceholder(element.label, "text"),
            button: "Continue",
          },
          isLong: inferIsLongText(element.label),
          validation: inferTextValidation(element.label),
        };
        break;

      case "email_input":
        enrichedElement.fieldConfig = {
          placeholder: element.placeholder || "Enter your email address",
          isRequired: true, // Email is almost always required
          labels: {
            placeholder: element.placeholder || "Enter your email address",
            button: "Continue",
          },
          retryMessageContent: "Please enter a valid email address",
          validation: { required: true, format: "email" },
        };
        break;

      case "phone_input":
        enrichedElement.fieldConfig = {
          placeholder: element.placeholder || "Enter your phone number",
          isRequired: inferIsRequired(element.label, index, elements.length),
          labels: {
            placeholder: element.placeholder || "Enter your phone number",
            button: "Continue",
          },
          retryMessageContent: "Please enter a valid phone number",
          defaultCountryCode: "US", // Default, can be customized
          validation: {
            required: inferIsRequired(element.label, index, elements.length),
          },
        };
        break;

      case "number_input":
        enrichedElement.fieldConfig = {
          placeholder:
            element.placeholder || inferPlaceholder(element.label, "number"),
          isRequired: inferIsRequired(element.label, index, elements.length),
          labels: {
            placeholder:
              element.placeholder || inferPlaceholder(element.label, "number"),
            button: "Continue",
          },
          validation: inferNumberValidation(element.label),
          formatting: inferNumberFormatting(element.label),
        };
        break;

      case "date_input":
        enrichedElement.fieldConfig = {
          placeholder: element.placeholder || "Select date",
          isRequired: inferIsRequired(element.label, index, elements.length),
          labels: {
            button: "Continue",
            from: "From:",
            to: "To:",
          },
          format: "dd/MM/yyyy",
          hasTime: inferNeedsTime(element.label),
          isRange: inferIsDateRange(element.label),
          validation: {
            required: inferIsRequired(element.label, index, elements.length),
          },
        };
        break;

      case "choice":
        const isMultiple = inferIsMultipleChoice(
          element.label,
          element.options,
        );
        enrichedElement.fieldConfig = {
          isMultipleChoice: isMultiple,
          isRequired: inferIsRequired(element.label, index, elements.length),
          buttonLabel: "Continue",
          isSearchable: inferNeedsSearch(element.options),
          searchInputPlaceholder: "Search options...",
          areInitialSearchButtonsVisible: true,
          validation: {
            required: inferIsRequired(element.label, index, elements.length),
          },
        };
        enrichedElement.isMultiple = isMultiple;
        break;

      case "rating":
        enrichedElement.fieldConfig = {
          buttonType: inferRatingType(element.label),
          length: inferRatingLength(element.label),
          startsAt: inferRatingStartsAt(element.label),
          isRequired: inferIsRequired(element.label, index, elements.length),
          labels: {
            button: "Continue",
            left: inferRatingLeftLabel(element.label),
            right: inferRatingRightLabel(element.label),
          },
          isOneClickSubmitEnabled: false,
          validation: {
            required: inferIsRequired(element.label, index, elements.length),
          },
        };
        break;

      case "file_upload":
        enrichedElement.fieldConfig = {
          isRequired: inferIsRequired(element.label, index, elements.length),
          isMultipleAllowed: inferAllowsMultipleFiles(element.label),
          visibility: "Auto",
          labels: {
            placeholder: "Click to upload or drag and drop",
            button: "Upload",
            clear: "Clear",
            skip: inferIsRequired(element.label, index, elements.length)
              ? undefined
              : "Skip",
          },
          allowedFileTypes: inferAllowedFileTypes(element.label),
          validation: {
            required: inferIsRequired(element.label, index, elements.length),
          },
        };
        break;

      case "text":
        // For text blocks, enrich with better content structure
        enrichedElement.content = {
          richText: [
            {
              type: "p",
              children: [{ text: element.label || "Welcome!" }],
            },
          ],
        };
        break;

      case "button":
        enrichedElement.content = element.label || "Continue";
        break;

      case "heading":
        enrichedElement.content = {
          richText: [
            {
              type: "h1",
              children: [{ text: element.label || "Form Title" }],
            },
          ],
        };
        break;
    }

    return enrichedElement;
  });
};

// Helper functions for intelligent inference

const inferPlaceholder = (label: string | null, fieldType: string): string => {
  if (!label) {
    return fieldType === "number" ? "Enter a number" : "Type your answer";
  }

  const lowerLabel = label.toLowerCase();

  // Common field patterns
  if (lowerLabel.includes("name")) return "Enter your name";
  if (lowerLabel.includes("company") || lowerLabel.includes("organization"))
    return "Enter company name";
  if (lowerLabel.includes("title") || lowerLabel.includes("position"))
    return "Enter your title";
  if (lowerLabel.includes("message") || lowerLabel.includes("comment"))
    return "Type your message";
  if (lowerLabel.includes("address")) return "Enter your address";
  if (lowerLabel.includes("city")) return "Enter city";
  if (lowerLabel.includes("age")) return "Enter your age";
  if (lowerLabel.includes("phone")) return "Enter your phone number";
  if (lowerLabel.includes("email")) return "Enter your email address";

  if (fieldType === "number") {
    if (lowerLabel.includes("age")) return "Enter your age";
    if (lowerLabel.includes("year")) return "Enter year";
    if (lowerLabel.includes("amount") || lowerLabel.includes("price"))
      return "Enter amount";
    return "Enter a number";
  }

  return `Enter ${label.toLowerCase()}`;
};

const inferIsRequired = (
  label: string | null,
  index: number,
  totalElements: number,
): boolean => {
  if (!label) return false;

  const lowerLabel = label.toLowerCase();

  // Always required fields
  if (
    lowerLabel.includes("email") ||
    lowerLabel.includes("name") ||
    lowerLabel.includes("required")
  ) {
    return true;
  }

  // Optional indicators
  if (
    lowerLabel.includes("optional") ||
    lowerLabel.includes("if you want") ||
    lowerLabel.includes("comment")
  ) {
    return false;
  }

  // First few fields in a form are usually required
  if (index < Math.min(3, Math.floor(totalElements * 0.6))) {
    return true;
  }

  return false; // Default to optional
};

const inferIsLongText = (label: string | null): boolean => {
  if (!label) return false;

  const lowerLabel = label.toLowerCase();
  return (
    lowerLabel.includes("message") ||
    lowerLabel.includes("comment") ||
    lowerLabel.includes("description") ||
    lowerLabel.includes("details") ||
    lowerLabel.includes("explain") ||
    lowerLabel.includes("tell us")
  );
};

const inferTextValidation = (label: string | null) => {
  if (!label) return {};

  const lowerLabel = label.toLowerCase();
  const validation: any = {};

  if (lowerLabel.includes("name")) {
    validation.minLength = 2;
    validation.pattern = "letters";
  }

  return validation;
};

const inferNumberValidation = (label: string | null) => {
  if (!label) return {};

  const lowerLabel = label.toLowerCase();
  const validation: any = {};

  if (lowerLabel.includes("age")) {
    validation.min = 1;
    validation.max = 120;
  }

  if (lowerLabel.includes("year")) {
    validation.min = 1900;
    validation.max = new Date().getFullYear() + 10;
  }

  if (lowerLabel.includes("rating") || lowerLabel.includes("score")) {
    validation.min = 1;
    validation.max = 10;
  }

  return validation;
};

const inferNumberFormatting = (label: string | null) => {
  if (!label) return {};

  const lowerLabel = label.toLowerCase();
  const formatting: any = {};

  if (
    lowerLabel.includes("price") ||
    lowerLabel.includes("amount") ||
    lowerLabel.includes("cost")
  ) {
    formatting.style = "currency";
    formatting.currency = "USD";
  }

  if (lowerLabel.includes("percent")) {
    formatting.style = "percent";
  }

  return formatting;
};

const inferNeedsTime = (label: string | null): boolean => {
  if (!label) return false;

  const lowerLabel = label.toLowerCase();
  return (
    lowerLabel.includes("time") ||
    lowerLabel.includes("appointment") ||
    lowerLabel.includes("meeting") ||
    lowerLabel.includes("schedule")
  );
};

const inferIsDateRange = (label: string | null): boolean => {
  if (!label) return false;

  const lowerLabel = label.toLowerCase();
  return (
    (lowerLabel.includes("from") && lowerLabel.includes("to")) ||
    lowerLabel.includes("between") ||
    lowerLabel.includes("range") ||
    lowerLabel.includes("period")
  );
};

const inferIsMultipleChoice = (
  label: string | null,
  options: string[] | null,
): boolean => {
  if (!label) return false;

  const lowerLabel = label.toLowerCase();

  // Explicit multiple choice indicators
  if (
    lowerLabel.includes("select all") ||
    lowerLabel.includes("choose all") ||
    lowerLabel.includes("multiple") ||
    lowerLabel.includes("check all")
  ) {
    return true;
  }

  // If many options (>4), more likely to be multiple choice
  if (options && options.length > 4) {
    return true;
  }

  return false;
};

const inferNeedsSearch = (options: string[] | null): boolean => {
  // Enable search if there are many options
  return options ? options.length > 5 : false;
};

const inferRatingType = (label: string | null): "Numbers" | "Icons" => {
  if (!label) return "Numbers";

  const lowerLabel = label.toLowerCase();

  if (
    lowerLabel.includes("star") ||
    lowerLabel.includes("satisfaction") ||
    lowerLabel.includes("recommend")
  ) {
    return "Icons";
  }

  return "Numbers";
};

const inferRatingLength = (label: string | null): number => {
  if (!label) return 5;

  const lowerLabel = label.toLowerCase();

  // Look for specific numbers in the label
  if (lowerLabel.includes("1 to 10") || lowerLabel.includes("1-10")) return 10;
  if (lowerLabel.includes("1 to 5") || lowerLabel.includes("1-5")) return 5;
  if (lowerLabel.includes("star")) return 5; // Stars are typically 1-5

  return 5; // Default to 5
};

const inferRatingStartsAt = (label: string | null): number => {
  if (!label) return 1;

  const lowerLabel = label.toLowerCase();

  // Most ratings start at 1, but some start at 0
  if (lowerLabel.includes("0 to") || lowerLabel.includes("0-")) return 0;

  return 1;
};

const inferRatingLeftLabel = (label: string | null): string | undefined => {
  if (!label) return undefined;

  const lowerLabel = label.toLowerCase();

  if (lowerLabel.includes("satisfaction")) return "Not satisfied";
  if (lowerLabel.includes("recommend")) return "Not likely";
  if (lowerLabel.includes("agree")) return "Disagree";
  if (lowerLabel.includes("quality")) return "Poor";

  return "Low";
};

const inferRatingRightLabel = (label: string | null): string | undefined => {
  if (!label) return undefined;

  const lowerLabel = label.toLowerCase();

  if (lowerLabel.includes("satisfaction")) return "Very satisfied";
  if (lowerLabel.includes("recommend")) return "Very likely";
  if (lowerLabel.includes("agree")) return "Strongly agree";
  if (lowerLabel.includes("quality")) return "Excellent";

  return "High";
};

const inferAllowsMultipleFiles = (label: string | null): boolean => {
  if (!label) return false;

  const lowerLabel = label.toLowerCase();
  return (
    lowerLabel.includes("files") || // plural
    lowerLabel.includes("multiple") ||
    lowerLabel.includes("documents") ||
    lowerLabel.includes("images")
  ); // plural
};

const inferAllowedFileTypes = (label: string | null) => {
  if (!label) return { isEnabled: false };

  const lowerLabel = label.toLowerCase();

  if (
    lowerLabel.includes("image") ||
    lowerLabel.includes("photo") ||
    lowerLabel.includes("picture")
  ) {
    return {
      isEnabled: true,
      types: [".jpg", ".jpeg", ".png", ".gif", ".webp"],
    };
  }

  if (lowerLabel.includes("document") || lowerLabel.includes("pdf")) {
    return {
      isEnabled: true,
      types: [".pdf", ".doc", ".docx", ".txt"],
    };
  }

  if (lowerLabel.includes("video")) {
    return {
      isEnabled: true,
      types: [".mp4", ".avi", ".mov", ".wmv"],
    };
  }

  if (lowerLabel.includes("resume") || lowerLabel.includes("cv")) {
    return {
      isEnabled: true,
      types: [".pdf", ".doc", ".docx"],
    };
  }

  return { isEnabled: false };
};

// Updated interface for localStorage-based cache
interface AnalysisResultWithCache {
  elements: DetectedElement[];
  fromCache: boolean;
  cacheInfo?: {
    createdAt: string;
    fileName: string;
    provider: string;
  };
}

export const analyzeImageWithCache = async (
  imageFile: File,
  apiKey: string,
  workspaceId: string, // Kept for compatibility but not used in localStorage
  forceAnalysis = false,
  provider: "openai" | "gemini" = "openai",
): Promise<AnalysisResultWithCache> => {
  if (!isValidImageFile(imageFile)) {
    throw new Error("Invalid image file format");
  }

  // Check localStorage cache first unless forced to reanalyze
  if (!forceAnalysis) {
    const cachedElements = await getCachedAnalysis(imageFile, provider, apiKey);
    if (cachedElements) {
      return {
        elements: cachedElements,
        fromCache: true,
        cacheInfo: {
          createdAt: new Date().toISOString(), // We'll get this from the cache if needed
          fileName: imageFile.name,
          provider,
        },
      };
    }
  }

  // Perform fresh analysis
  const base64Image = await convertFileToBase64(imageFile);
  const elements =
    provider === "gemini"
      ? await analyzeImageWithGemini(base64Image, apiKey)
      : await analyzeImageWithOpenAI(base64Image, apiKey);

  // Cache the results for future use
  await setCachedAnalysis(imageFile, provider, apiKey, elements);

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

export const analyzeTextPromptWithCache = async (
  textPrompt: string,
  apiKey: string,
  workspaceId: string, // Kept for compatibility
  forceAnalysis = false,
  provider: "openai" | "gemini" = "openai",
): Promise<AnalysisResultWithCache> => {
  if (!textPrompt.trim()) {
    throw new Error("Text prompt cannot be empty");
  }

  // Check localStorage cache first unless forced to reanalyze
  if (!forceAnalysis) {
    const cachedElements = await getCachedTextAnalysis(
      textPrompt,
      provider,
      apiKey,
    );
    if (cachedElements) {
      return {
        elements: cachedElements,
        fromCache: true,
        cacheInfo: {
          createdAt: new Date().toISOString(),
          fileName: `text-prompt-${createTextHash(textPrompt)}`,
          provider,
        },
      };
    }
  }

  // Perform fresh analysis
  const elements =
    provider === "gemini"
      ? await analyzeTextPromptWithGemini(textPrompt, apiKey)
      : await analyzeTextPromptWithOpenAI(textPrompt, apiKey);

  // Cache the results for future use
  await setCachedTextAnalysis(textPrompt, provider, apiKey, elements);

  return {
    elements,
    fromCache: false,
  };
};

export const analyzeTextPrompt = async (
  textPrompt: string,
  apiKey: string,
  provider: "openai" | "gemini" = "openai",
): Promise<DetectedElement[]> => {
  if (!textPrompt.trim()) {
    throw new Error("Text prompt cannot be empty");
  }

  const elements =
    provider === "gemini"
      ? await analyzeTextPromptWithGemini(textPrompt, apiKey)
      : await analyzeTextPromptWithOpenAI(textPrompt, apiKey);

  return enrichElementsWithSmartDefaults(elements);
};
