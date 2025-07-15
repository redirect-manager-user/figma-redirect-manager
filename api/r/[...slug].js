// Import the Firebase Admin SDK
const admin = require('firebase-admin');

/**
 * Initializes the Firebase Admin SDK.
 * It checks for the required environment variable and ensures the app is only initialized once.
 * This function is designed to be called within the handler to catch initialization errors.
 */
function initializeFirebaseAdmin() {
  // This is the most common point of failure. Check if the environment variable is set.
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    // This clear error will now appear in your Vercel logs if the variable is missing.
    throw new Error('CRITICAL: FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set.');
  }

  // Prevent re-initializing the app on subsequent cold starts.
  if (admin.apps.length > 0) {
    return admin.app();
  }

  // Parse the service account key from the environment variable.
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);

  // Initialize the Firebase app.
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

// --- The Serverless Function Handler ---
export default async function handler(req, res) {
  const fallbackUrl = '/'; // Redirect to the homepage if a redirect URL can't be found.

  try {
    // Initialize Firebase and get a Firestore instance.
    initializeFirebaseAdmin();
    const db = admin.firestore();

    // The 'slug' is an array of path segments from the URL.
    // For a URL like /r/my-component/main, slug will be ['my-component', 'main']
    const { slug } = req.query;

    // 1. Validate the incoming URL structure
    if (!slug || slug.length !== 2) {
      console.warn('Invalid slug received:', slug);
      return res.redirect(307, fallbackUrl);
    }

    const [componentId, branch] = slug;

    // 2. Validate the branch type
    if (branch !== 'main' && branch !== 'latest') {
      console.warn(`Invalid branch received: '${branch}'`);
      return res.redirect(307, fallbackUrl);
    }

    // 3. Fetch the component document from Firestore
    const docRef = db.collection('components').doc(componentId);
    const docSnap = await docRef.get();

    // 4. Check if the document exists
    if (!docSnap.exists) {
      console.warn(`Document not found for componentId: '${componentId}'`);
      return res.redirect(307, fallbackUrl);
    }

    // 5. Determine the correct redirect URL from the document data
    const componentData = docSnap.data();
    const redirectUrl = branch === 'main' ? componentData.mainUrl : componentData.latestUrl;

    if (!redirectUrl) {
        console.warn(`URL for branch '${branch}' not found in document for componentId: '${componentId}'`);
        return res.redirect(307, fallbackUrl);
    }

    // 6. Perform the redirect
    console.log(`Redirecting from /r/${componentId}/${branch} to ${redirectUrl}`);
    // We use a 307 Temporary Redirect as the destination URL might change.
    return res.redirect(307, redirectUrl);

  } catch (error) {
    // 7. This block will now catch any errors during initialization or Firestore operations
    //    and log them clearly in Vercel.
    console.error('--- FUNCTION INVOCATION FAILED ---');
    console.error('Error Message:', error.message);
    console.error('Error Stack:', error.stack);
    console.error('---------------------------------');
    
    // Return a generic 500 error to the user. The real details are in the logs.
    return res.status(500).send('Internal Server Error. Please check the function logs for details.');
  }
}
```

### **How to Fix the Error**

1.  **Update the Code:** Replace the content of your `api/r/[...slug].js` file with the code above.
2.  **Check Your Vercel Environment Variable:**
    * Go to your Firebase Console -> Project Settings -> Service accounts.
    * Click "Generate new private key" to download a JSON file.
    * Open the JSON file and copy its **entire content**.
    * Go to your Vercel Project -> Settings -> Environment Variables.
    * Find the variable named `FIREBASE_SERVICE_ACCOUNT_KEY`.
    * Ensure its value is the **exact, complete JSON content** you just copied. There should be no extra characters or missing brackets.
3.  **Redeploy:** After saving the variable, trigger a new deployment in Vercel for the changes to take effect.

Now, if the error happens again, check your Vercel function logs. The new code will print a much more specific error message telling you exactly what went wro
