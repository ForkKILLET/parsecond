import { ValueOf } from './utils'

export interface ParseErrMap {
  ExpectEnd: { rest: string }
  ExpectTerminator: { content: string }
}

export type ParseErrType = keyof ParseErrMap

export const kParseErr: unique symbol = Symbol('ParseErr')

export type ParseErr<Ks extends ParseErrType = ParseErrType> = ValueOf<{
  [K in Ks]: { type: K, [kParseErr]: true } & ParseErrMap[K]
}>

export const ParseErr = <K extends ParseErrType>(type: K, data: ParseErrMap[K]) => ({
  type,
  [kParseErr]: true as const,
  ...data,
})

export const isParseErr = (err: any): err is ParseErr => err?.[kParseErr] === true