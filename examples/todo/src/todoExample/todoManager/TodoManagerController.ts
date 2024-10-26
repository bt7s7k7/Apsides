import { makeRandomID } from "../../comTypes/util"
import { Logger } from "../../foundation/logger/Logger"
import { AsyncInitializationQueue } from "../../serviceProvider/AsyncInitializationQueue"
import { ServiceFactory, ServiceKind } from "../../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../../serviceProvider/ServiceProvider"
import { RpcServer } from "../../structRpc/architecture/RpcServer"
import { TodoList } from "../todoList/TodoList"
import { TodoListController } from "../todoList/TodoListController"
import { TodoManagerApi } from "./TodoManager"


export class TodoManagerController extends TodoManagerApi.makeController() {
    protected readonly _lists = new Map<string, TodoListController>()
    protected readonly _services = this.rpcServer.services
    protected readonly _logger = this._services.get(Logger.kind)
    protected readonly _tap = this.rpcServer.addTap(TodoListController).addCallback(() => this._updateListInfo())

    protected _updateListInfo() {
        const lists = [...this._lists.values()].map(v => ({ id: v.id, label: v.label }))
        this._mutate(v => v.lists = lists)
    }

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
                this._updateListInfo()

                return list
            },
        })
    }

    public static readonly kind = new ServiceKind<TodoManagerController>("TodoManager")
    public static init(services: ServiceProvider) {
        const server = services.get(RpcServer.kind)
        const controller = new TodoManagerController(server, null)
        controller._updateListInfo()
        server.registerController(controller)
        const asyncQueue = services.get(AsyncInitializationQueue.kind)
        asyncQueue.addTask(controller.init(undefined!))
        return controller
    }
}

TodoManagerController satisfies ServiceFactory<TodoManagerController>
