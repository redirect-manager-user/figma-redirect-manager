// Import the Firebase Admin SDK
const admin = require('firebase-admin');

// --- Firebase Admin Initialization ---
// This code initializes the Firebase Admin SDK.
// It checks if the app is already initialized to prevent errors during hot-reloads.
// IMPORTANT: You must set your Firebase Service Account Key as an environment variable
// in Vercel. The variable should be named FIREBASE_SERVICE_ACCOUNT_KEY and its
// value should be the full JSON content of your service account file.
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY))
    });
  }
} catch (error) {
  console.error('Firebase admin initialization error', error.stack);
}

const db = admin.firestore();

// --- The Serverless Function Handler ---
// This is the main function that Vercel will execute.
export default async function handler(req, res) {
  // The 'slug' is an array of path segments from the URL.
  // For a URL like /r/my-component/main, slug will be ['my-component', 'main']
  const { slug } = req.query;
  const fallbackUrl = '/'; // Redirect to the homepage if anything goes wrong.

  // 1. Validate the incoming URL structure
  if (!slug || slug.length !== 2) {
    console.log('Invalid slug:', slug);
    return res.redirect(307, fallbackUrl);
  }

  const [componentId, branch] = slug;

  // 2. Validate the branch type
  if (branch !== 'main' && branch !== 'latest') {
    console.log('Invalid branch:', branch);
    return res.redirect(307, fallbackUrl);
  }

  try {
    // 3. Fetch the component document from Firestore
    const docRef = db.collection('components').doc(componentId);
    const docSnap = await docRef.get();

    // 4. Check if the document exists
    if (!docSnap.exists) {
      console.log('No such document for componentId:', componentId);
      return res.redirect(307, fallbackUrl);
    }

    // 5. Determine the correct redirect URL from the document data
    const componentData = docSnap.data();
    const redirectUrl = branch === 'main' ? componentData.mainUrl : componentData.latestUrl;

    if (!redirectUrl) {
        console.log(`URL for branch '${branch}' not found in document.`);
        return res.redirect(307, fallbackUrl);
    }

    // 6. Perform the redirect
    // We use a 307 Temporary Redirect as the destination URL might change.
    console.log(`Redirecting to: ${redirectUrl}`);
    res.redirect(307, redirectUrl);

  } catch (error) {
    // 7. Handle any errors during the process
    console.error('Error fetching document or redirecting:', error);
    res.redirect(307, fallbackUrl);
  }
}
