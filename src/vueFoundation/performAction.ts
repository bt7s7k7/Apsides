import { asError } from "../comTypes/util"
import { ClientError } from "../foundation/messaging/errors"
import { DynamicsEmitter } from "../vue3gui/DynamicsEmitter"

export async function performAction<TResult>(emitter: DynamicsEmitter, action: () => Promise<TResult>, label: string) {
    const work = emitter.work(label, {
        props: {
            debounce: true
        }
    })
    try {
        const result = await action().catch(asError)

        if (result instanceof Error) {
            if (result instanceof ClientError) {
                emitter.alert(result.message, { error: true })
                return null
            } else {
                throw result
            }
        }

        return result
    } finally {
        work.done()
    }
}
