import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  HStack,
  Image,
  Radio,
  RadioGroup,
  Text,
  Textarea,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import type { AIInputType } from "../types";

interface InputSelectionStepProps {
  onImageSelect: (file: File) => void;
  onTextPromptSubmit: (prompt: string) => void;
  isLoading: boolean;
  hasOpenAICredentials: boolean;
  hasGeminiCredentials: boolean;
  selectedProvider?: "openai" | "gemini";
  onProviderChange: (provider: "openai" | "gemini") => void;
}

export const InputSelectionStep = ({
  onImageSelect,
  onTextPromptSubmit,
  isLoading,
  hasOpenAICredentials,
  hasGeminiCredentials,
  selectedProvider,
  onProviderChange,
}: InputSelectionStepProps) => {
  const { workspace } = useWorkspace();
  const [inputType, setInputType] = useState<AIInputType>("image");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [textPrompt, setTextPrompt] = useState("");

  const borderColor = useColorModeValue("gray.300", "gray.600");
  const activeBorderColor = useColorModeValue("blue.300", "blue.400");
  const bgColor = useColorModeValue("gray.50", "gray.800");
  const activeBgColor = useColorModeValue("blue.50", "blue.900");
  const textColor = useColorModeValue("gray.600", "gray.400");
  const subtleTextColor = useColorModeValue("gray.500", "gray.500");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      setSelectedImage(file);
      const previewUrl = URL.createObjectURL(file);
      setImagePreview(previewUrl);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"],
    },
    multiple: false,
    disabled: isLoading,
  });

  const handleSubmit = () => {
    if (inputType === "image" && selectedImage) {
      onImageSelect(selectedImage);
    } else if (inputType === "prompt" && textPrompt.trim()) {
      onTextPromptSubmit(textPrompt.trim());
    }
  };

  const hasSelectedProviderCredentials =
    selectedProvider === "gemini" ? hasGeminiCredentials : hasOpenAICredentials;
  const hasAnyCredentials = hasOpenAICredentials || hasGeminiCredentials;

  const canProceed =
    hasSelectedProviderCredentials &&
    !isLoading &&
    ((inputType === "image" && selectedImage) ||
      (inputType === "prompt" && textPrompt.trim().length > 0));

  return (
    <VStack spacing={6} align="stretch">
      <VStack spacing={4}>
        <Text fontSize="lg" fontWeight="medium">
          Create your typebot with AI
        </Text>
        <Text fontSize="sm" color="gray.600" textAlign="center">
          Choose how you'd like to provide input for AI to generate your typebot
        </Text>
      </VStack>

      <HStack spacing={8} justify="center" align="flex-start" flexWrap="wrap">
        <VStack spacing={3} align="center" minW="200px">
          <Text fontSize="md" fontWeight="medium">
            Input Method
          </Text>
          <RadioGroup
            value={inputType}
            onChange={(value) => setInputType(value as AIInputType)}
          >
            <HStack spacing={6}>
              <Radio value="image" colorScheme="blue" size="lg">
                <Text fontSize="sm">Upload Image</Text>
              </Radio>
              <Radio value="prompt" colorScheme="blue" size="lg">
                <Text fontSize="sm">Text Prompt</Text>
              </Radio>
            </HStack>
          </RadioGroup>
        </VStack>

        {hasAnyCredentials && (
          <VStack spacing={3} align="center" minW="200px">
            <Text fontSize="md" fontWeight="medium">
              Choose AI Provider
            </Text>
            <RadioGroup
              value={selectedProvider}
              onChange={(value) =>
                onProviderChange(value as "openai" | "gemini")
              }
            >
              <HStack spacing={6}>
                <Radio
                  value="openai"
                  isDisabled={!hasOpenAICredentials}
                  colorScheme="blue"
                  size="lg"
                >
                  <VStack spacing={1} align="start">
                    <Text fontSize="sm">OpenAI</Text>
                    {!hasOpenAICredentials && (
                      <Text fontSize="xs" color="gray.500">
                        (No credentials)
                      </Text>
                    )}
                  </VStack>
                </Radio>
                <Radio
                  value="gemini"
                  isDisabled={!hasGeminiCredentials}
                  colorScheme="blue"
                  size="lg"
                >
                  <VStack spacing={1} align="start">
                    <Text fontSize="sm">Google Gemini</Text>
                    {!hasGeminiCredentials && (
                      <Text fontSize="xs" color="gray.500">
                        (No credentials)
                      </Text>
                    )}
                  </VStack>
                </Radio>
              </HStack>
            </RadioGroup>
          </VStack>
        )}
      </HStack>

      {!hasAnyCredentials && (
        <Alert status="warning">
          <AlertIcon />
          <VStack align="start" spacing={1}>
            <Text fontWeight="medium">AI credentials required</Text>
            <Text fontSize="sm">
              Please configure OpenAI or Gemini credentials in your workspace
              settings to use AI generation.
            </Text>
          </VStack>
        </Alert>
      )}

      {hasAnyCredentials &&
        !hasSelectedProviderCredentials &&
        selectedProvider && (
          <Alert status="warning">
            <AlertIcon />
            <VStack align="start" spacing={1}>
              <Text fontWeight="medium">
                {selectedProvider === "gemini" ? "Gemini" : "OpenAI"}{" "}
                credentials required
              </Text>
              <Text fontSize="sm">
                Please configure{" "}
                {selectedProvider === "gemini" ? "Gemini" : "OpenAI"}{" "}
                credentials in your workspace settings or choose a different
                provider.
              </Text>
            </VStack>
          </Alert>
        )}

      {inputType === "image" && (
        <Box
          {...getRootProps()}
          border="2px dashed"
          borderColor={isDragActive ? activeBorderColor : borderColor}
          borderRadius="md"
          p={8}
          textAlign="center"
          cursor={isLoading ? "not-allowed" : "pointer"}
          bg={isDragActive ? activeBgColor : bgColor}
          opacity={isLoading ? 0.6 : 1}
          transition="all 0.2s"
        >
          <input {...getInputProps()} />
          {imagePreview ? (
            <VStack spacing={4}>
              <Image
                src={imagePreview}
                alt="Preview"
                maxH="200px"
                maxW="100%"
                objectFit="contain"
                borderRadius="md"
              />
              <Text fontSize="sm" color={textColor}>
                Click or drag to replace image
              </Text>
            </VStack>
          ) : (
            <VStack spacing={4}>
              <Text fontSize="xl">📷</Text>
              <VStack spacing={2}>
                <Text fontWeight="medium">
                  {isDragActive
                    ? "Drop the image here"
                    : "Drop an image here, or click to select"}
                </Text>
                <Text fontSize="sm" color={subtleTextColor}>
                  Upload a screenshot or mockup of your form/interface
                </Text>
                <Text fontSize="xs" color={subtleTextColor}>
                  Supports PNG, JPG, GIF, WebP files
                </Text>
              </VStack>
            </VStack>
          )}
        </Box>
      )}

      {inputType === "prompt" && (
        <VStack spacing={3} align="stretch">
          <Text fontSize="sm" color={textColor}>
            Describe the typebot you want to create in detail. Include
            information about form fields, questions, user flow, and any
            specific requirements.
          </Text>
          <Textarea
            value={textPrompt}
            onChange={(e) => setTextPrompt(e.target.value)}
            placeholder="Example: Create a customer feedback form with fields for name, email, rating (1-5 stars), multiple choice for service categories (Support, Sales, Technical), and a large text area for detailed feedback. Include a welcome message and thank you page."
            size="lg"
            minH="200px"
            maxH="400px"
            resize="vertical"
            isDisabled={isLoading}
            border="2px solid"
            borderColor={borderColor}
            _focus={{
              borderColor: activeBorderColor,
              boxShadow: `0 0 0 1px ${activeBorderColor}`,
            }}
          />
          <Text fontSize="xs" color={subtleTextColor} textAlign="right">
            {textPrompt.length} characters
          </Text>
        </VStack>
      )}

      <Button
        colorScheme="blue"
        size="lg"
        onClick={handleSubmit}
        isLoading={isLoading}
        loadingText={inputType === "image" ? "Analyzing..." : "Processing..."}
        isDisabled={!canProceed}
        width="full"
      >
        {!hasAnyCredentials
          ? "Configure AI Credentials First"
          : !hasSelectedProviderCredentials && selectedProvider
            ? `Configure ${selectedProvider === "gemini" ? "Gemini" : "OpenAI"} Credentials First`
            : inputType === "image"
              ? !selectedImage
                ? "Select an image first"
                : "Analyze Image"
              : !textPrompt.trim()
                ? "Enter a prompt first"
                : "Generate from Prompt"}
      </Button>
    </VStack>
  );
};

// Keep the old export name for backward compatibility
export const ImageUploadStep = InputSelectionStep;
