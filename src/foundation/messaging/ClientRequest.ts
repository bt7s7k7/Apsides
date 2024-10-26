import { Task } from "../../comTypes/util"

export class ClientRequest extends Task<object> {
    constructor(
        public readonly id: number,
        public readonly data: object
    ) {
        super()
    }
}
