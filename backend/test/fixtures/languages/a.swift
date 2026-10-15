import Foundation

class Service: Base {
    func run(x: Int) { if x > 0 { helper() } }
}
protocol Runner { func run(x: Int) }
