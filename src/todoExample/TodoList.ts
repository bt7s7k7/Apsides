import { Struct } from "../struct/Struct"
import { Type } from "../struct/Type"
import { Api } from "../structRpc/api/Api"

export class TodoList extends Struct.define("TodoList", {
    id: Type.string,
    label: Type.string,
    items: Type.boolean.as(Type.map)
}) { }

export const TodoListApi = Api.define(TodoList, {
    setLabel: Api.action(Type.string, Type.empty),
})

export class TodoListProxy extends TodoListApi.makeProxy() { }
export class TodoListController extends TodoListApi.makeController() {
    static {
        TodoListApi.makeControllerImpl(this, {
            async setLabel(label) {
                this._mutate(v => v.label = label)
            }
        })
    }
}
