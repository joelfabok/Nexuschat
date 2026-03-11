import { createContext, useContext, useState } from 'react';
import UserProfileModal from '../components/Profile/UserProfileModal';

const ProfileContext = createContext(null);

export function ProfileProvider({ children, onStartDM }) {
  const [userId, setUserId] = useState(null);

  return (
    <ProfileContext.Provider value={{ openProfile: setUserId }}>
      {children}
      {userId && (
        <UserProfileModal
          userId={userId}
          onClose={() => setUserId(null)}
          onStartDM={(conv) => { onStartDM?.(conv); setUserId(null); }}
        />
      )}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  return useContext(ProfileContext);
}
