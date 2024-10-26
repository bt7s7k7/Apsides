import { createApp, markRaw } from "vue"
import { createWebHistory } from "vue-router"
import { GlobalLogger } from "./foundation/logger/GlobalLogger"
import { Logger } from "./foundation/logger/Logger"
import { AsyncInitializationQueue } from "./serviceProvider/AsyncInitializationQueue"
import { ServiceLoader } from "./serviceProvider/ServiceLoader"
import { SocketIOClient } from "./socketIOTransport/SocketIOClient"
import { RpcClient } from "./structRpc/architecture/RpcClient"
import { TODO_LIST_VIEW } from "./todoExample/todoList/TodoListView"
import { TodoManagerProxy } from "./todoExample/todoManager/TodoManagerProxy"
import { TODO_MANAGER_VIEW } from "./todoExample/todoManager/TodoManagerView"
import "./vue3gui/style.scss"
import { vue3gui } from "./vue3gui/vue3gui"
import { RouterService } from "./vueFoundation/RouterService"
import { VueApplication } from "./vueFoundation/VueApplication"
import { VueApplicationHost } from "./vueFoundation/VueApplicationHost"

void async function () {
    const logger = new GlobalLogger()

    if (import.meta.env.DEV) logger.info`Loading services...`

    // When proxies are bound, they get a reference to their client from themselves. If the proxies are set
    // to be reactive, they will get a reactive proxy of the client and when they register themselves,
    // Vue will save their raw references into the client and so mutations will not trigger reactivity.
    // We will mark the client as raw, which will prevent this problem. 
    markRaw(RpcClient.prototype)

    const services = new ServiceLoader()
        .provide(Logger.kind, logger)
        .add(VueApplication.make(() =>
            createApp(VueApplicationHost)
                .use(vue3gui, {})
        ))
        .add(RouterService.make({
            history: createWebHistory(),
        }))
        .add(TODO_MANAGER_VIEW)
        .add(TODO_LIST_VIEW)
        .add(SocketIOClient.make({ resetOnReconnect: true }))
        .add(RpcClient)
        .add(TodoManagerProxy)
        .load()

    const app = services.get(VueApplication.kind)
    app.mount("#app")

    await services.tryGet(AsyncInitializationQueue.kind)?.awaitAll()

    if (import.meta.env.DEV) logger.info`Ready`

}()
