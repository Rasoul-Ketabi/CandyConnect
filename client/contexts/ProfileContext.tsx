import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LoadProfiles, LoadSettings, SaveSettings } from '../services/api';
// import * as main from '../wailsjs/go/models'; // Removed Wails models


interface Profile {
  id: string;
  name: string;
  url: string;
  protocol: string;
  isSelected: boolean;
  createdAt: Date;
  ping?: number;
  pingSuccess?: boolean;
  isPinging?: boolean;
}

interface ProfileContextType {
  profiles: Profile[];
  selectedProfile: Profile | null;
  setProfiles: (profiles: Profile[]) => void;
  setSelectedProfile: (profile: Profile | null) => void;
  selectProfileById: (profileId: string) => Promise<void>;
  updateProfile: (profileId: string, updates: Partial<Profile>) => void;
  addProfile: (profile: Profile) => void;
  removeProfile: (profileId: string) => void;
  loadProfilesFromBackend: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  // Extract protocol from URL
  const extractProtocol = (url: string): string => {
    const match = url.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
    return match ? match[1].toUpperCase() : 'Unknown';
  };

  // Load profiles from backend and restore selected profile from settings
  const loadProfilesFromBackend = useCallback(async () => {
    try {
      // Load profiles
      const backendProfiles = await LoadProfiles();
      const profilesArray: Profile[] = Object.entries(backendProfiles).map(([name, configText]) => ({
        id: name,
        name: name,
        url: String(configText),
        protocol: extractProtocol(String(configText)),
        isSelected: false,
        createdAt: new Date()
      }));

      // Load settings to get selected profile
      let selectedProfileName: string | null = null;
      try {
        const settings = await LoadSettings();
        selectedProfileName = (settings as any).selectedProfile || null;
      } catch (error) {
        console.error('Failed to load settings for selected profile:', error);
      }

      // Set selected profile based on settings or default to first profile
      let profileToSelect: Profile | null = null;
      if (selectedProfileName && profilesArray.length > 0) {
        profileToSelect = profilesArray.find(p => p.name === selectedProfileName) || null;
      }

      // If no profile found in settings or no settings, select first profile
      if (!profileToSelect && profilesArray.length > 0) {
        profileToSelect = profilesArray[0];
      }

      // Update isSelected flags
      profilesArray.forEach(p => {
        p.isSelected = profileToSelect ? p.id === profileToSelect.id : false;
      });

      setProfiles(profilesArray);
      setSelectedProfile(profileToSelect);
    } catch (error) {
      console.error('Failed to load profiles from backend:', error);
    }
  }, []);

  // Select profile by ID and save to settings
  const selectProfileById = useCallback(async (profileId: string) => {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;

    // Update profiles state
    const updatedProfiles = profiles.map(p => ({
      ...p,
      isSelected: p.id === profileId
    }));

    setProfiles(updatedProfiles);
    setSelectedProfile(profile);

    // Save selected profile to backend settings
    try {
      const settings = await LoadSettings();
      const updatedSettings = {
        ...settings,
        selectedProfile: profile.name
      };
      await SaveSettings(updatedSettings as any);
    } catch (error) {
      console.error('Failed to save selected profile to settings:', error);
    }
  }, [profiles]);

  // Update profile
  const updateProfile = useCallback((profileId: string, updates: Partial<Profile>) => {
    setProfiles(prev => prev.map(p =>
      p.id === profileId ? { ...p, ...updates } : p
    ));

    // Update selectedProfile if it's the one being updated
    if (selectedProfile && selectedProfile.id === profileId) {
      setSelectedProfile(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [selectedProfile]);

  // Add profile
  const addProfile = useCallback((profile: Profile) => {
    setProfiles(prev => [...prev, profile]);
  }, []);

  // Remove profile
  const removeProfile = useCallback((profileId: string) => {
    setProfiles(prev => {
      const filtered = prev.filter(p => p.id !== profileId);

      // If removed profile was selected, select first remaining profile
      if (selectedProfile && selectedProfile.id === profileId) {
        const newSelected = filtered.length > 0 ? filtered[0] : null;
        setSelectedProfile(newSelected);

        // Update isSelected flags
        const updatedProfiles = filtered.map(p => ({
          ...p,
          isSelected: newSelected ? p.id === newSelected.id : false
        }));

        // Save new selection to settings
        if (newSelected) {
          selectProfileById(newSelected.id);
        }

        return updatedProfiles;
      }

      return filtered;
    });
  }, [selectedProfile, selectProfileById]);

  // Load profiles on mount
  useEffect(() => {
    loadProfilesFromBackend();
  }, [loadProfilesFromBackend]);

  const value: ProfileContextType = {
    profiles,
    selectedProfile,
    setProfiles,
    setSelectedProfile,
    selectProfileById,
    updateProfile,
    addProfile,
    removeProfile,
    loadProfilesFromBackend
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
};
