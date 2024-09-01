/* eslint-disable no-console */
// @ts-check

import { spawn } from "child_process"
import { ViteNodeRunner } from "vite-node/client"
import { installSourcemapsSupport } from "vite-node/source-map"
import { isMainThread, parentPort, receiveMessageOnPort, Worker, workerData } from "worker_threads"

// During development the backend is built using vite, specifically using vite-node. There are two
// parts to this process - the server (like for web development) and the runner (like the browser).
// The server starts firsts, creating a vite server and running tsc. Every time tsc compiles the 
// project and does not find any errors, a new worker thread is started in which a new runner
// is created. If a worker thread is already running it is terminated. 

// Communication between the runner and the server works using MessagePort, however some requests
// must be resolved synchronously form the perspective of the runner. For this the `sendSyncRequest` 
// function is used which freezes the worker thread until a response is returned. 

const semaphore = new Int32Array(isMainThread ? new SharedArrayBuffer(4) : workerData.sharedBuffer)
function sendSyncRequest(/** @type {{ kind: string } & Record<string, any>} */ msg) {
    if (parentPort == null) throw new Error("Parent port is null in worker")
    parentPort.postMessage({ ...msg, sync: true })
    Atomics.wait(semaphore, 0, 0)
    const response = receiveMessageOnPort(parentPort)
    if (response == undefined) {
        throw new Error("Did not receive message from parent after waking up")
    }
    return response.message
}

// [Worker only] Async requests all have an id assigned, the `requests` map keeps `resolve` functions from promises
// and executes them when a response is received. 

let nextId = 0
/** @type { Map<number, (response: any) => void> } */
const requests = new Map()
function sendRequest(/** @type {{ kind: string } & Record<string, any>} */ msg) {
    if (parentPort == null) throw new Error("Parent port is null in worker")

    if (nextId == 0) {
        parentPort.on("message", (msg) => {
            if (msg.requestId) {
                const request = requests.get(msg.requestId)
                if (request) {
                    request(msg.response)
                } else {
                    throw new Error("Received response to invalid request")
                }
                requests.delete(msg.requestId)
            } else {
                throw new Error("Invalid async response")
            }
        })
        nextId++
    }

    const requestId = nextId++
    parentPort.postMessage({ ...msg, requestId })

    return new Promise((resolve) => {
        requests.set(requestId, (response) => {
            resolve(response)
        })
    })
}

// [Host only] Only one worker thread exists at a time, if a new one is started the previous one is terminated.
// Anytime the worker thread sends a request to the host thread the callback is executed and the return value is
// sent back. There is no difference from the implementer of the callback between sync and async request, everything
// is handled here. When the worker crashes due to an error a message with the kind of "error" is sent.

/** @type { Worker | null } */
let lastWorker = null
function runWorker(/** @type {(msg: { kind: string } & Record<string, any>) => any} */ callback) {
    if (lastWorker) {
        lastWorker.terminate()
    }

    const worker = new Worker(import.meta.filename, {
        workerData: { sharedBuffer: semaphore.buffer },
        name: "vite-runner"
    })

    lastWorker = worker

    worker.on("message", async msg => {
        const response = await callback(msg)
        if (response === undefined) {
            worker.terminate()
            throw new Error(`Invalid request ${msg.kind} from worker`)
        }

        if (msg.requestId) {
            worker.postMessage({ response, requestId: msg.requestId })
            return
        }

        worker.postMessage(response)

        let stuckCounter = 0
        while (true) {
            const awoken = Atomics.notify(semaphore, 0)
            if (awoken != 0) break
            await new Promise((resolve) => setTimeout(resolve, 1))
            stuckCounter++
            if (stuckCounter > 1000) {
                worker.terminate()
                throw new Error("Worker is not responding to notifications")
            }
        }
    })

    worker.on("error", error => {
        callback({ kind: "error", error })
    })
}

if (isMainThread) {
    console.log("\x1b[96m[backend] Starting compilers...\x1b[0m")

    const { createServer: viteCreateServer } = await import("vite")
    const { ViteNodeServer } = await import("vite-node/server")

    // tsc is started first so we can initialize vite during the first compilation which takes a long time
    const tsc = spawn("yarn tsc --noEmit --watch --incremental --preserveWatchOutput --pretty", {
        stdio: "pipe",
        shell: true,
    })

    const viteTask = (async () => {
        const server = await viteCreateServer({
            optimizeDeps: {
                disabled: true
            }
        })

        await server.pluginContainer.buildStart({})

        // @ts-ignore
        const node = new ViteNodeServer(server)

        return () => {
            runWorker(async (msg) => {
                if (msg.kind == "getExecutionPath") {
                    return "./src/index.ts"
                }

                if (msg.kind == "getConfig") {
                    return {
                        root: server.config.root,
                        base: server.config.base,
                    }
                }

                if (msg.kind == "getSourceMap") {
                    return node.getSourceMap(msg.source)
                }

                if (msg.kind == "fetchModule") {
                    return await node.fetchModule(msg.id)
                }

                if (msg.kind == "resolveId") {
                    return await node.resolveId(msg.id, msg.importer)
                }

                // Handling of the worker crashing
                if (msg.kind == "error") {
                    console.error(msg.error)
                    console.log("\x1b[91m[backend] Error detected, waiting for changes...\x1b[0m")
                    return
                }

                // Handling of the patched console functions, see runner code for details
                if (msg.kind == "print") {
                    const { isStdout, string } = msg
                    void (isStdout ? process.stdout : process.stderr).write(string + "\n")
                    return null
                }
            })
        }
    })()

    let pending = false

    tsc.stdout.addListener("data", (chunk) => {
        process.stdout.write(chunk)
        if (chunk.toString().includes("Found 0 errors.")) {
            console.log("\x1b[96m[backend] Reloaded due to changes.\x1b[0m")

            if (execute) {
                execute()
            } else {
                pending = true
            }
        }
    })

    tsc.stderr.addListener("data", (chunk) => {
        process.stderr.write(chunk)
    })

    const execute = await viteTask
    if (pending) execute()

    console.log("\x1b[96m[backend] Vite ready.\x1b[0m")

    // Allow the user to force a restart of the runner
    process.stdin.on("data", (data) => {
        if (data.toString() == "rs\n") {
            execute()
            console.log("\x1b[96m[backend] Reloaded due to user command.\x1b[0m")
        }
    })
} else {
    installSourcemapsSupport({
        getSourceMap: source => {
            return sendSyncRequest({ kind: "getSourceMap", source })
        }
    })

    const runner = new ViteNodeRunner({
        ...sendSyncRequest({ kind: "getConfig" }),
        fetchModule(id) {
            return sendRequest({ kind: "fetchModule", id })
        },
        resolveId(id, importer) {
            return sendRequest({ kind: "resolveId", id, importer })
        }
    })

    const file = sendSyncRequest({ kind: "getExecutionPath" })

    // Logging to the console in a worker thread works by sending messages to the main thread, but if 
    // the worker terminates before the messages are delivered, by for example crashing on an error
    // the created logs will not be displayed in the terminal. We replace the default method
    // with our own which calls synchronously to the main thread, therefore nothing can happen
    // before the logs are printed.

    const consoleSymbols = Object.getOwnPropertySymbols(console)
    const kWriteToConsole = consoleSymbols.find(v => v.description == "kWriteToConsole")
    let kUseStdout = null
    let kUseStderr = null

    // @ts-ignore
    console[kWriteToConsole] = (streamSymbol, string, color) => {
        // kUseStdout and kUseStderr are not accessible, so we get them by manually invoking .log and .error on console
        if (kUseStdout == null) {
            kUseStdout = streamSymbol
            return
        }

        if (kUseStderr == null) {
            kUseStderr = streamSymbol
            return
        }

        const isStdout = streamSymbol == kUseStdout
        sendSyncRequest({ kind: "print", isStdout, string })
    }

    // These logging functions are necessary to initialize the patch to console[kWriteToConsole]
    // so do not remove them
    console.log("a")
    console.error("a")

    // Because stdio is piped in worker, node reports that stdout is not a terminal. We know that in the debug runner
    // we always want colors so just force it.
    process.env.FORCE_COLORS = "true"
    process.stdout.isTTY = true

    await runner.executeFile(file)
}
