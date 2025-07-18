import {
  Alert,
  AlertIcon,
  Box,
  Button,
  HStack,
  Text,
  VStack,
  useColorModeValue,
} from "@chakra-ui/react";
import type { CachedAnalysisResult } from "../types";

interface CachedAnalysisAlertProps {
  cachedResult: CachedAnalysisResult;
  onReanalyze: () => void;
  isLoading: boolean;
}

export const CachedAnalysisAlert = ({
  cachedResult,
  onReanalyze,
  isLoading,
}: CachedAnalysisAlertProps) => {
  const backgroundColor = useColorModeValue("blue.50", "blue.900");
  const borderColor = useColorModeValue("blue.200", "blue.600");

  return (
    <Alert
      status="info"
      variant="subtle"
      borderRadius="md"
      p={4}
      bg={backgroundColor}
      border="1px solid"
      borderColor={borderColor}
    >
      <AlertIcon />
      <Box flex="1">
        <VStack align="start" spacing={2}>
          <Text fontWeight="medium">Using cached analysis results</Text>
          <Text fontSize="sm" color="gray.600">
            This image was previously analyzed on{" "}
            {cachedResult.createdAt.toLocaleDateString()} at{" "}
            {cachedResult.createdAt.toLocaleTimeString()}. You can use the
            existing results or run a fresh analysis.
          </Text>
          <HStack spacing={3} fontSize="sm">
            <Text>
              <strong>File:</strong> {cachedResult.fileName}
            </Text>
            <Text>
              <strong>Size:</strong> {(cachedResult.fileSize / 1024).toFixed(1)}
              KB
            </Text>
            <Text>
              <strong>Elements found:</strong>{" "}
              {cachedResult.analysisResult.length}
            </Text>
          </HStack>
        </VStack>
      </Box>
      <Button
        colorScheme="blue"
        size="sm"
        variant="outline"
        onClick={onReanalyze}
        isLoading={isLoading}
        loadingText="Analyzing..."
        ml={4}
      >
        Analyze Fresh
      </Button>
    </Alert>
  );
};
