/** When an object is disposed, all properties which contain this symbol set to `true` will also be disposed. */
export const AUTO_DISPOSE = Symbol.for("apsides.events.auto-dispose")

export class Disposable {
    [Symbol.dispose]() {
        defaultDisposeAction(this)
    }
}

function _doubleDisposeGuard() {
    throw new Error("Object was disposed already")
}

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
