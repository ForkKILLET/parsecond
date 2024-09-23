const ExpectEnd = Symbol('ExpectEnd')

export namespace Err {
    export type ExpectEnd = {
        type: typeof ExpectEnd
        rest: string
    }
    
    export const types = {
        ExpectEnd
    } as const

    export interface ErrMap {
        ExpectEnd: ExpectEnd
    }

    export const build = <K extends keyof ErrMap>(errName: K, data: Omit<ErrMap[K], 'type'>): ErrMap[K] => ({
        type: types[errName],
        ...data
    })

    export const is = <K extends keyof ErrMap>(errName: K, err: { type: any }): err is ErrMap[K] =>
        err.type === types[errName]
}