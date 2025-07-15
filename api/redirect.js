import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin (only once)
// You would store your service account credentials securely
initializeApp({ ... });

export default async function handler(request, response) {
  const { componentId, branch } = request.query; // Get params from the URL
  const db = getFirestore();

  const docRef = db.collection('components').doc(componentId);
  const docSnap = await docRef.get();

  if (docSnap.exists()) {
    const data = docSnap.data();
    const url = branch === 'main' ? data.mainUrl : data.latestUrl;
    // This sends the redirect command to the browser
    response.redirect(307, url);
  } else {
    response.status(404).send('Component not found');
  }
}
