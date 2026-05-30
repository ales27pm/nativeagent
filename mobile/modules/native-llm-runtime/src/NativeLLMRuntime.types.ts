export type LLMRuntimeBackend =
  | 'none'
  | 'llama_cpp'
  | 'mlx'
  | 'coreml'
  | 'executorch'
  | 'mediapipe';

export type LLMRuntimeHealth = {
  available: boolean;
  platform: 'ios' | 'android';
  backend: LLMRuntimeBackend;
  supportsStreaming: boolean;
  supportsCancellation: boolean;
  supportsQuantizedModels: boolean;
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

export type NativeLLMRuntimeModule = {
  getLLMRuntimeHealth(): Promise<LLMRuntimeHealth>;
  listInstalledModels(): Promise<InstalledLLMModel[]>;
  loadModel(request: LoadModelRequest): Promise<LoadModelResult>;
  unloadModel(modelId: string): Promise<UnloadModelResult>;
};
