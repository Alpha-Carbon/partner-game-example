import express from 'express';
import crypto from 'crypto';
import bodyParser from 'body-parser';
import low from 'lowdb';
import fs from 'fs';
import FileSync from 'lowdb/adapters/FileSync';
import lodashId from 'lodash-id';
import cors from 'cors';
import axios from 'axios';
import { UserState, JankenMove, JankenResult } from './types';
import mkdirp from 'mkdirp';
import { v4 as uuidv4 } from 'uuid';
import { URLSearchParams } from 'url';

const RSA_PRIVATE_KEY = fs.readFileSync('./private.pem');
const RSA_PUBLIC_KEY = fs.readFileSync('./public.pem');

// Aggregate Configuration Variables
const PARTNER_PLATFORM = 'ABC Corp. Ltd';
const PORT = process.env.PORT ? process.env.PORT : 3001;
const BANQ_MERCHANT_ID = process.env.BANQ_MERCHANT_ID ?? '00000000-0000-0000-0000-000000000000';
const BANQ_SERVICE_ID = process.env.BANQ_SERVICE_ID ?? '10000000-0000-0000-0000-000000000000';
const YUBI_HOST = process.env.YUBI_HOST ?? 'http://localhost:3000';
// const BANQ_API = process.env.BANQ_API ?? 'http://localhost:3030';
const BANQ_API = process.env.BANQ_API ?? 'http://192.168.50.147:3030';
const YUBI_PATH = '/payments/partner';
const YUBI_PAYMENTS_URL = `${YUBI_HOST}${YUBI_PATH}`;
const TRON_TOKEN_ADDRESS = process.env.TRON_TOKEN_ADDRESS ?? '0xd9479486081278a1a626262082ea2042648687cb'
const BNB_TOKEN_ADDRESS = process.env.BNB_TOKEN_ADDRESS ?? '0xffBfE5fcbecED10b385601Cc78fECfc33BeE237b'
const TRON_TOKEN_TYPE = process.env.TRON_TOKEN_TYPE ?? 'USDT'
const BNB_TOKEN_TYPE = process.env.BNB_TOKEN_TYPE ?? 'USDT'

const BNB_CHAIN_INFO = {
  chainType: 'binance',
  chainId: 97
}

const TRON_CHAIN_INFO = {
  chainType: 'tron',
  chainId: 1
}

const ETH_CHAIN_INFO = {
  chainType: 'eth',
  chainId: 1337
}

console.log(`
===CONFIG===
Port: ${PORT}
Partner: ${PARTNER_PLATFORM}
BANQ MerchantID: ${BANQ_MERCHANT_ID}
BANQ ServiceID: ${BANQ_SERVICE_ID}
BANQ Api: ${BANQ_API}
===========\n`);

const httpClient = axios.create({
  baseURL: BANQ_API,
});

async function main() {
  const signer = crypto.createSign('RSA-SHA256');
  const signature = signer.update('helloworld').sign(RSA_PRIVATE_KEY, 'base64');
  console.log(signature);

  const app = express();
  const port = PORT;
  const db = await createDatabase();
  await recover(db);

  // start the event chaser
  // stateUpdateLoop(db);

  //middleware
  app.use(bodyParser.json());
  app.use(cors());

  // Mock Login
  app.post('/login', (req, res) => {
    const { userId } = req.body;
    const user = db.get('users').getById(userId).value();
    res.json(user);
  });

  // Get deposit record
  app.post('/webhook', (req, res) => {
    const userId = req.body.user_id;
    const usersCollection = db.get('users');
    const txCollection = db.get('tetherTransactions').value();
    const user = usersCollection.getById(userId).value();
    if (!user) {
      res.status(400).send('unknown user');
      return;
    }
    if (!req.body.token_address) {
      return;
    }
    // process event and store the fact
    user.balance = Number(req.body.value) + Number(user.balance);
    txCollection.push({
      userId: user.id,
      kind: 'Deposit',
      amount: Number(req.body.value),
      at: req.body.dateTime,
    });
    db.write();
    res.status(200).send("12344");
  });

  // Query users
  app.get('/allUsers', (_req, res) => {
    const users = db
      .get('users')
      .value()
      .map((u: UserState) => ({ username: u.username, id: u.id }));
    res.json(users);
  });

  // // Withdraw funds to YUBI as User
  // app.post('/withdrawOnYubi', async (req, res) => {
  //   const { userId, currency, value } = req.body;
  //   const userCollection = db.get('users');
  //   let user = userCollection.getById(userId).value();
  //   if (!user) {
  //     res.status(400).send('unknown user');
  //     return;
  //   }
  //   if (user.balance < value) {
  //     res.status(400).send('insufficient funds');
  //     return;
  //   }
  //   if (!user.yubiAccount) {
  //     res.status(400).send('no withdrawal account available');
  //     return;
  //   }
  //   if (currency !== 'Tether') {
  //     res.status(400).send('unsupported currency');
  //     return;
  //   }

  //   const idempotencyKey = uuidv4();
  //   const payload: OnYubi = {
  //     idempotencyKey,
  //     user: user.yubiAccount,
  //     amount: {
  //       kind: currency,
  //       value: String(value),
  //     },
  //     metadata: jankenMetadata(userId),
  //   };
  //   const request = {
  //     id: idempotencyKey,
  //     userId,
  //     yubiRequestId: undefined,
  //     url: `${BANQ_API}/partners/userWithdrawal`,
  //     payload,
  //   };

  //   let accepted = await idempotentWithdrawal(db, request);
  //   if (accepted) {
  //     res.sendStatus(202);
  //   } else {
  //     res.sendStatus(500);
  //   }
  // });

  // get user deposit address from Banq
  app.post('/getDepositAddress', async (req, res) => {
    const { userId, network } = req.body;
    const userCollection = db.get('users');
    let user = userCollection.getById(userId).value();
    if (!user) {
      res.status(400).send('unknown user');
      return;
    }


    let tokenAddress: String
    let chainInfo: {
      chainType: string;
      chainId: Number;
    }
    switch (network) {
      case 'TRC20':
        tokenAddress = TRON_TOKEN_ADDRESS
        chainInfo = TRON_CHAIN_INFO
        break;
      case 'ERC20':
        tokenAddress = BNB_TOKEN_ADDRESS
        chainInfo = BNB_CHAIN_INFO
        break;
    }


    const payload: Deposit = {
      userId: user.id,
      chainInfo,
      metadata: {
        serviceMedata: "test"
      }
    };

    const request: DepositRequest = {
      url: `${BANQ_API}/secure/external/depositAddress`,
      payload,
    };

    let headers = createSignedHeaders(
      BANQ_MERCHANT_ID,
      BANQ_SERVICE_ID,
      RSA_PRIVATE_KEY,
      request.payload
    );

    let banqRes = await httpClient.post(request.url, request.payload, { headers });

    res.status(200).json(banqRes.data)
  });


  // Withdraw funds to Chain as User
  app.post('/withdrawOnChain', async (req, res) => {
    const { userId, value, address, network } = req.body;
    const userCollection = db.get('users');
    let user = userCollection.getById(userId).value();
    if (!user) {
      res.status(400).send('unknown user');
      return;
    }
    if (user.balance < value) {
      res.status(400).send('insufficient funds');
      return;
    }
    let tokenType: string
    let chainInfo: {
      chainType: string;
      chainId: Number;
    }
    switch (network) {
      case 'TRC20':
        tokenType = TRON_TOKEN_TYPE
        chainInfo = TRON_CHAIN_INFO
        break;
      case 'ERC20':
        tokenType = BNB_TOKEN_TYPE
        chainInfo = BNB_CHAIN_INFO
        break;
    }

    const idempotencyKey = uuidv4();
    const payload: OnChain = {
      idempotentKey: idempotencyKey,
      merchantId: BANQ_MERCHANT_ID,
      address,
      tokenType,
      value,
      chainInfo
    };
    const request = {
      id: idempotencyKey,
      userId,
      yubiRequestId: undefined,
      url: `${BANQ_API}/secure/external/withdrawal`,
      payload,
    };

    let accepted = await idempotentWithdrawal(db, request);
    if (accepted) {
      res.sendStatus(202);
    } else {
      res.sendStatus(500);
    }
  });

  // Play Janken as User
  app.post('/janken', (req, res) => {
    const wager = 10;
    const selections: Array<JankenMove> = ['rock', 'paper', 'scissors'];
    const { userId, move } = req.body;
    if (move !== 'rock' && move !== 'paper' && move !== 'scissors') {
      res.status(500).send('invalid move');
      return;
    }

    const collection = db.get('users');
    const txCollection = db.get('tetherTransactions').value();
    const user = collection.getById(userId).value();
    const cpuMove: JankenMove =
      selections[Math.floor(Math.random() * selections.length)];

    if (user.balance < wager) {
      res.status(500).send('insufficient funds');
      return;
    }

    let result: JankenResult;
    if (move === cpuMove) {
      result = 'draw';
    } else if (
      (move === 'rock' && cpuMove === 'scissors') ||
      (move === 'scissors' && cpuMove === 'paper') ||
      (move === 'paper' && cpuMove === 'rock')
    ) {
      result = 'win';
      user.balance += wager;
      txCollection.push({
        userId: user.id,
        kind: 'Win(Janken)',
        amount: { kind: 'Tether', value: String(wager) },
        at: new Date().toString(),
      });
    } else {
      result = 'lose';
      user.balance -= wager;
      txCollection.push({
        userId: user.id,
        kind: 'Loss(Janken)',
        amount: { kind: 'Tether', value: String(wager) },
        at: new Date().toString(),
      });
    }

    db.write();

    res.json({
      remoteMove: cpuMove,
      result: result,
      userState: user,
      value: wager,
    });
  });

  // Get the YUBI Deposit link
  // app.post('/depositLink', (req, res) => {
  //   const { userId, applyAmount, network } = req.body;
  //   const user = db.get('users').getById(userId).value();
  //   if (!user) {
  //     res.status(400).send('unknown user');
  //     return;
  //   }

  //   res.json(createYubiPaymentLink(userId, 'Tether', applyAmount, network));
  // });

  // Get list of User's Transactions
  app.post('/transactions', (req, res) => {
    const { userId } = req.body;
    const txns = db.get('tetherTransactions').filter({ userId }).value();
    res.json(txns);
  });

  // Get Full Database State Dump
  app.get('/state', (_req, res) => {
    res.header('Content-Type', 'application/json');
    res.send(JSON.stringify(db, null, 4));
  });

  // Check API Server Liveliness
  app.get('/healthz', (_req, res) => {
    res.sendStatus(200);
  });

  app.listen(port, () => {
    console.log(`app listening at http://localhost:${port}`);
  });
}

main()
  .then((_res) => { })
  .catch(console.error);

// In case of a crash, we get all of the requests without a requestId (due to missing the response
// from the Yubi API server) and retry the request until we receive a 202 accepted
async function recover(db) {
  const requestCache: Array<WithdrawRequest> = db
    .get('requestCache')
    .filter({ yubiRequestId: undefined })
    .value();

  for (var i = 0; i < requestCache.length; i++) {
    console.log(`recovering request: ${requestCache[i]}`);
    const ok = await idempotentWithdrawal(db, requestCache[i]);
    if (!ok) {
      console.log(
        `idempotent withdrawal recovery failed:`,
        JSON.stringify(requestCache[i])
      );
    }
  }
}


type WithdrawRequest = {
  id: string;
  userId: string;
  url: string;
  yubiRequestId: string | undefined;
  payload: OnYubi | OnChain;
};

type DepositRequest = {
  url: string;
  payload: Deposit;
};

type OnYubi = {
  idempotentKey: string,
  address: string;
  value: string;
  chainInfo: {
    chainType: string;
    chainId: Number;
  }
  tokenAddress: string | undefined;
};

type OnChain = {
  idempotentKey: string,
  merchantId: string,
  tokenType: string,
  address: string,
  value: Number,
  chainInfo: {
    chainType: string;
    chainId: Number;
  }
};


type Metadata = {
  serviceMedata: string
}
type Deposit = {
  chainInfo: {
    chainType: string;
    chainId: Number;
  },
  userId: string,
  metadata: Metadata
};

// change here
// Yubi API guarantees a request remains idempotent for 24 hours if the same idempotency key
// is given for a request
async function idempotentWithdrawal(db, request: WithdrawRequest) {
  const user = db.get('users').getById(request.userId).value();
  const requestCache = db.get('requestCache');

  // #IMPORTANT, User.balance and idempotent requests object must be a transactional write in YOUR
  // database.  `user.balance -= value`` and the request is stored on disk after the `write()` call
  const value = Number(request.payload.value);
  console.log('user balance pre withdraw:', user.balance);
  user.balance -= value;
  console.log('user balance post withdraw:', user.balance);
  const cachedRequest = requestCache.insert(request).write();

  //Post Request, retrying if we can
  let headers = createSignedHeaders(
    BANQ_MERCHANT_ID,
    BANQ_SERVICE_ID,
    RSA_PRIVATE_KEY,
    request.payload
  );
  const revert = await retryRequest(
    request.url,
    headers,
    request.payload
  );
  if (!revert) {
    //store the withdrawal response id from YUBI
    //when the corresponding event comes back from YUBI, we can mark the entry based on the
    //yubi request id as complete.  This lets us know for sure if a response was 202 accepted
    console.log('Withdrawal accepted');
    // cachedRequest.yubiRequestId = yubiRequestId;
    // requestCache.write();
  } else {
    // #IMPORTANT the balance update and requestCache item must be removed together in
    // a transaction!
    user.balance = value + Number(user.balance);
    requestCache.removeById(request.id).write();
    return false;
  }
  return true;
}

async function retryRequest(
  url: string,
  headers: object,
  payload: any
): Promise<boolean> {
  let retries = 5;
  while (retries > 0) {
    console.log(
      `idempotent request: ${url} payload: ${JSON.stringify(payload, null, 2)}`
    );
    try {
      let resp = await httpClient.post(url, payload, { headers });
      if (resp.status === 202) {
        return false;
      }
    } catch (e) {
      if (e.response) {
        // request failed due to bad request or server error.  Abort
        console.log('Idempotent Bad Request, Need Revert');
        return true;
      } else if (e.request) {
        // request failed due to timeout.  Could be our network or remote's network or both.
        // it is possible the request arrived or did not arrive, this is retryable
        console.log('Idempotent Timed Out, retrying:', e.request);
        console.log(e.response);
      } else {
        // this is code level errors like null objects.  In this case, it should be a failure
        console.log('Idempotent Request System Error:', e);
        return true;
      }
    }

    // be friendly to the remote api
    await delay(1000);
    retries -= 1;
  }

  console.log(
    'Retry count exhausted, request status unknown and cannot revert'
  );
  return false;
}

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jankenMetadata(userId: string) {
  return {
    userId,
    gameType: 'janken',
    platform: PARTNER_PLATFORM,
    time: Date.now().toString(),
  };
}

// function createYubiPaymentLink(userId: string, currency: string, applyAmount: string, network: string): string {
//   const metadataURIParams = new URLSearchParams(jankenMetadata(userId));
//   const orderId = uuidv4();

//   let path = network ? 
//     `${YUBI_PATH}?currency=${currency}&partner=${YUBI_PARTNER_ID}&network=${network}&order=${orderId}&${metadataURIParams.toString()}` 
//       : `${YUBI_PATH}?currency=${currency}&partner=${YUBI_PARTNER_ID}&order=${orderId}&${metadataURIParams.toString()}`;
//   if (applyAmount !== "") {
//     path += `&applyamount=${applyAmount}`
//   }

//   const signer = crypto.createSign('RSA-SHA256');
//   signer.update(path);
//   const signature = signer.sign(RSA_PRIVATE_KEY, 'base64');

//   return `${YUBI_HOST}${path}&sig=${signature}`;
// }

async function createDatabase() {
  try {
    await mkdirp('dist');
  } catch (e) {
    console.error('mkdirp error:', e);
    throw e;
  }

  const adapter = new FileSync('dist/db.json');
  const db = low(adapter);
  db._.mixin(lodashId);

  if (!db.get('initialized').value()) {
    console.log('initializing blank database');

    db.defaults({
      initialized: true,
      yubiCheckpoint: {
        eventIndex: '0',
      },
      users: [],
      requestCache: [],
      tetherTransactions: [],
    }).write();

    const usersCollection = db.get('users');
    usersCollection
      .insert({
        id: '0ee12dff-a026-4fa1-b67a-9f97da73aba4',
        username: 'Goku',
        balance: 0,
        yubiAccount: undefined,
      })
      .write();
    usersCollection
      .insert({
        id: 'ea706f4f-3bfc-4953-95d3-170dd562bf2e',
        username: 'Yusuke',
        balance: 0,
        yubiAccount: undefined,
      })
      .write();
    usersCollection
      .insert({
        id: '10cc7c5-813d-461e-a063-3c5acec61bae',
        username: 'Gon',
        balance: 0,
        yubiAccount: undefined,
      })
      .write();
    usersCollection
      .insert({
        id: '617ac13f-4543-4a29-9cef-856d2611b967',
        username: 'Naruto',
        balance: 0,
        yubiAccount: undefined,
      })
      .write();
  }

  return db;
}

// function stateUpdateLoop(db) {
//   const checkpoint = db.get('yubiCheckpoint').value();
//   const usersCollection = db.get('users');
//   const txCollection = db.get('tetherTransactions').value();
//   const requestCache = db.get('requestCache');

//   let loopId = setInterval(async () => {
//     let data = await query_events(checkpoint.eventIndex);
//     if (!data) {
//       return;
//     }

//     try {
//       // console.log(`received ${resp.data.length} events`);
//       for (var i = 0; i < data.length; i++) {
//         const event = data[i];
//         console.log(`processing ${event.kind} event`);
//         switch (event.kind) {
//           case 'Received':
//             if (event.metadata !== undefined && event.metadata.userId !== undefined) {
//               const user = usersCollection.getById(event.metadata.userId).value();
//               // process each event and store the fact
//               user.balance += Number(event.amount.value);
//               user.yubiAccount = event.correlationId;
//               txCollection.push({
//                 userId: user.id,
//                 kind: 'Deposit',
//                 amount: event.amount,
//                 at: event.when,
//               });
//             }
//             break;
//           // case 'Transfered':
//           case 'Withdrawn':
//             if (event.metadata !== undefined && event.metadata.userId !== undefined) {
//               const user = usersCollection.getById(event.metadata.userId).value();
//               // It is up to the system to decide if the requestCache for this transfer event
//               // should be deleted
//               txCollection.push({
//                 userId: user.id,
//                 kind: 'Withdraw',
//                 amount: event.amount,
//                 at: event.when,
//               });
//             }
//             break;
//         }
//         //#NOTE this bigint conversion is needed only because javascript only uses 53bit precision
//         //for numbers and the api uses i64 for event indices
//         let index = BigInt(checkpoint.eventIndex);
//         index += BigInt(1);
//         checkpoint.eventIndex = index.toString();
//         // the last write makes everything transactional
//         db.write();
//       }
//     } catch (e) {
//       console.log(`server logic error: ${e}`);
//       clearInterval(loopId);
//       throw e;
//     }
//   }, 5000);
// }

type EventsRequest = {
  currencyKind: string;
  version: string;
};

type SignedHeaders = {
  'X-merchantId': string;
  'X-ServiceId': string;
  'X-Signature': string;
  'X-Algorithm': 'RSA-SHA256';
};

function createSignedHeaders(
  merchantId: string,
  serviceId: string,
  privateKey: any,
  payload: object
): object {

  const signer = crypto.createSign('RSA-SHA256');
  const signature = signer
    .update(JSON.stringify(payload))
    .sign(privateKey, 'base64');
  const headers: SignedHeaders = {
    'X-merchantId': merchantId,
    'X-ServiceId': serviceId,
    'X-Signature': signature,
    'X-Algorithm': 'RSA-SHA256',
  };
  return headers;
}

// async function query_events(eventIndex: string): Promise<any> {
//   try {
//     console.log('requesting events from:', eventIndex);
//     const request: EventsRequest = {
//       currencyKind: 'Tether',
//       version: eventIndex,
//     };
//     const headers = createSignedHeaders(
//       YUBI_PARTNER_ID,
//       RSA_PRIVATE_KEY,
//       request
//     );

//     const resp = await httpClient.post(`${YUBI_API}/partners/events`, request, {
//       headers,
//     });
//     if (resp.status !== 200) {
//       console.log(`events query failed with status: ${resp.status}`);
//       return;
//     }
//     return resp.data;
//   } catch (e) {
//     console.log(`update failed: ${e}`);
//     return;
//   }
// }

// const request_uri = `/partners/events?partnerId=${YUBI_PARTNER_ID}&currencyKind=Tether&version=1234`;
// console.log(`request uri: ${request_uri}`)
// const signer = crypto.createSign('RSA-SHA256');
// signer.update(request_uri);
// const signature = signer.sign(RSA_PRIVATE_KEY, 'base64');
// const signed_request = `${request_uri}&sig=${signature}`;
// console.log(`signed request uri: ${signed_request}`);
