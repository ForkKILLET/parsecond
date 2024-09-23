export const unreachable = () => new Error('Unreachable')

export const nil = Symbol('Nil')
export type Nil = typeof nil
export type NotNil<T> = Exclude<T, Nil>

export type Head<Ts extends any[]> = Ts extends [ infer H, ...any ] ? H : never

export type Filter<Ts extends any[], F> =
    Ts extends [ infer H, ...infer T ]
        ? H extends F
            ? [ H, ...Filter<T, F> ]
            : Filter<T, F>
        : []
export type FilterOut<Ts extends any[], F> =
    Ts extends [ infer H, ...infer T ]
        ? H extends F
            ? FilterOut<T, F>
            : [ H, ...FilterOut<T, F> ]
        : []