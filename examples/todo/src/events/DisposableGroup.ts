import { Disposable } from "./Disposable"
import { EventListener } from "./EventListener"

export class DisposableGroup extends EventListener {
    protected readonly _guarding: Disposable[] = []

    public guard(target: Disposable) {
        this._guarding.push(target)
    }

    public override[Symbol.dispose]() {
        for (const target of this._guarding) {
            target[Symbol.dispose]()
        }

        this._guarding.length = 0

        super[Symbol.dispose]()
    }
}
