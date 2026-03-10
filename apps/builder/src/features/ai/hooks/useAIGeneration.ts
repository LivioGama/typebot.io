import {
  analyzeImageWithCache,
  analyzeTextPromptWithCache,
  generateTypebot,
} from "@/features/ai";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { trpc } from "@/lib/queryClient";
import { useToast } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import type {
  AIGenerationStep,
  AIInputType,
  CachedAnalysisResult,
  ClarificationChoice,
  DetectedElement,
  PreviewChoice,
} from "../types";

export const useAIGeneration = () => {
  const toast = useToast();
  const { workspace } = useWorkspace();

  const [currentStep, setCurrentStep] = useState<
    "input" | "clarification" | "preview" | "generation"
  >("input");
  const [inputType, setInputType] = useState<AIInputType>("image");
  const [uploadedImage, setUploadedImage] = useState<File | undefined>();
  const [textPrompt, setTextPrompt] = useState<string>("");
  const [detectedElements, setDetectedElements] = useState<DetectedElement[]>(
    [],
  );
  const [clarificationChoices, setClarificationChoices] = useState<
    ClarificationChoice[]
  >([]);
  const [previewChoices, setPreviewChoices] = useState<PreviewChoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cachedResult, setCachedResult] = useState<
    CachedAnalysisResult | undefined
  >();
  const [fromCache, setFromCache] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<
    "openai" | "gemini" | undefined
  >();

  const { data: openaiCredentials } = useQuery(
    trpc.credentials.listCredentials.queryOptions(
      {
        scope: "workspace",
        workspaceId: workspace?.id,
        type: "openai",
      },
      {
        enabled: !!workspace?.id,
      },
    ),
  );

  const { data: geminiCredentials } = useQuery(
    trpc.credentials.listCredentials.queryOptions(
      {
        scope: "workspace",
        workspaceId: workspace?.id,
        type: "gemini",
      },
      {
        enabled: !!workspace?.id,
      },
    ),
  );

  const selectedCredentials =
    selectedProvider === "gemini" ? geminiCredentials : openaiCredentials;
  const selectedCredentialId = selectedCredentials?.credentials?.[0]?.id;

  const { data: credentialData } = useQuery(
    trpc.credentials.getCredentials.queryOptions(
      {
        scope: "workspace",
        workspaceId: workspace?.id,
        credentialsId: selectedCredentialId || "",
      },
      {
        enabled: !!workspace?.id && !!selectedCredentialId,
      },
    ),
  );

  const hasOpenAICredentials = Boolean(openaiCredentials?.credentials?.length);
  const hasGeminiCredentials = Boolean(geminiCredentials?.credentials?.length);
  const hasSelectedCredentials = Boolean(
    selectedCredentials?.credentials?.length,
  );

  const apiKey = (credentialData?.data as any)?.apiKey;

  useEffect(() => {
    if (!selectedProvider) {
      if (hasOpenAICredentials) {
        setSelectedProvider("openai");
      } else if (hasGeminiCredentials) {
        setSelectedProvider("gemini");
      }
    }
  }, [hasOpenAICredentials, hasGeminiCredentials, selectedProvider]);

  const generateTypebotInternal = useCallback(
    async (elements: DetectedElement[]) => {
      if (!hasSelectedCredentials || !apiKey || !workspace?.id) {
        throw new Error("Missing credentials or workspace");
      }

      return generateTypebot(elements, apiKey, selectedProvider || "openai");
    },
    [hasSelectedCredentials, apiKey, selectedProvider],
  );

  const handleImageUpload = useCallback(
    async (file: File, forceAnalysis = false) => {
      if (!hasSelectedCredentials || !apiKey || !workspace?.id) {
        const providerName =
          selectedProvider === "gemini" ? "Gemini" : "OpenAI";
        toast({
          title: `${providerName} credentials required`,
          description: `Please configure ${providerName} credentials in your workspace settings first.`,
          status: "error",
        });
        return;
      }

      setInputType("image");
      setUploadedImage(file);
      setTextPrompt("");
      setIsLoading(true);

      if (forceAnalysis) {
        setClarificationChoices([]);
        setPreviewChoices([]);
        setCachedResult(undefined);
        setFromCache(false);
      }

      const analysisStartTime = performance.now();

      try {
        const result = await analyzeImageWithCache(
          file,
          apiKey,
          workspace.id,
          forceAnalysis,
          selectedProvider || "openai",
        );

        const analysisEndTime = performance.now();
        const analysisTimeMs = Math.round(analysisEndTime - analysisStartTime);
        const analysisTimeSeconds = (analysisTimeMs / 1000).toFixed(1);

        setDetectedElements(result.elements);
        setCachedResult(
          result.cacheInfo
            ? {
                id: "localStorage",
                fileHash: "",
                fileName: result.cacheInfo.fileName,
                fileSize: file.size,
                mimeType: file.type,
                createdAt: new Date(result.cacheInfo.createdAt),
                analysisResult: result.elements,
              }
            : undefined,
        );
        setFromCache(result.fromCache);

        if (result.fromCache && result.cacheInfo) {
          toast({
            title: "Using cached analysis",
            description: `Found previous analysis for ${result.cacheInfo.fileName} (${result.cacheInfo.provider}) • Instant retrieval`,
            status: "info",
          });
        } else {
          const providerName =
            selectedProvider === "gemini" ? "Gemini" : "OpenAI";
          toast({
            title: "Image analysis complete",
            description: `${providerName} analyzed ${result.elements.length} elements in ${analysisTimeSeconds}s`,
            status: "success",
          });
        }

        const elementsNeedingClarification = result.elements.filter(
          (el) => el.clarificationNeeded || el.type === "choice",
        );

        if (elementsNeedingClarification.length > 0) {
          setCurrentStep("clarification");
        } else {
          setCurrentStep("preview");
          const initialPreviewChoices = result.elements.map((_, index) => ({
            elementIndex: index,
            isIncluded: true,
          }));
          setPreviewChoices(initialPreviewChoices);
        }
      } catch (error) {
        toast({
          title: "Analysis failed",
          description:
            error instanceof Error ? error.message : "Failed to analyze image",
          status: "error",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [hasSelectedCredentials, apiKey, workspace?.id, toast, selectedProvider],
  );

  const handleTextPromptSubmit = useCallback(
    async (prompt: string, forceAnalysis = false) => {
      if (!hasSelectedCredentials || !apiKey || !workspace?.id) {
        const providerName =
          selectedProvider === "gemini" ? "Gemini" : "OpenAI";
        toast({
          title: `${providerName} credentials required`,
          description: `Please configure ${providerName} credentials in your workspace settings first.`,
          status: "error",
        });
        return;
      }

      setInputType("prompt");
      setTextPrompt(prompt);
      setUploadedImage(undefined);
      setIsLoading(true);

      if (forceAnalysis) {
        setClarificationChoices([]);
        setPreviewChoices([]);
        setCachedResult(undefined);
        setFromCache(false);
      }

      const analysisStartTime = performance.now();

      try {
        const result = await analyzeTextPromptWithCache(
          prompt,
          apiKey,
          workspace.id,
          forceAnalysis,
          selectedProvider || "openai",
        );

        const analysisEndTime = performance.now();
        const analysisTimeMs = Math.round(analysisEndTime - analysisStartTime);
        const analysisTimeSeconds = (analysisTimeMs / 1000).toFixed(1);

        setDetectedElements(result.elements);
        setCachedResult(
          result.cacheInfo
            ? {
                id: "localStorage",
                fileHash: "",
                fileName: result.cacheInfo.fileName,
                fileSize: prompt.length,
                mimeType: "text/plain",
                createdAt: new Date(result.cacheInfo.createdAt),
                analysisResult: result.elements,
              }
            : undefined,
        );
        setFromCache(result.fromCache);

        if (result.fromCache && result.cacheInfo) {
          toast({
            title: "Using cached analysis",
            description: `Found previous analysis for this prompt (${result.cacheInfo.provider}) • Instant retrieval`,
            status: "info",
          });
        } else {
          const providerName =
            selectedProvider === "gemini" ? "Gemini" : "OpenAI";
          toast({
            title: "Text prompt analysis complete",
            description: `${providerName} analyzed and created ${result.elements.length} elements in ${analysisTimeSeconds}s`,
            status: "success",
          });
        }

        const elementsNeedingClarification = result.elements.filter(
          (el) => el.clarificationNeeded || el.type === "choice",
        );

        if (elementsNeedingClarification.length > 0) {
          setCurrentStep("clarification");
        } else {
          setCurrentStep("preview");
          const initialPreviewChoices = result.elements.map((_, index) => ({
            elementIndex: index,
            isIncluded: true,
          }));
          setPreviewChoices(initialPreviewChoices);
        }
      } catch (error) {
        toast({
          title: "Analysis failed",
          description:
            error instanceof Error
              ? error.message
              : "Failed to analyze text prompt",
          status: "error",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [hasSelectedCredentials, apiKey, workspace?.id, toast, selectedProvider],
  );

  const handleClarificationChoiceChange = useCallback(
    (elementIndex: number, selectedBlockType: string, isMultiple?: boolean) => {
      setClarificationChoices((prev) => {
        const existing = prev.find((c) => c.elementIndex === elementIndex);
        if (existing) {
          return prev.map((c) =>
            c.elementIndex === elementIndex
              ? { ...c, selectedBlockType, isMultiple }
              : c,
          );
        }
        return [...prev, { elementIndex, selectedBlockType, isMultiple }];
      });
    },
    [],
  );

  const handlePreviewChoiceChange = useCallback(
    (elementIndex: number, isIncluded: boolean) => {
      setPreviewChoices((prev) => {
        const existing = prev.find((c) => c.elementIndex === elementIndex);
        if (existing) {
          return prev.map((c) =>
            c.elementIndex === elementIndex ? { ...c, isIncluded } : c,
          );
        }
        return [...prev, { elementIndex, isIncluded }];
      });
    },
    [],
  );

  const handleContinueToPreview = useCallback(() => {
    setCurrentStep("preview");
    if (previewChoices.length === 0) {
      const initialPreviewChoices = detectedElements.map((_, index) => ({
        elementIndex: index,
        isIncluded: true,
      }));
      setPreviewChoices(initialPreviewChoices);
    }
  }, [detectedElements, previewChoices.length]);

  const handleGenerate = useCallback(async () => {
    if ((!uploadedImage && !textPrompt) || !hasSelectedCredentials || !apiKey)
      return null;

    setCurrentStep("generation");
    setIsLoading(true);

    try {
      const includedElementIndices = previewChoices
        .filter((choice) => choice.isIncluded)
        .map((choice) => choice.elementIndex);

      const elementsToInclude =
        includedElementIndices.length > 0
          ? detectedElements.filter((_, index) =>
              includedElementIndices.includes(index),
            )
          : detectedElements;

      const elementsWithClarifications = elementsToInclude.map(
        (element, originalIndex) => {
          const elementIndex = detectedElements.findIndex(
            (el) => el === element,
          );
          const clarification = clarificationChoices.find(
            (c) => c.elementIndex === elementIndex,
          );
          const result = clarification
            ? {
                ...element,
                type: clarification.selectedBlockType as any,
                isMultiple: clarification.isMultiple,
              }
            : element;

          return result;
        },
      );

      const typebot = await generateTypebotInternal(elementsWithClarifications);
      return typebot;
    } catch (error) {
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [
    uploadedImage,
    textPrompt,
    hasSelectedCredentials,
    apiKey,
    detectedElements,
    clarificationChoices,
    previewChoices,
    generateTypebotInternal,
  ]);

  const handleReanalyze = useCallback(async () => {
    if (inputType === "image" && uploadedImage) {
      await handleImageUpload(uploadedImage, true);
    } else if (inputType === "prompt" && textPrompt) {
      await handleTextPromptSubmit(textPrompt, true);
    }
  }, [
    inputType,
    uploadedImage,
    textPrompt,
    handleImageUpload,
    handleTextPromptSubmit,
  ]);

  const reset = useCallback(() => {
    setCurrentStep("input");
    setInputType("image");
    setUploadedImage(undefined);
    setTextPrompt("");
    setDetectedElements([]);
    setClarificationChoices([]);
    setPreviewChoices([]);
    setCachedResult(undefined);
    setFromCache(false);
    setIsLoading(false);
  }, []);

  const currentState: AIGenerationStep = {
    step: currentStep,
    inputType,
    uploadedImage,
    textPrompt,
    analysisResult: detectedElements.length > 0 ? detectedElements : undefined,
    clarificationChoices,
    previewChoices,
    hasOpenAICredentials,
    hasGeminiCredentials,
    selectedProvider,
    cachedResult,
    fromCache,
  };

  return {
    currentState,
    isLoading,
    handleImageUpload,
    handleTextPromptSubmit,
    handleClarificationChoiceChange,
    handlePreviewChoiceChange,
    handleContinueToPreview,
    handleGenerate,
    handleReanalyze,
    reset,
    selectedProvider,
    setSelectedProvider,
    hasOpenAICredentials,
    hasGeminiCredentials,
    elementsNeedingClarification: detectedElements.filter(
      (el) => el.clarificationNeeded || el.type === "choice",
    ),
  };
};
