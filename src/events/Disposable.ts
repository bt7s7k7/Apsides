/** When an object is disposed, all properties which contain this symbol set to `true` will also be disposed. */
export const AUTO_DISPOSE = Symbol.for("apsides.events.auto-dispose")

/** Extend this class to comply with the disposable object protocol. */
export class Disposable {
    public [Symbol.dispose]() {
        defaultDisposeAction(this)
    }
}

/** This function will replace the dispose function on any disposed {@link Disposable}, so an error is thrown if the object is disposed twice. */
function _doubleDisposeGuard() {
    throw new Error("Object was disposed already")
}

/** Disposes an object. Automatically called by the default implementation of {@link Disposable}, use this if you want to implement that interface yourself. */
export function defaultDisposeAction(object: Disposable) {
    object[Symbol.dispose] = _doubleDisposeGuard

    for (const property of Object.values(object)) {
        if (typeof property == "object" && property != null && AUTO_DISPOSE in property && property[AUTO_DISPOSE]) {
            property[Symbol.dispose]()
        }
    }

    for (const symbol of Object.getOwnPropertySymbols(object)) {
        const property = (object as any)[symbol]
        if (typeof property == "object" && property != null && AUTO_DISPOSE in property && property[AUTO_DISPOSE]) {
            property[Symbol.dispose]()
        }
    }
}
