/// <reference types="mocha" />

import { expect } from 'chai'
import dedent from 'dedent'
import { exprCalculator } from './expr'
import { P, isSuccess, Parser, nil } from '../src'
import { Err } from '../src/error'

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
        itRun: (input: string, f: (assertion: {
            to: Chai.Assertion
            toSuceed: Chai.Assertion
            toFail: Chai.Assertion
        }) => void) => {
            it(input, () => {
                try {
                    f(tester.expectRun(input))
                }
                catch (err) {
                    if (! (err instanceof Error)) throw new Error(err)
                    throw err
                }
            })
        }
    }
    return tester
}

describe('Combinator tests', () => {
    describe(`char('a')`, () => {
        const { itRun } = testParser(P.char('a'))
        itRun('a', a => a.to.deep.equal({ val: 'a', rest: '' }))
        itRun('abc', a => a.to.deep.equal({ val: 'a', rest: 'bc' }))
    })

    describe(`satisfy(ch => ch === 'a' || ch === 'b')`, () => {
        const { itRun } = testParser(P.satisfiy(ch => ch === 'a' || ch === 'b'))
        itRun('ac', a => a.to.deep.equal({ val: 'a', rest: 'c' }))
        itRun('bc', a => a.to.deep.equal({ val: 'b', rest: 'c' }))
        itRun('cc', a => a.toFail)
    })

    describe(`many(char('a'))`, () => {
        const { itRun } = testParser(P.many(P.char('a')))
        itRun('aaa', a => a.toSuceed.and.to.deep.equal([ ...'aaa' ]))
        itRun('aab', a => a.toSuceed.and.to.deep.equal([ ...'aa' ]))
        itRun('bbb', a => a.toSuceed.and.to.deep.equal([]))
    })

    describe(`join(many(char('a')))`, () => {
        const { itRun } = testParser(P.join(P.many(P.char('a'))))
        itRun('aaa', a => a.toSuceed.and.to.equal('aaa'))
        itRun('aab', a => a.toSuceed.and.to.equal('aa'))
        itRun('bbb', a => a.toSuceed.and.to.equal(''))
    })

    describe(`join(some(char('a')))`, () => {
        const { itRun } = testParser(P.join(P.some(P.char('a'))))
        itRun('aaa', a => a.toSuceed.and.to.equal('aaa'))
        itRun('aab', a => a.toSuceed.and.to.equal('aa'))
        itRun('bbb', a => a.toFail)
    })

    describe(`str('abc')`, () => {
        const { itRun } = testParser(P.str('abc'))
        itRun('abc', a => a.toSuceed.deep.equal('abc'))
        itRun('abcdef', a => a.to.deep.equal({ val: 'abc', rest: 'def' }))
        itRun('abd', a => a.toFail)
    })

    describe(`map(seq([ char('<'), number, char('>') ]), ([, n ]) => n)`, () => {
        const { itRun } = testParser(P.map(P.seq([ P.char('<'), P.number, P.char('>') ]), ([, n ]) => n))
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
            P.then(P.char('<'), () =>
            P.then(P.number, n =>
            P.then(P.char('>'), () =>
            P.return(n))))
        )
        itRun('<123>', a => a.toSuceed.and.to.equal(123))
        itRun('<123', a => a.toFail)
    })

    describe(`head(fseq([ ignore(char('<')), number, ignore(char('>')) ]))`, () => {
        const { itRun } = testParser(P.head(P.fseq([ P.ignore(P.char('<')), P.number, P.ignore(P.char('>')) ])))
        itRun('<123>', a => a.toSuceed.and.to.equal(123))
        itRun('<123', a => a.toFail)
    })

    describe(`right(char('<'), left(number, char('>')))`, () => {
        const { itRun } = testParser(P.right(P.char('<'), P.left(P.number, P.char('>'))))
        itRun('<123>', a => a.to.deep.equal({ val: 123,  rest: '' }))
        itRun('<123', a => a.toFail)
    })

    describe(`followedBy(str('abc'), surWhite(str('->')))`, () => {
        const { itRun } = testParser(P.followedBy(P.str('abc'), P.surWhite(P.str('->'))))
        itRun('abc -> def', a => a.to.deep.equal({ val: 'abc', rest: ' -> def' }))
        itRun('abc', a => a.toFail)
    })

    describe(`notFollowedBy(str('abc'), surWhite(str('->')))`, () => {
        const { itRun } = testParser(P.notFollowedBy(P.str('abc'), P.surWhite(P.str('->'))))
        itRun('abc -> def', a => a.toFail)
        itRun('abcdef', a => a.to.deep.equal({ val: 'abc', rest: 'def' }))
    })

    describe(`until(str(';;'))`, () => {
        const { itRun } = testParser(P.until(P.str(';;')))
        itRun('abc;;', a => a.to.deep.equal({ val: [ 'abc', ';;' ], rest: ';;' }))
        itRun('abc; def;; ghi', a => a.to.deep.equal({ val: [ 'abc; def', ';;' ], rest: ';; ghi' }))
        itRun('abc;', a => a.toFail)
    })

    describe(`until(alt([ char(';'), eoi ]))`, () => {
        const { itRun } = testParser(P.until(P.alt([ P.char(';'), P.eoi ])))
        itRun('abc; def', a => a.to.deep.equal({ val: [ 'abc', ';' ], rest: '; def' }))
        itRun('abc def', a => a.to.deep.equal({ val: [ 'abc def', nil ], rest: '' }))
    })

    describe(`eoi`, () => {
        const { itRun } = testParser(P.eoi)
        itRun('', a => a.toSuceed)
        itRun('a', a => a.toFail)
    })

    describe(`ended(join(many(char('a'))))`, () => {
        const { itRun } = testParser(P.ended(P.join(P.many(P.char('a')))))
        itRun('', a => a.toSuceed.and.to.equal(''))
        itRun('aaa', a => a.toSuceed.and.to.equal('aaa'))
        itRun('aaab', a => a.toFail)
    })
})

describe('Expression calculator tests', () => {
    const { expectRun } = testParser(P.mapErr(P.ended(exprCalculator), err => {
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