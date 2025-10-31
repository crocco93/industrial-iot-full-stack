import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { TabNavigation } from './TabNavigation';

export const MainLayout: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1">
          <TabNavigation />
        </main>
      </div>
    </div>
  );
};