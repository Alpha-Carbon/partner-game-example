import React, { useState } from 'react'
import rock from './assets/Play_Rock.png'
import paper from './assets/Play_Paper.png'
import scissors from './assets/Play_Scissors.png'
import { JankenMove, JankenResult, UserState } from './types'
import * as API from './api'

type Props = {
    userId: string
    updateUser: (user: UserState) => void
}

type State = {
    p1Move?: JankenMove
    p2Move?: JankenMove
    result?: JankenResult
    value?: number
}

const initialState: State = {
    p1Move: undefined,
    p2Move: undefined,
    result: undefined,
    value: undefined,
}

export default function Janken({ userId, updateUser }: Props) {
    const [state, setState] = useState<State>(initialState)

    async function onMoveClick(move: JankenMove) {
        if (!state.result) {
            setState((prev) => ({ ...prev, p1Move: move, p1MoveReady: false }))
            try {
                let resp = await API.janken(userId, move)
                await API.delay(1000)
                setState((prev) => ({
                    ...prev,
                    p2Move: resp.remoteMove,
                    p1MoveReady: true,
                    p2MoveReady: true,
                    result: resp.result,
                    value: resp.value,
                }))
                updateUser(resp.userState)
            } catch (e: any) {
                alert('error: ' + e.message)
                setState(initialState)
            }
        }
    }

    const reveal = state.result !== undefined
    const awaiting_results =
        state.p1Move !== undefined && state.p2Move === undefined
    const p1Move = state.p1Move !== undefined && reveal ? state.p1Move : 'rock'
    const p2Move = state.p2Move !== undefined && reveal ? state.p2Move : 'rock'

    function renderButtons() {
        if (awaiting_results) {
            return <p>waiting for results....</p>
        } else if (!state.result) {
            return (
                <div>
                    <button
                        className="playBtn"
                        onClick={() => {
                            onMoveClick('rock')
                        }}
                    >
                        rock
                    </button>
                    <button
                        className="playBtn"
                        onClick={() => {
                            onMoveClick('paper')
                        }}
                    >
                        paper
                    </button>
                    <button
                        className="playBtn"
                        onClick={() => {
                            onMoveClick('scissors')
                        }}
                    >
                        scissors
                    </button>
                </div>
            )
        } else {
            let res
            switch (state.result) {
                case 'win':
                    res = `You Win ${state.value} USDT!`
                    break
                case 'lose':
                    res = `You lose ${state.value} USDT!`
                    break
                case 'draw':
                    res = 'Draw!'
                    break
            }
            return (
                <>
                    <button
                        className="playBtn"
                        onClick={() => {
                            setState(initialState)
                        }}
                    >
                        Play Again
                    </button>
                    <h2>{res}</h2>
                </>
            )
        }
    }

    return (
        <div>
            <h1>Janken Paws!</h1>
            <div className="player-group">
                <Player move={p1Move} ready={reveal} isP2={false} />
                <Player move={p2Move} ready={reveal} isP2={true} />
            </div>
            {renderButtons()}
        </div>
    )
}

type PlayerProps = {
    move: JankenMove
    ready: boolean
    isP2: boolean
}

function Player({ move, ready, isP2 }: PlayerProps) {
    function getImageSrc(move: JankenMove) {
        switch (move) {
            case 'rock':
                return rock
            case 'paper':
                return paper
            case 'scissors':
                return scissors
        }
    }

    return (
        <>
            <div className={`player ${isP2 ? 'p2' : ''}`}>
                {isP2 ? null : <p>You</p>}
                <img
                    className={`player-image ${ready ? '' : 'bounce'}`}
                    src={getImageSrc(move)}
                    alt="Rock Paper Scissors"
                />
            </div>
        </>
    )
}
