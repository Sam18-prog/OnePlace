import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { logClientDiagnostic, toFriendlyAuthError } from '../utils/errorHandling';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      (nextUser) => {
        setUser(nextUser);
        setAuthLoading(false);
      },
      (err) => {
        logClientDiagnostic('Auth state observer error', err);
        setAuthLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (): Promise<boolean> => {
    if (isSigningIn) return false;
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      return true;
    } catch (err) {
      logClientDiagnostic('Google sign-in popup error', err);
      setAuthError(toFriendlyAuthError(err));
      return false;
    } finally {
      setIsSigningIn(false);
    }
  }, [isSigningIn]);

  const logOut = useCallback(async () => {
    setAuthError(null);
    try {
      await signOut(auth);
    } catch (err) {
      logClientDiagnostic('Sign-out error', err);
      setAuthError('Could not complete sign-out. Please try refreshing the page.');
    }
  }, []);

  return {
    user,
    authLoading,
    isSigningIn,
    authError,
    setAuthError,
    signIn,
    logOut,
  };
}
