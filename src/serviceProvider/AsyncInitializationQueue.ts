import { ServiceFactory, ServiceKind } from "./ServiceFactory"
import { ServiceProvider } from "./ServiceProvider"

export class AsyncInitializationQueue {
    protected readonly _tasks: Promise<void>[] = []

    public addTask(task: Promise<void>) {
        this._tasks.push(task)
    }

    public awaitAll() {
        const promise = Promise.all(this._tasks)
        this._tasks.length = 0
        return promise
    }

    public static readonly kind = new ServiceKind<AsyncInitializationQueue>("AsyncInitializationQueue")
    public static init(services: ServiceProvider) {
        return new AsyncInitializationQueue()
    }
}

AsyncInitializationQueue satisfies ServiceFactory<AsyncInitializationQueue>
