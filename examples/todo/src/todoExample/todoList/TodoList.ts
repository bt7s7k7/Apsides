import { RestResourceNameAttribute } from "../../restTransport/RestTransport"
import { Struct } from "../../struct/Struct"
import { Type } from "../../struct/Type"
import { Api } from "../../structRpc/api/Api"
import { Handle } from "../../structRpc/api/Handle"

export class TodoList extends Struct.define("TodoList", class {
    id = Type.string.as(Struct.field)
    label = Type.string.as(Struct.field)
    items = Type.boolean.as(Type.map).as(Struct.field)

    public readonly setLabel = Api.action(Type.string, Type.empty, "Updates the todo list label").as(Struct.field)
}, Handle, {
    baseTypeDecorator(type) {
        return type.annotate(new RestResourceNameAttribute("todo"))
    },
}) {
    public static readonly api = Api.define(this)
}
