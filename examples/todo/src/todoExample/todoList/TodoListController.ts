import { TodoListApi } from "./TodoList"


export class TodoListController extends TodoListApi.makeController() {
    static {
        TodoListApi.makeControllerImpl(this, {
            async setLabel(label) {
                this._mutate(v => v.label = label)
            }
        })
    }
}
