import React from 'react';
import SettingsSidebar from './SettingsSidebar';

const SettingsLayout = ({ currentPage, setCurrentPage, children }) => {
  return (
    <div className="settings-layout">
      <SettingsSidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="settings-content">
        {children}
      </div>
    </div>
  );
};

export default SettingsLayout;
