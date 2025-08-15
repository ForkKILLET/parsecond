import { expect, describe, it, Assertion } from 'vitest'
import { isSuccess, p, Parser } from '../src/index'

import { Err } from '../src/error'
import { exprCalculator } from './expr'

const testParser = (parser: Parser) => {
  const tester = {
    expectRun: (input: string) => {
      const result = parser(input)
      return {
        get to() {
          return expect(result)
        },
        get toSuceed() {
          if (! isSuccess(result)) throw `Expect success, got failure: ${String(result.err)}`
          return expect(result.val)
        },
        get toFail() {
          if (isSuccess(result)) throw `Expect failure, got success: ${String(result.val)}`
          return expect(result.err)
        }
      }
    },
    itRun: (input: string, fn: (assertion: {
      to: Assertion
      toSuceed: Assertion
      toFail: Assertion
    }) => void) => {
      it(input, () => {
        try {
          fn(tester.expectRun(input))
        }
        catch (err) {
          if (! (err instanceof Error)) throw new Error(String(err))
          throw err
        }
      })
    }
  }
  return tester
}

describe('Combinator tests', () => {
  describe(`char('a')`, () => {
    const { itRun } = testParser(p.char('a'))
    itRun('a', a => a.to.deep.equal({ val: 'a', rest: '' }))
    itRun('abc', a => a.to.deep.equal({ val: 'a', rest: 'bc' }))
  })

  describe(`satisfy(ch => ch === 'a' || ch === 'b')`, () => {
    const { itRun } = testParser(p.satisfiy(ch => ch === 'a' || ch === 'b'))
    itRun('ac', a => a.to.deep.equal({ val: 'a', rest: 'c' }))
    itRun('bc', a => a.to.deep.equal({ val: 'b', rest: 'c' }))
    itRun('cc', a => a.toFail)
  })

  describe(`many(char('a'))`, () => {
    const { itRun } = testParser(p.many(p.char('a')))
    itRun('aaa', a => a.toSuceed.and.to.deep.equal([ ...'aaa' ]))
    itRun('aab', a => a.toSuceed.and.to.deep.equal([ ...'aa' ]))
    itRun('bbb', a => a.toSuceed.and.to.deep.equal([]))
  })

  describe(`join(many(char('a')))`, () => {
    const { itRun } = testParser(p.join(p.many(p.char('a'))))
    itRun('aaa', a => a.toSuceed.and.to.equal('aaa'))
    itRun('aab', a => a.toSuceed.and.to.equal('aa'))
    itRun('bbb', a => a.toSuceed.and.to.equal(''))
  })

  describe(`join(some(char('a')))`, () => {
    const { itRun } = testParser(p.join(p.some(p.char('a'))))
    itRun('aaa', a => a.toSuceed.and.to.equal('aaa'))
    itRun('aab', a => a.toSuceed.and.to.equal('aa'))
    itRun('bbb', a => a.toFail)
  })

  describe(`str('abc')`, () => {
    const { itRun } = testParser(p.str('abc'))
    itRun('abc', a => a.toSuceed.deep.equal('abc'))
    itRun('abcdef', a => a.to.deep.equal({ val: 'abc', rest: 'def' }))
    itRun('abd', a => a.toFail)
  })

  describe(`map(seq([ char('<'), number, char('>') ]), ([, n ]) => n)`, () => {
    const { itRun } = testParser(p.map(p.seq([ p.char('<'), p.number, p.char('>') ]), ([, n ]) => n))
    itRun('<123>', a => a.toSuceed.and.to.equal(123))
    itRun('<123', a => a.toFail)
  })

  describe(`(
    P.then(P.char('<'), () =>
    P.then(P.number, n =>
    P.then(P.char('>'), () =>
    P.return(n))))
  )`, () => {
    const { itRun } = testParser(
      p.then(p.char('<'), () =>
      p.then(p.number, n =>
      p.then(p.char('>'), () =>
      p.return(n))))
    )
    itRun('<123>', a => a.toSuceed.and.to.equal(123))
    itRun('<123', a => a.toFail)
  })

  describe(`head(fseq([ ignore(char('<')), number, ignore(char('>')) ]))`, () => {
    const { itRun } = testParser(p.head(p.fseq([ p.ignore(p.char('<')), p.number, p.ignore(p.char('>')) ])))
    itRun('<123>', a => a.toSuceed.and.to.equal(123))
    itRun('<123', a => a.toFail)
  })

  describe(`right(char('<'), left(number, char('>')))`, () => {
    const { itRun } = testParser(p.right(p.char('<'), p.left(p.number, p.char('>'))))
    itRun('<123>', a => a.to.deep.equal({ val: 123,  rest: '' }))
    itRun('<123', a => a.toFail)
  })

  describe(`followedBy(str('abc'), surWhite(str('->')))`, () => {
    const { itRun } = testParser(p.followedBy(p.str('abc'), p.spaced(p.str('->'))))
    itRun('abc -> def', a => a.to.deep.equal({ val: 'abc', rest: ' -> def' }))
    itRun('abc', a => a.toFail)
  })

  describe(`notFollowedBy(str('abc'), surWhite(str('->')))`, () => {
    const { itRun } = testParser(p.notFollowedBy(p.str('abc'), p.spaced(p.str('->'))))
    itRun('abc -> def', a => a.toFail)
    itRun('abcdef', a => a.to.deep.equal({ val: 'abc', rest: 'def' }))
  })

  describe(`until(str(';;'))`, () => {
    const { itRun } = testParser(p.until(p.str(';;')))
    itRun('abc;;', a => a.to.deep.equal({ val: [ 'abc', ';;' ], rest: ';;' }))
    itRun('abc; def;; ghi', a => a.to.deep.equal({ val: [ 'abc; def', ';;' ], rest: ';; ghi' }))
    itRun('abc;', a => a.toFail)
  })

  describe(`until(alt([ char(';'), eoi ]))`, () => {
    const { itRun } = testParser(p.until(p.alt([ p.char(';'), p.eoi ])))
    itRun('abc; def', a => a.to.deep.equal({ val: [ 'abc', ';' ], rest: '; def' }))
    itRun('abc def', a => a.to.deep.equal({ val: [ 'abc def', null ], rest: '' }))
  })

  describe(`eoi`, () => {
    const { itRun } = testParser(p.eoi)
    itRun('', a => a.toSuceed)
    itRun('a', a => a.toFail)
  })

  describe(`ended(join(many(char('a'))))`, () => {
    const { itRun } = testParser(p.ended(p.join(p.many(p.char('a')))))
    itRun('', a => a.toSuceed.and.to.equal(''))
    itRun('aaa', a => a.toSuceed.and.to.equal('aaa'))
    itRun('aaab', a => a.toFail)
  })

  describe(`sequence([ optional(number), char('d'), number ])`, () => {
    const { itRun } = testParser(p.sequence([ p.optional(p.number), p.char('d'), p.number ]))
    itRun('d123', a => a.to.deep.equal({ val: [ null, 'd', 123 ], rest: '' }))
    itRun('123d456', a => a.to.deep.equal({ val: [ 123, 'd', 456 ], rest: '' }))
    itRun('d', a => a.toFail)
    itRun('123', a => a.toFail)
  })

  describe(`many(notEmpty(alt([ char(','), head(until(alt([ eoi, char(',') ]))) ])))`, () => {
    const { itRun } = testParser(
      p.many(p.notEmpty(
        p.alt([
          p.char(','),
          p.head(p.until(p.alt([ p.eoi, p.char(',') ])))
        ])
      ))
    )
    itRun('x,y,z', a => a.toSuceed.and.to.deep.equal([ 'x', ',', 'y', ',', 'z' ]))
  })
})

describe('Expression calculator tests', () => {
  const { expectRun } = testParser(p.mapErr(p.ended(exprCalculator), err => {
    if (Err.is('ExpectEnd', err)) return `Expect end of input, got '${err.rest}'`
  }))
  const itEval = (exprStr: string) => {
    const ans = eval(exprStr)
    it(`${exprStr} = ${ans}`, () => {
      expectRun(exprStr).toSuceed.and.to.be.equal(ans)
    })
  }

  itEval('1')
  itEval('(1)')
  itEval('1+1')
  itEval('1 + 1')
  itEval('1 + 2 + 3')
  itEval('1 + 2 - 3')
  itEval('1 + 2 * 3')
  itEval('(1 + 2) * 3')
  itEval('(1 + 2 * 3 ** (4 - 5)) / 6')
})