import { Sidebar } from './Sidebar';
import { Toaster } from 'sonner';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-60 overflow-y-auto">
        <div className="p-6">
          {children}
        </div>
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
