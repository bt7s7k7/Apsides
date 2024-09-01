import { makeRandomID } from "../comTypes/util"
import { Logger } from "../foundation/logger/Logger"
import { AsyncInitializationQueue } from "../serviceProvider/AsyncInitializationQueue"
import { ServiceFactory, ServiceKind } from "../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../serviceProvider/ServiceProvider"
import { Struct } from "../struct/Struct"
import { Type } from "../struct/Type"
import { Api } from "../structRpc/api/Api"
import { RpcServer } from "../structRpc/architecture/RpcServer"
import { TodoList, TodoListController } from "./TodoList"

const TodoListInfo_t = Type.pick(TodoList.ref(), "id", "label")

export const TodoManagerApi = Api.define(class TodoManager extends Struct.define("TodoManager", {
}) { }, {
    onListChanged: Api.event(Type.string),

    getLists: Api.action(Type.empty, TodoListInfo_t.as(Type.array)),
    createList: Api.action(Type.object({ label: Type.string }), Type.string),
})

export class TodoManagerProxy extends TodoManagerApi.makeProxy() { }

export class TodoManagerController extends TodoManagerApi.makeController() /* implements Api._ControllerImpl<typeof TodoManagerApi extends Api<any, infer U> ? U : never>  */ {
    protected readonly _lists = new Map<string, TodoListController>()
    protected readonly _services = this.rpcServer.services
    protected readonly _logger = this._services.get(Logger.kind)

    static {
        TodoManagerApi.makeControllerImpl(TodoManagerController, {
            async _init() {
                this._logger.info`Loading TodoManagerController`
            },
            async createList({ label }) {
                const list = await this.rpcServer.makeController(TodoListController, new TodoList({
                    id: makeRandomID(),
                    items: TodoList.baseType.props.items.default(),
                    label
                }))

                this._lists.set(list.id, list)
                this.rpcServer.registerController(list)
                this.onListChanged.emit(list.id)

                return list.id
            },
            async getLists() {
                return [...this._lists.values()].map(v => ({ id: v.id, label: v.label }))
            }
        })
    }

    public static readonly kind = new ServiceKind<TodoManagerController>("TodoManager")
    public static init(services: ServiceProvider) {
        const server = services.get(RpcServer.kind)
        const controller = new TodoManagerController(server, null)
        server.registerController(controller)
        const asyncQueue = services.get(AsyncInitializationQueue.kind)
        asyncQueue.addTask(controller.init(undefined!))
        return controller
    }
}

TodoManagerController satisfies ServiceFactory<TodoManagerController>

