import { Disposable } from "./Disposable"
import { EventListener } from "./EventListener"

/** Wrap multiple disposable values to be disposed at once. */
export class DisposableGroup extends EventListener {
    protected readonly _guarding: Disposable[] = []

    /** Adds a disposable value that will be disposed with this group. */
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
