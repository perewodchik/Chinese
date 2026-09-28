// Draw the app's icons: a cinnabar seal with 写 in the app's own Kai face.
//
// The app is "good paper with one red stamp on it", and its mark is 写 in
// WenKai (the brand in the top bar), so the icon is that stamp: the whole
// square in --accent, a thin frame inside like the rim of a carved seal, and
// 写 in the colour of the paper. The maskable one (Android crops it to any
// shape) drops the frame and keeps 写 inside the middle 80%.
//
//   swiftc -O scripts/build-icons.swift -o .cache/build-icons && .cache/build-icons
//
// Writes public/icons/*.png. Run it again only when the design changes; the
// PNGs are committed.
import AppKit
import CoreText

let root = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
let out = root.appendingPathComponent("public/icons")
try? FileManager.default.createDirectory(at: out, withIntermediateDirectories: true)

let fontURL = root.appendingPathComponent("public/fonts/wenkai.ttf") as CFURL
guard let descs = CTFontManagerCreateFontDescriptorsFromURL(fontURL) as? [CTFontDescriptor], let desc = descs.first else {
  fatalError("public/fonts/wenkai.ttf not found — run from the project root")
}

func rgb(_ hex: UInt32) -> CGColor {
  CGColor(
    srgbRed: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255,
    blue: CGFloat(hex & 0xff) / 255, alpha: 1)
}
let seal = rgb(0xb8452f)  // --accent
let paper = rgb(0xfbf6ee)  // a shade warmer than --card, as paper under ink

func draw(size: Int, frame: Bool, glyphScale: CGFloat, name: String) {
  let s = CGFloat(size)
  let ctx = CGContext(
    data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
  ctx.setFillColor(seal)
  ctx.fill(CGRect(x: 0, y: 0, width: s, height: s))

  if frame {
    // the rim of the seal: inset, rounded, a little heavier than a hairline
    let inset = s * 0.105
    let rim = CGRect(x: inset, y: inset, width: s - 2 * inset, height: s - 2 * inset)
    ctx.setStrokeColor(paper)
    ctx.setLineWidth(max(1.5, s * 0.022))
    ctx.addPath(CGPath(roundedRect: rim, cornerWidth: s * 0.07, cornerHeight: s * 0.07, transform: nil))
    ctx.strokePath()
  }

  // 写, centred on its ink rather than its em box, so it sits in the middle
  let font = CTFontCreateWithFontDescriptor(desc, s * glyphScale, nil)
  let attr = NSAttributedString(
    string: "写",
    attributes: [
      NSAttributedString.Key(kCTFontAttributeName as String): font,
      NSAttributedString.Key(kCTForegroundColorAttributeName as String): paper,
    ])
  let line = CTLineCreateWithAttributedString(attr)
  let ink = CTLineGetImageBounds(line, ctx)
  ctx.textPosition = CGPoint(x: (s - ink.width) / 2 - ink.minX, y: (s - ink.height) / 2 - ink.minY)
  // WenKai's strokes are a pen's; at 60px on a home screen they need a
  // little more ink, so the glyph is outlined in its own colour too
  ctx.setTextDrawingMode(.fillStroke)
  ctx.setStrokeColor(paper)
  ctx.setLineWidth(s * 0.012)
  ctx.setLineJoin(.round)
  CTLineDraw(line, ctx)

  let rep = NSBitmapImageRep(cgImage: ctx.makeImage()!)
  try! rep.representation(using: .png, properties: [:])!.write(to: out.appendingPathComponent(name))
  print("public/icons/\(name)")
}

draw(size: 512, frame: true, glyphScale: 0.62, name: "icon-512.png")
draw(size: 192, frame: true, glyphScale: 0.62, name: "icon-192.png")
draw(size: 180, frame: true, glyphScale: 0.62, name: "apple-touch-icon.png")
draw(size: 512, frame: false, glyphScale: 0.5, name: "icon-maskable-512.png")
draw(size: 64, frame: false, glyphScale: 0.78, name: "favicon-64.png")
