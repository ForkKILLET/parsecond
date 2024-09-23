/// <reference types="mocha" />

import { expect, } from 'chai'
import { exprCalculator } from './expr'
import { isSuccess, Parser } from '../src'

const getParserTester = (parser: Parser) => (input: string) => {
    const result = parser(input)
    return {
        get toSuceedAnd() {
            if (! isSuccess(result)) throw `Expect success, got failure: ${result.err}`
            return expect(result.val)
        },
        get toFailAnd() {
            if (isSuccess(result)) throw `Expect failure, got success: ${result.val}`
            return expect(result.err)
        }
    }
}

describe('Expression calculator tests', () => {
    const expectRun = getParserTester(exprCalculator)
    const itEval = (exprStr: string) => {
        const ans = eval(exprStr.replace(/\^/g, '**'))
        it(`${exprStr} = ${ans}`, () => expectRun(exprStr).toSuceedAnd.to.be.equal(ans))
    }

    itEval('1')
    itEval('(1)')
    itEval('1+1')
    itEval('1 + 1')
    itEval('1 + 2 + 3')
    itEval('1 + 2 - 3')
    itEval('1 + 2 * 3')
    itEval('(1 + 2) * 3')
    itEval('(1 + 2 * 3 ^ (4 - 5)) / 6')
})