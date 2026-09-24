// Measure a page in WebKit — the engine Safari and every iPad browser use —
// off screen, with no window and nothing to click.
//
// The preview pane is Chromium, and the two disagree more than one would like:
// `white-space: nowrap` on the words of a passage wrapped in Chrome and put
// every paragraph on one line in Safari. This loads a page, runs a script until
// it stops answering "WAIT", and prints what the script returns.
//
//   swiftc -O scripts/webkit-probe.swift -o .cache/webkit-probe
//   .cache/webkit-probe http://localhost:5174/texts/<id> 375 measure.js
//
// Against the dev server the page signs itself in (HANZI_DEV_USER), since the
// request comes from this machine.
import AppKit
import WebKit

let args = CommandLine.arguments
guard args.count >= 4, let url = URL(string: args[1]) else {
  print("usage: webkit-probe <url> <width> <script.js>")
  exit(2)
}
let width = CGFloat(Double(args[2]) ?? 768)
let script = try! String(contentsOfFile: args[3])

final class Probe: NSObject, WKNavigationDelegate {
  let view: WKWebView
  var tries = 0
  init(width: CGFloat) {
    view = WKWebView(frame: NSRect(x: 0, y: 0, width: width, height: 1024), configuration: WKWebViewConfiguration())
    super.init()
    view.navigationDelegate = self
  }
  func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { poll() }
  func poll() {
    tries += 1
    // The app signs in and loads its data after the page itself has loaded.
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
      self.view.evaluateJavaScript(script) { result, error in
        let out = (result as? String) ?? "error: \(String(describing: error))"
        if out.hasPrefix("WAIT") && self.tries < 20 { self.poll(); return }
        print(out)
        exit(0)
      }
    }
  }
}

let app = NSApplication.shared
app.setActivationPolicy(.prohibited)
let probe = Probe(width: width)
probe.view.load(URLRequest(url: url))
DispatchQueue.main.asyncAfter(deadline: .now() + 45) { print("timeout"); exit(1) }
app.run()
