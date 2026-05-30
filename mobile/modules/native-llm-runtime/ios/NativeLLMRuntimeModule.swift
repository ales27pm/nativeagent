import ExpoModulesCore
import Foundation

public class NativeLLMRuntimeModule: Module {
  private let backend: any LLMBackend = LlamaCppBackend()

  public func definition() -> ModuleDefinition {
    Name("NativeLLMRuntime")

    // MARK: - Health

    AsyncFunction("getLLMRuntimeHealth") { [self] () -> [String: Any] in
      var result: [String: Any] = [
        "available": backend.isLinked,
        "platform": "ios",
        "backend": backend.backendName,
        "supportsStreaming": backend.supportsStreaming,
        "supportsCancellation": backend.supportsCancellation,
        "supportsQuantizedModels": backend.supportsQuantizedModels,
        "supportedFormats": backend.supportedFormats,
      ]

      if let modelId = backend.currentModelId {
        result["loadedModelId"] = modelId
      } else {
        result["loadedModelId"] = NSNull()
      }

      if let reason = backend.reasonNotLinked() {
        result["reasonUnavailable"] = reason
      } else {
        result["reasonUnavailable"] = NSNull()
      }

      return result
    }

    // MARK: - Model discovery

    AsyncFunction("listInstalledModels") { () -> [[String: Any]] in
      return self.scanModelsDirectory()
    }

    // MARK: - Load / unload

    AsyncFunction("loadModel") { [self] (request: [String: Any]) -> [String: Any] in
      guard let modelId = request["modelId"] as? String,
            let localPath = request["localPath"] as? String
      else {
        throw NSError(
          domain: "NativeLLMRuntime",
          code: 400,
          userInfo: [NSLocalizedDescriptionKey: "modelId and localPath are required"]
        )
      }

      let ctxLen = (request["contextLength"] as? Int) ?? 2048
      let nativeReq = LoadModelRequestNative(
        modelId: modelId,
        localPath: localPath,
        preferredBackend: request["preferredBackend"] as? String,
        contextLength: ctxLen
      )

      do {
        let result = try await backend.loadModel(request: nativeReq)
        return [
          "loaded": result.loaded,
          "modelId": result.modelId,
          "backend": result.backend,
          "message": result.message,
        ]
      } catch let e as LlamaCppError {
        throw NSError(
          domain: "NativeLLMRuntime.LlamaCpp",
          code: 1,
          userInfo: [NSLocalizedDescriptionKey: e.errorDescription ?? e.localizedDescription]
        )
      }
    }

    AsyncFunction("unloadModel") { [self] (modelId: String) -> [String: Any] in
      let result = await backend.unloadModel(modelId: modelId)
      return [
        "unloaded": result.unloaded,
        "modelId": result.modelId,
        "message": result.message,
      ]
    }

    // MARK: - Inference (iOS-only in Phase 2B; Android stubs this at the TS layer)

    AsyncFunction("runInference") { [self] (request: [String: Any]) -> [String: Any] in
      guard let modelId = request["modelId"] as? String,
            let prompt = request["prompt"] as? String
      else {
        throw NSError(
          domain: "NativeLLMRuntime",
          code: 400,
          userInfo: [NSLocalizedDescriptionKey: "modelId and prompt are required"]
        )
      }

      let nativeReq = RunInferenceRequestNative(
        modelId: modelId,
        prompt: prompt,
        maxTokens: (request["maxTokens"] as? Int) ?? 256,
        temperature: (request["temperature"] as? Float) ?? 0.8,
        topP: (request["topP"] as? Float) ?? 0.95,
        stopSequences: (request["stopSequences"] as? [String]) ?? []
      )

      do {
        let result = try await backend.runInference(request: nativeReq)
        return [
          "text": result.text,
          "tokensGenerated": result.tokensGenerated,
          "tokensSeen": result.tokensSeen,
          "backend": result.backend,
          "modelId": result.modelId,
        ]
      } catch let e as LlamaCppError {
        throw NSError(
          domain: "NativeLLMRuntime.LlamaCpp",
          code: 2,
          userInfo: [NSLocalizedDescriptionKey: e.errorDescription ?? e.localizedDescription]
        )
      }
    }
  }

  // MARK: - Model file scanning

  private func scanModelsDirectory() -> [[String: Any]] {
    let fileManager = FileManager.default
    guard let documentsURL = fileManager.urls(for: .documentDirectory, in: .userDomainMask).first
    else { return [] }

    let fileExtensions: Set<String> = ["gguf", "bin"]
    let packageExtensions: Set<String> = ["mlmodelc", "mlpackage"]
    var models: [[String: Any]] = []
    let iso = ISO8601DateFormatter()

    guard let enumerator = fileManager.enumerator(
      at: documentsURL,
      includingPropertiesForKeys: [.fileSizeKey, .creationDateKey, .isDirectoryKey],
      options: [.skipsHiddenFiles]
    ) else { return [] }

    for case let url as URL in enumerator {
      let ext = url.pathExtension.lowercased()
      var isDir: ObjCBool = false
      fileManager.fileExists(atPath: url.path, isDirectory: &isDir)

      if isDir.boolValue {
        if packageExtensions.contains(ext) {
          enumerator.skipDescendants()
          let attrs = try? url.resourceValues(forKeys: [.creationDateKey])
          let discoveredAt = attrs?.creationDate.map { iso.string(from: $0) } ?? ""
          models.append([
            "id": url.lastPathComponent,
            "name": url.deletingPathExtension().lastPathComponent,
            "localPath": url.path,
            "format": ext,
            "sizeBytes": 0,
            "discoveredAt": discoveredAt,
          ])
        }
        continue
      }

      guard fileExtensions.contains(ext) else { continue }
      let attrs = try? url.resourceValues(forKeys: [.fileSizeKey, .creationDateKey])
      let sizeBytes = attrs?.fileSize ?? 0
      let discoveredAt = attrs?.creationDate.map { iso.string(from: $0) } ?? ""
      let format: String
      switch ext {
      case "gguf": format = "gguf"
      case "bin":  format = "bin"
      default:     format = "unknown"
      }
      models.append([
        "id": url.lastPathComponent,
        "name": url.deletingPathExtension().lastPathComponent,
        "localPath": url.path,
        "format": format,
        "sizeBytes": sizeBytes,
        "discoveredAt": discoveredAt,
      ])
    }

    return models
  }
}
