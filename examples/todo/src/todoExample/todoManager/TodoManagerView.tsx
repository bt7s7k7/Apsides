import { mdiPlus } from "@mdi/js"
import { defineComponent } from "vue"
import { RouterView, useRoute, useRouter } from "vue-router"
import { FormView } from "../../formBuilder/FormView"
import { useForm } from "../../formBuilder/useForm"
import { Type } from "../../struct/Type"
import { Button, ButtonGroup, ButtonProps } from "../../vue3gui/Button"
import { useDynamicsEmitter } from "../../vue3gui/DynamicsEmitter"
import { Menu } from "../../vue3gui/Menu"
import { MenuItemProps } from "../../vue3gui/MenuItem"
import { useServiceProvider } from "../../vueFoundation/VueApplication"
import { createLoader } from "../../vueFoundation/createLoader"
import { createRoute } from "../../vueFoundation/createRoute"
import { performAction } from "../../vueFoundation/performAction"
import { TodoList } from "../todoList/TodoList"
import { TODO_LIST_VIEW } from "../todoList/TodoListView"
import { TodoListInfo, TodoManager } from "./TodoManager"
import { TODO_MANAGER_HANDLE } from "./TodoManagerHandle"

const TodoListInit_t = Type.pick(TodoList.baseType, "label")

export const TodoManagerView = (defineComponent({
    name: "TodoManagerView",
    props: {
        manager: { type: TodoManager, required: true }
    },
    setup(props, ctx) {
        const emitter = useDynamicsEmitter()
        const router = useRouter()
        const route = useRoute()

        const manager = props.manager

        const targetRoute = TODO_LIST_VIEW.name

        const menu = new class _TodoMenu extends Menu<TodoListInfo> {
            public getItems(): TodoListInfo[] {
                return manager.lists ?? []
            }

            public getKey(item: TodoListInfo): string {
                return item.id
            }

            public override getLabel(item: TodoListInfo) {
                return item.label
            }

            public isSelected(item: TodoListInfo) {
                return route.name == targetRoute && item.id == route.params.id
            }

            public override getProps(item: TodoListInfo): MenuItemProps.Function & ButtonProps.Function {
                return {
                    to: { name: targetRoute, params: { id: item.id } }
                }
            }
        }

        async function add() {
            const form = useForm({
                value: TodoListInit_t.default(),
                type: TodoListInit_t,
            })

            const modal = emitter.modal(() => <>
                <b class="mb-2">Create TODO list</b>
                <FormView form={form} />
            </>, {
                props: {
                    okButton: "Create",
                    cancelButton: true,
                    class: "w-300"
                }
            })

            if (!await modal) return

            const result = await performAction(emitter, () => manager.createList(form.value), "Creating...")
            if (result == null) return
            router.push({ name: targetRoute, params: { id: result.id } })
        }

        return () => (
            <div class="flex-fill flex row">
                <div class="flex-basis-200 border-right flex column">
                    <ButtonGroup clear>
                        {menu.renderRoot()}
                        <Button label="Add" icon={mdiPlus} onClick={add} />
                    </ButtonGroup>
                </div>
                <RouterView class="flex-fill" />
            </div>
        )
    }
}))

export const TODO_MANAGER_VIEW = createRoute({
    name: "TodoManager",
    path: "/",
    component: createLoader.withComponent(async (guard) => {
        const services = useServiceProvider()
        const manager = services.get(TODO_MANAGER_HANDLE.kind)

        return () => <TodoManagerView manager={manager} />
    }, { overlayProps: { class: "flex-fill flex column" } })
})
