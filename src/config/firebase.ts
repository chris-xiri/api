import * as admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();


try {
    let credential;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // Vercel / Environment Variable approach
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
        credential = admin.credential.cert(serviceAccount);
    } else {
        // Local / GCP Auto-Discovery approach
        credential = admin.credential.applicationDefault();
    }

    admin.initializeApp({
        credential,
    });
    console.log('Firebase Admin initialized successfully');
} catch (error) {
    console.error('Error initializing Firebase Admin:', error);
}

export const db = admin.firestore();
export const auth = admin.auth();
