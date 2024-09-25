const ExpectEnd = Symbol('ExpectEnd')
const ExpectTerminator = Symbol('ExpectTerminator')

export namespace Err {
    export type ExpectEnd = {
        type: typeof ExpectEnd
        rest: string
    }

    export type ExpectTerminator = {
        type: typeof ExpectTerminator
        content: string
    }
    
    export const types = {
        ExpectEnd,
        ExpectTerminator
    } as const

    export interface ErrMap {
        ExpectEnd: ExpectEnd,
        ExpectTerminator: ExpectTerminator
    }

    export const build = <K extends keyof ErrMap>(errName: K, data: Omit<ErrMap[K], 'type'>) => ({
        type: types[errName],
        ...data
    }) as ErrMap[K]

    export const is = <K extends keyof ErrMap>(errName: K, err: any): err is ErrMap[K] =>
        err && typeof err === 'object' && err.type === types[errName]
}