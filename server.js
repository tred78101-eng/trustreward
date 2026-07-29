// =====================================================
// TRUSTREWARD COMPLETE BACKEND
// =====================================================
// Networks:
// 1. PaidBucksy
// 2. TimeWall
// 3. FlexWall
// 4. OGAds
// 5. CPX Research
// 6. CPAGrip
//
// Firebase:
// Realtime Database
//
// Coin conversion:
// $1 USD = 250 coins
//
// Deploy: Vercel (serverless)
// =====================================================


import { Hono } from "hono";
import crypto from "node:crypto";

import {
  initializeApp,
  getApps,
  cert
} from "firebase-admin/app";

import {
  getDatabase
} from "firebase-admin/database";


// =====================================================
// CONFIGURATION
// =====================================================

const COINS_PER_USD = 250;


// =====================================================
// HONO APP
// =====================================================

const app = new Hono();


// =====================================================
// FIREBASE ADMIN
// =====================================================

if (!getApps().length) {

  const projectId =
    process.env.FIREBASE_PROJECT_ID;

  const clientEmail =
    process.env.FIREBASE_CLIENT_EMAIL;

  const privateKey =
    process.env.FIREBASE_PRIVATE_KEY
      ? process.env.FIREBASE_PRIVATE_KEY.replace(
          /\\n/g,
          "\n"
        )
      : undefined;


  if (
    !projectId ||
    !clientEmail ||
    !privateKey
  ) {

    console.error(
      "Firebase environment variables are missing."
    );

  }


  initializeApp({

    credential:
      cert({

        projectId:
          projectId,

        clientEmail:
          clientEmail,

        privateKey:
          privateKey

      }),

    databaseURL:
      process.env.FIREBASE_DATABASE_URL ||
      "https://trustreward-19165-default-rtdb.firebaseio.com"

  });

}


const db =
  getDatabase();


// =====================================================
// HELPER: MD5
// =====================================================

function md5(value) {

  return crypto
    .createHash("md5")
    .update(String(value))
    .digest("hex");

}


// =====================================================
// HELPER: SHA256
// =====================================================

function sha256(value) {

  return crypto
    .createHash("sha256")
    .update(String(value))
    .digest("hex");

}


// =====================================================
// HELPER: NUMBER
// =====================================================

function safeNumber(value) {

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;

}


// =====================================================
// HELPER: ADD COINS
// =====================================================

async function addCoins(
  userId,
  coins
) {

  const userRef =
    db.ref(
      `users/${userId}`
    );


  const result =
    await userRef.transaction(
      (user) => {

        if (!user) {

          return user;

        }


        user.coins =
          safeNumber(user.coins) +
          coins;


        user.totalEarned =
          safeNumber(user.totalEarned) +
          coins;


        return user;

      }
    );


  return result;

}


// =====================================================
// HELPER: REMOVE COINS
// =====================================================

async function removeCoins(
  userId,
  coins
) {

  const userRef =
    db.ref(
      `users/${userId}`
    );


  const result =
    await userRef.transaction(
      (user) => {

        if (!user) {

          return user;

        }


        const currentCoins =
          safeNumber(user.coins);


        const currentTotalEarned =
          safeNumber(
            user.totalEarned
          );


        user.coins =
          Math.max(
            0,
            currentCoins - coins
          );


        user.totalEarned =
          Math.max(
            0,
            currentTotalEarned - coins
          );


        return user;

      }
    );


  return result;

}


// =====================================================
// HELPER: NOTIFICATION
// =====================================================

async function sendNotification(
  userId,
  type,
  title,
  message,
  icon
) {

  await db
    .ref(
      `notifications/${userId}`
    )
    .push({

      type:
        type,

      title:
        title,

      message:
        message,

      icon:
        icon || "coins",

      read:
        false,

      timestamp:
        Date.now()

    });

}


// =====================================================
// HELPER: USER EXISTS
// =====================================================

async function getUser(
  userId
) {

  const userRef =
    db.ref(
      `users/${userId}`
    );


  const snapshot =
    await userRef.once(
      "value"
    );


  if (
    !snapshot.exists()
  ) {

    return null;

  }


  return snapshot.val() || {};

}


// =====================================================
// HOME / HEALTH
// =====================================================

app.get(
  "/",
  (c) => {

    return c.text(
      "TrustReward backend is running."
    );

  }
);


// =====================================================
// HEALTH CHECK
// =====================================================

app.get(
  "/health",
  (c) => {

    return c.json({

      success:
        true,

      status:
        "online",

      service:
        "TrustReward Backend",

      coinsPerUsd:
        COINS_PER_USD,

      timestamp:
        Date.now()

    });

  }
);



// =====================================================
// =====================================================
// PAIDBUCKSY POSTBACK
// =====================================================
// =====================================================

app.get(
  "/postback/paidbucksy",
  async (c) => {

    try {

      // =================================================
      // PARAMETERS
      // =================================================

      const userId =
        String(
          c.req.query("user_id") || ""
        ).trim();


      const transactionId =
        String(
          c.req.query("transaction_id") || ""
        ).trim();


      const rewardRaw =
        c.req.query("reward");


      const status =
        String(
          c.req.query("status") || ""
        ).trim();


      const signature =
        String(
          c.req.query("signature") || ""
        ).trim()
        .toLowerCase();


      // =================================================
      // REQUIRED
      // =================================================

      if (
        !userId ||
        !transactionId ||
        rewardRaw === undefined ||
        !status ||
        !signature
      ) {

        return c.text(
          "ERROR",
          400
        );

      }


      // =================================================
      // REWARD
      // =================================================

      const reward =
        Number(rewardRaw);


      if (
        !Number.isFinite(reward) ||
        reward <= 0
      ) {

        return c.text(
          "INVALID REWARD",
          400
        );

      }


      // =================================================
      // SECRET
      // =================================================

      const secret =
        process.env.PAIDBUCKSY_SECRET;


      if (!secret) {

        console.error(
          "PAIDBUCKSY_SECRET is missing"
        );

        return c.text(
          "ERROR",
          500
        );

      }


      // =================================================
      // MD5
      //
      // user_id + transaction_id + reward + SECRET
      // =================================================

      const signatureInput =
        String(userId) +
        String(transactionId) +
        String(rewardRaw) +
        String(secret);


      const expectedSignature =
        md5(
          signatureInput
        );


      if (
        signature !==
        expectedSignature.toLowerCase()
      ) {

        console.error(
          "PAIDBUCKSY INVALID SIGNATURE"
        );

        return c.text(
          "ERROR",
          403
        );

      }


      // =================================================
      // USER
      // =================================================

      const user =
        await getUser(
          userId
        );


      if (!user) {

        return c.text(
          "ERROR",
          404
        );

      }


      // =================================================
      // TRANSACTION
      // =================================================

      const transactionRef =
        db.ref(
          `paidbucksy_transactions/${transactionId}`
        );


      const existing =
        await transactionRef.once(
          "value"
        );


      if (
        existing.exists()
      ) {

        return c.text(
          "OK",
          200
        );

      }


      // =================================================
      // STATUS 0 = CREDIT
      // =================================================

      if (
        status === "0"
      ) {

        await addCoins(
          userId,
          reward
        );


        await transactionRef.set({

          transactionId:
            transactionId,

          uid:
            userId,

          network:
            "PaidBucksy",

          reward:
            reward,

          status:
            "credit",

          offerId:
            c.req.query("offer_id") || "",

          offerName:
            c.req.query("offer_name") || "",

          eventId:
            c.req.query("event_id") || "",

          eventName:
            c.req.query("event_name") || "",

          ip:
            c.req.query("ip") || "",

          payout:
            safeNumber(
              c.req.query("payout")
            ),

          createdAt:
            Date.now()

        });


        await db
          .ref(
            `users/${userId}/activity`
          )
          .push({

            type:
              "PaidBucksy Offer",

            transactionId:
              transactionId,

            amount:
              reward,

            offerName:
              c.req.query("offer_name") || "",

            createdAt:
              Date.now()

          });


        await sendNotification(

          userId,

          "success",

          "ðŸŽ‰ PaidBucksy Reward",

          `You earned ${reward.toLocaleString()} coins from PaidBucksy.`,

          "coins"

        );


        console.log(
          "PAIDBUCKSY CREDIT SUCCESS",
          {
            userId,
            transactionId,
            reward
          }
        );


        return c.text(
          "OK",
          200
        );

      }


      // =================================================
      // STATUS 1 = SUBTRACT
      // =================================================

      if (
        status === "1"
      ) {

        const deduction =
          Math.abs(reward);


        await removeCoins(
          userId,
          deduction
        );


        await transactionRef.set({

          transactionId:
            transactionId,

          uid:
            userId,

          network:
            "PaidBucksy",

          reward:
            -deduction,

          status:
            "rejected",

          offerId:
            c.req.query("offer_id") || "",

          offerName:
            c.req.query("offer_name") || "",

          eventId:
            c.req.query("event_id") || "",

          eventName:
            c.req.query("event_name") || "",

          ip:
            c.req.query("ip") || "",

          payout:
            safeNumber(
              c.req.query("payout")
            ),

          createdAt:
            Date.now()

        });


        await sendNotification(

          userId,

          "warning",

          "PaidBucksy Reward Reversed",

          `${deduction.toLocaleString()} coins were deducted because a PaidBucksy reward was rejected.`,

          "warning"

        );


        console.log(
          "PAIDBUCKSY REJECTED",
          {
            userId,
            transactionId,
            deduction
          }
        );


        return c.text(
          "OK",
          200
        );

      }


      return c.text(
        "UNKNOWN STATUS",
        400
      );


    } catch (error) {

      console.error(
        "PAIDBUCKSY POSTBACK ERROR:",
        error
      );


      return c.text(
        "ERROR",
        500
      );

    }

  }
);



// =====================================================
// =====================================================
// TIMEWALL POSTBACK
// =====================================================
// =====================================================

app.get(
  "/postback/timewall",
  async (c) => {

    try {

      // =================================================
      // SECRET
      // =================================================

      const secret =
        process.env.TIMEWALL_SECRET;


      if (!secret) {

        console.error(
          "TIMEWALL_SECRET is missing"
        );

        return c.text(
          "Server configuration error",
          500
        );

      }


      // =================================================
      // PARAMETERS
      // =================================================

      const userId =
        String(
          c.req.query("userID") || ""
        ).trim();


      const transactionId =
        String(
          c.req.query("transactionID") || ""
        ).trim();


      const revenueRaw =
        c.req.query("revenue");


      const currencyAmountRaw =
        c.req.query("currencyAmount");


      const receivedHash =
        String(
          c.req.query("hash") || ""
        )
        .trim()
        .toLowerCase();


      const type =
        String(
          c.req.query("type") || "credit"
        )
        .trim()
        .toLowerCase();


      const ip =
        String(
          c.req.query("ip") || ""
        );


      const withdrawId =
        String(
          c.req.query("withdrawid") || ""
        );


      const reason =
        String(
          c.req.query("reason") || ""
        );


      const offerName =
        String(
          c.req.query("offername") || ""
        );


      const offerDetail =
        String(
          c.req.query("offerdetail") || ""
        );


      const originalTxId =
        String(
          c.req.query("original_txid") || ""
        );


      // =================================================
      // REQUIRED
      // =================================================

      if (
        !userId ||
        !transactionId ||
        revenueRaw === undefined ||
        currencyAmountRaw === undefined
      ) {

        return c.text(
          "Missing required parameters",
          400
        );

      }


      const revenue =
        Number(revenueRaw);


      const currencyAmount =
        Number(currencyAmountRaw);


      if (
        !Number.isFinite(revenue) ||
        !Number.isFinite(currencyAmount)
      ) {

        return c.text(
          "Invalid amount",
          400
        );

      }


      // =================================================
      // SHA256
      //
      // userID + revenue + Secret
      // =================================================

      const expectedHash =
        sha256(
          userId +
          String(revenueRaw) +
          secret
        )
        .toLowerCase();


      if (
        !receivedHash ||
        receivedHash !== expectedHash
      ) {

        console.error(
          "TIMEWALL INVALID HASH",
          {
            userId,
            transactionId
          }
        );


        return c.text(
          "Invalid hash",
          403
        );

      }


      // =================================================
      // USER
      // =================================================

      const user =
        await getUser(
          userId
        );


      if (!user) {

        return c.text(
          "User not found",
          404
        );

      }


      // =================================================
      // TRANSACTION
      // =================================================

      const transactionRef =
        db.ref(
          `timewall_transactions/${transactionId}`
        );


      const transactionSnapshot =
        await transactionRef.once(
          "value"
        );


      // =================================================
      // CREDIT
      // =================================================

      if (
        type === "credit"
      ) {

        if (
          transactionSnapshot.exists()
        ) {

          const old =
            transactionSnapshot.val() || {};


          if (
            old.status ===
            "completed"
          ) {

            return c.text(
              "OK",
              200
            );

          }

        }


        const coins =
          Math.floor(
            currencyAmount
          );


        if (
          coins <= 0
        ) {

          return c.text(
            "Invalid coin amount",
            400
          );

        }


        await addCoins(
          userId,
          coins
        );


        await transactionRef.set({

          transactionId:
            transactionId,

          uid:
            userId,

          type:
            "credit",

          revenue:
            revenue,

          coins:
            coins,

          ip:
            ip,

          withdrawid:
            withdrawId,

          offername:
            offerName,

          offerdetail:
            offerDetail,

          reason:
            reason,

          original_txid:
            originalTxId,

          status:
            "completed",

          createdAt:
            Date.now()

        });


        await sendNotification(

          userId,

          "success",

          "ðŸŽ‰ TimeWall Reward",

          `You earned ${coins.toLocaleString()} coins from TimeWall.`,

          "coins"

        );


        console.log(
          "TIMEWALL CREDIT SUCCESS",
          {
            userId,
            transactionId,
            revenue,
            coins
          }
        );


        return c.text(
          "OK",
          200
        );

      }


      // =================================================
      // CHARGEBACK
      // =================================================

      if (
        type === "chargeback"
      ) {

        if (
          !transactionSnapshot.exists()
        ) {

          return c.text(
            "OK",
            200
          );

        }


        const oldTransaction =
          transactionSnapshot.val() || {};


        if (
          oldTransaction.status ===
          "chargeback"
        ) {

          return c.text(
            "OK",
            200
          );

        }


        const deduction =
          Math.abs(
            currencyAmount
          );


        if (
          deduction <= 0
        ) {

          return c.text(
            "Invalid chargeback amount",
            400
          );

        }


        await removeCoins(
          userId,
          deduction
        );


        await transactionRef.set({

          transactionId:
            transactionId,

          uid:
            userId,

          type:
            "chargeback",

          revenue:
            revenue,

          coins:
            -deduction,

          ip:
            ip,

          withdrawid:
            withdrawId,

          offername:
            offerName,

          offerdetail:
            offerDetail,

          reason:
            reason,

          original_txid:
            originalTxId,

          status:
            "chargeback",

          createdAt:
            Date.now()

        });


        await sendNotification(

          userId,

          "warning",

          "TimeWall Reward Reversed",

          `${deduction.toLocaleString()} coins were deducted because a TimeWall reward was reversed.`,

          "warning"

        );


        return c.text(
          "OK",
          200
        );

      }


      // =================================================
      // HOLD
      // =================================================

      if (
        type === "hold"
      ) {

        await transactionRef.set({

          transactionId:
            transactionId,

          uid:
            userId,

          type:
            "hold",

          revenue:
            revenue,

          coins:
            Math.floor(
              currencyAmount
            ),

          ip:
            ip,

          withdrawid:
            withdrawId,

          offername:
            offerName,

          offerdetail:
            offerDetail,

          reason:
            reason,

          original_txid:
            originalTxId,

          status:
            "pending",

          createdAt:
            Date.now()

        });


        return c.text(
          "OK",
          200
        );

      }


      // =================================================
      // HOLD CANCELLED
      // =================================================

      if (
        type === "hold_cancelled"
      ) {

        await transactionRef.set({

          transactionId:
            transactionId,

          uid:
            userId,

          type:
            "hold_cancelled",

          revenue:
            revenue,

          coins:
            0,

          ip:
            ip,

          withdrawid:
            withdrawId,

          offername:
            offerName,

          offerdetail:
            offerDetail,

          reason:
            reason,

          original_txid:
            originalTxId,

          status:
            "cancelled",

          createdAt:
            Date.now()

        });


        return c.text(
          "OK",
          200
        );

      }


      return c.text(
        "Unknown transaction type",
        400
      );


    } catch (error) {

      console.error(
        "TIMEWALL POSTBACK ERROR:",
        error
      );


      return c.text(
        "Internal server error",
        500
      );

    }

  }
);



// =====================================================
// =====================================================
// FLEXWALL POSTBACK
// NO SECRET
// =====================================================
// =====================================================

app.get(
  "/postback/flexwall",
  async (c) => {

    try {

      const userId =
        String(
          c.req.query("user_id") || ""
        ).trim();


      const amountRaw =
        c.req.query("amount");


      const txid =
        String(
          c.req.query("TXID") ||
          c.req.query("tixid") ||
          ""
        ).trim();


      const offerName =
        String(
          c.req.query("offer_name") || ""
        );


      const payout =
        String(
          c.req.query("payout") || ""
        );


      const userIp =
        String(
          c.req.query("user_ip") || ""
        );


      const amount =
        Number(amountRaw);


      if (
        !userId ||
        !txid ||
        !Number.isFinite(amount) ||
        amount <= 0
      ) {

        return c.text(
          "ERROR",
          400
        );

      }


      // =================================================
      // TRANSACTION
      // =================================================

      const transactionRef =
        db.ref(
          `offerwallTransactions/flexwall/${txid}`
        );


      const existing =
        await transactionRef.once(
          "value"
        );


      if (
        existing.exists()
      ) {

        return c.text(
          "OK",
          200
        );

      }


      // =================================================
      // USER
      // =================================================

      const user =
        await getUser(
          userId
        );


      if (!user) {

        return c.text(
          "ERROR",
          404
        );

      }


      // =================================================
      // CREDIT
      // =================================================

      await addCoins(
        userId,
        Math.floor(amount)
      );


      // =================================================
      // TRANSACTION
      // =================================================

      await transactionRef.set({

        userId:
          userId,

        amount:
          Math.floor(amount),

        payout:
          payout,

        offerName:
          offerName,

        userIp:
          userIp,

        transactionId:
          txid,

        network:
          "FlexWall",

        status:
          "completed",

        createdAt:
          Date.now()

      });


      // =================================================
      // ACTIVITY
      // =================================================

      await db
        .ref(
          `users/${userId}/activity`
        )
        .push({

          type:
            "FlexWall Offer",

          offerName:
            offerName,

          transactionId:
            txid,

          amount:
            Math.floor(amount),

          payout:
            payout,

          createdAt:
            Date.now()

        });


      // =================================================
      // NOTIFICATION
      // =================================================

      await sendNotification(

        userId,

        "success",

        "ðŸŽ‰ FlexWall Reward",

        `You earned ${Math.floor(amount).toLocaleString()} coins from FlexWall.`,

        "coins"

      );


      console.log(
        "FLEXWALL CREDIT SUCCESS",
        {
          userId,
          txid,
          amount
        }
      );


      return c.text(
        "OK",
        200
      );


    } catch (error) {

      console.error(
        "FLEXWALL POSTBACK ERROR:",
        error
      );


      return c.text(
        "ERROR",
        500
      );

    }

  }
);



// =====================================================
// =====================================================
// OGADS OFFER API
// =====================================================
// =====================================================

app.get(
  "/offers/ogads",
  async (c) => {

    try {

      const forwardedFor =
        c.req.header(
          "x-forwarded-for"
        ) || "";


      const realIp =
        c.req.header(
          "x-real-ip"
        ) || "";


      const ip =
        (
          forwardedFor.split(",")[0] ||
          realIp ||
          ""
        ).trim();


      const userAgent =
        c.req.header(
          "user-agent"
        ) || "";


      const apiKey =
        process.env.OGADS_API_KEY;


      if (!apiKey) {

        return c.json({

          success:
            false,

          error:
            "OGAds API key is not configured."

        }, 500);

      }


      if (!ip) {

        return c.json({

          success:
            false,

          error:
            "Visitor IP could not be detected."

        }, 400);

      }


      if (!userAgent) {

        return c.json({

          success:
            false,

          error:
            "User-Agent could not be detected."

        }, 400);

      }


      const apiUrl =
        new URL(
          "https://saveapp.store/api/v2"
        );


      apiUrl.searchParams.set(
        "ip",
        ip
      );


      apiUrl.searchParams.set(
        "user_agent",
        userAgent
      );


      apiUrl.searchParams.set(
        "max",
        "50"
      );


      const response =
        await fetch(
          apiUrl.toString(),
          {

            method:
              "GET",

            headers: {

              Authorization:
                `Bearer ${apiKey}`,

              Accept:
                "application/json"

            }

          }
        );


      const text =
        await response.text();


      if (
        !response.ok
      ) {

        console.error(
          "OGADS API ERROR",
          response.status,
          text
        );


        return c.json({

          success:
            false,

          error:
            "OGAds API request failed.",

          status:
            response.status

        }, 502);

      }


      let offers;


      try {

        offers =
          JSON.parse(text);

      } catch {

        return c.json({

          success:
            false,

          error:
            "OGAds returned invalid JSON."

        }, 502);

      }


      return c.json({

        success:
          true,

        offers:
          offers

      }, 200, {

        "Cache-Control":
          "no-store"

      });


    } catch (error) {

      console.error(
        "OGADS OFFER API ERROR:",
        error
      );


      return c.json({

        success:
          false,

        error:
          "Unable to load OGAds offers."

      }, 500);

    }

  }
);



// =====================================================
// =====================================================
// OGADS POSTBACK
// NO SECRET
// =====================================================
// =====================================================

app.get(
  "/postback/ogads",
  async (c) => {

    try {

      const userId =
        String(
          c.req.query("user_id") || ""
        ).trim();


      const offerId =
        String(
          c.req.query("offer_id") || ""
        ).trim();


      const offerName =
        String(
          c.req.query("offer_name") ||
          "OGAds Offer"
        ).trim();


      const payout =
        Number(
          c.req.query("payout") || 0
        );


      const ip =
        String(
          c.req.query("ip") || ""
        ).trim();


      const date =
        String(
          c.req.query("date") || ""
        ).trim();


      const time =
        String(
          c.req.query("time") || ""
        ).trim();


      const datetime =
        String(
          c.req.query("datetime") || ""
        ).trim();


      const sessionTimestamp =
        String(
          c.req.query("session_timestamp") || ""
        ).trim();


      const affSub =
        String(
          c.req.query("aff_sub") || ""
        ).trim();


      const ran =
        String(
          c.req.query("ran") || ""
        ).trim();


      if (!userId) {

        return c.text(
          "MISSING USER_ID",
          400
        );

      }


      if (!offerId) {

        return c.text(
          "MISSING OFFER_ID",
          400
        );

      }


      if (
        !Number.isFinite(payout) ||
        payout <= 0
      ) {

        return c.text(
          "INVALID PAYOUT",
          400
        );

      }


      const user =
        await getUser(
          userId
        );


      if (!user) {

        return c.text(
          "USER NOT FOUND",
          404
        );

      }


      // =================================================
      // TRANSACTION ID
      // =================================================

      const transactionString = [

        userId,
        offerId,
        payout,
        offerName,
        ip,
        date,
        time,
        datetime,
        sessionTimestamp,
        affSub,
        ran

      ].join("|");


      const transactionId =
        sha256(
          transactionString
        );


      const transactionRef =
        db.ref(
          `transactions/ogads/${transactionId}`
        );


      const existing =
        await transactionRef.once(
          "value"
        );


      if (
        existing.exists()
      ) {

        return c.text(
          "OK - ALREADY PROCESSED",
          200
        );

      }


      // =================================================
      // $1 = 250 COINS
      // =================================================

      const coins =
        Math.floor(
          payout *
          COINS_PER_USD
        );


      if (
        coins <= 0
      ) {

        return c.text(
          "CALCULATED COINS INVALID",
          400
        );

      }


      // =================================================
      // CREDIT
      // =================================================

      await addCoins(
        userId,
        coins
      );


      // =================================================
      // SAVE
      // =================================================

      await transactionRef.set({

        transactionId:
          transactionId,

        provider:
          "OGAds",

        uid:
          userId,

        user_id:
          userId,

        offerId:
          offerId,

        offerName:
          offerName,

        payout:
          payout,

        coins:
          coins,

        ip:
          ip,

        date:
          date,

        time:
          time,

        datetime:
          datetime,

        sessionTimestamp:
          sessionTimestamp,

        affSub:
          affSub,

        ran:
          ran,

        status:
          "credited",

        createdAt:
          Date.now()

      });


      // =================================================
      // ACTIVITY
      // =================================================

      await db
        .ref(
          `users/${userId}/activity`
        )
        .push({

          type:
            "OGAds Offer",

          offerId:
            offerId,

          offerName:
            offerName,

          payout:
            payout,

          coins:
            coins,

          transactionId:
            transactionId,

          createdAt:
            Date.now()

        });


      // =================================================
      // NOTIFICATION
      // =================================================

      await sendNotification(

        userId,

        "success",

        "ðŸŽ‰ Reward Credited",

        `You earned ${coins.toLocaleString()} coins from ${offerName}.`,

        "coins"

      );


      console.log(
        "OGADS CREDIT SUCCESS",
        {
          userId,
          offerId,
          payout,
          coins
        }
      );


      return c.text(
        `OK - ${coins} COINS CREDITED`,
        200
      );


    } catch (error) {

      console.error(
        "OGADS POSTBACK ERROR:",
        error
      );


      return c.text(
        "SERVER ERROR",
        500
      );

    }

  }
);



// =====================================================
// =====================================================
// CPX RESEARCH POSTBACK
// =====================================================
// IP Whitelist: 188.40.3.73, 157.90.97.92,
//              2a01:4f8:d0a:30ff::2
// Hash: md5({trans_id}-CPX_SECRET)
// Status: 1 = completed, 2 = canceled (fraud)
// =====================================================
// =====================================================

app.get(
  "/postback/cpx",
  async (c) => {

    try {

      // =================================================
      // IP WHITELIST
      // =================================================

      const forwardedFor =
        c.req.header(
          "x-forwarded-for"
        ) || "";


      const realIp =
        c.req.header(
          "x-real-ip"
        ) || "";


      const clientIp =
        (
          forwardedFor.split(",")[0] ||
          realIp ||
          ""
        ).trim();


      const CPX_WHITELIST_IPS = [
        "188.40.3.73",
        "157.90.97.92",
        "2a01:4f8:d0a:30ff::2"
      ];


      if (
        clientIp &&
        !CPX_WHITELIST_IPS.includes(
          clientIp
        )
      ) {

        console.error(
          "CPX IP NOT WHITELISTED",
          { clientIp }
        );


        return c.json({

          success:
            false,

          message:
            "IP not allowed"

        }, 403);

      }


      // =================================================
      // PARAMETERS
      // =================================================

      const status =
        String(
          c.req.query("status") || ""
        );


      const transId =
        String(
          c.req.query("trans_id") || ""
        );


      const userId =
        String(
          c.req.query("user_id") || ""
        );


      const amountUsd =
        Number(
          c.req.query("amount_usd") || 0
        );


      const amountLocal =
        Number(
          c.req.query("amount_local") || 0
        );


      const secureHash =
        String(
          c.req.query("hash") ||
          c.req.query("secure_hash") ||
          ""
        )
        .toLowerCase();


      const offerId =
        String(
          c.req.query("offer_id") || ""
        );


      const type =
        String(
          c.req.query("type") || ""
        )
        .trim()
        .toLowerCase();


      const ipClick =
        String(
          c.req.query("ip_click") || ""
        );


      const subId1 =
        String(
          c.req.query("sub_id") ||
          c.req.query("subid_1") ||
          ""
        );


      const subId2 =
        String(
          c.req.query("sub_id_2") ||
          c.req.query("subid_2") ||
          ""
        );


      // =================================================
      // REQUIRED
      // =================================================

      if (
        !status ||
        !transId ||
        !userId
      ) {

        return c.json({

          success:
            false,

          message:
            "Missing required parameters"

        }, 400);

      }


      // =================================================
      // STATUS VALIDATION
      //
      // 1 = completed
      // 2 = canceled (fraud reversal)
      // =================================================

      if (
        status !== "1" &&
        status !== "2"
      ) {

        return c.json({

          success:
            false,

          message:
            "Invalid status"

        }, 400);

      }


      // =================================================
      // SECRET
      // =================================================

      const secret =
        process.env.CPX_SECRET;


      if (!secret) {

        console.error(
          "CPX_SECRET is missing"
        );

        return c.json({

          success:
            false,

          message:
            "CPX secret is not configured"

        }, 500);

      }


      // =================================================
      // CPX HASH
      //
      // md5({trans_id}-yourappsecurehash)
      // =================================================

      const expectedHash =
        md5(
          transId +
          "-" +
          secret
        ).toLowerCase();


      if (
        !secureHash ||
        secureHash !== expectedHash
      ) {

        console.error(
          "CPX INVALID HASH",
          {
            transId,
            userId
          }
        );


        return c.json({

          success:
            false,

          message:
            "Invalid hash"

        }, 403);

      }


      // =================================================
      // USER
      // =================================================

      const user =
        await getUser(
          userId
        );


      if (!user) {

        return c.json({

          success:
            false,

          message:
            "User not found"

        }, 404);

      }


      // =================================================
      // TRANSACTION
      // =================================================

      const transactionRef =
        db.ref(
          `cpxTransactions/${transId}`
        );


      const transactionSnapshot =
        await transactionRef.once(
          "value"
        );


      // =================================================
      // STATUS 1 = COMPLETED
      // =================================================

      if (
        status === "1"
      ) {

        if (
          transactionSnapshot.exists()
        ) {

          const old =
            transactionSnapshot.val() || {};


          if (
            old.status ===
            "credited"
          ) {

            return c.json({

              success:
                true,

              message:
                "Transaction already credited"

            }, 200);

          }

        }


        if (
          !Number.isFinite(amountUsd) ||
          amountUsd <= 0
        ) {

          return c.json({

            success:
              false,

            message:
              "Invalid amount_usd"

          }, 400);

        }


        const coins =
          Math.floor(
            amountUsd *
            COINS_PER_USD
          );


        if (
          coins <= 0
        ) {

          return c.json({

            success:
              false,

            message:
              "Calculated reward is zero"

          }, 400);

        }


        await addCoins(
          userId,
          coins
        );


        await transactionRef.set({

          transactionId:
            transId,

          userId:
            userId,

          offerId:
            offerId,

          amountUsd:
            amountUsd,

          amountLocal:
            amountLocal,

          coins:
            coins,

          status:
            "credited",

          type:
            type,

          subId1:
            subId1,

          subId2:
            subId2,

          ipClick:
            ipClick,

          createdAt:
            Date.now()

        });


        await db
          .ref(
            `users/${userId}/activity`
          )
          .push({

            type:
              "CPX Research Survey",

            transactionId:
              transId,

            offerId:
              offerId,

            amountUsd:
              amountUsd,

            coins:
              coins,

            createdAt:
              Date.now()

          });


        // =================================================
        // NOTIFICATION
        // =================================================

        const notificationTitle =
          type === "bonus"
            ? "ðŸŽ‰ Bonus Reward"
            : "ðŸŽ‰ Survey Reward";


        const notificationMessage =
          type === "bonus"
            ? `+${coins.toLocaleString()} bonus coins added to your account.`
            : `+${coins.toLocaleString()} coins added to your account.`;


        await sendNotification(

          userId,

          "success",

          notificationTitle,

          notificationMessage,

          "coins"

        );


        console.log(
          "CPX CREDIT SUCCESS",
          {
            userId,
            transId,
            amountUsd,
            coins,
            type
          }
        );


        return c.json({

          success:
            true,

          message:
            "Coins credited",

          user_id:
            userId,

          transaction_id:
            transId,

          coins:
            coins

        }, 200);

      }


      // =================================================
      // STATUS 2 = CANCELED (FRAUD REVERSAL)
      // =================================================

      if (
        status === "2"
      ) {

        if (
          !transactionSnapshot.exists()
        ) {

          return c.json({

            success:
              true,

            message:
              "No previous credit found"

          }, 200);

        }


        const transaction =
          transactionSnapshot.val() || {};


        if (
          transaction.status ===
          "reversed"
        ) {

          return c.json({

            success:
              true,

            message:
              "Transaction already reversed"

          }, 200);

        }


        if (
          transaction.status !==
          "credited"
        ) {

          return c.json({

            success:
              true,

            message:
              "Transaction was not credited"

          }, 200);

        }


        const creditedCoins =
          Number(
            transaction.coins || 0
          );


        if (
          creditedCoins <= 0
        ) {

          return c.json({

            success:
              true,

            message:
              "Nothing to reverse"

          }, 200);

        }


        await removeCoins(
          userId,
          creditedCoins
        );


        await transactionRef.update({

          status:
            "reversed",

          reversedAt:
            Date.now()

        });


        await sendNotification(

          userId,

          "warning",

          "Reward Reversed",

          `${creditedCoins.toLocaleString()} coins were removed because a previous survey reward was canceled.`,

          "warning"

        );


        console.log(
          "CPX REVERSAL SUCCESS",
          {
            userId,
            transId,
            coinsRemoved:
              creditedCoins
          }
        );


        return c.json({

          success:
            true,

          message:
            "Reward reversed",

          user_id:
            userId,

          transaction_id:
            transId,

          coins_removed:
            creditedCoins

        }, 200);

      }


      return c.json({

        success:
          false,

        message:
          "Invalid status"

      }, 400);


    } catch (error) {

      console.error(
        "CPX POSTBACK ERROR:",
        error
      );


      return c.json({

        success:
          false,

        message:
          "Server error"

      }, 500);

    }

  }
);



// =====================================================
// =====================================================
// CPAGRIP CONFIG
// =====================================================
// =====================================================

const CPAGRIP_USER_ID =
  "2542470";


const CPAGRIP_PUBLIC_KEY =
  process.env.CPAGRIP_PUBLIC_KEY;



// =====================================================
// CPAGRIP POSTBACK
// PASSWORD ONLY
// =====================================================

app.post(
  "/postback/cpagrip",
  async (c) => {

    try {

      const body =
        await c.req.text();


      const params =
        new URLSearchParams(
          body
        );


      // =================================================
      // PARAMETERS
      // =================================================

      const password =
        params.get("password");


      const payout =
        Number(
          params.get("payout") || "0"
        );


      const offerId =
        params.get("offer_id");


      const trackingId =
        params.get("tracking_id");


      // =================================================
      // PASSWORD
      // =================================================

      const correctPassword =
        process.env.CPAGRIP_POSTBACK_PASSWORD;


      if (
        !correctPassword ||
        password !== correctPassword
      ) {

        return c.text(
          "Invalid password",
          403
        );

      }


      // =================================================
      // REQUIRED
      // =================================================

      if (
        !trackingId ||
        !offerId ||
        !Number.isFinite(payout) ||
        payout <= 0
      ) {

        return c.text(
          "Missing parameters",
          400
        );

      }


      // =================================================
      // USER
      // =================================================

      const user =
        await getUser(
          trackingId
        );


      if (!user) {

        return c.text(
          "User not found",
          404
        );

      }


      // =================================================
      // TRANSACTION
      // =================================================

      const transactionId =
        `${trackingId}_${offerId}_${payout}`;


      const transactionRef =
        db.ref(
          `cpagrip_transactions/${transactionId}`
        );


      const oldTransaction =
        await transactionRef.once(
          "value"
        );


      if (
        oldTransaction.exists()
      ) {

        return c.text(
          "Already credited",
          200
        );

      }


      // =================================================
      // $1 = 250 COINS
      // =================================================

      const coins =
        Math.floor(
          payout *
          COINS_PER_USD
        );


      if (
        coins <= 0
      ) {

        return c.text(
          "Invalid coin amount",
          400
        );

      }


      // =================================================
      // CREDIT
      // =================================================

      await addCoins(
        trackingId,
        coins
      );


      // =================================================
      // SAVE TRANSACTION
      // =================================================

      await transactionRef.set({

        userId:
          trackingId,

        offerId:
          offerId,

        payout:
          payout,

        coins:
          coins,

        network:
          "CPAGrip",

        status:
          "credited",

        createdAt:
          Date.now()

      });


      // =================================================
      // ACTIVITY
      // =================================================

      await db
        .ref(
          `users/${trackingId}/activity`
        )
        .push({

          type:
            "CPAGrip Offer",

          offerId:
            offerId,

          payout:
            payout,

          coins:
            coins,

          transactionId:
            transactionId,

          createdAt:
            Date.now()

        });


      // =================================================
      // NOTIFICATION
      // =================================================

      await sendNotification(

        trackingId,

        "success",

        "ðŸŽ‰ CPAGrip Reward",

        `You earned ${coins.toLocaleString()} coins from CPAGrip.`,

        "coins"

      );


      console.log(
        "CPAGRIP CREDIT SUCCESS",
        {
          trackingId,
          offerId,
          payout,
          coins
        }
      );


      return c.text(
        "Success",
        200
      );


    } catch (error) {

      console.error(
        "CPAGRIP POSTBACK ERROR:",
        error
      );


      return c.text(
        "ERROR",
        500
      );

    }

  }
);



// =====================================================
// =====================================================
// CPAGRIP OFFER FEED
// =====================================================
// =====================================================

app.get(
  "/offers/cpagrip",
  async (c) => {

    try {

      const trackingId =
        String(
          c.req.query("tracking_id") || ""
        ).trim();


      if (!trackingId) {

        return c.json({

          error:
            "Missing tracking_id"

        }, 400);

      }


      const type =
        String(
          c.req.query("type") || "json"
        );


      let feedUrl;


      // =================================================
      // JSON
      // =================================================

      if (
        type === "json"
      ) {

        feedUrl =
          "https://www.cpagrip.com/common/offer_feed_json.php" +
          "?user_id=" +
          encodeURIComponent(
            CPAGRIP_USER_ID
          ) +
          "&pubkey=" +
          encodeURIComponent(
            CPAGRIP_PUBLIC_KEY
          ) +
          "&tracking_id=" +
          encodeURIComponent(
            trackingId
          ) +
          "&limit=50";

      }


      // =================================================
      // RSS
      // =================================================

      else if (
        type === "rss"
      ) {

        feedUrl =
          "https://www.cpagrip.com/common/offer_feed_rss.php" +
          "?user_id=" +
          encodeURIComponent(
            CPAGRIP_USER_ID
          ) +
          "&tracking_id=" +
          encodeURIComponent(
            trackingId
          ) +
          "&limit=50";

      }


      // =================================================
      // CSV
      // =================================================

      else if (
        type === "csv"
      ) {

        feedUrl =
          "https://www.cpagrip.com/common/offer_feed_csv.php" +
          "?user_id=" +
          encodeURIComponent(
            CPAGRIP_USER_ID
          ) +
          "&tracking_id=" +
          encodeURIComponent(
            trackingId
          ) +
          "&limit=50";

      }


      else {

        return c.json({

          error:
            "Invalid feed type"

        }, 400);

      }


      // =================================================
      // FETCH
      // =================================================

      const response =
        await fetch(
          feedUrl
        );


      const content =
        await response.text();


      return c.text(

        content,

        response.ok
          ? 200
          : 502,

        {

          "Access-Control-Allow-Origin":
            "*",

          "Cache-Control":
            "no-store"

        }

      );


    } catch (error) {

      console.error(
        "CPAGRIP FEED ERROR:",
        error
      );


      return c.json({

        error:
          error.message ||
          "Unable to load CPAGrip feed"

      }, 500);

    }

  }
);



// =====================================================
// =====================================================
// 404 HANDLER
// =====================================================
// =====================================================

app.notFound(
  (c) => {

    return c.json({

      success:
        false,

      error:
        "Route not found",

      path:
        c.req.path

    }, 404);

  }
);



// =====================================================
// =====================================================
// ERROR HANDLER
// =====================================================
// =====================================================

app.onError(
  (error, c) => {

    console.error(
      "GLOBAL SERVER ERROR:",
      error
    );


    return c.json({

      success:
        false,

      error:
        "Internal server error"

    }, 500);

  }
);



// =====================================================
// VERCEL EXPORT
// =====================================================

export default app;