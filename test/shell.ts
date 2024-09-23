import { P } from '../src'
import { createParserRepl } from './repl'

export type Command = {
    action: (...args: string[]) => string
    children: Record<string, Command>
    description?: string
}

export const commands = {
    action: () => 'root',
    children: {
        help: {
            action: (pathStr = '') => {
                const cmd = pathStr ? findCommand(pathStr.split('.')) : commands
                if (! cmd) return `Command '${pathStr}' not found.`
                return `${pathStr || '[root]'}: ${cmd.description ?? '[no description]'}${Object.keys(cmd.children).map(s => `\n * ${s}`).join('')}`
            },
            children: {},
            description: 'Get help of a command.'
        },
        echo: {
            action: (...args: string[]) => args.join(' '),
            children: {},
            description: 'Echo text.'
        },
        foo: {
            action: () => 'foo',
            children: {
                bar: {
                    action: () => 'bar',
                    children: {}
                }
            }
        }
    }
} satisfies Command

const findCommand = (path: string[]): Command | undefined => path.reduce((c, p) => c?.children?.[p], commands)

export const word = P.join(P.some(P.satisfiy(ch => /\S/.test(ch))))

export const quotedWord = P.sur(P.char('"'), P.char('"'))(P.join(P.many(P.satisfiy(ch => ch !== '"'))))

export const commandPath = P.sep(P.join(P.some(P.satisfiy(ch => ch !== '.' && /\S/.test(ch)))), P.charIn('.'))

export const command =
    P.surWhite(P.then(commandPath, path => {
        const cmd = findCommand(path)
        if (! cmd) return P.fail(`Command '${path.join('.')}' not found.`)
        return P.map(
            P.alt([
                P.head(P.fseq([
                    P.ignore(P.some(P.white)),
                    P.sep(P.alt([ word, quotedWord ]), P.some(P.white))
                ])),
                P.return<string[]>([])
            ]),
            args => cmd.action(...args)
        )
    }))

if (require.main === module) {
    createParserRepl(command, { name: 'shell' })
}