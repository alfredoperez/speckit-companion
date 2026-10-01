// Lists on-screen app windows front to back as "<id>\t<owner>\t<title>". qa-stage.sh compiles it once.
import CoreGraphics

let list = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID) as? [[String: Any]] ?? []
for w in list where (w[kCGWindowLayer as String] as? Int ?? 1) == 0 {
    let id = w[kCGWindowNumber as String] as? Int ?? 0
    let owner = w[kCGWindowOwnerName as String] as? String ?? ""
    let title = w[kCGWindowName as String] as? String ?? ""
    print("\(id)\t\(owner)\t\(title)")
}
