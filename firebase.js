// =====================================================
// FIREBASE SETUP
// Shared across all routes
// =====================================================

import {
  initializeApp,
  getApps,
  cert
} from "firebase-admin/app";

import {
  getDatabase
} from "firebase-admin/database";


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


export const db =
  getDatabase();
