/**
 * Local storage cache for image analysis results
 * Stores analysis results in browser localStorage to avoid re-analyzing same images
 */

import type { DetectedElement } from "../types";

interface CachedImageAnalysis {
  fileHash: string;
  fileName: string;
  fileSize: number;
  provider: "openai" | "gemini";
  apiKeyHash: string;
  analysisResult: DetectedElement[];
  createdAt: string;
  expiresAt: string;
}

const CACHE_KEY_PREFIX = "typebot_image_analysis_";
const CACHE_EXPIRY_DAYS = 7; // Cache expires after 7 days

/**
 * Generates a SHA-256 hash of a file for caching
 */
export const generateFileHash = async (file: File): Promise<string> => {
  const arrayBuffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
};

/**
 * Generates a hash for the API key to associate cache with specific credentials
 */
export const generateApiKeyHash = async (apiKey: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  // Return first 16 characters for shorter storage
  return hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .substring(0, 16);
};

/**
 * Creates a cache key for localStorage
 */
const createCacheKey = (
  fileHash: string,
  provider: string,
  apiKeyHash: string,
): string => {
  return `${CACHE_KEY_PREFIX}${fileHash}_${provider}_${apiKeyHash}`;
};

/**
 * Checks if a cached analysis exists and is still valid
 */
export const getCachedAnalysis = async (
  file: File,
  provider: "openai" | "gemini",
  apiKey: string,
): Promise<DetectedElement[] | null> => {
  try {
    const fileHash = await generateFileHash(file);
    const apiKeyHash = await generateApiKeyHash(apiKey);
    const cacheKey = createCacheKey(fileHash, provider, apiKeyHash);

    console.log("🔍 Checking localStorage cache:", {
      fileHash: fileHash.substring(0, 8) + "...",
      provider,
      fileName: file.name,
      cacheKey: cacheKey.substring(0, 30) + "...",
    });

    const cachedData = localStorage.getItem(cacheKey);
    if (!cachedData) {
      console.log("❌ Cache MISS - no existing analysis found");
      return null;
    }

    const parsed: CachedImageAnalysis = JSON.parse(cachedData);

    // Check if cache has expired
    const now = new Date();
    const expiryDate = new Date(parsed.expiresAt);
    if (now > expiryDate) {
      console.log("⏰ Cache EXPIRED - removing old analysis");
      localStorage.removeItem(cacheKey);
      return null;
    }

    // Verify file details match
    if (parsed.fileSize !== file.size || parsed.fileName !== file.name) {
      console.log("⚠️ Cache file mismatch - different file with same hash");
      return null;
    }

    console.log("✅ Cache HIT - using existing analysis", {
      createdAt: parsed.createdAt,
      elementsCount: parsed.analysisResult.length,
      provider: parsed.provider,
    });

    return parsed.analysisResult;
  } catch (error) {
    console.warn("Failed to read cache:", error);
    return null;
  }
};

/**
 * Saves analysis results to localStorage cache
 */
export const setCachedAnalysis = async (
  file: File,
  provider: "openai" | "gemini",
  apiKey: string,
  analysisResult: DetectedElement[],
): Promise<void> => {
  try {
    const fileHash = await generateFileHash(file);
    const apiKeyHash = await generateApiKeyHash(apiKey);
    const cacheKey = createCacheKey(fileHash, provider, apiKeyHash);

    const now = new Date();
    const expiryDate = new Date(
      now.getTime() + CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
    );

    const cacheData: CachedImageAnalysis = {
      fileHash,
      fileName: file.name,
      fileSize: file.size,
      provider,
      apiKeyHash,
      analysisResult,
      createdAt: now.toISOString(),
      expiresAt: expiryDate.toISOString(),
    };

    console.log("💾 Saving analysis to localStorage cache...", {
      elementsFound: analysisResult.length,
      fileName: file.name,
      provider,
      expiresAt: expiryDate.toLocaleDateString(),
    });

    localStorage.setItem(cacheKey, JSON.stringify(cacheData));

    console.log("✅ Analysis cached successfully in localStorage");

    // Clean up expired entries while we're here
    await cleanupExpiredCache();
  } catch (error) {
    console.warn("Failed to save cache:", error);
  }
};

/**
 * Removes expired cache entries from localStorage
 */
const cleanupExpiredCache = async (): Promise<void> => {
  try {
    const now = new Date();
    const keysToRemove: string[] = [];

    // Check all localStorage keys for our cache entries
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        try {
          const cachedData = localStorage.getItem(key);
          if (cachedData) {
            const parsed: CachedImageAnalysis = JSON.parse(cachedData);
            const expiryDate = new Date(parsed.expiresAt);
            if (now > expiryDate) {
              keysToRemove.push(key);
            }
          }
        } catch {
          // Invalid cache entry, mark for removal
          keysToRemove.push(key);
        }
      }
    }

    // Remove expired entries
    keysToRemove.forEach((key) => {
      localStorage.removeItem(key);
    });

    if (keysToRemove.length > 0) {
      console.log(`🧹 Cleaned up ${keysToRemove.length} expired cache entries`);
    }
  } catch (error) {
    console.warn("Failed to cleanup cache:", error);
  }
};

/**
 * Clears all cached analysis data (useful for testing)
 */
export const clearAllCache = (): void => {
  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => {
    localStorage.removeItem(key);
  });

  console.log(`🗑️ Cleared ${keysToRemove.length} cached analyses`);
};

/**
 * Gets cache statistics for debugging
 */
export const getCacheStats = (): {
  totalEntries: number;
  totalSizeKB: number;
  oldestEntry?: string;
  newestEntry?: string;
  entries: Array<{
    fileName: string;
    provider: string;
    createdAt: string;
    elementsCount: number;
    sizeKB: number;
  }>;
} => {
  let totalEntries = 0;
  let totalSize = 0;
  let oldestDate: Date | null = null;
  let newestDate: Date | null = null;
  const entries: Array<{
    fileName: string;
    provider: string;
    createdAt: string;
    elementsCount: number;
    sizeKB: number;
  }> = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_KEY_PREFIX)) {
      totalEntries++;
      const data = localStorage.getItem(key);
      if (data) {
        totalSize += data.length;
        try {
          const parsed: CachedImageAnalysis = JSON.parse(data);
          const createdAt = new Date(parsed.createdAt);

          entries.push({
            fileName: parsed.fileName,
            provider: parsed.provider,
            createdAt: parsed.createdAt,
            elementsCount: parsed.analysisResult.length,
            sizeKB: Math.round(data.length / 1024),
          });

          if (!oldestDate || createdAt < oldestDate) {
            oldestDate = createdAt;
          }
          if (!newestDate || createdAt > newestDate) {
            newestDate = createdAt;
          }
        } catch {
          // Ignore invalid entries
        }
      }
    }
  }

  // Sort entries by creation date (newest first)
  entries.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return {
    totalEntries,
    totalSizeKB: Math.round(totalSize / 1024),
    oldestEntry: oldestDate?.toLocaleDateString(),
    newestEntry: newestDate?.toLocaleDateString(),
    entries,
  };
};

/**
 * Adds cache debugging to window object for browser console access
 */
export const addCacheDebuggingToWindow = (): void => {
  if (typeof window !== "undefined") {
    (window as any).typebotImageCache = {
      stats: getCacheStats,
      clear: clearAllCache,
      debug: () => {
        const stats = getCacheStats();
        console.table(stats.entries);
        console.log("Cache Summary:", {
          totalEntries: stats.totalEntries,
          totalSizeKB: stats.totalSizeKB,
          oldestEntry: stats.oldestEntry,
          newestEntry: stats.newestEntry,
        });
      },
    };
    console.log(
      "💡 Image cache debugging available via window.typebotImageCache",
    );
  }
};
