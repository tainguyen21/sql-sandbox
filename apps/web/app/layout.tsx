import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WorkspaceSidebar } from '@/components/workspace/workspace-sidebar';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SQL Sandbox',
  description: 'Interactive PostgreSQL learning and debugging platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="flex h-screen">
          <WorkspaceSidebar />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
