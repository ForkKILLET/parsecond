import { P, Parser } from '..'

type Expect<T extends true> = T

type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false

const p1 = P.then(P.return(0), () => {
    if (Math.random() > .5) return P.return(1 as const)
    return P.fail(2 as const)
})

export type t0 = Expect<Equal<typeof p1, Parser<1, 2>>>