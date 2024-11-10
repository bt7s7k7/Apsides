import { defineComponent, onUnmounted } from "vue"
import { Disposable } from "../events/Disposable"
import { ClientError } from "../foundation/messaging/errors"
import { Icon } from "../vue3gui/Icon"
import { Overlay } from "../vue3gui/Overlay"
import { asyncComputed, ComponentProps } from "../vue3gui/util"

export function createLoader(thunk: (guard: (disposable: Disposable) => void) => Promise<() => any>, options?: { overlayProps?: ComponentProps<typeof Overlay> }) {
    const guarded: Disposable[] = []

    onUnmounted(() => {
        for (const guard of guarded) {
            guard[Symbol.dispose]()
        }
    })

    function guard(value: Disposable) {
        guarded.push(value)
    }

    const result = asyncComputed(() => null, () => thunk(guard))

    return () => (
        <Overlay
            loading show={result.loading} variant="clear" {...options?.overlayProps} debounce
            class={result.error ? "flex row center gap-2 text-danger" : undefined}
        >
            {result.error ? <>
                <Icon icon="M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z" />
                {result.error instanceof ClientError ? (
                    result.error.message
                ) : (
                    "Unexpected error occurred"
                )}
            </> : result.value?.()}
        </Overlay>
    )
}

export namespace createLoader {
    type _Params = Parameters<typeof createLoader>

    export function withComponent(thunk: _Params[0], options?: _Params[1]) {
        return defineComponent({
            name: "Loader",
            setup(props, ctx) {
                return createLoader(thunk, options)
            },
        })
    }

    type _AddIdParameter<T> = T extends (...args: infer UArgs) => infer UResult ? (id: string, ...args: UArgs) => UResult : never

    export function withComponentAndId(thunk: _AddIdParameter<_Params[0]>, options?: _Params[1]) {
        return defineComponent({
            name: "Loader",
            props: {
                id: { type: String, required: true },
            },
            setup(props, ctx) {
                return createLoader((guard) => {
                    return thunk(props.id, guard)
                }, options)
            },
        })
    }
}
