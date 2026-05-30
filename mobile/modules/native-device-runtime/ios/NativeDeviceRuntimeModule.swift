import ExpoModulesCore
import Foundation
import UIKit

public class NativeDeviceRuntimeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("NativeDeviceRuntime")

    Function("isNativeRuntimeAvailable") { () -> Bool in
      return true
    }

    AsyncFunction("getRuntimeSnapshot") { () -> [String: Any?] in
      let processInfo = ProcessInfo.processInfo
      let device = UIDevice.current
      let bundle = Bundle.main

      let appVersion = bundle.infoDictionary?["CFBundleShortVersionString"] as? String
      let buildNumber = bundle.infoDictionary?["CFBundleVersion"] as? String

      let thermalState: String
      switch processInfo.thermalState {
      case .nominal: thermalState = "nominal"
      case .fair: thermalState = "fair"
      case .serious: thermalState = "serious"
      case .critical: thermalState = "critical"
      @unknown default: thermalState = "unknown"
      }

      return [
        "platform": "ios",
        "osVersion": device.systemVersion,
        "deviceModel": NativeDeviceRuntimeModule.hardwareModelIdentifier(),
        "processorCount": processInfo.processorCount,
        "activeProcessorCount": processInfo.activeProcessorCount,
        "physicalMemoryBytes": Int64(processInfo.physicalMemory),
        "lowPowerModeEnabled": processInfo.isLowPowerModeEnabled,
        "thermalState": thermalState,
        "appVersion": appVersion as Any?,
        "buildNumber": buildNumber as Any?,
      ]
    }
  }

  private static func hardwareModelIdentifier() -> String {
    var systemInfo = utsname()
    uname(&systemInfo)
    let machineMirror = Mirror(reflecting: systemInfo.machine)
    let identifier = machineMirror.children.reduce(into: "") { partial, element in
      guard let value = element.value as? Int8, value != 0 else { return }
      partial.append(Character(UnicodeScalar(UInt8(value))))
    }
    return identifier.isEmpty ? UIDevice.current.model : identifier
  }
}
