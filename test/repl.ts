import { createInterface } from 'node:readline'
import { isSuccess, P, Parser } from '../src'
import { Err } from '../src/error'

export type ReplOptions = {
    requireEndOfInput?: boolean
    name?: string
}

const log = (...args: any[]) => console.log(...args)
const error = (msg: string, ...args: any[]) => console.log(`\x1B[31m${msg}\x1B[0m`, ...args)

export const createParserRepl = (parser: Parser, {
    requireEndOfInput = true,
    name = ''
}: ReplOptions = {}) => {
    if (requireEndOfInput) parser = P.mapErr(P.end(parser), err => {
        if (Err.is('ExpectEnd', err)) return `Expect end of input, got '${err.rest}'.`
        return err
    })

    log('Parsecond REPL' + (name ? ` - ${name}` : ''))
    const rln = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: `${name}> `
    })

    rln.prompt()
    rln.on('line', line => {
        const result = parser(line)
        if (isSuccess(result)) log(result.val)
        else error('Error: ' + String(result.err))
        rln.prompt()
    })
}