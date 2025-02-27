import { AsyncInitializationQueue } from "../../serviceProvider/AsyncInitializationQueue"
import { ServiceFactory, ServiceKind } from "../../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../../serviceProvider/ServiceProvider"
import { RpcClient } from "../../structRpc/architecture/RpcClient"
import { TodoManager } from "./TodoManager"

export const TODO_MANAGER_HANDLE: ServiceFactory<TodoManager> = {
    kind: new ServiceKind<TodoManager>("TodoManager"),
    init(services: ServiceProvider) {
        const client = services.get(RpcClient.kind)
        const handle = client.getEmptyHandle(TodoManager)
        const asyncQueue = services.get(AsyncInitializationQueue.kind)
        asyncQueue.addTask(handle.bind())
        return handle
    }
}
