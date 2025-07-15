import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, deleteDoc, setDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, auth } from './firebase';

// --- Shadcn UI-style Components (using Tailwind CSS) ---

const Card = ({ className, ...props }) => (
    <div className={`rounded-xl border bg-card text-card-foreground shadow-sm ${className}`} {...props} />
);

const CardHeader = ({ className, ...props }) => (
    <div className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props} />
);

const CardTitle = ({ className, ...props }) => (
    <h3 className={`text-2xl font-semibold leading-none tracking-tight ${className}`} {...props} />
);

const CardContent = ({ className, ...props }) => (
    <div className={`p-6 pt-0 ${className}`} {...props} />
);

const Input = React.forwardRef(({ className, ...props }, ref) => (
    <input
        className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        ref={ref}
        {...props}
    />
));

const Button = ({ className, variant = 'default', size = 'default', ...props }) => {
    const variants = {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    };
    const sizes = {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
    }
    return <button className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
};

const Label = ({ className, ...props }) => (
    <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props} />
);

// --- Login Screen Component ---
const LoginScreen = ({ onLogin, onRegister, error }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();
        onLogin(email, password);
    };

    const handleRegister = (e) => {
        e.preventDefault();
        onRegister(email, password);
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Login or Register</CardTitle>
                </CardHeader>
                <CardContent>
                    <form className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" type="email" placeholder="m@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        </div>
                        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                        <div className="flex flex-col sm:flex-row gap-2">
                           <Button onClick={handleLogin} className="w-full">Login</Button>
                           <Button onClick={handleRegister} variant="outline" className="w-full">Register</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};


// --- Main App Component ---

export default function App() {
    // --- State Management ---
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [components, setComponents] = useState([]);
    const [newComponentName, setNewComponentName] = useState('');
    const [mainUrl, setMainUrl] = useState('');
    const [latestUrl, setLatestUrl] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [authError, setAuthError] = useState(null);
    const [error, setError] = useState(null);
    const [copiedLink, setCopiedLink] = useState(null);

    // --- Edit State ---
    const [editingComponentId, setEditingComponentId] = useState(null);
    const [editedMainUrl, setEditedMainUrl] = useState('');
    const [editedLatestUrl, setEditedLatestUrl] = useState('');

    const appId = process.env.REACT_APP_APP_ID || 'default-figma-redirect-app';


    // --- Authentication Effect ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            setIsAuthReady(true);
        });
        return () => unsubscribe();
    }, []);

    // --- Firestore Data Fetching Effect ---
    useEffect(() => {
        if (!isAuthReady || !user) {
            setIsLoading(false);
            setComponents([]); // Clear components if user logs out
            return;
        };

        setIsLoading(true);
        const componentsCollectionRef = collection(db, `artifacts/${appId}/users/${user.uid}/components`);
        
        const unsubscribe = onSnapshot(componentsCollectionRef, (snapshot) => {
            const fetchedComponents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setComponents(fetchedComponents);
            setIsLoading(false);
        }, (err) => {
            console.error("Firestore snapshot error:", err);
            setError("Failed to load components. Please try again later.");
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [isAuthReady, user, appId]);
    
    // --- Event Handlers ---

    const handleLogin = async (email, password) => {
        setAuthError(null);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setAuthError(err.message);
        }
    };

    const handleRegister = async (email, password) => {
        setAuthError(null);
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setAuthError(err.message);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (err) {
            console.error("Logout failed:", err);
        }
    };

    const generateComponentId = (name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComponentName.trim() || !mainUrl.trim() || !latestUrl.trim()) {
            setError("All fields are required.");
            return;
        }
        if (!user) {
            setError("You must be logged in to add components.");
            return;
        }
        
        setError(null);
        const componentId = generateComponentId(newComponentName);

        try {
            const componentDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/components`, componentId);
            await setDoc(componentDocRef, { name: newComponentName, mainUrl, latestUrl });
            setNewComponentName('');
            setMainUrl('');
            setLatestUrl('');
        } catch (err) {
            console.error("Error adding document: ", err);
            setError("Failed to save component.");
        }
    };

    const handleDelete = async (componentId) => {
        if (!user) return;
        try {
            const componentDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/components`, componentId);
            await deleteDoc(componentDocRef);
        } catch (err) {
            console.error("Error deleting document: ", err);
            setError("Failed to delete component.");
        }
    };

    const handleStartEditing = (component) => {
        setEditingComponentId(component.id);
        setEditedMainUrl(component.mainUrl);
        setEditedLatestUrl(component.latestUrl);
    };

    const handleCancelEditing = () => {
        setEditingComponentId(null);
        setEditedMainUrl('');
        setEditedLatestUrl('');
    };

    const handleUpdateComponent = async (componentId) => {
        if (!user) return;
        if (!editedMainUrl.trim() || !editedLatestUrl.trim()) {
            // Simple validation, could be more robust
            alert("URLs cannot be empty.");
            return;
        }
        try {
            const componentDocRef = doc(db, `artifacts/${appId}/users/${user.uid}/components`, componentId);
            await updateDoc(componentDocRef, {
                mainUrl: editedMainUrl,
                latestUrl: editedLatestUrl
            });
            handleCancelEditing(); // Exit edit mode on success
        } catch (err) {
            console.error("Error updating document: ", err);
            setError("Failed to update component.");
        }
    };
    
    const handleCopyToClipboard = (text) => {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            setCopiedLink(text);
            setTimeout(() => setCopiedLink(null), 2000);
        } catch (err) {
            console.error('Failed to copy text: ', err);
        }
        document.body.removeChild(textArea);
    };

    // --- Render Logic ---

    const getBaseUrl = () => {
        if (typeof window !== 'undefined') {
            return `${window.location.protocol}//${window.location.host}/r`;
        }
        return '/r';
    }

    if (!isAuthReady) {
        return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    }

    if (!user) {
        return <LoginScreen onLogin={handleLogin} onRegister={handleRegister} error={authError} />;
    }

    return (
        <div className="bg-background text-foreground min-h-screen font-sans">
            <style>{`
                  :root {
                      --background: 0 0% 100%;
                      --foreground: 222.2 84% 4.9%;
                      --card: 0 0% 100%;
                      --card-foreground: 222.2 84% 4.9%;
                      --primary: 222.2 47.4% 11.2%;
                      --primary-foreground: 210 40% 98%;
                      --muted: 210 40% 96.1%;
                      --muted-foreground: 215.4 16.3% 46.9%;
                      --accent: 210 40% 96.1%;
                      --accent-foreground: 222.2 47.4% 11.2%;
                      --destructive: 0 84.2% 60.2%;
                      --destructive-foreground: 210 40% 98%;
                      --border: 214.3 31.8% 91.4%;
                      --input: 214.3 31.8% 91.4%;
                      --ring: 222.2 84% 4.9%;
                  }
              `}</style>
            <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-5xl">
                
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Figma Redirect Manager</h1>
                        <p className="text-muted-foreground mt-2">Create, edit, and manage "pretty links" for your Figma components.</p>
                    </div>
                    <Button variant="outline" onClick={handleLogout}>Logout</Button>
                </header>

                <Card className="mb-8">
                    <CardHeader>
                        <CardTitle>Add New Component</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="componentName">Component Name</Label>
                                <Input id="componentName" value={newComponentName} onChange={(e) => setNewComponentName(e.target.value)} placeholder="e.g., Range Slider Filter" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="mainUrl">Main Branch URL</Label>
                                <Input id="mainUrl" type="url" value={mainUrl} onChange={(e) => setMainUrl(e.target.value)} placeholder="https://figma.com/design/.../main" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="latestUrl">Latest Branch URL</Label>
                                <Input id="latestUrl" type="url" value={latestUrl} onChange={(e) => setLatestUrl(e.target.value)} placeholder="https://figma.com/design/.../latest-branch" />
                            </div>
                            <Button type="submit" disabled={!isAuthReady || isLoading} className="w-full sm:w-auto">
                                {isAuthReady ? 'Add Component' : 'Initializing...'}
                            </Button>
                        </form>
                        {error && <p className="text-sm font-medium text-destructive mt-4">{error}</p>}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Managed Components</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <p className="text-muted-foreground">Loading components...</p>
                        ) : components.length === 0 ? (
                            <p className="text-muted-foreground">No components added yet. Add one using the form above.</p>
                        ) : (
                            <div className="space-y-4">
                                {components.map(comp => {
                                    const isEditing = editingComponentId === comp.id;
                                    return (
                                        <div key={comp.id} className="p-4 border rounded-lg">
                                            {isEditing ? (
                                                // --- EDITING VIEW ---
                                                <div className="space-y-4">
                                                    <h3 className="font-semibold text-lg truncate">{comp.name}</h3>
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`edit-main-${comp.id}`}>Main URL</Label>
                                                        <Input id={`edit-main-${comp.id}`} value={editedMainUrl} onChange={(e) => setEditedMainUrl(e.target.value)} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <Label htmlFor={`edit-latest-${comp.id}`}>Latest URL</Label>
                                                        <Input id={`edit-latest-${comp.id}`} value={editedLatestUrl} onChange={(e) => setEditedLatestUrl(e.target.value)} />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Button size="sm" onClick={() => handleUpdateComponent(comp.id)}>Save</Button>
                                                        <Button size="sm" variant="outline" onClick={handleCancelEditing}>Cancel</Button>
                                                    </div>
                                                </div>
                                            ) : (
                                                // --- DISPLAY VIEW ---
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                    <div className="flex-grow min-w-0">
                                                        <h3 className="font-semibold text-lg truncate">{comp.name}</h3>
                                                        <div className="mt-2 space-y-2 text-sm">
                                                            {[
                                                                { label: 'Main', url: comp.mainUrl },
                                                                { label: 'Latest', url: comp.latestUrl }
                                                            ].map(({ label, url }) => (
                                                                <div key={label} className="flex items-center gap-2">
                                                                    <span className="font-medium text-muted-foreground w-14 flex-shrink-0">{label}:</span>
                                                                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">{url}</a>
                                                                </div>
                                                            ))}
                                                             <div className="mt-3 pt-3 border-t space-y-2">
                                                                <p className="font-semibold text-sm">Pretty Links:</p>
                                                                {[
                                                                    { label: 'Main', link: `${getBaseUrl()}/${comp.id}/main` },
                                                                    { label: 'Latest', link: `${getBaseUrl()}/${comp.id}/latest` }
                                                                ].map(({ label, link }) => (
                                                                    <div key={label} className="flex items-center gap-2 group">
                                                                        <a href={link} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline truncate block">{link}</a>
                                                                        <button onClick={() => handleCopyToClipboard(link)} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                                                            {copiedLink === link ? '✅' : '📋'}
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                              </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex-shrink-0 flex sm:flex-col gap-2">
                                                        <Button size="sm" variant="outline" onClick={() => handleStartEditing(comp)}>Edit</Button>
                                                        <Button size="sm" variant="destructive" onClick={() => handleDelete(comp.id)}>Delete</Button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
                 <footer className="text-center mt-8 text-sm text-muted-foreground">
                    <p>Logged in as: <span className="font-mono">{user ? user.email : 'N/A'}</span></p>
                 </footer>
            </div>
        </div>
    );
}
