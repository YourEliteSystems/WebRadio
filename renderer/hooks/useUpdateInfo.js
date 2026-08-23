import { useState, useEffect } from 'react';

/**
 * Hook für Update-Benachrichtigungen über den Updater-IPC-Kanal.
 */
export function useUpdateInfo() {
  const [updateInfo, setUpdateInfo] = useState(null);

  useEffect(() => {
    if (window.updaterAPI?.onUpdateAvailable) {
      window.updaterAPI.onUpdateAvailable((info) => {
        setUpdateInfo(info);
      });
    }
  }, []);

  return updateInfo;
}
