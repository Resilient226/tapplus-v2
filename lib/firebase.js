const admin = require('firebase-admin');

if (!admin.apps.length) {
  const projectId   = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    console.error('Firebase env vars missing:', {
      FIREBASE_PROJECT_ID: !!projectId,
      FIREBASE_CLIENT_EMAIL: !!clientEmail,
      FIREBASE_PRIVATE_KEY: !!privateKey,
    });
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db   = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
