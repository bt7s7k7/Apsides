import { RestResourceNameAttribute } from "../../restTransport/RestTransport"
import { Struct } from "../../struct/Struct"
import { Type } from "../../struct/Type"
import { Api } from "../../structRpc/api/Api"

export class TodoList extends Struct.define("TodoList", {
    id: Type.string,
    label: Type.string,
    items: Type.boolean.as(Type.map)
}, undefined, {
    baseTypeDecorator(type) {
        return type.annotate(new RestResourceNameAttribute("todo"))
    },
}) { }

export const TodoListApi = Api.define(TodoList, {
    setLabel: Api.action(Type.string, Type.empty, "Updates the todo list label"),
})


