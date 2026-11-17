import React, { createContext, useContext, useState, useEffect } from 'react';
import { authApi, onboardingApi } from '../lib/api';
import { supabase } from '../lib/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const checkOnboardingStatus = async () => {
    const response = await onboardingApi.getStatus();
    setNeedsOnboarding(response.data.needs_onboarding);
    return response.data.needs_onboarding;
  };

  const refreshUser = async () => {
    const response = await authApi.getMe();
    setUser(response.data);
    return response.data;
  };

  useEffect(() => {
    let active = true;
    let sessionVersion = 0;

    const loadUser = async () => {
      const currentVersion = ++sessionVersion;
      try {
        const response = await authApi.getMe();
        if (!active || currentVersion !== sessionVersion) return;
        setUser(response.data);
        await checkOnboardingStatus();
      } catch (error) {
        if (!active || currentVersion !== sessionVersion) return;
        console.error('Error loading authenticated user:', error);
        setUser(null);
        setNeedsOnboarding(false);
        if (error.response?.status === 401) {
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) {
            console.error('Error clearing the expired Supabase session:', signOutError);
          }
        }
      } finally {
        if (active && currentVersion === sessionVersion) {
          setLoading(false);
        }
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        sessionVersion += 1;
        setUser(null);
        setNeedsOnboarding(false);
        setLoading(false);
        return;
      }

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        window.setTimeout(() => {
          if (active) loadUser();
        }, 0);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const response = await authApi.getMe();
    await checkOnboardingStatus();
    setUser(response.data);
    return response.data;
  };

  const register = async (name, email, password) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw error;

    if (!data.session) {
      return { emailConfirmationRequired: true };
    }

    const response = await authApi.getMe();
    setUser(response.data);
    setNeedsOnboarding(true);
    return response.data;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setNeedsOnboarding(false);
  };

  const completeOnboarding = async () => {
    setNeedsOnboarding(false);
    await checkOnboardingStatus();
  }

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login, 
      register, 
      logout,
      needsOnboarding,
      completeOnboarding,
      checkOnboardingStatus,
      refreshUser,
      isAuthenticated: !!user 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
