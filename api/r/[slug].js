import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// --- Securely get your service account key from environment variables ---
const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY
);

// --- Initialize Firebase Admin (only once) ---
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
}

const db = getFirestore();

export default async function handler(request, response) {
  // The [...slug] part gives us an array, e.g., ['my-component-id', 'main']
  const { slug } = request.query;

  if (!slug || slug.length !== 2) {
    return response.status(400).send('Invalid redirect link format.');
  }

  const [componentId, branch] = slug;

  try {
    const docRef = db.collection('components').doc(componentId);
    const docSnap = await docRef.get();

    if (docSnap.exists()) {
      const data = docSnap.data();
      const url = branch === 'main' ? data.mainUrl : data.latestUrl;

      if (url) {
        // This is the server-side redirect command
        return response.redirect(307, url);
      } else {
        return response.status(404).send(`Branch "${branch}" not found.`);
      }
    } else {
      return response.status(404).send('Component not found.');
    }
  } catch (error) {
    console.error('Redirect error:', error);
    return response.status(500).send('Internal Server Error');
  }
}
