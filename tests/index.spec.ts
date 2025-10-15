import { expect, describe, it, Assertion } from 'vitest'
import { p, Parser } from '../src/index'

const testParser = (parser: Parser) => {
  const tester = {
    expectRun: (input: string) => {
      const result = parser({ input, index: 0, rest: input })
      return {
        get ok() {
          if (! result.isOk) throw `Expect ok, got err: ${String(result.err)}`
          return expect(result.val.val)
        },
        get err() {
          if (! result.isErr) throw `Expect err, got ok: ${String(result.val)}`
          return expect(result.err)
        }
      }
    },
    itRun: (input: string, fn: (assertion: {
      ok: Assertion
      err: Assertion
    }) => void) => {
      it(input, () => {
        try {
          fn(tester.expectRun(input))
        }
        catch (err) {
          if (! (err instanceof Error)) throw Error(String(err))
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
    itRun('a', a => a.ok.to.deep.equal('a'))
    itRun('abc', a => a.ok.to.deep.equal('a'))
  })

  describe(`satisfy(ch => ch === 'a' || ch === 'b')`, () => {
    const { itRun } = testParser(p.satisfiy(ch => ch === 'a' || ch === 'b'))
    itRun('ac', a => a.ok.to.deep.equal('a'))
    itRun('bc', a => a.ok.to.deep.equal('b'))
    itRun('cc', a => a.err)
  })

  describe(`many(char('a'))`, () => {
    const { itRun } = testParser(p.many(p.char('a')))
    itRun('aaa', a => a.ok.to.deep.equal([ ...'aaa' ]))
    itRun('aab', a => a.ok.to.deep.equal([ ...'aa' ]))
    itRun('bbb', a => a.ok.to.deep.equal([]))
  })

  describe(`join(many(char('a')))`, () => {
    const { itRun } = testParser(p.join(p.many(p.char('a'))))
    itRun('aaa', a => a.ok.to.equal('aaa'))
    itRun('aab', a => a.ok.to.equal('aa'))
    itRun('bbb', a => a.ok.to.equal(''))
  })

  describe(`join(some(char('a')))`, () => {
    const { itRun } = testParser(p.join(p.some(p.char('a'))))
    itRun('aaa', a => a.ok.to.equal('aaa'))
    itRun('aab', a => a.ok.to.equal('aa'))
    itRun('bbb', a => a.err)
  })

  describe(`str('abc')`, () => {
    const { itRun } = testParser(p.str('abc'))
    itRun('abc', a => a.ok.to.deep.equal('abc'))
    itRun('abcdef', a => a.ok.to.deep.equal('abc'))
    itRun('abd', a => a.err)
  })

  describe(`map(seq([ char('<'), integer, char('>') ]), ([, n ]) => n)`, () => {
    const { itRun } = testParser(p.map(p.seq([ p.char('<'), p.integer, p.char('>') ]), ([, n ]) => n))
    itRun('<123>', a => a.ok.to.equal(123))
    itRun('<123', a => a.err)
  })

  describe(`(
    P.then(P.char('<'), () =>
    P.then(p.integer, n =>
    P.then(P.char('>'), () =>
    P.return(n))))
  )`, () => {
    const { itRun } = testParser(
      p.bind(p.char('<'), () =>
      p.bind(p.integer, n =>
      p.bind(p.char('>'), () =>
      p.return(n))))
    )
    itRun('<123>', a => a.ok.to.equal(123))
    itRun('<123', a => a.err)
  })

  describe(`right(char('<'))(left(char('>')(integer)))`, () => {
    const { itRun } = testParser(p.right(p.char('<'))(p.left(p.char('>'))(p.integer)))
    itRun('<123>', a => a.ok.to.deep.equal(123)),
    itRun('<123', a => a.err)
  })

  describe(`followedBy(str('abc'), spaced(str('->')))`, () => {
    const { itRun } = testParser(p.followedBy(p.str('abc'), p.spaced(p.str('->'))))
    itRun('abc -> def', a => a.ok.to.deep.equal('abc'))
    itRun('abc', a => a.err)
  })

  describe(`notFollowedBy(str('abc'), spaced(str('->')))`, () => {
    const { itRun } = testParser(p.notFollowedBy(p.str('abc'), p.spaced(p.str('->'))))
    itRun('abc -> def', a => a.err)
    itRun('abcdef', a => a.ok.to.deep.equal('abc'))
  })

  describe(`eoi`, () => {
    const { itRun } = testParser(p.eoi)
    itRun('', a => a.ok)
    itRun('a', a => a.err)
  })

  describe(`ended(join(many(char('a'))))`, () => {
    const { itRun } = testParser(p.ended(p.join(p.many(p.char('a')))))
    itRun('', a => a.ok.to.equal(''))
    itRun('aaa', a => a.ok.to.equal('aaa'))
    itRun('aaab', a => a.err)
  })

  describe(`sequence([ optional(integer), char('d'), integer ])`, () => {
    const { itRun } = testParser(p.sequence([ p.optional(p.integer), p.char('d'), p.integer ]))
    itRun('d123', a => a.ok.to.deep.equal([ null, 'd', 123 ]))
    itRun('123d456', a => a.ok.to.deep.equal([ 123, 'd', 456 ]))
    itRun('d', a => a.err)
    itRun('123', a => a.err)
  })
})
