package expo.modules.nativellmruntime

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class NativeLLMRuntimeModule : Module() {
  private var loadedModelId: String? = null

  override fun definition() = ModuleDefinition {
    Name("NativeLLMRuntime")

    AsyncFunction("getLLMRuntimeHealth") {
      val loadedId = loadedModelId
      mapOf(
        "available" to false,
        "isLinked" to false,
        "platform" to "android",
        "backend" to "none",
        "supportsStreaming" to false,
        "supportsCancellation" to false,
        "supportsQuantizedModels" to false,
        "supportedFormats" to emptyList<String>(),
        "loadedModelId" to loadedId,
        "reasonUnavailable" to "No Android inference backend linked yet. iOS llama.cpp exists; Android backend is planned for a later phase.",
      )
    }

    AsyncFunction("listInstalledModels") {
      scanModelsDirectory()
    }

    AsyncFunction("loadModel") { request: Map<String, Any?> ->
      val modelId = request["modelId"] as? String
        ?: throw IllegalArgumentException("modelId is required")
      val localPath = request["localPath"] as? String
        ?: throw IllegalArgumentException("localPath is required")

      val file = File(localPath)
      if (!file.exists()) {
        return@AsyncFunction mapOf(
          "loaded" to false,
          "modelId" to modelId,
          "backend" to "none",
          "message" to "File not found at path: $localPath",
        )
      }

      mapOf(
        "loaded" to false,
        "modelId" to modelId,
        "backend" to "none",
        "message" to "File validated, but Android inference backend is not linked yet.",
      )
    }

    AsyncFunction("unloadModel") { modelId: String ->
      val wasLoaded = loadedModelId == modelId
      loadedModelId = null
      mapOf(
        "unloaded" to wasLoaded,
        "modelId" to modelId,
        "message" to if (wasLoaded) "Model state cleared." else "No model was loaded with that ID.",
      )
    }
  }

  private fun scanModelsDirectory(): List<Map<String, Any?>> {
    val context = appContext.reactContext ?: return emptyList()
    val filesDir = context.filesDir
    val dateFormat = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
    val modelExtensions = setOf("gguf", "bin")
    val models = mutableListOf<Map<String, Any?>>()

    filesDir.walkTopDown().filter { it.isFile }.forEach { file ->
      val ext = file.extension.lowercase(Locale.US)
      if (ext !in modelExtensions) return@forEach

      val format = when (ext) {
        "gguf" -> "gguf"
        "bin" -> "bin"
        else -> "unknown"
      }

      models.add(
        mapOf(
          "id" to file.name,
          "name" to file.nameWithoutExtension,
          "localPath" to file.absolutePath,
          "format" to format,
          "sizeBytes" to file.length(),
          "discoveredAt" to dateFormat.format(Date(file.lastModified())),
        )
      )
    }

    return models
  }
}
