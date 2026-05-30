package expo.modules.nativedeviceruntime

import android.app.ActivityManager
import android.content.Context
import android.os.Build
import android.os.PowerManager
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class NativeDeviceRuntimeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("NativeDeviceRuntime")

    Function("isNativeRuntimeAvailable") {
      true
    }

    AsyncFunction("getRuntimeSnapshot") {
      val context = appContext.reactContext
        ?: throw IllegalStateException("Android context is not available")

      val runtime = Runtime.getRuntime()
      val processorCount = runtime.availableProcessors()
      val activeProcessorCount = processorCount

      val activityManager =
        context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
      val memInfo = ActivityManager.MemoryInfo()
      activityManager.getMemoryInfo(memInfo)
      val physicalMemoryBytes = memInfo.totalMem

      val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      val lowPowerModeEnabled = powerManager.isPowerSaveMode

      val thermalState = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        when (powerManager.currentThermalStatus) {
          PowerManager.THERMAL_STATUS_NONE,
          PowerManager.THERMAL_STATUS_LIGHT -> "nominal"
          PowerManager.THERMAL_STATUS_MODERATE -> "fair"
          PowerManager.THERMAL_STATUS_SEVERE -> "serious"
          PowerManager.THERMAL_STATUS_CRITICAL,
          PowerManager.THERMAL_STATUS_EMERGENCY,
          PowerManager.THERMAL_STATUS_SHUTDOWN -> "critical"
          else -> "unknown"
        }
      } else {
        "unknown"
      }

      val pkg = try {
        context.packageManager.getPackageInfo(context.packageName, 0)
      } catch (_: Exception) {
        null
      }
      val appVersion: String? = pkg?.versionName
      val buildNumber: String? = if (pkg != null) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
          pkg.longVersionCode.toString()
        } else {
          @Suppress("DEPRECATION")
          pkg.versionCode.toString()
        }
      } else {
        null
      }

      mapOf(
        "platform" to "android",
        "osVersion" to Build.VERSION.RELEASE,
        "deviceModel" to "${Build.MANUFACTURER} ${Build.MODEL}",
        "processorCount" to processorCount,
        "activeProcessorCount" to activeProcessorCount,
        "physicalMemoryBytes" to physicalMemoryBytes,
        "lowPowerModeEnabled" to lowPowerModeEnabled,
        "thermalState" to thermalState,
        "appVersion" to appVersion,
        "buildNumber" to buildNumber
      )
    }
  }
}
