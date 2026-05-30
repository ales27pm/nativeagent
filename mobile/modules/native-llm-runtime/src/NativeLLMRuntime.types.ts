export type LLMRuntimeBackend =
  | 'none'
  | 'llama_cpp'
  | 'mlx'
  | 'coreml'
  | 'executorch'
  | 'mediapipe';

export type LLMRuntimeHealth = {
  available: boolean;
  isLinked: boolean;
  platform: 'ios' | 'android';
  backend: LLMRuntimeBackend;
  supportsStreaming: boolean;
  supportsCancellation: boolean;
  supportsQuantizedModels: boolean;
  supportedFormats: Array<'gguf' | 'mlmodelc' | 'mlpackage' | 'bin' | 'unknown'>;
  loadedModelId: string | null;
  reasonUnavailable: string | null;
};

export type InstalledLLMModel = {
  id: string;
  name: string;
  localPath: string;
  format: 'gguf' | 'mlmodelc' | 'mlpackage' | 'bin' | 'unknown';
  sizeBytes: number;
  discoveredAt: string;
};

export type LoadModelRequest = {
  modelId: string;
  localPath: string;
  preferredBackend?: LLMRuntimeBackend;
  contextLength?: number;
};

export type LoadModelResult = {
  loaded: boolean;
  modelId: string;
  backend: LLMRuntimeBackend;
  message: string;
};

export type UnloadModelResult = {
  unloaded: boolean;
  modelId: string;
  message: string;
};

export type RunInferenceRequest = {
  modelId: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stopSequences?: string[];
};

export type RunInferenceResult = {
  text: string;
  tokensGenerated: number;
  tokensSeen: number;
  durationMs: number;
  backend: LLMRuntimeBackend;
  modelId: string;
};

export type LLMRuntimeErrorCode =
  | 'BACKEND_UNAVAILABLE'
  | 'MODEL_NOT_LOADED'
  | 'MODEL_LOAD_FAILED'
  | 'INFERENCE_NOT_IMPLEMENTED'
  | 'FILE_NOT_FOUND'
  | 'INVALID_FORMAT'
  | 'FILE_NOT_READABLE'
  | 'RUNTIME_UNAVAILABLE';

export type NativeLLMRuntimeModule = {
  getLLMRuntimeHealth(): Promise<LLMRuntimeHealth>;
  listInstalledModels(): Promise<InstalledLLMModel[]>;
  loadModel(request: LoadModelRequest): Promise<LoadModelResult>;
  unloadModel(modelId: string): Promise<UnloadModelResult>;
  // runInference is iOS-only in Phase 2B; Android stubs at the TS layer
  runInference?(request: RunInferenceRequest): Promise<RunInferenceResult>;
};
