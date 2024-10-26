import { Task } from "../comTypes/util"
import { ServiceFactory, ServiceKind } from "./ServiceFactory"
import { ServiceProvider } from "./ServiceProvider"

export class AsyncInitializationQueue {
    protected readonly _tasks: Promise<void>[] = []
    protected readonly _loaded = new Task<void>()
    public get loaded() { return this._loaded.asPromise() }

    public addTask(task: Promise<void>) {
        this._tasks.push(task)
    }

    public awaitAll() {
        const promise = Promise.all(this._tasks)
        this._tasks.length = 0
        promise.then(() => this._loaded.resolve())
        return promise
    }


    public static readonly kind = new ServiceKind<AsyncInitializationQueue>("AsyncInitializationQueue")
    public static init(services: ServiceProvider) {
        return new AsyncInitializationQueue()
    }
}

AsyncInitializationQueue satisfies ServiceFactory<AsyncInitializationQueue>
