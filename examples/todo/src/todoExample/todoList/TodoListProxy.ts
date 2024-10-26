import { reactive } from "vue"
import { TodoListApi } from "./TodoList"


export class TodoListProxy extends TodoListApi.makeProxy(reactive) { }
