import { createApp } from "vue"
import { createWebHistory } from "vue-router"
import { App } from "./app/App"
import { GlobalLogger } from "./foundation/logger/GlobalLogger"
import { Logger } from "./foundation/logger/Logger"
import { AsyncInitializationQueue } from "./serviceProvider/AsyncInitializationQueue"
import { ServiceLoader } from "./serviceProvider/ServiceLoader"
import { SocketIOClient } from "./socketIOTransport/SocketIOClient"
import { RpcClient } from "./structRpc/architecture/RpcClient"
import { TodoList } from "./todoExample/todoList/TodoList"
import { TodoListProxy } from "./todoExample/todoList/TodoListProxy"
import { TodoManagerProxy } from "./todoExample/todoManager/TodoManagerProxy"
import "./vue3gui/style.scss"
import { vue3gui } from "./vue3gui/vue3gui"
import { RouterService } from "./vueFoundation/RouterService"
import { VueApplication } from "./vueFoundation/VueApplication"

void async function () {
    const logger = new GlobalLogger()

    if (import.meta.env.DEV) logger.info`Loading services...`

    const services = new ServiceLoader()
        .provide(Logger.kind, logger)
        .add(VueApplication.make(() =>
            createApp(App)
                .use(vue3gui, {})
        ))
        .add(RouterService.make({
            history: createWebHistory(),
        }))
        .add(SocketIOClient.make({ resetOnReconnect: true }))
        .add(RpcClient)
        .add(TodoManagerProxy)
        .load()

    await services.tryGet(AsyncInitializationQueue.kind)?.awaitAll()

    if (import.meta.env.DEV) logger.info`Ready`

    const app = services.get(VueApplication.kind)
    app.mount("#app")

    logger.info`Starting test`
    const client = services.get(RpcClient.kind)
    const todoManger = client.getEmptyProxy(TodoManagerProxy)
    const listId = await todoManger.createList({ label: "New List" })
    logger.info`Step 0: ${listId}`
    const list = await client.getBoundProxy(TodoListProxy, listId)
    logger.info`Step 1: ${TodoList.baseType.clone(list)}`
    await list.setLabel("Label 2")
    logger.info`Step 2: ${TodoList.baseType.clone(list)}`
}()
