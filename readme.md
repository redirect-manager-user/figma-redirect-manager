# Figma Redirect Manager

This is a React application for creating and managing "pretty links" for your Figma components, powered by Firebase for authentication and database services.

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd figma-redirect-manager
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Firebase:**
    * Create a Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/).
    * In your project, go to **Authentication** and enable the **Email/Password** sign-in method.
    * Go to **Firestore Database** and create a database.
    * Go to **Project settings** > **General** and copy your Firebase configuration object.

4.  **Configure environment variables:**
    * Create a `.env` file in the root of your project.
    * Add your Firebase configuration to the `.env` file:
        ```
        REACT_APP_FIREBASE_CONFIG={"apiKey":"...","authDomain":"...","projectId":"...","storageBucket":"...","messagingSenderId":"...","appId":"..."}
        REACT_APP_APP_ID=default-figma-redirect-app
        ```

5.  **Run the application:**
    ```bash
    npm start
    ```

## Deploying to Vercel

Follow the instructions in the `vercel-deployment-guide.md` file to deploy this application to Vercel.
