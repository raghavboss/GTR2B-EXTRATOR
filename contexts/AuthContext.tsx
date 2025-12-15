
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role, Permission, Ledger } from '../types';
import { getUserByEmail, getAllRoles, initDB, getAllLedgers, logAudit, seedJaipurData, seedJodhpurData } from '../utils/db'; // initDB to ensure seeding

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

  // Load session from localStorage on mount
  useEffect(() => {
    const loadSession = async () => {
      // Ensure DB is initialized (and seeded)
      try {
        await initDB();
        
        // Auto-seed mock data for convenience
        await seedJaipurData();
        await seedJodhpurData();

        // Check Internal User Session
        const storedUser = localStorage.getItem('erp_session_user');
        if (storedUser) {
            const user: User = JSON.parse(storedUser);
            // Verify user still exists and get latest role
            const dbUser = await getUserByEmail(user.email);
            if (dbUser && dbUser.isActive) {
                setCurrentUser(dbUser);
                const roles = await getAllRoles();
                const role = roles.find(r => r.id === dbUser.roleId) || null;
                setCurrentRole(role);
            } else {
                localStorage.removeItem('erp_session_user');
            }
        }

        // Check External Ledger Session
        const storedLedger = localStorage.getItem('erp_session_ledger');
        if (storedLedger) {
            const ledger: Ledger = JSON.parse(storedLedger);
            // Verify ledger exists
            const ledgers = await getAllLedgers();
            const dbLedger = ledgers.find(l => l.id === ledger.id);
            if(dbLedger && dbLedger.portalEmail && dbLedger.portalPassword) {
                setCurrentExternalUser(dbLedger);
            } else {
                localStorage.removeItem('erp_session_ledger');
            }
        }

      } catch (e) {
          console.error("Session load failed", e);
      } finally {
          setIsLoading(false);
      }
    };
    loadSession();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const user = await getUserByEmail(email);
      
      // In a real app, use bcrypt.compare(password, user.passwordHash)
      if (user && user.passwordHash === password) {
        if (!user.isActive) {
            return { success: false, error: 'Account is deactivated. Contact admin.' };
        }
        
        const roles = await getAllRoles();
        const role = roles.find(r => r.id === user.roleId) || null;

        setCurrentUser(user);
        setCurrentRole(role);
        setCurrentExternalUser(null); // Clear external session if any
        localStorage.setItem('erp_session_user', JSON.stringify(user));
        localStorage.removeItem('erp_session_ledger');

        // Audit Log
        logAudit({
            userId: user.id || 0,
            userName: user.name,
            action: 'LOGIN',
            module: 'Authentication',
            description: `User logged in successfully.`
        });

        return { success: true };
      }
      return { success: false, error: 'Invalid email or password' };
    } catch (error) {
      console.error("Login error", error);
      return { success: false, error: 'System error during login' };
    }
  };

  const loginExternal = async (email: string, password: string) => {
      try {
          const ledgers = await getAllLedgers();
          const ledger = ledgers.find(l => l.portalEmail === email && l.portalPassword === password);

          if (ledger) {
              setCurrentExternalUser(ledger);
              setCurrentUser(null); // Clear internal session
              setCurrentRole(null);
              localStorage.setItem('erp_session_ledger', JSON.stringify(ledger));
              localStorage.removeItem('erp_session_user');

              // Audit Log (External)
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

  const logout = () => {
    if (currentUser) {
        logAudit({
            userId: currentUser.id || 0,
            userName: currentUser.name,
            action: 'LOGOUT',
            module: 'Authentication',
            description: `User logged out.`
        });
    } else if (currentExternalUser) {
        logAudit({
            userId: `EXT-${currentExternalUser.id}`,
            userName: currentExternalUser.name,
            action: 'LOGOUT',
            module: 'Partner Portal',
            description: `Partner logged out.`
        });
    }

    setCurrentUser(null);
    setCurrentRole(null);
    setCurrentExternalUser(null);
    localStorage.removeItem('erp_session_user');
    localStorage.removeItem('erp_session_ledger');
  };

  const hasPermission = (permission: Permission): boolean => {
    if (currentExternalUser) return false; // External users have no internal permissions
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
