import { DescriptionFormatter } from "../../prettyPrint/DescriptionFormatter"
import { ServiceFactory } from "../../serviceProvider/ServiceFactory"
import { ServiceProvider } from "../../serviceProvider/ServiceProvider"
import { Logger } from "./Logger"

const _PREFIX_STRINGS = {
    info: `[${DescriptionFormatter.ansiColor("INFO", { custom: false, name: "cyan" })}]`,
    debug: `[${DescriptionFormatter.ansiColor("DEBUG", { custom: false, name: "magenta" })}]`,
    warn: `[${DescriptionFormatter.ansiColor("WARN", { custom: false, name: "yellow" })}]`,
    error: `[${DescriptionFormatter.ansiColor("ERROR", { custom: false, name: "red" })}]`,
    critical: `[${DescriptionFormatter.ansiColor("CRITICAL", { custom: false, name: "red" })}]`,
} satisfies Record<Logger.Level, string>

export class TerminalLogger extends Logger {
    protected _log(prefix: Logger.Level, text: TemplateStringsArray, values: any[]): void {
        const args = [_PREFIX_STRINGS[prefix], text[0].trim()]
        if (args[1].length == 0) args.pop()

        for (let i = 1; i < text.length; i++) {
            args.push(values[i - 1])
            args.push(text[i].trim())
        }

        if (prefix == "info" || prefix == "debug") {
            // eslint-disable-next-line no-console
            console.log(...args)
        } else if (prefix == "warn") {
            // eslint-disable-next-line no-console
            console.warn(...args)
        } else {
            // eslint-disable-next-line no-console
            console.error(...args)
        }
    }

    public static init(services: ServiceProvider) {
        return new TerminalLogger()
    }
}

TerminalLogger satisfies ServiceFactory<Logger>
