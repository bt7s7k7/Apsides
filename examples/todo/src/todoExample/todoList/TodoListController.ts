import { TodoList } from "./TodoList"

export class TodoListController extends TodoList.api.makeController() {
    static {
        TodoList.api.makeControllerImpl(this, {
            async setLabel(label) {
                this._mutate(v => v.label = label)
            }
        })
    }
}
