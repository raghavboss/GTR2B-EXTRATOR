
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role, Permission, Ledger } from '../types';
import { getUserByEmail, getAllRoles, initDB, getAllLedgers, logAudit, seedJaipurData, seedJodhpurData, saveUser } from '../utils/db';
import { auth } from '../utils/firebase';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, User as FirebaseUser } from 'firebase/auth';

interface AuthContextType {
  currentUser: User | null;
  currentRole: Role | null;
  currentExternalUser: Ledger | null; // For Customer/Vendor Login
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginExternal: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [currentExternalUser, setCurrentExternalUser] = useState<Ledger | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize DB and Seed Data
  useEffect(() => {
    const initSystem = async () => {
        try {
            await initDB();
            await seedJaipurData();
            await seedJodhpurData();
        } catch (e) {
            console.error("System Initialization Failed", e);
        }
    };
    initSystem();
  }, []);

  // Monitor Firebase Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
            // User is signed in.
            // 1. Check if user exists in local IDB
            try {
                const email = firebaseUser.email!;
                let dbUser = await getUserByEmail(email);

                // If user authenticated in Firebase but not in IDB (e.g., cleared browser data),
                // we might want to recreate them locally if they were the default admin,
                // or deny access. For this app, if it's the admin email, we ensure it exists.
                if (!dbUser && email === 'admin@corp.com') {
                    // Re-seed default admin if missing locally but present in auth
                    // This logic is handled by initDB usually, but let's be safe.
                    // For now, assume idb handles persistence.
                }

                if (dbUser && dbUser.isActive) {
                    setCurrentUser(dbUser);
                    const roles = await getAllRoles();
                    const role = roles.find(r => r.id === dbUser.roleId) || null;
                    setCurrentRole(role);
                    
                    // Audit Log (Session Restore)
                    // We don't log every refresh, but we could.
                } else {
                    // Valid firebase user but invalid local user (disabled or deleted)
                    console.warn("Firebase user exists but local user is missing or inactive.");
                    await signOut(auth);
                    setCurrentUser(null);
                    setCurrentRole(null);
                }
            } catch (err) {
                console.error("Error fetching user details", err);
            }
        } else {
            // User is signed out.
            setCurrentUser(null);
            setCurrentRole(null);
        }
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    try {
        // Attempt Firebase Login
        await signInWithEmailAndPassword(auth, email, password);
        
        // If successful, onAuthStateChanged will handle state update.
        // We fetch the user here just to log the audit event immediately if needed,
        // but onAuthStateChanged is the source of truth.
        
        // Fetch user to log audit
        const user = await getUserByEmail(email);
        if (user) {
             logAudit({
                userId: user.id || 0,
                userName: user.name,
                action: 'LOGIN',
                module: 'Authentication',
                description: `User logged in via Firebase.`
            });
        }

        return { success: true };
    } catch (error: any) {
        console.error("Firebase Login Error", error);

        // Auto-provisioning Logic for Demo/First-Run convenience
        // auth/invalid-credential is the new generic error that can mean "User not found" 
        // OR "Wrong password" if enumeration protection is on.
        if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
            // Check if this user exists in our Local DB (seeded user)
            const localUser = await getUserByEmail(email);
            
            if (localUser) {
                // User exists locally. Try to create them in Firebase.
                // If they truly exist in Firebase and password was wrong, createUser will fail with email-already-in-use.
                // If they don't exist in Firebase (first run), this will succeed and log them in.
                try {
                    await createUserWithEmailAndPassword(auth, email, password);
                    
                    // Sync: Update local user password hash if needed (though we rely on firebase now)
                    // localUser.passwordHash = password; // Optional sync
                    // await saveUser(localUser);

                    logAudit({
                        userId: localUser.id || 0,
                        userName: localUser.name,
                        action: 'CREATE',
                        module: 'Authentication',
                        description: `Auto-provisioned Firebase account for local user.`
                    });

                    return { success: true };
                } catch (createError: any) {
                    console.error("Auto-provisioning failed", createError);
                    
                    if (createError.code === 'auth/email-already-in-use') {
                        // This confirms the user exists in Firebase, so the original error was indeed a wrong password.
                        return { success: false, error: 'Invalid password' };
                    }
                    
                    return { success: false, error: createError.message };
                }
            }
        }

        return { success: false, error: error.message };
    }
  };

  const loginExternal = async (email: string, password: string) => {
      // External users (Partners) still use IDB Ledgers for now as per "simple auth" scope usually applying to main app users.
      // If needed, we could migrate them to Firebase too, but they are dynamically created ledgers.
      try {
          const ledgers = await getAllLedgers();
          const ledger = ledgers.find(l => l.portalEmail === email && l.portalPassword === password);

          if (ledger) {
              setCurrentExternalUser(ledger);
              setCurrentUser(null); 
              setCurrentRole(null);
              // Ensure firebase is signed out so we don't have mixed states
              await signOut(auth);

              logAudit({
                userId: `EXT-${ledger.id}`,
                userName: ledger.name,
                action: 'LOGIN',
                module: 'Partner Portal',
                description: `Partner logged in successfully.`
              });

              return { success: true };
          }
          return { success: false, error: 'Invalid portal credentials' };
      } catch (error) {
          console.error("External Login error", error);
          return { success: false, error: 'System error during login' };
      }
  };

  const logout = async () => {
    if (currentUser) {
        logAudit({
            userId: currentUser.id || 0,
            userName: currentUser.name,
            action: 'LOGOUT',
            module: 'Authentication',
            description: `User logged out.`
        });
        await signOut(auth);
    } else if (currentExternalUser) {
        logAudit({
            userId: `EXT-${currentExternalUser.id}`,
            userName: currentExternalUser.name,
            action: 'LOGOUT',
            module: 'Partner Portal',
            description: `Partner logged out.`
        });
        setCurrentExternalUser(null);
    }
    
    // State is cleared by onAuthStateChanged for currentUser
  };

  const hasPermission = (permission: Permission): boolean => {
    if (currentExternalUser) return false;
    if (!currentRole) return false;
    if (currentRole.id === 'super_admin') return true;
    return currentRole.permissions.includes(permission);
  };

  return (
    <AuthContext.Provider value={{ currentUser, currentRole, currentExternalUser, isLoading, login, loginExternal, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
