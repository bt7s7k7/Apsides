import { AUTO_DISPOSE, Disposable } from "./Disposable"
import { DISPOSABLE_HANDLE, DisposableHandle, DisposableUser } from "./DisposableHandle"

/** Handles event listener registration and delivery of events. */
export class EventEmitter<T = void> extends Disposable implements DisposableUser {
    public readonly [AUTO_DISPOSE] = true

    /** All listeners that will receive an event when emitted. */
    protected readonly _listeners = new Map<number, EventEmitter.Listener<T>>
    /** Counter for assigning unique IDs to listeners. */
    protected _nextId = 0

    /** Used for debouncing, stores the amount of time this object will wait before emitting an event. */
    protected readonly _timeout: number
    /** If this emitter is synchronous. */
    protected readonly _sync: boolean
    /** If this emitter is asynchronous, only the latest event will be delivered. If this emitter is synchronous, this value is ignored. */
    protected readonly _deduplicate: boolean

    /** Used for debouncing, ID of the latest registered timeout or null if there aren't any */
    protected _timeoutID: any = null
    /** Next event that will be delivered. Only used for async emitters with deduplication or debounced emitters. */
    protected _nextEvent: T | null = null

    /** Adds a listener that will be notified when an event is emitted. If the `handle` is not `null` the listener will be automatically removed when the handle is disposed. */
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

    /** Creates a new promise that will be resolved as soon as an event is emitted. If the `handle` is not `null` the listener will be automatically removed when the handle is disposed. */
    public asPromise(handle: EventEmitter.Handle<Disposable> = null) {
        return new Promise((resolve) => this.add(handle, resolve, { once: true }))
    }

    /** Emits the event synchronously right now. */
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

    /** Emits the event */
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

    /** Removes a listener by id. */
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

    /** Object that owns a listener. When it is disposed, all its listeners are also disposed. */
    export type Handle<T extends Disposable> = DisposableHandle<T> | { [DISPOSABLE_HANDLE]: DisposableHandle<T> } | null

    /** Callback function that will be called when a event is emitted. */
    export type Handler<T, TSelf> = (event: T, self: TSelf) => void

    /** Information about an event listener. */
    export interface Listener<T> {
        handle: DisposableHandle | null
        callback: Handler<T, Disposable | null>
        /** If `true` this listener will be removed after it handles one event */
        once: boolean
    }

    declare const EVENT_BINDING: unique symbol
    /** Stores the ID of an event listener and can be used to remove it from an {@link EventEmitter}. */
    export type EventBinding = { [EVENT_BINDING]: true } & number
}
