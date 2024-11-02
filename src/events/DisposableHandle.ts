import { ToReadonlyCollection } from "../comTypes/types"
import { AUTO_DISPOSE, Disposable } from "./Disposable"

export const DISPOSABLE_HANDLE = Symbol.for("apsides.events.disposable-handle")

export class DisposableHandle<T extends Disposable = Disposable> extends Disposable {
    public readonly [AUTO_DISPOSE] = true

    /** Stores all users that registered with this handle */
    protected _users = new Set<DisposableUser>()

    public override[Symbol.dispose]() {
        for (const user of this._users) {
            user.removeHandle(this)
        }

        this._users.clear()

        super[Symbol.dispose]()
    }

    /** Registers a user with this handle, the user will be notified when this handle is disposed. Only one registration per user is allowed otherwise an error will be thrown. */
    public registerUser(user: DisposableUser) {
        if (this._users.has(user)) throw new Error("Duplicate user registered for disposable handle")
        this._users.add(user)
    }

    /** Removes the users registration from this handle. If the user is not registered nothing happens. */
    public unregisterUser(user: DisposableUser) {
        this._users.delete(user)
    }

    /** Gets the count of currently registered users. */
    public getUserCount() {
        return this._users.size
    }

    /** Returns a set of all registered users. This is a live reference to the collection, it will update when users are (un)registered. */
    public getUsers() {
        return this._users as ToReadonlyCollection<typeof this._users>
    }

    constructor(
        /** The value this handle handles. */
        public value: T
    ) { super() }
}

/** Implement this interface if you want to receive a notification when a {@link DisposableHandle} is disposed. */
export interface DisposableUser {
    /** Executed when a {@link DisposableHandle}, that this object has been registered with, is disposed. */
    removeHandle(handle: DisposableHandle): void
}

/** Stores multiple {@link DisposableHandle} instances, when any of the stored handles are disposed, they are automatically removed from this collection. */
export class DisposableHandleCollection<T> extends Disposable implements DisposableUser {
    public readonly [AUTO_DISPOSE] = true

    protected _handles = new Map<DisposableHandle, T>()

    public addHandle(handle: DisposableHandle, value: T) {
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
