import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    signOut 
} from 'firebase/auth';
import { 
    getFirestore,
    collection,
    query,
    where,
    onSnapshot,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    getDoc
} from 'firebase/firestore';

// --- Firebase Configuration ---
const firebaseConfig = process.env.REACT_APP_FIREBASE_CONFIG 
    ? JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG) 
    : {};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app); // Initialize Firestore


// --- Shadcn UI-style Components ---
const Card = ({ className, ...props }) => <div className={`rounded-xl border bg-card text-card-foreground shadow-sm ${className}`} {...props} />;
const CardHeader = ({ className, ...props }) => <div className={`flex flex-col space-y-1.5 p-6 ${className}`} {...props} />;
const CardTitle = ({ className, ...props }) => <h3 className={`text-2xl font-semibold leading-none tracking-tight ${className}`} {...props} />;
const CardContent = ({ className, ...props }) => <div className={`p-6 pt-0 ${className}`} {...props} />;
const Input = React.forwardRef(({ className, ...props }, ref) => <input className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`} ref={ref} {...props} />);
const Button = ({ className, variant = 'default', size = 'default', ...props }) => {
    const variants = {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
    };
    const sizes = { default: 'h-10 px-4 py-2', sm: 'h-9 rounded-md px-3' };
    return <button className={`inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`} {...props} />;
};
const Label = ({ className, ...props }) => <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`} {...props} />;

// --- Login Screen Component ---
const LoginScreen = ({ onLogin, error, isLoading }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const handleLogin = (e) => { e.preventDefault(); onLogin(email, password); };
    return (
        <div className="flex items-center justify-center min-h-screen bg-background">
            <Card className="w-full max-w-sm">
                <CardHeader><CardTitle>Admin Login</CardTitle></CardHeader>
                <CardContent>
                    <form className="space-y-4" onSubmit={handleLogin}>
                        <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" placeholder="user@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isLoading} /></div>
                        <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isLoading} /></div>
                        {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                        <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? 'Logging in...' : 'Login'}</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

// --- Redirect Handler Component ---
const RedirectHandler = () => {
    const [message, setMessage] = useState('Looking for your link...');
    useEffect(() => {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        const findAndRedirect = async () => {
            if (pathParts.length === 3 && pathParts[0] === 'r') {
                const [, componentId, branch] = pathParts;
                try {
                    const docRef = doc(db, 'components', componentId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const targetComponent = docSnap.data();
                        const url = branch === 'main' ? targetComponent.mainUrl : targetComponent.latestUrl;
                        if (url) {
                            setMessage(`Redirecting to ${branch} branch...`);
                            window.location.replace(url);
                        } else {
                            setMessage(`Error: Branch "${branch}" not found for this component.`);
                        }
                    } else {
                        setMessage(`Error: Could not find a component with the ID "${componentId}".`);
                    }
                } catch (err) {
                    setMessage(`Error fetching redirect link: ${err.message}`);
                }
            } else {
                setMessage('Error: Invalid redirect link format.');
            }
        };
        findAndRedirect();
    }, []);
    return (
        <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
            <div className="text-center"><h1 className="text-2xl font-bold mb-4">Figma Redirector</h1><p>{message}</p></div>
        </div>
    );
};

// --- Main App Component ---
export default function App() {
    const [user, setUser] = useState(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);
    const [components, setComponents] = useState([]);
    const [isDataLoading, setIsDataLoading] = useState(true);
    
    const [newComponentName, setNewComponentName] = useState('');
    const [mainUrl, setMainUrl] = useState('');
    const [latestUrl, setLatestUrl] = useState('');
    const [error, setError] = useState(null);
    const [authError, setAuthError] = useState(null);
    const [copiedLink, setCopiedLink] = useState(null);

    const [editingComponentId, setEditingComponentId] = useState(null);
    const [editedMainUrl, setEditedMainUrl] = useState('');
    const [editedLatestUrl, setEditedLatestUrl] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setIsAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // --- Real-time data fetching from Firestore ---
    useEffect(() => {
        if (!user) {
            setComponents([]);
            setIsDataLoading(false);
            return;
        }
        setIsDataLoading(true);
        const q = query(collection(db, "components"), where("uid", "==", user.uid));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const userComponents = [];
            querySnapshot.forEach((doc) => {
                userComponents.push({ id: doc.id, ...doc.data() });
            });
            setComponents(userComponents);
            setIsDataLoading(false);
        }, (err) => {
            console.error("Error fetching data:", err);
            setError("Failed to load components.");
            setIsDataLoading(false);
        });
        return () => unsubscribe();
    }, [user]);
    
    const handleLogin = async (email, password) => {
        setAuthError(null);
        setIsAuthLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setAuthError("Invalid credentials. Please try again.");
        } finally {
            setIsAuthLoading(false);
        }
    };

    const handleLogout = async () => { await signOut(auth); };

    const generateComponentId = (name) => name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComponentName.trim() || !mainUrl.trim() || !latestUrl.trim() || !user) return;
        
        setError(null);
        const componentId = generateComponentId(newComponentName);

        if (components.some(c => c.id === componentId)) {
            setError("A component with this name already exists.");
            return;
        }
        
        try {
            const docRef = doc(db, 'components', componentId);
            await setDoc(docRef, {
                uid: user.uid,
                name: newComponentName,
                mainUrl,
                latestUrl,
            });
            setNewComponentName('');
            setMainUrl('');
            setLatestUrl('');
        } catch (err) {
            console.error("Error adding document:", err);
            setError("Failed to save component.");
        }
    };

    const handleDelete = async (componentId) => {
        try {
            await deleteDoc(doc(db, "components", componentId));
        } catch (err) {
            console.error("Error deleting document:", err);
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
        if (!editedMainUrl.trim() || !editedLatestUrl.trim()) return;
        
        try {
            const docRef = doc(db, "components", componentId);
            await updateDoc(docRef, {
                mainUrl: editedMainUrl,
                latestUrl: editedLatestUrl
            });
            handleCancelEditing();
        } catch (err) {
            console.error("Error updating document:", err);
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

    if (isAuthLoading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
    if (window.location.pathname.startsWith('/r/')) return <RedirectHandler />;
    if (!user) return <LoginScreen onLogin={handleLogin} error={authError} isLoading={isAuthLoading} />;

    const getBaseUrl = () => window.location.protocol + '//' + window.location.host;

    return (
        <div className="bg-background text-foreground min-h-screen font-sans">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8 max-w-5xl">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Figma Redirect Manager</h1>
                        <p className="text-muted-foreground mt-2">Create, edit, and manage "pretty links" for your Figma components.</p>
                    </div>
                    <Button variant="outline" onClick={handleLogout}>Logout</Button>
                </header>
                <Card className="mb-8">
                    <CardHeader><CardTitle>Add New Component</CardTitle></CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2"><Label htmlFor="componentName">Component Name</Label><Input id="componentName" value={newComponentName} onChange={(e) => setNewComponentName(e.target.value)} placeholder="e.g., Range Slider Filter" /></div>
                            <div className="space-y-2"><Label htmlFor="mainUrl">Main Branch URL</Label><Input id="mainUrl" type="url" value={mainUrl} onChange={(e) => setMainUrl(e.target.value)} placeholder="https://figma.com/design/.../main" /></div>
                            <div className="space-y-2"><Label htmlFor="latestUrl">Latest Branch URL</Label><Input id="latestUrl" type="url" value={latestUrl} onChange={(e) => setLatestUrl(e.target.value)} placeholder="https://figma.com/design/.../latest-branch" /></div>
                            <Button type="submit" className="w-full sm:w-auto">Add Component</Button>
                        </form>
                        {error && <p className="text-sm font-medium text-destructive mt-4">{error}</p>}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle>Managed Components</CardTitle></CardHeader>
                    <CardContent>
                        {isDataLoading ? (<p className="text-muted-foreground">Loading components...</p>) : 
                        components.length === 0 ? (<p className="text-muted-foreground">No components added yet. Add one using the form above.</p>) : 
                        (
                            <div className="space-y-4">
                                {components.map(comp => {
                                    const isEditing = editingComponentId === comp.id;
                                    return (
                                        <div key={comp.id} className="p-4 border rounded-lg">
                                            {isEditing ? (
                                                <div className="space-y-4">
                                                    <h3 className="font-semibold text-lg truncate">{comp.name}</h3>
                                                    <div className="space-y-2"><Label htmlFor={`edit-main-${comp.id}`}>Main URL</Label><Input id={`edit-main-${comp.id}`} value={editedMainUrl} onChange={(e) => setEditedMainUrl(e.target.value)} /></div>
                                                    <div className="space-y-2"><Label htmlFor={`edit-latest-${comp.id}`}>Latest URL</Label><Input id={`edit-latest-${comp.id}`} value={editedLatestUrl} onChange={(e) => setEditedLatestUrl(e.target.value)} /></div>
                                                    <div className="flex items-center gap-2"><Button size="sm" onClick={() => handleUpdateComponent(comp.id)}>Save</Button><Button size="sm" variant="outline" onClick={handleCancelEditing}>Cancel</Button></div>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                                    <div className="flex-grow min-w-0">
                                                        <h3 className="font-semibold text-lg truncate">{comp.name}</h3>
                                                        <div className="mt-2 space-y-2 text-sm">
                                                            {[ { label: 'Main', url: comp.mainUrl }, { label: 'Latest', url: comp.latestUrl } ].map(({ label, url }) => (<div key={label} className="flex items-center gap-2"><span className="font-medium text-muted-foreground w-14 flex-shrink-0">{label}:</span><a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate block">{url}</a></div>))}
                                                             <div className="mt-3 pt-3 border-t space-y-2">
                                                                <p className="font-semibold text-sm">Pretty Links:</p>
                                                                {[ { label: 'Main', link: `${getBaseUrl()}/r/${comp.id}/main` }, { label: 'Latest', link: `${getBaseUrl()}/r/${comp.id}/latest` } ].map(({ label, link }) => (<div key={label} className="flex items-center gap-2 group"><a href={link} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline truncate block">{link}</a><button onClick={() => handleCopyToClipboard(link)} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">{copiedLink === link ? '✅' : '📋'}</button></div>))}
                                                              </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex-shrink-0 flex sm:flex-col gap-2"><Button size="sm" variant="outline" onClick={() => handleStartEditing(comp)}>Edit</Button><Button size="sm" variant="destructive" onClick={() => handleDelete(comp.id)}>Delete</Button></div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>
                 <footer className="text-center mt-8 text-sm text-muted-foreground"><p>Logged in as: <span className="font-mono">{user ? user.email : 'N/A'}</span></p></footer>
            </div>
        </div>
    );
}
