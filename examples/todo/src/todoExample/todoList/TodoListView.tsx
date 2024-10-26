import { defineComponent } from "vue"
import { FormView } from "../../formBuilder/FormView"
import { useForm } from "../../formBuilder/useForm"
import { CustomFieldAttribute, ExplicitFieldAttribute, ReadonlyField } from "../../formML/Form"
import { Type } from "../../struct/Type"
import { RpcClient } from "../../structRpc/architecture/RpcClient"
import { useDynamicsEmitter } from "../../vue3gui/DynamicsEmitter"
import { createLoader } from "../../vueFoundation/createLoader"
import { createRoute, wrapComponentWithId } from "../../vueFoundation/createRoute"
import { performAction } from "../../vueFoundation/performAction"
import { useServiceProvider } from "../../vueFoundation/VueApplication"
import { TODO_MANAGER_VIEW } from "../todoManager/TodoManagerView"
import { TodoListProxy } from "./TodoListProxy"

export const TodoListView = (defineComponent({
    name: "TodoListView",
    props: {
        list: { type: TodoListProxy, required: true }
    },
    setup(props, ctx) {
        const list = props.list
        const emitter = useDynamicsEmitter()

        const form = useForm({
            value: list,
            type: Type.object({
                id: Type.string.annotate(new CustomFieldAttribute(ReadonlyField.default())),
                label: Type.string.annotate(new ExplicitFieldAttribute())
            }),
            fieldOptions: {
                onChange(event) {
                    if (event.isPath(["label"])) {
                        performAction(emitter, () => list.setLabel(event.value), "Renaming...")
                    }
                },
            },
        })

        return () => (
            <div class="flex column p-4">
                <FormView form={form} />
            </div>
        )
    }
}))

export const TODO_LIST_VIEW = createRoute({
    name: "TodoList",
    path: "/list/:id",
    parent: TODO_MANAGER_VIEW,
    component: wrapComponentWithId(createLoader.withComponentAndId(async (id, guard) => {
        const services = useServiceProvider()
        const client = services.get(RpcClient.kind)
        const list = await client.getBoundProxy(TodoListProxy, id)
        guard(list)

        return () => <TodoListView list={list} />
    }, { overlayProps: { class: "flex-fill" } }))
})
