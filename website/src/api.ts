import {
    JSONParse,
    IsPlayResponse,
    PlayResponse,
    JankenMove,
    UserTuple,
    IsUserState,
    UserState,
} from './types'

const GAME_API = process.env.REACT_APP_GAME_API
    ? process.env.REACT_APP_GAME_API
    : 'http://localhost:3001'

console.log(`Game Api: ${GAME_API}`)

export async function login(userId: string): Promise<UserState> {
    const resp = await fetch(`${GAME_API}/login`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
    })

    if (!resp.ok) {
        throw Error(`login failed: ${await resp.text()}`)
    }

    const payload = await resp.text()
    const result = JSONParse(IsUserState)(payload)
    switch (result.type) {
        case 'Ok':
            return result.value
        case 'Err':
            throw result.error
    }
}

export async function getAllUsers(): Promise<Array<UserTuple>> {
    const resp = await fetch(`${GAME_API}/allUsers`, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    })

    if (!resp.ok) {
        throw Error(`getAllUsers failed: ${await resp.text()}`)
    }

    return await resp.json()
}

export async function janken(
    userId: string,
    move: JankenMove
): Promise<PlayResponse> {
    const resp = await fetch(`${GAME_API}/janken`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, move }),
    })

    if (!resp.ok) {
        throw Error(`janken failed: ${await resp.text()}`)
    }

    const payload = await resp.text()
    const result = JSONParse(IsPlayResponse)(payload)
    switch (result.type) {
        case 'Ok':
            return result.value
        case 'Err':
            throw result.error
    }
}

export async function withdrawOnChain(
    userId: string,
    address: string,
    value: number,
    network: string
) {
    const resp = await fetch(`${GAME_API}/withdrawOnChain`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, value, address, network }),
    })

    if (!resp.ok) {
        throw Error(`${await resp.text()}`)
    }
}

export async function getDepositAddress(
    userId: string,
    network: string
) {
    const resp = await fetch(`${GAME_API}/getDepositAddress`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, network }),
    })

    if (!resp.ok) {
        throw Error(`${await resp.text()}`)
    }

    return await resp.json()
}

export async function withdrawOnYubi(
    userId: string,
    currency: string,
    value: number
) {
    const resp = await fetch(`${GAME_API}/withdrawOnYubi`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, currency, value }),
    })

    if (!resp.ok) {
        throw Error(`${await resp.text()}`)
    }
}

export async function getTransactions(userId: string): Promise<Array<any>> {
    const resp = await fetch(`${GAME_API}/transactions`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
    })

    if (!resp.ok) {
        throw Error(`${await resp.text()}`)
    }

    return resp.json()
}

export async function getDepositLink(userId: string, applyAmount: string, network: string): Promise<string> {
    const resp = await fetch(`${GAME_API}/depositLink`, {
        method: 'POST',
        headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, applyAmount, network }),
    })

    if (!resp.ok) {
        throw Error(`${await resp.text()}`)
    }

    return resp.json()
}

export function delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
