import { defineComponent } from "vue"
import { RouterView } from "vue-router"
import { DynamicsEmitter } from "../vue3gui/DynamicsEmitter"
import { Overlay } from "../vue3gui/Overlay"
import { useApplicationReady } from "./VueApplication"

export const VueApplicationHost = (defineComponent({
    name: "VueApplicationHost",
    setup(props, ctx) {
        const ready = useApplicationReady()

        return () => (
            <DynamicsEmitter>
                {ready.value ? (
                    <RouterView />
                ) : (
                    <Overlay class="flex-fill" loading show variant="clear" debounce />
                )}
            </DynamicsEmitter>
        )
    }
}))
