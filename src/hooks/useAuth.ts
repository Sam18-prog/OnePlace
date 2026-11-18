import { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (): Promise<boolean> => {
    setIsSigningIn(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Google Sign-In was cancelled or failed.';
      setAuthError(message);
      return false;
    } finally {
      setIsSigningIn(false);
    }
  }, []);

  const logOut = useCallback(async () => {
    setAuthError(null);
    await signOut(auth);
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
