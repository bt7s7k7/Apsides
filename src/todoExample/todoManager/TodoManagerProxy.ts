import { AsyncInitializationQueue } from "../../serviceProvider/AsyncInitializationQueue"
import { ServiceFactory, ServiceKind } from "../../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../../serviceProvider/ServiceProvider"
import { RpcClient } from "../../structRpc/architecture/RpcClient"
import { TodoManagerApi } from "./TodoManager"

export class TodoManagerProxy extends TodoManagerApi.makeProxy() {
    public static readonly kind = new ServiceKind<TodoManagerProxy>("TodoManager")
    public static init(services: ServiceProvider) {
        const client = services.get(RpcClient.kind)
        const proxy = client.getEmptyProxy(TodoManagerProxy)
        const asyncQueue = services.get(AsyncInitializationQueue.kind)
        asyncQueue.addTask(proxy.bind())
        return proxy
    }
}

TodoManagerProxy satisfies ServiceFactory<TodoManagerProxy>
