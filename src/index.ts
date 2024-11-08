import { Err } from './error'
import { nil, FilterOut, Head, NotNil, Nil, Filter, unreachable } from './utils'

export type ParserResult<T = any, E = any> = 
    | { val: T, rest: string }
    | { err: E }

export type Parser<T = any, E = any> = (input: string) => ParserResult<T, E>

export type Success<P extends Parser> = Exclude<ReturnType<P>, { err: any }> extends { val: infer T } ? T : never
export type Failure<P extends Parser> = Exclude<ReturnType<P>, { val: any }> extends { err: infer E } ? E : never

export const isSuccess = (parserResult: ParserResult<any>) => 'val' in parserResult

export const satisfiy = (pred: (char: string) => boolean): Parser<string, Nil> => input => {
    const [ c ] = input
    if (c && pred(c)) return { val: c, rest: input.slice(1) }
    return { err: nil }
}

export const anyChar = satisfiy(() => true)

export const char = <const T extends string>(char: T) => satisfiy(c => c === char) as Parser<T, Nil>

export const charIn = (chars: string) => satisfiy(ch => chars.includes(ch))

export const charMatch = (regex: RegExp) => satisfiy(ch => regex.test(ch))

export const charSequence = (str: string): Parser<string, Nil> => input => { // <=> join(sequence([ ...str ].map(char))) 
    const { length } = str 
    let index = 0
    while (index < str.length)
        if (input[index] === str[index]) index ++
        else return { err: nil }
    return { val: str, rest: input.slice(length) }
}

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

export const alternative = <Ps extends Parser[]>(parsers: Ps): Parser<Success<Ps[number]>, Nil> => input => {
    for (const parser of parsers) {
        const result = parser(input)
        if (isSuccess(result)) return result
    }
    return { err: nil }
}

export const then = <T, E, N extends Parser>(parser: Parser<T, E>, next: (val: T) => N): Parser<Success<N>, E | Failure<N>> => input => {
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
    { [I in keyof Ps]: Success<Ps[I]> },
    Failure<Ps[number]>
> => input => {
    const vals = [] as { [I in keyof Ps]: Success<Ps[I]> }
    for (const parser of parsers) {
        const result = parser(input)
        if (! isSuccess(result)) return result
        vals.push(result.val)
        input = result.rest
    }
    return { val: vals, rest: input }
}

export const ignore = <E>(parser: Parser<any, E>): Parser<Nil, E> => map(parser, () => nil)

export const left = <T, E1, E2>(left: Parser<T, E1>, right: Parser<any, E2>): Parser<T, E1 | E2> =>
    then(left, val => map(right, () => val))

export const right = <T, E1, E2>(left: Parser<any, E1>, right: Parser<T, E2>): Parser<T, E1 | E2> =>
    then(left, () => right)

export const filteredSequence = <const Ps extends Parser[]>(parsers: Ps) =>
    map(sequence(parsers), vals => vals.filter((val) => val !== nil)) as Parser<
        FilterOut<{ [I in keyof Ps]: Success<Ps[I]> }, Nil>,
        Failure<Ps[number]>
    >

export const head = <Ts extends any[], E>(parser: Parser<Ts, E>): Parser<Head<Ts>, E> => map(parser, ([ h ]) => h)

export const lazy = <T, E>(builder: () => Parser<T, E>): Parser<T, E> => input => builder()(input)

export const endOfInput: Parser<Nil, Err.ExpectEnd> = input => {
    if (! input) return { val: nil, rest: '' }
    return { err: Err.build('ExpectEnd', { rest: input }) }
}

export const ended = <T, E>(parser: Parser<T, E>): Parser<T, E | Err.ExpectEnd> => head(sequence([ parser, endOfInput ]))

const WHITE_CHARS = ' \t\r\n'
export const white = charIn(WHITE_CHARS)

export const surrroundedBy = <EL, ER>(left: Parser<any, EL>, right: Parser<any, ER>) => <T, E>(parser: Parser<T, E>) =>
    map(sequence([ left, parser, right ]), ([, result ]) => result)

export const surroundedByWhite = surrroundedBy(many(white), many(white))

export const surroundedByParen = surrroundedBy(char('('), char(')'))

export const DIGIT_CHARS = '0123456789'
export const digit = charIn(DIGIT_CHARS)

export const number = map(some(digit), chars => Number(chars.join('')))

export type BinaryOp<Os extends string[], T, A extends 'left' | 'right'> = (
    A extends 'left' ? {
        op: Os[number]
        lhs: BinaryOp<Os, T, 'left'>
        rhs: T
    } :
    A extends 'right' ? {
        op: Os[number]
        lhs: T
        rhs: BinaryOp<Os, T, 'right'>
    } :
    never
) | T

export const binaryOperator = <const Os extends string[], T, E, A extends 'left' | 'right'>(
    ops: Os,
    base: Parser<T, E>,
    asscociativity: A,
): Parser<BinaryOp<Os, T, A>, E | Nil> => {
    type R = Parser<BinaryOp<Os, T, A>, E | Nil>

    const symbolChars = [ ...new Set(ops.join('')) ].join('')
    const symbol = surroundedByWhite(alternative(
        ops.map(op => notFollowedBy(charSequence(op), charIn(symbolChars)))
    ))
    if (asscociativity === 'left') {
        return map(sequence([
            base,
            many(sequence([ symbol, base ]))
        ]), ([ head, tail ]) => tail
            .reduce<BinaryOp<Os, T, 'left'>>((lhs, [ op, rhs ]) => ({ lhs, op, rhs }), head)
        ) as R
    }
    else if (asscociativity === 'right') {
        const op: Parser<BinaryOp<Os, T, 'right'>, E | Nil> = lazy(() => alternative([
            map(sequence([ base, symbol, op ]), ([ lhs, op, rhs ]) => ({ lhs, op, rhs })),
            base
        ]))
        return op as R
    }
}

export const until = <T>(
    terminator: Parser<T>
): Parser<[ string, T ], Err.ExpectTerminator> => input => {
    let content = ''
    let isEoi = false
    while (input.length || ! isEoi) {
        if (! input.length) isEoi = true
        const [ head ] = input, tail = input.slice(1)
        const result = terminator(input)
        if (isSuccess(result)) return {
            val: [ content, result.val ],
            rest: input
        }
        content += head
        input = tail
    }
    return {
        err: Err.build('ExpectTerminator', { content })
    }
}

export const followedBy = <T, E1, E2>(parser: Parser<T, E1>, follower: Parser<any, E2>): Parser<T, E1 | E2> =>
    then(parser, val => input => {
        const result = follower(input)
        if (isSuccess(result)) return { val, rest: input }
        return result
    })

export const notFollowedBy = <T, E>(parser: Parser<T, E>, follower: Parser): Parser<T, E | Nil> =>
    then(parser, val => input => {
        const result = follower(input)
        if (isSuccess(result)) return { err: nil } as const
        return { val, rest: input }
    })

export const notEmpty = <T extends string, E>(parser: Parser<T, E>): Parser<T, E | Nil> =>
    then(parser, s => s ? success(s) : fail(nil))

export const P = {
    satisfiy,
    anyChar,
    char,
    charIn,
    charMatch,
    charSequence, str: charSequence,
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
    left,
    right,
    filteredSequence, fseq: filteredSequence,
    head,
    lazy,
    endOfInput, eoi: endOfInput,
    ended,
    white,
    surrroundedBy, sur: surrroundedBy,
    surroundedByWhite, surWhite: surroundedByWhite,
    surroundedByParen, surParen: surroundedByParen,
    digit,
    number,
    binaryOperator, binOp: binaryOperator,
    until,
    followedBy,
    notFollowedBy,
    notEmpty
}

export {
    unreachable, nil, Nil, NotNil, Err,
    Head, Filter, FilterOut
}
