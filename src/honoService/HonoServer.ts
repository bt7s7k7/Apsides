import { serve } from "@hono/node-server"
import { ServeStaticOptions } from "@hono/node-server/serve-static"
import { Hono } from "hono"
import { HonoOptions } from "hono/hono-base"
import { BlankEnv } from "hono/types"
import { Task } from "../comTypes/util"
import { Logger } from "../foundation/logger/Logger"
import { UNMANAGED_HTTP_SERVER_SERVICE } from "../foundation/unmanaged"
import { AsyncInitializationQueue } from "../serviceProvider/AsyncInitializationQueue"
import { ServiceFactory, ServiceKind } from "../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../serviceProvider/ServiceProvider"

export class HonoServer {
    public readonly app
    public readonly nativeServer

    protected constructor(
        public readonly services: ServiceProvider,
        options: HonoServer.Options
    ) {
        this.app = new Hono(options?.app)
        const logger = services.get(Logger.kind)

        const listening = new Task<void>()
        this.nativeServer = serve({
            ...options.serve as Parameters<typeof serve>[0],
            fetch: this.app.fetch,
        }, (address) => {
            logger.info`Listening at ${address}`
            listening.resolve()
        })

        services.get(AsyncInitializationQueue.kind).addTask(listening.asPromise())
    }

    public static make(options: HonoServer.Options): ServiceFactory<HonoServer> {
        return {
            kind: this.kind,
            init(services) {
                const server = new HonoServer(services, options)
                services.provideService(UNMANAGED_HTTP_SERVER_SERVICE, server.nativeServer)
                return server
            }
        }
    }

    public static readonly kind = new ServiceKind<HonoServer>("HonoServer", [UNMANAGED_HTTP_SERVER_SERVICE])
}

export namespace HonoServer {
    export interface Options {
        serve?: Omit<Parameters<typeof serve>[0], "fetch">
        app?: HonoOptions<BlankEnv>
        static?: ServeStaticOptions
    }
}
