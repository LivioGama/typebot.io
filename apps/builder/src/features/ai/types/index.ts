export interface DetectedElement {
  type:
    | "text_input"
    | "number_input"
    | "email_input"
    | "phone_input"
    | "date_input"
    | "choice"
    | "rating"
    | "file_upload"
    | "text"
    | "button"
    | "heading";
  label: string | null;
  placeholder: string | null;
  options: string[] | null;
  confidence: number;
  clarificationNeeded: boolean;
  isMultiple?: boolean;
}

export interface ClarificationChoice {
  elementIndex: number;
  selectedBlockType: string;
  isMultiple?: boolean;
}

export interface PreviewChoice {
  elementIndex: number;
  isIncluded: boolean;
}

export interface CachedAnalysisResult {
  id: string;
  fileHash: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
  analysisResult: DetectedElement[];
}

export interface AnalysisResultWithCache {
  elements: DetectedElement[];
  cached?: CachedAnalysisResult;
  fromCache: boolean;
}

export interface AIGenerationStep {
  step: "upload" | "clarification" | "preview" | "generation";
  uploadedImage?: File;
  analysisResult?: DetectedElement[];
  clarificationChoices: ClarificationChoice[];
  previewChoices: PreviewChoice[];
  hasOpenAICredentials: boolean;
  cachedResult?: CachedAnalysisResult;
  fromCache?: boolean;
}
