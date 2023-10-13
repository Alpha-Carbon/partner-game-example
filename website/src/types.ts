export type Result<T, E> = { type: 'Ok'; value: T } | { type: 'Err'; error: E };

export const JSONParse = <T>(guard: (o: any) => o is T) => (
  data: string
): Result<T, Error> => {
  try {
    const value = JSON.parse(data);
    return guard(value)
      ? { type: 'Ok', value }
      : { type: 'Err', error: new Error('malformed json') };
  } catch (e: any) {
    return { type: 'Err', error: e };
  }
};

export type JankenMove = 'rock' | 'paper' | 'scissors';
export type JankenResult = 'win' | 'lose' | 'draw';
export type UserTuple = {
  id: string;
  username: string;
};

export interface UserState {
  id: string;
  username: string;
  balance: number;
}

export interface PlayResponse {
  remoteMove: JankenMove;
  result: JankenResult;
  userState: UserState;
  value: number;
}

export function IsUserState(o: any): o is UserState {
  return (
    o !== null &&
    typeof o.id === 'string' &&
    typeof o.username === 'string' &&
    typeof o.balance === 'number'
  );
}

export function IsPlayResponse(o: any): o is PlayResponse {
  return (
    o !== null &&
    typeof o.remoteMove === 'string' &&
    (o.remoteMove === 'rock' ||
      o.remoteMove === 'paper' ||
      o.remoteMove === 'scissors') &&
    typeof o.result === 'string' &&
    (o.result === 'win' || o.result === 'lose' || o.result === 'draw') &&
    IsUserState(o.userState) &&
    typeof o.value === 'number'
  );
}
