import { Disposable } from "./Disposable"
import { DISPOSABLE_HANDLE, DisposableHandle } from "./DisposableHandle"

/** Extend this class to be able to use it as a handle for an {@link EventEmitter}. */
export class EventListener extends Disposable {
    public readonly [DISPOSABLE_HANDLE] = new DisposableHandle(this)
}
