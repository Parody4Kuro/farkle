import AppKit
import Foundation

// Original vector artwork, based on this game's five-pip favicon. No external assets.
let destination = URL(fileURLWithPath: CommandLine.arguments.dropFirst().first ?? "desktop/resources", isDirectory: true)
let temporary = FileManager.default.temporaryDirectory.appendingPathComponent("tavern-icon-\(UUID().uuidString)", isDirectory: true)
let iconset = temporary.appendingPathComponent("icon.iconset", isDirectory: true)
try FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)
try FileManager.default.createDirectory(at: destination, withIntermediateDirectories: true)
defer { try? FileManager.default.removeItem(at: temporary) }

func color(_ r: CGFloat, _ g: CGFloat, _ b: CGFloat) -> NSColor {
    NSColor(srgbRed: r / 255, green: g / 255, blue: b / 255, alpha: 1)
}

func render(_ pixels: Int) -> Data {
    let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
    let scale = AffineTransform(scaleByX: CGFloat(pixels) / 1024, byY: CGFloat(pixels) / 1024)
    (scale as NSAffineTransform).concat()
    let outer = NSBezierPath(roundedRect: NSRect(x: 80, y: 80, width: 864, height: 864), xRadius: 186, yRadius: 186)
    NSGradient(starting: color(23, 28, 25), ending: color(58, 39, 26))!.draw(in: outer, angle: 90)
    let border = NSBezierPath(roundedRect: NSRect(x: 114, y: 114, width: 796, height: 796), xRadius: 157, yRadius: 157)
    color(167, 118, 60).setStroke(); border.lineWidth = 10; border.stroke()
    let die = NSBezierPath(roundedRect: NSRect(x: 250, y: 250, width: 524, height: 524), xRadius: 104, yRadius: 104)
    let shadow = NSShadow(); shadow.shadowColor = NSColor.black.withAlphaComponent(0.45)
    shadow.shadowBlurRadius = 28; shadow.shadowOffset = NSSize(width: 0, height: -18)
    NSGraphicsContext.saveGraphicsState(); shadow.set()
    color(211, 166, 96).setFill(); die.fill(); NSGraphicsContext.restoreGraphicsState()
    NSGradient(starting: color(199, 159, 98), ending: color(245, 220, 168))!.draw(in: die, angle: 90)
    color(246, 218, 160).setStroke(); die.lineWidth = 10; die.stroke()
    for (x, y) in [(370.0, 370.0), (654.0, 370.0), (370.0, 654.0), (654.0, 654.0), (512.0, 512.0)] {
        (x == 512 ? color(111, 47, 38) : color(48, 35, 24)).setFill()
        NSBezierPath(ovalIn: NSRect(x: x - 44, y: y - 44, width: 88, height: 88)).fill()
    }
    NSGraphicsContext.restoreGraphicsState()
    return bitmap.representation(using: .png, properties: [:])!
}

for size in [16, 32, 128, 256, 512] {
    for multiplier in [1, 2] {
        let suffix = multiplier == 2 ? "@2x" : ""
        try render(size * multiplier).write(to: iconset.appendingPathComponent("icon_\(size)x\(size)\(suffix).png"))
    }
}
try render(1024).write(to: destination.appendingPathComponent("icon.png"))
let process = Process()
process.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
process.arguments = ["--convert", "icns", "--output", destination.appendingPathComponent("icon.icns").path, iconset.path]
try process.run(); process.waitUntilExit()
if process.terminationStatus != 0 { exit(process.terminationStatus) }
print("Generated original Tavern Bones icon at \(destination.path)")
