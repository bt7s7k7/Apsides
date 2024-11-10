import { PropType, defineComponent } from "vue"
import { NATIVE_EVENTS } from "../vue3gui/util"

export interface FormDefinition {
    render(): any
}

export const FormView = (defineComponent({
    name: "FormView",
    props: {
        form: { type: Object as PropType<FormDefinition>, required: true },
        ...NATIVE_EVENTS,
    },
    setup(props, ctx) {
        return () => (
            props.form.render()
        )
    },
}))
