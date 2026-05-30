import ExpoModulesCore
import Foundation

public class NativeLLMRuntimeModule: Module {
  private var loadedModelId: String? = nil

  public func definition() -> ModuleDefinition {
    Name("NativeLLMRuntime")

    AsyncFunction("getLLMRuntimeHealth") { () -> [String: Any] in
      var result: [String: Any] = [
        "available": false,
        "platform": "ios",
        "backend": "none",
        "supportsStreaming": false,
        "supportsCancellation": false,
        "supportsQuantizedModels": false,
        "reasonUnavailable": "No inference backend linked. Phase 2B will integrate llama.cpp or MLX Swift.",
      ]
      if let modelId = self.loadedModelId {
        result["loadedModelId"] = modelId
      } else {
        result["loadedModelId"] = NSNull()
      }
      return result
    }

    AsyncFunction("listInstalledModels") { () -> [[String: Any]] in
      return self.scanModelsDirectory()
    }

    AsyncFunction("loadModel") { (request: [String: Any]) -> [String: Any] in
      guard let modelId = request["modelId"] as? String,
            let localPath = request["localPath"] as? String
      else {
        throw NSError(
          domain: "NativeLLMRuntime",
          code: 400,
          userInfo: [NSLocalizedDescriptionKey: "modelId and localPath are required"]
        )
      }

      guard FileManager.default.fileExists(atPath: localPath) else {
        return [
          "loaded": false,
          "modelId": modelId,
          "backend": "none",
          "message": "File not found at path: \(localPath)",
        ]
      }

      // File exists but no backend is linked in Phase 2A
      return [
        "loaded": false,
        "modelId": modelId,
        "backend": "none",
        "message": "File validated — no inference backend linked. loadModel activates in Phase 2B.",
      ]
    }

    AsyncFunction("unloadModel") { (modelId: String) -> [String: Any] in
      let wasLoaded = self.loadedModelId == modelId
      self.loadedModelId = nil
      return [
        "unloaded": wasLoaded,
        "modelId": modelId,
        "message": wasLoaded ? "Model state cleared." : "No model was loaded with that ID.",
      ]
    }
  }

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
