import { Struct } from "../../struct/Struct"
import { Type } from "../../struct/Type"
import { Api } from "../../structRpc/api/Api"
import { BindResultAttribute } from "../../structRpc/api/BindResultAttribute"
import { TodoList } from "../todoList/TodoList"

const TodoListInfo_t = Type.pick(TodoList.ref(), "id", "label")
export type TodoListInfo = Type.Extract<typeof TodoListInfo_t>

export const TodoManagerApi = Api.define(class TodoManager extends Struct.define("TodoManager", {
    lists: TodoListInfo_t.as(Type.array)
}) { }, {
    createList: Api.action(Type.object({ label: Type.string }), TodoList.ref().annotate(BindResultAttribute), "Creates a new todo list"),
})
