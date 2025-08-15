export const unreachable = (msg?: string) => new Error('Unreachable' + (msg ? `: ${msg}` : ''))

export type NotNull<T> = Exclude<T, null>

export type Head<Ts extends any[]> = Ts extends [ infer H, ...any ] ? H : never

export type ValueOf<T> = T[keyof T]
