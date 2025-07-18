import { analyzeImageWithCache, generateTypebot } from "@/features/ai";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { trpc } from "@/lib/queryClient";
import { useToast } from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import type {
  AIGenerationStep,
  CachedAnalysisResult,
  ClarificationChoice,
  DetectedElement,
  PreviewChoice,
} from "../types";

export const useAIGeneration = () => {
  const toast = useToast();
  const { workspace } = useWorkspace();

  const [currentStep, setCurrentStep] = useState<
    "upload" | "clarification" | "preview" | "generation"
  >("upload");
  const [uploadedImage, setUploadedImage] = useState<File | undefined>();
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

  const { data: credentials } = useQuery(
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

  const { data: credentialData } = useQuery(
    trpc.credentials.getCredentials.queryOptions(
      {
        scope: "workspace",
        workspaceId: workspace?.id,
        credentialsId: credentials?.credentials?.[0]?.id || "",
      },
      {
        enabled: !!workspace?.id && !!credentials?.credentials?.[0]?.id,
      },
    ),
  );

  const hasOpenAICredentials = Boolean(credentials?.credentials?.length);
  const openAICredential = credentials?.credentials?.[0];
  const apiKey = (credentialData?.data as any)?.apiKey;

  const generateTypebotInternal = useCallback(
    async (elementsToGenerate: DetectedElement[]) => {
      if (!apiKey) return null;

      try {
        const typebot = await generateTypebot(elementsToGenerate, apiKey);

        toast({
          title: "Typebot generated successfully",
          status: "success",
        });

        return typebot;
      } catch (error) {
        toast({
          title: "Generation failed",
          description:
            error instanceof Error
              ? error.message
              : "Failed to generate typebot",
          status: "error",
        });
        return null;
      }
    },
    [apiKey, toast],
  );

  const handleImageUpload = useCallback(
    async (file: File, forceAnalysis = false) => {
      if (!hasOpenAICredentials || !apiKey || !workspace?.id) {
        toast({
          title: "OpenAI credentials required",
          description:
            "Please configure OpenAI credentials in your workspace settings first.",
          status: "error",
        });
        return;
      }

      setUploadedImage(file);
      setIsLoading(true);

      try {
        const result = await analyzeImageWithCache(
          file,
          apiKey,
          workspace.id,
          forceAnalysis,
        );

        setDetectedElements(result.elements);
        setCachedResult(result.cached);
        setFromCache(result.fromCache);

        if (result.fromCache && result.cached) {
          toast({
            title: "Using cached analysis",
            description: `Found previous analysis from ${result.cached.createdAt.toLocaleDateString()}`,
            status: "info",
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
    [hasOpenAICredentials, apiKey, workspace?.id, toast],
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
    if (!uploadedImage || !hasOpenAICredentials || !apiKey) return null;

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
    hasOpenAICredentials,
    apiKey,
    detectedElements,
    clarificationChoices,
    previewChoices,
    generateTypebotInternal,
  ]);

  const handleReanalyze = useCallback(async () => {
    if (uploadedImage) {
      await handleImageUpload(uploadedImage, true);
    }
  }, [uploadedImage, handleImageUpload]);

  const reset = useCallback(() => {
    setCurrentStep("upload");
    setUploadedImage(undefined);
    setDetectedElements([]);
    setClarificationChoices([]);
    setPreviewChoices([]);
    setCachedResult(undefined);
    setFromCache(false);
    setIsLoading(false);
  }, []);

  const currentState: AIGenerationStep = {
    step: currentStep,
    uploadedImage,
    analysisResult: detectedElements.length > 0 ? detectedElements : undefined,
    clarificationChoices,
    previewChoices,
    hasOpenAICredentials,
    cachedResult,
    fromCache,
  };

  return {
    currentState,
    isLoading,
    handleImageUpload,
    handleClarificationChoiceChange,
    handlePreviewChoiceChange,
    handleContinueToPreview,
    handleGenerate,
    handleReanalyze,
    reset,
    elementsNeedingClarification: detectedElements.filter(
      (el) => el.clarificationNeeded || el.type === "choice",
    ),
  };
};
