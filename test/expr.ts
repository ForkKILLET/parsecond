import { P, Parser } from '../src'
import { Err } from '../src/error'
import { Nil, unreachable } from '../src/utils'
import { createParserRepl } from './repl'

export type Expr = {
    op: '^' | '+' | '-' | '*' | '/'
    lhs: number | Expr
    rhs: number | Expr
}

export const expr: Parser<number | Expr, Nil | Err.ExpectEnd> = P.lazy(() => {
    const powOp = P.binOp([ '^' ], 'right', P.alt([ P.number, P.surParen(expr) ]))
    const mulOp = P.binOp([ '*', '/' ], 'left', P.alt([ powOp, P.surParen(expr) ]))
    const addOp = P.binOp([ '+', '-' ], 'left', P.alt([ mulOp, P.surParen(expr) ]))
    return addOp
})

export const calcExpr = (expr: Expr | number): number => {
    if (typeof expr === 'number') return expr
    const { lhs, op, rhs } = expr
    if (op === '^') return calcExpr(lhs) ** calcExpr(rhs)
    if (op === '+') return calcExpr(lhs) + calcExpr(rhs)
    if (op === '-') return calcExpr(lhs) - calcExpr(rhs)
    if (op === '*') return calcExpr(lhs) * calcExpr(rhs)
    if (op === '/') return calcExpr(lhs) / calcExpr(rhs)
    throw unreachable()
}

export const exprCalculator = P.map(expr, calcExpr)

if (require.main === module) {
    createParserRepl(exprCalculator, { name: 'expr' })
}
