import { ToReadonlyCollection } from "../comTypes/types"
import { AUTO_DISPOSE, Disposable } from "./Disposable"

export const DISPOSABLE_HANDLE = Symbol.for("apsides.events.disposable-handle")

export class DisposableHandle<T extends Disposable = Disposable> extends Disposable {
    public readonly [AUTO_DISPOSE] = true

    protected _users = new Set<DisposableUser>()

    public override[Symbol.dispose]() {
        for (const user of this._users) {
            user.removeHandle(this)
        }

        this._users.clear()

        super[Symbol.dispose]()
    }

    public registerUser(user: DisposableUser) {
        if (this._users.has(user)) throw new Error("Duplicate user registered for disposable handle")
        this._users.add(user)
    }

    public unregisterUser(user: DisposableUser) {
        this._users.delete(user)
    }

    public getUserCount() {
        return this._users.size
    }

    public getUsers() {
        return this._users as ToReadonlyCollection<typeof this._users>
    }

    constructor(
        public value: T
    ) { super() }
}

export interface DisposableUser {
    removeHandle(handle: DisposableHandle): void
}

export class DisposableHandleCollection<T> extends Disposable implements DisposableUser {
    public readonly [AUTO_DISPOSE] = true

    protected _handles = new Map<DisposableHandle, T>()

    public add(handle: DisposableHandle, value: T) {
        this._handles.set(handle, value)
        handle.registerUser(this)
    }

    public removeHandle(handle: DisposableHandle) {
        this._handles.delete(handle)
        handle.unregisterUser(this)
    }

    public override[Symbol.dispose]() {
        for (const handle of this._handles.keys()) {
            handle.unregisterUser(this)
        }

        super[Symbol.dispose]()
    }
}
