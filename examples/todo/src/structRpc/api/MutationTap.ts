import { Readwrite } from "../../comTypes/types"
import { unreachable } from "../../comTypes/util"
import { AUTO_DISPOSE } from "../../events/Disposable"
import { EventEmitter } from "../../events/EventEmitter"
import { EventListener } from "../../events/EventListener"
import { RpcServer } from "../architecture/RpcServer"
import { Api } from "./Api"

class _ChangedEmitter<T extends Api.Controller = any> extends EventEmitter<ReadonlySet<T>> {
    protected override _emit(event: ReadonlySet<T>): void {
        super._emit(event)
        this.tap["_changed"].clear()
    }

    constructor(
        public readonly tap: MutationTap<T>
    ) { super({ deduplicate: true }) }
}

export class MutationTap<T extends Api.Controller = any> extends EventListener {
    public [AUTO_DISPOSE] = true

    protected readonly _changed = new Set<T>()

    public readonly onChanged: EventEmitter<ReadonlySet<T>> = new _ChangedEmitter<T>(this)

    public handleChanged(controller: T) {
        this._changed.add(controller)
        this.onChanged.emit(this._changed)
    }

    public override[Symbol.dispose]() {
        const tapCollection = this.server["_taps"].get(this.type) ?? unreachable()
        tapCollection.delete(this) || unreachable()

        if (tapCollection.size == 0) {
            this.server["_taps"].delete(this.type)
        }

        (this as Readwrite<this>).server = null!

        super[Symbol.dispose]()
    }

    public addCallback(callback: (value: ReadonlySet<T>) => void): this {
        this.onChanged.add(null, callback)
        return this
    }

    constructor(
        public readonly server: RpcServer,
        public readonly type: string
    ) { super() }
}

