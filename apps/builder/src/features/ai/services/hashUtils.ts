/**
 * Computes SHA-256 hash of a file for deduplication purposes in image analysis caching.
 * This allows us to detect when the same image has been uploaded before and reuse
 * the previous AI analysis results instead of making expensive API calls.
 */
export const computeFileHash = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
};

/**
 * Creates a hashed identifier for the API key to associate cached results
 * with the specific AI model configuration while maintaining privacy.
 */
export const createApiKeyHash = async (apiKey: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Return first 16 characters for shorter storage while maintaining uniqueness
  return hashHex.substring(0, 16);
};

/**
 * Validates if a file is a supported image format for AI analysis
 */
export const isValidImageFile = (file: File): boolean => {
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
 * Gets file metadata needed for caching
 */
export const getFileMetadata = (file: File) => {
  return {
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
  };
};
