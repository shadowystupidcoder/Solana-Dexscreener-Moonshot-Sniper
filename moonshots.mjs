import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL, VersionedMessage, VersionedTransaction, Transaction } from '@solana/web3.js';
import * as spl from "@solana/spl-token";
import { NearUInt64 } from "@solana/buffer-layout";
const connection = new Connection('https://hidden-weathered-pallet.solana-mainnet.discover.quiknode.pro/4e1f35366dce2476315a1f5c7efab222ae8562de/');
const user = Keypair.fromSecretKey(new Uint8Array([254, 214, 219, 105, 15, 49, 222, 59, 38]));

const mint = "25grceZsD9tKZA1NgzAjtBazrkXNw5oFFFUmXpac84Qv";


/* Example sell */

// dont touch these v
const EXACT_RESERVE_POINT_1 = 581220852;
const EXACT_PRICE_POINT_1 = 0.0001106;
const EXACT_RESERVE_POINT_2 = 963086653;
const EXACT_PRICE_POINT_2 = 0.00001310;
const m = (EXACT_PRICE_POINT_2 - EXACT_PRICE_POINT_1) / (EXACT_RESERVE_POINT_2 - EXACT_RESERVE_POINT_1);
const b = EXACT_PRICE_POINT_1 - m * EXACT_RESERVE_POINT_1;
//  dont touch these ^

async function getPrice(supply) {
    return m * supply + b;
}

const solToSpend = 0.0051;
await buy(mint, solToSpend, user);

//const sellTokensAmountUi = 64575;
//await sell(mint, sellTokensAmountUi, user);

async function calculateTokensReceived(solAmount, currentSolPrice, tokenPriceUSD) {
    // Calculate the total amount in USD
    const totalUSD = solAmount * currentSolPrice;
    // Calculate the number of tokens you will receive
    const numberOfTokens = totalUSD / tokenPriceUSD;
    return numberOfTokens;
}

async function getCurrentSolPrice() {
const vaults = await connection.getMultipleAccountsInfo([new PublicKey("DQyrAcCrDXQ7NeoqGgDCZwBvWDcYmFCjSb9JtteuvPpz"), new PublicKey("HLmqeL62xR1QoZ1HKKbXRrdN1p3phKpxRMb2VVopvBBz")]);
const vaultBaseRawAmount = new NearUInt64().decode(new Uint8Array(vaults[0].data.subarray(64, 72)));
const vaultQuoteRawAmount = new NearUInt64().decode(new Uint8Array(vaults[1].data.subarray(64, 72)));
const baseUiAmount = vaultBaseRawAmount / 10 ** 9;
const quoteUiAmount = vaultQuoteRawAmount / 10 ** 6
const perToken = quoteUiAmount / baseUiAmount
const perOneSol = perToken * 1
return(Number(perOneSol.toFixed(2))) }


async function buy(mint, solAmount, user) {
    const bondingCurve = await connection.getProgramAccounts(new PublicKey("MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG"), {
        filters: [{ memcmp: { offset: 24, bytes: mint } }]
    });
    const supply = new NearUInt64().decode(new Uint8Array(bondingCurve[0].account.data.subarray(16, 24)));
    const tokenPriceUSD = await getPrice(supply / LAMPORTS_PER_SOL)
	console.log(tokenPriceUSD)
	const lamportsIn = solAmount * LAMPORTS_PER_SOL
	const solUSD = await getCurrentSolPrice()
	const tokensReceived = (await calculateTokensReceived(solAmount, solUSD, tokenPriceUSD) * LAMPORTS_PER_SOL)
    const prep = {
        "direction": "buy",
        "creatorPK": user.publicKey.toString(),
        "amount": tokensReceived.toFixed(0),
        "collateralAmount": lamportsIn.toFixed(0),
        "slippageBps": 2500,
        "mintAddress": mint,
        "curveType": "LINEAR_V1",
        "coefB": 25
    };
    console.log(prep);
    const prSend = await prepareTransaction("https://ms.dexscreener.com/tx/v1/prepare", prep);
    const prResp = await prSend.json();
    console.log(prResp);
    const prTx = prResp['transaction'];
    const prToken = prResp['token'];
    const prDirection = prResp['direction'];
    const deserializedTx = await deserializeTransaction(Buffer.from(prTx, "base64"));
    deserializedTx.sign([user]);
    const signedTx = deserializedTx.serialize();
    const base64Tx = Buffer.from(signedTx).toString('base64');
    const txData = {
        "direction": prDirection,
        "signedTransaction": base64Tx,
        "token": prToken
    };
    const send = await prepareTransaction("https://ms.dexscreener.com/tx/v1/submit", txData);
    const sendResp = await send.json();
    if (sendResp) {
        return sendResp;
    }
}


async function sell(mint, amount, user) {
    const bondingCurve = await connection.getProgramAccounts(new PublicKey("MoonCVVNZFSYkqNXP6bxHLPL6QQJiMagDL3qcqUQTrG"), {
        filters: [{ memcmp: { offset: 24, bytes: mint } }]
    });
    const supply = new NearUInt64().decode(new Uint8Array(bondingCurve[0].account.data.subarray(16, 24)));
    const tokenPrice = await getPrice(supply / LAMPORTS_PER_SOL);
    const amountOfTokensRaw = Number(amount.toFixed(0)) * LAMPORTS_PER_SOL;
    const totalTokenPrice = ((amountOfTokensRaw / LAMPORTS_PER_SOL) * tokenPrice) / await getCurrentSolPrice();
    const collateralIn = (totalTokenPrice * LAMPORTS_PER_SOL).toFixed(0);
    const sellData = {
        "direction": "sell",
        "creatorPK": user.publicKey.toString(),
        "amount": amountOfTokensRaw.toString(),
        "collateralAmount": collateralIn,
        "slippageBps": 1500,
        "mintAddress": mint,
        "curveType": "LINEAR_V1",
        "coefB": 25
    };
    console.log(sellData);
    try {
        await prepareSellTransaction(sellData, mint, user);
    } catch (error) {
        console.log(error);
    }
}


async function prepareSellTransaction(data, mint, user) {
    const prSend = await prepareTransaction("https://ms.dexscreener.com/tx/v1/prepare", data);
    const prResp = await prSend.json();
    const prTx = prResp['transaction'];
    const prToken = prResp['token'];
    const prDirection = prResp['direction'];
    const deserializedTx = await deserializeTransaction(Buffer.from(prTx, "base64"));
    const ata = await getOwnerAta(mint, user);
    deserializedTx.sign([user]);
    const signedTx = deserializedTx.serialize();
    const base64Tx = Buffer.from(signedTx).toString('base64');
    const txData = {
        "direction": prDirection,
        "signedTransaction": base64Tx,
        "token": prToken
    };
    const send = await prepareTransaction("https://ms.dexscreener.com/tx/v1/submit", txData);
    const sendResp = await send.json();
    try {
		const info = await connection.getAccountInfo(ata)
		if (info) {
		const bal = new NearUInt64().decode(new Uint8Array(info.data.subarray(64, 72)));
		if (bal === 0) {
        const tx = new Transaction().add(spl.createCloseAccountInstruction(ata, user.publicKey, user.publicKey));
        const sent = await connection.sendTransaction(tx, [user], { skipPreflight: false, preflightCommitment: "confirmed" });
        console.log(sent); } }
    } catch (error) {
        console.log(error);
    }
    if (sendResp) {
        return sendResp;
    }
}


async function prepareTransaction(endpoint, data) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        return response;
    } catch (error) {
        console.log(error);
    }
}


async function getOwnerAta(mint, user) {
    const mintPub = new PublicKey(mint);
    const foundAta = PublicKey.findProgramAddressSync([user.publicKey.toBuffer(), spl.TOKEN_PROGRAM_ID.toBuffer(), mintPub.toBuffer()], spl.ASSOCIATED_TOKEN_PROGRAM_ID)[0];
    return foundAta;
}


function decodeLength(bytes) {
    let len = 0;
    let size = 0;
    for (;;) {
        let elem = bytes.shift();
        len |= (elem & 0x7f) << size * 7;
        size += 1;
        if ((elem & 0x80) === 0) {
            break;
        }
    }
    return len;
}


function guardedSplice(byteArray, ...args) {
    const [start] = args;
    if (args.length === 2 ? start + (args[1] ?? 0) > byteArray.length : start >= byteArray.length) {
        throw new Error('END_OF_BUFFER_ERROR_MESSAGE');
    }
    return byteArray.splice(...args);
}


async function deserializeTransaction(serializedTransaction) {
    let byteArray = [...serializedTransaction];
    const signatures = [];
    const signaturesLength = decodeLength(byteArray);
    for (let i = 0; i < signaturesLength; i++) {
        signatures.push(new Uint8Array(guardedSplice(byteArray, 0, 64)));
    }
    const message = VersionedMessage.deserialize(new Uint8Array(byteArray));
    return new VersionedTransaction(message, signatures);
}
