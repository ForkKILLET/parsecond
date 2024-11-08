import { P, Parser } from '../src'
import { Err } from '../src/error'
import { Nil, unreachable } from '../src/utils'
import { createParserRepl } from './repl'

export type Expr = {
    op: ';+' | ';'
    lhs: string | Expr
    rhs: string | Expr
}

export const expr: Parser<string | Expr, Nil | Err.ExpectTerminator> = P.lazy(() => P.binOp(
    [ ';+', ';' ],
    P.head(P.until(P.alt([ P.str(';+'), P.str(';'), P.eoi ]))),
    'left'
))

if (require.main === module) {
    createParserRepl(expr, { name: 'expr' })
}
