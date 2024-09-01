import { AUTO_DISPOSE, Disposable } from "./Disposable"
import { DISPOSABLE_HANDLE, DisposableHandle, DisposableUser } from "./DisposableHandle"

export class EventEmitter<T> extends Disposable implements DisposableUser {
    public readonly [AUTO_DISPOSE] = true

    protected readonly _listeners = new Map<number, EventEmitter.Listener<T>>
    protected _nextId = 0

    protected readonly _timeout: number
    protected readonly _sync: boolean
    protected readonly _deduplicate: boolean

    protected _timeoutID: any = null
    protected _nextEvent: T | null = null

    public add<TOwner extends Disposable>(handle: EventEmitter.Handle<TOwner>, handler: EventEmitter.Handler<T, TOwner>, options?: { once?: boolean }) {
        const id = this._nextId++

        if (handle != null && DISPOSABLE_HANDLE in handle) handle = handle[DISPOSABLE_HANDLE]

        const listener: EventEmitter.Listener<T> = {
            handle,
            callback: handler as EventEmitter.Handler<T, Disposable | null>,
            once: options?.once ?? false
        }

        this._listeners.set(id, listener)
        handle?.registerUser(this)

        return id as EventEmitter.EventBinding
    }

    public asPromise(handle: EventEmitter.Handle<Disposable>) {
        return new Promise((resolve) => this.add(handle, resolve, { once: true }))
    }

    protected _emit(event: T) {
        for (const id of this._listeners.keys()) {
            const listener = this._listeners.get(id)

            // Listener can be null, if it is removed during execution of another listener
            if (listener != null) {
                const once = listener.once
                const self = listener.handle?.value ?? null
                if (once) this.remove(id as EventEmitter.EventBinding)
                listener.callback(event, self)
            }
        }
    }

    public emit(event: T) {
        if (this._timeout != 0) {
            this._nextEvent = event!

            if (this._timeoutID == null) {
                this._timeoutID = setTimeout(() => {
                    this._timeoutID = null
                    const nextEvent = this._nextEvent!
                    this._nextEvent = null
                    this._emit(nextEvent)
                }, this._timeout)
            }
        } else if (!this._sync) {
            if (this._deduplicate) {
                this._nextEvent = event

                if (this._timeoutID == null) {
                    this._timeoutID = true
                    queueMicrotask(() => {
                        this._timeoutID = null
                        const nextEvent = this._nextEvent!
                        this._nextEvent = null
                        this._emit(nextEvent)
                    })
                }
            } else {
                queueMicrotask(() => this._emit(event))
            }
        } else {
            this._emit(event)
        }
    }

    public remove(binding: EventEmitter.EventBinding) {
        const listener = this._listeners.get(binding)
        if (listener == null) return false

        listener.handle?.unregisterUser(this)
        this._listeners.delete(binding)

        return true
    }

    public removeHandle(handleToRemove: DisposableHandle): void {
        for (const [id, { handle }] of [...this._listeners]) {
            if (handle == handleToRemove) {
                this._listeners.delete(id)
            }
        }
    }

    public override[Symbol.dispose](): void {
        for (const listener of this._listeners.values()) {
            listener.handle?.unregisterUser(this)
        }

        this._listeners.clear()

        super[Symbol.dispose]()
    }

    constructor(options?: EventEmitter.Options) {
        super()

        this._timeout = options?.debounceTimeout ?? 0
        this._deduplicate = options?.deduplicate ?? true
        this._sync = options?.sync ?? false
    }
}

export namespace EventEmitter {
    export interface Options {
        /** Waits this timeout before calling listeners, only the latest event value is emitted @default 0 */
        debounceTimeout?: number
        /** By default, listeners are notified on the next microtask, set this to notify immediately @default false */
        sync?: boolean
        /** Notify listeners with only the latest event (only applicable is emitter is async, which is default) @default true */
        deduplicate?: boolean
    }

    export type Handle<T extends Disposable> = DisposableHandle<T> | { [DISPOSABLE_HANDLE]: DisposableHandle<T> } | null

    export type Handler<T, TSelf> = (event: T, self: TSelf) => void

    export interface Listener<T> {
        handle: DisposableHandle | null
        callback: Handler<T, Disposable | null>
        once: boolean
    }

    declare const EVENT_BINDING: unique symbol
    export type EventBinding = { [EVENT_BINDING]: true } & number
}
