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
  suggestedBlockType?: string;
  fieldConfig?: {
    placeholder?: string;
    isRequired?: boolean;
    isLong?: boolean;
    isMultipleChoice?: boolean;
    isSearchable?: boolean;
    searchInputPlaceholder?: string;
    areInitialSearchButtonsVisible?: boolean;
    buttonLabel?: string;
    buttonType?: "Numbers" | "Icons";
    length?: number;
    startsAt?: number;
    isOneClickSubmitEnabled?: boolean;
    hasTime?: boolean;
    isRange?: boolean;
    format?: string;
    isMultipleAllowed?: boolean;
    visibility?: string;
    retryMessageContent?: string;
    defaultCountryCode?: string;
    labels?: {
      placeholder?: string;
      button?: string;
      from?: string;
      to?: string;
      left?: string;
      right?: string;
      clear?: string;
      skip?: string;
    };
    validation?: {
      required?: boolean;
      format?: string;
      minLength?: number;
      pattern?: string;
      min?: number;
      max?: number;
    };
    formatting?: {
      style?: string;
      currency?: string;
    };
    allowedFileTypes?: {
      isEnabled: boolean;
      types?: string[];
    };
  };
  content?: any;
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

export type AIInputType = "image" | "prompt";

export interface AIGenerationStep {
  step: "input" | "clarification" | "preview" | "generation";
  inputType?: AIInputType;
  uploadedImage?: File;
  textPrompt?: string;
  analysisResult?: DetectedElement[];
  clarificationChoices: ClarificationChoice[];
  previewChoices: PreviewChoice[];
  hasOpenAICredentials: boolean;
  hasGeminiCredentials: boolean;
  selectedProvider?: "openai" | "gemini";
  cachedResult?: CachedAnalysisResult;
  fromCache?: boolean;
}
