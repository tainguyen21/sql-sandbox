import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

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
          {/* Sidebar placeholder - Phase 02 will add workspace switcher */}
          <aside className="w-64 border-r bg-muted/40 p-4">
            <h1 className="text-lg font-semibold">SQL Sandbox</h1>
          </aside>
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
