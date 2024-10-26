import { onUnmounted, Ref, watch } from "vue"

export function useDisposable<T extends Disposable>(value: T) {
    onUnmounted(() => {
        value[Symbol.dispose]()
    })

    return value
}

export function useDisposableRef<T extends Disposable>(ref: Ref<T>) {
    watch(ref, (value, oldValue) => {
        if (value != oldValue) {
            oldValue[Symbol.dispose]()
        }
    })

    onUnmounted(() => {
        ref.value[Symbol.dispose]()
    })

    return ref
}
