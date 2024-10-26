import { Disposable } from "./Disposable"
import { DISPOSABLE_HANDLE, DisposableHandle } from "./DisposableHandle"

export class EventListener extends Disposable {
    public readonly [DISPOSABLE_HANDLE] = new DisposableHandle(this)
}
