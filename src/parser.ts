import { ParseErr, kParseErr } from './error'
import { Head } from './utils'
import { Result, InferVal, InferErr, Ok, Err } from 'fk-result'

void kParseErr

export interface ParserState {
  input: string
  index: number
  rest: string
}
export type ParserStateVal<T> = { val: T, state: ParserState }
export type ParserResult<T = any, E = any> = Result<ParserStateVal<T>, E>

export type Parser<T = any, E = unknown> = (state: ParserState) => ParserResult<T, E>

export type ParserOk<P extends Parser> = InferVal<ReturnType<P>>['val']
export type ParserErr<P extends Parser> = InferErr<ReturnType<P>>

export const eat = (state: ParserState, length: number): ParserState => ({
  ...state,
  index: state.index + length,
  rest: state.rest.slice(length),
})

export interface Satisfy {
  <C extends string>(pred: (char: string) => char is C): Parser<C, null>
  (pred: (char: string) => boolean): Parser<string, null>
}
export const satisfiy: Satisfy = (pred: (char: string) => boolean): Parser<string, null> => state => {
  const [char] = state.rest
  if (char && pred(char)) return Ok({ val: char, state: eat(state, 1) })
  return Err(null)
}

export const anyChar = satisfiy(() => true)

export const charMatch = (regex: RegExp) => satisfiy(ch => regex.test(ch))

export const char = <const C extends string>(char: C) => satisfiy((ch): ch is C => ch === char)

export type OneOf<S extends string> = S extends `${infer H}${infer T}` ? H | OneOf<T> : never
export const oneOf = <const S extends string>(chars: S) => satisfiy((ch): ch is OneOf<S> => chars.includes(ch))

export const noneOf = (chars: string) => satisfiy(ch => ! chars.includes(ch))

export const string = <const S extends string>(str: S): Parser<S, null> => state => {
  if (state.rest.startsWith(str)) return Ok({ val: str, state: eat(state, str.length) })
  return Err(null)
}

export const stringMatch = (regex: RegExp): Parser<string, null> => state => {
  const match = state.rest.match(regex)
  if (match && match.index === 0) {
    const [str] = match
    return Ok({ val: str, state: eat(state, str.length) })
  }
  return Err(null)
}

export const pure = <T>(val: T): Parser<T, never> => state => Ok({ val, state })
export const fail = <E>(err: E): Parser<never, E> => () => Err(err)
export const result = <T, E>(result: Result<T, E>): Parser<T, E> => state => result.map(val => ({ val, state }))

export const guard = <T, E>(parser: Parser<T, E>, pred: (val: T) => boolean): Parser<T, E | null> =>
  bind(parser, val => result(pred(val) ? Ok(val) : Err(null)))

export const map = <T0, T1, E>(parser: Parser<T0, E>, fn: (val: T0) => T1): Parser<T1, E> => input =>
  parser(input).map(({ val, state }) => ({ val: fn(val), state }))

export const mapErr = <T, E0, E1>(parser: Parser<T, E0>, fn: (err: E0) => E1): Parser<T, E1> => input =>
  parser(input).mapErr(fn)

export const mapState = <T, E>(parser: Parser<T, E>, fn: (val: ParserState) => ParserState): Parser<T, E> => input =>
  parser(input).map(({ val, state }) => ({ val, state: fn(state) }))

export const join = <E>(parser: Parser<string[], E>) => map(parser, (val) => val.join(''))

export const separatedBy = <T, E>(base: Parser<T, E>, separator: Parser): Parser<T[], E> =>
  map(
    sequence([base, many(map(sequence([separator, base]), ([, val]) => val))]),
    ([head, tail]) => [head, ...tail]
  )

export const separatedBy1 = <T, E0, E1>(base: Parser<T, E0>, separator: Parser<any, E1>): Parser<T[], E0 | E1> =>
  map(
    sequence([base, some(map(sequence([separator, base]), ([, val]) => val))]),
    ([head, tail]) => [head, ...tail]
  )

export const alternative = <Ps extends Parser[]>(parsers: Ps): Parser<ParserOk<Ps[number]>, null> => input => {
  for (const parser of parsers) {
    const result = parser(input)
    if (result.isOk) return result as ParserOk<Ps[number]>
  }
  return Err(null)
}

export const bind = <T, E, Tn, En>(parser: Parser<T, E>, next: (val: T) => Parser<Tn, En>): Parser<Tn, E | En> => state =>
  parser(state).bind(({ val, state }) => next(val)(state))

export const bindErr = <T, E, Tn, En>(parser: Parser<T, E>, next: (err: E) => Parser<Tn, En>): Parser<T | Tn, En> => state =>
  parser(state).bindErr(err => next(err)(state))

export const bindValState = <T, E, Tn, En>(
  parser: Parser<T, E>,
  next: (valState: { val: T, state: ParserState },
) => Parser<Tn, En>): Parser<Tn, E | En> =>
  state => parser(state).bind(({ val, state }) => next({ val, state })(state))

export const optional = <T, E>(parser: Parser<T, E>): Parser<T | null, never> => state =>
  parser(state).bindErr(() => Ok({ val: null, state }))

export const some = <T, E>(parser: Parser<T, E>): Parser<T[], E> =>
  bind(parser, val => map(many(parser), vals => [val, ...vals]))

export const many = <T>(parser: Parser<T>): Parser<T[], never> =>
  bindErr(some(parser), () => pure([]))

export const sequence = <const Ps extends Parser[]>(parsers: Ps): Parser<
  { [I in keyof Ps]: ParserOk<Ps[I]> },
  ParserErr<Ps[number]>
> => state => {
  const vals = [] as { [I in keyof Ps]: ParserOk<Ps[I]> }
  for (const parser of parsers) {
    const result = parser(state)
    if (result.isOk) {
      const { val, state: nextState } = result.val
      vals.push(val)
      state = nextState
    }
    else return result as Result<never, ParserErr<Ps[number]>>
  }
  return Ok({ val: vals, state })
}

export const skip = <E>(parser: Parser<any, E>): Parser<null, E> => map(parser, () => null)

export const left = <E2>(right: Parser<any, E2>) => <T, E1>(left: Parser<T, E1>): Parser<T, E1 | E2> =>
  bind(left, val => map(right, () => val))

export const right = <E1>(left: Parser<any, E1>) => <T, E2>(right: Parser<T, E2>): Parser<T, E1 | E2> =>
  bind(left, () => right)

export const head = <Ts extends any[], E>(parser: Parser<Ts, E>): Parser<Head<Ts>, E> => map(parser, ([h]) => h)

export const lazy = <T, E = unknown>(builder: () => Parser<T, E>): Parser<T, E> => input => builder()(input)

export const endOfInput: Parser<null, ParseErr<'ExpectEnd'>> = state => {
  if (! state.rest) return Ok({ val: null, state })
  return Err(ParseErr('ExpectEnd', { rest: state.rest }))
}

export const ended = <T, E>(parser: Parser<T, E>): Parser<T, E | ParseErr<'ExpectEnd'>> => head(sequence([parser, endOfInput]))

const WHITE_CHARS = ' \t\r\n'
export const white = oneOf(WHITE_CHARS)

export const delimitedBy = <EL, ER>(left: Parser<any, EL>, right: Parser<any, ER>) => <T, E>(parser: Parser<T, E>) =>
  map(sequence([left, parser, right]), ([, result]) => result)

export const spaced = delimitedBy(many(white), many(white))

export const parens = delimitedBy(char('('), char(')'))
export const brackets = delimitedBy(char('['), char(']'))
export const braces = delimitedBy(char('{'), char('}'))
export const angles = delimitedBy(char('<'), char('>'))

export const DIGIT_CHARS = '0123456789'
export const digit = oneOf(DIGIT_CHARS)

export const digits = join(some(digit))
export const posint = map(digits, Number)
export const signed = <E>(parser: Parser<number, E>) => map(
  sequence([optional(oneOf('+-')), parser]),
  ([sign, val]) => sign === '-' ? - val : val
)
export const integer = signed(posint)
export const decimal = signed(alternative([
  map(
    sequence([optional(digits), char('.'), digits]),
    ([pre, , post]) => Number(`${pre ?? 0}.${post}`)
  ),
  posint,
]))

export const followedBy = <T, E1, E2>(parser: Parser<T, E1>, follower: Parser<any, E2>): Parser<T, E1 | E2> =>
  bind(parser, val => map(follower, () => val))

export const notFollowedBy = <T, E>(parser: Parser<T, E>, follower: Parser): Parser<T, E | null> =>
  bind(parser, val => bind(bindErr(follower, () => pure(val)), () => fail(null)))

export const notEmpty = <T extends string, E>(parser: Parser<T, E>): Parser<T, E | null> =>
  bind(parser, s => s ? pure(s) : fail(null))

export type Range = {
  input: string
  start: number
  end: number
}
export namespace Range {
  export const startOf = (range: Range): Range => ({
    input: range.input,
    start: range.start,
    end: range.start,
  })

  export const endOf = (range: Range): Range => ({
    input: range.input,
    start: range.end,
    end: range.end,
  })

  export const outer = (start: Range, end: Range): Range => ({
    input: start.input,
    start: start.start,
    end: end.end,
  })

  export const inner = (start: Range, end: Range): Range => ({
    input: start.input,
    start: start.end,
    end: end.start,
  })

  export const empty = (): Range => ({
    input: '',
    start: 1,
    end: 0,
  })
}

export type Ranged<T> = {
  val: T
  range: Range
}

export const ranged = <T, E>(parser: Parser<T, E>): Parser<Ranged<T>, E> =>
  oldState => parser(oldState).map(({ val, state }) => ({
    val: {
      val,
      range: {
        input: oldState.input,
        start: oldState.index,
        end: state.index,
      }
    },
    state,
  }))

export type RunParser<T, E> = (input: string) => ParserResult<T, E>
export const runParser = <T, E>(parser: Parser<T, E>): RunParser<T, E> => (input: string) =>
  parser({ input, index: 0, rest: input })

export const p = {
  satisfiy,
  anyChar,
  char,
  charMatch,
  oneOf,
  noneOf,
  string, str: string,
  stringMatch, regex: stringMatch,
  pure, return: pure,
  fail,
  result,
  guard,
  map, mapErr, mapState,
  join,
  separatedBy, sep: separatedBy,
  separatedBy1, sep1: separatedBy1,
  alternative, alt: alternative,
  bind, bindErr, bindValState,
  optional, opt: optional,
  some,
  many,
  sequence, seq: sequence,
  skip, ignore: skip,
  left,
  right,
  head,
  lazy,
  endOfInput, eoi: endOfInput,
  ended,
  white,
  delimitedBy,
  spaced,
  parens,
  brackets,
  braces,
  angles,
  digit,
  digits,
  posint,
  integer,
  signed,
  decimal,
  followedBy,
  notFollowedBy,
  notEmpty,
  ranged,
}
