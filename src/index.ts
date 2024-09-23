import { Err } from './error'
import { FilterOut, Head, Nil, nil } from './utils'

export type ParserResult<T = any, E = any> = 
    | { val: T, rest: string }
    | { err: E }

export type Parser<T = any, E = any> = (input: string) => ParserResult<T, E>

export type Sucess<P extends Parser> = Exclude<ReturnType<P>, { err: any }> extends { val: infer T } ? T : never
export type Failure<P extends Parser> = Exclude<ReturnType<P>, { val: any }> extends { err: infer E } ? E : never

export const isSuccess = (parserResult: ParserResult<any>) => 'val' in parserResult

export const satisfiy = (pred: (char: string) => boolean): Parser<string, Nil> => input => {
    const [ c ] = input
    if (c && pred(c)) return { val: c, rest: input.slice(1) }
    return { err: nil }
}

export const char = <const T extends string>(char: T) => satisfiy(c => c === char) as Parser<T, Nil>

export const charIn = (chars: string) => satisfiy(ch => chars.includes(ch))

export const charMatch = (regex: RegExp) => satisfiy(ch => regex.test(ch))

export const success = <T>(val: T): Parser<T, never> => input => ({ val, rest: input })

export const fail = <E>(err: E): Parser<never, E> => () => ({ err })

export const map = <T0, T1, E>(parser: Parser<T0, E>, f: (val: T0) => T1): Parser<T1, E> => input => {
    const result = parser(input)
    return isSuccess(result) ? { val: f(result.val), rest: result.rest } : result
}

export const mapErr = <T, E0, E1>(parser: Parser<T, E0>, f: (reason: E0) => E1): Parser<T, E1> => input => {
    const result = parser(input)
    return isSuccess(result) ? result : { err: f(result.err) }
}

export const join = <E>(parser: Parser<string[], E>) => map(parser, (val) => val.join(''))

export const separatedBy = <T, E>(base: Parser<T, E>, separator: Parser): Parser<T[], E> =>
    map(
        sequence([ base, many(map(sequence([ separator, base ]), ([, val ]) => val)) ]),
        ([ head, tail ]) => [ head, ...tail ]
    )

export const alternative = <Ps extends Parser[]>(parsers: Ps): Parser<Sucess<Ps[number]>, Nil> => input => {
    for (const parser of parsers) {
        const result = parser(input)
        if (isSuccess(result)) return result
    }
    return { err: nil }
}

export const then = <T, E, N extends Parser>(parser: Parser<T, E>, next: (val: T) => N): Parser<Sucess<N>, E | Failure<N>> => input => {
    const result = parser(input)
    if (isSuccess(result)) return next(result.val)(result.rest)
    return result
}

export const some = <T, E>(parser: Parser<T, E>): Parser<T[], E | Nil> => input => {
    const vals: T[] = []
    while (true) {
        const result = parser(input)
        if (! isSuccess(result)) {
            if (vals.length) return { val: vals, rest: input }
            return { err: nil }
        }
        vals.push(result.val)
        input = result.rest
    }
}

export const many = <T>(parser: Parser<T>): Parser<T[], never> => input => {
    const vals: T[] = []
    while (true) {
        const result = parser(input)
        if (! isSuccess(result)) return { val: vals, rest: input }
        vals.push(result.val)
        input = result.rest
    }
}

export const sequence = <const Ps extends Parser[]>(parsers: Ps): Parser<
    { [I in keyof Ps]: Sucess<Ps[I]> },
    Failure<Ps[number]>
> => input => {
    const vals = [] as { [I in keyof Ps]: Sucess<Ps[I]> }
    for (const parser of parsers) {
        const result = parser(input)
        if (! isSuccess(result)) return result
        vals.push(result.val)
        input = result.rest
    }
    return { val: vals, rest: input }
}

export const ignore = <E>(parser: Parser<any, E>): Parser<Nil, E> => map(parser, () => nil)

export const filteredSequence = <const Ps extends Parser[]>(parsers: Ps) =>
    map(sequence(parsers), vals => vals.filter((val) => val !== nil)) as Parser<
        FilterOut<{ [I in keyof Ps]: Sucess<Ps[I]> }, Nil>,
        Failure<Ps[number]>
    >

export const head = <Ts extends any[], E>(parser: Parser<Ts, E>): Parser<Head<Ts>, E> => map(parser, ([ h ]) => h)

export const lazy = <T, E>(builder: () => Parser<T, E>): Parser<T, E> => input => builder()(input)

export const endOfInput = <T, E>(parser: Parser<T, E>): Parser<T, E | Err.ExpectEnd> => input => {
    const result = parser(input)
    if (isSuccess(result) && result.rest) return {
        err: Err.build('ExpectEnd', { rest: result.rest })
    }
    return result
}

const WHITE_CHARS = ' \t\r\n'
export const white = charIn(WHITE_CHARS)

export const surrroundedBy = <EL, ER>(left: Parser<any, EL>, right: Parser<any, ER>) => <T, E>(parser: Parser<T, E>) =>
    map(sequence([ left, parser, right ]), ([, result ]) => result)

export const surroundedByWhite = surrroundedBy(many(white), many(white))

export const surroundedByParen = surrroundedBy(char('('), char(')'))

export const DIGIT_CHARS = '0123456789'
export const digit = charIn(DIGIT_CHARS)

export const number = map(some(digit), chars => Number(chars.join('')))

export type BinaryOp<Os extends string[], T> = {
    op: Os[number]
    lhs: T | BinaryOp<Os, T>
    rhs: T | BinaryOp<Os, T>
}

export const binaryOperator = <const Os extends string[], T, E>(
    ops: Os, asscociativity: 'left' | 'right', base: Parser<T, E>
): Parser<T | BinaryOp<Os, T>, E | Nil> => {
    const symbol = surroundedByWhite(alternative(ops.map(char)))
    if (asscociativity === 'left') {
        return map(sequence([
            base,
            many(sequence([ symbol, base ]))
        ]), ([ head, tail ]) => tail
            .reduce<T | BinaryOp<Os, T>>((lhs, [ op, rhs ]) => ({ lhs, op, rhs }), head)
        )
    }
    else {
        const op: Parser<T | BinaryOp<Os, T>, E | Nil> = lazy(() => alternative([
            map(sequence([ base, symbol, op ]), ([ lhs, op, rhs ]) => ({ lhs, op, rhs })),
            base
        ]))
        return op
    }
}

export const P = {
    satisfiy,
    char,
    charIn,
    charMatch,
    success, return: success,
    fail,
    map,
    mapErr,
    join,
    separatedBy, sep: separatedBy,
    alternative, alt: alternative,
    then,
    some,
    many,
    sequence, seq: sequence,
    ignore,
    filteredSequence, fseq: filteredSequence,
    head,
    lazy,
    endOfInput, end: endOfInput,
    white,
    surrroundedBy, sur: surrroundedBy,
    surroundedByWhite, surWhite: surroundedByWhite,
    surroundedByParen, surParen: surroundedByParen,
    digit,
    number,
    binaryOperator, binOp: binaryOperator
}