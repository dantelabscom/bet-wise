'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { Menu, X, ChevronDown } from 'lucide-react';

export default function DashboardHeader() {
  const { data: session } = useSession();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [sportsMenuOpen, setSportsMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  const user = session?.user || { name: 'User', email: null, id: '', image: null };

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Close menus when clicking outside of them
      if (profileMenuOpen || sportsMenuOpen) {
        const target = event.target as HTMLElement;
        
        if (!target.closest('.profile-menu') && !target.closest('.sports-menu')) {
          setProfileMenuOpen(false);
          setSportsMenuOpen(false);
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileMenuOpen, sportsMenuOpen]);

  return (
    <header className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center">
            <Link 
              href="/" 
              className="flex items-center"
            >
              <span className="text-xl font-bold text-blue-600">BetWise</span>
            </Link>
            
            <nav className="ml-10 hidden space-x-8 md:flex">
              <Link 
                href="/dashboard" 
                className="text-gray-900 hover:text-blue-600"
              >
                Dashboard
              </Link>
              <Link 
                href="/markets" 
                className="text-gray-500 hover:text-blue-600"
              >
                Markets
              </Link>
              <div className="relative sports-menu">
                <button 
                  onClick={() => setSportsMenuOpen(!sportsMenuOpen)}
                  className="text-gray-500 hover:text-blue-600 flex items-center"
                >
                  Sports <ChevronDown size={16} className="ml-1" />
                </button>
                {sportsMenuOpen && (
                  <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20">
                    <Link 
                      href="/sports" 
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setSportsMenuOpen(false)}
                    >
                      All Sports
                    </Link>
                    <Link 
                      href="/markets/cricket" 
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      onClick={() => setSportsMenuOpen(false)}
                    >
                      Cricket
                    </Link>
                  </div>
                )}
              </div>
              <Link 
                href="/positions" 
                className="text-gray-500 hover:text-blue-600"
              >
                My Positions
              </Link>
              <Link 
                href="/analytics" 
                className="text-gray-500 hover:text-blue-600"
              >
                Analytics
              </Link>
              <Link 
                href="/wallet" 
                className="text-gray-500 hover:text-blue-600"
              >
                Wallet
              </Link>
            </nav>
          </div>
          
          <div className="hidden items-center md:flex">
            <div className="relative profile-menu">
              <button
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                className="flex items-center space-x-2 rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <span>{user.name || user.email || 'User'}</span>
                <ChevronDown size={16} />
              </button>
              
              {profileMenuOpen && (
                <div className="absolute right-0 z-10 mt-2 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
                  <Link 
                    href="/profile" 
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Your Profile
                  </Link>
                  <Link 
                    href="/settings" 
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    onClick={() => setProfileMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex md:hidden">
            <button
              className="text-gray-500 hover:text-gray-900"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>
      
      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden">
          <div className="space-y-1 px-2 pb-3 pt-2">
            <Link 
              href="/dashboard" 
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-900 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              Dashboard
            </Link>
            <Link 
              href="/markets" 
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-500 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              Markets
            </Link>
            <Link 
              href="/sports" 
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-500 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              Sports
            </Link>
            <Link 
              href="/markets/cricket" 
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-500 hover:bg-gray-100 pl-6"
              onClick={() => setMobileMenuOpen(false)}
            >
              Cricket Markets
            </Link>
            <Link 
              href="/positions" 
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-500 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              My Positions
            </Link>
            <Link 
              href="/analytics" 
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-500 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              Analytics
            </Link>
            <Link 
              href="/wallet" 
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-500 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              Wallet
            </Link>
            <Link 
              href="/profile" 
              className="block rounded-md px-3 py-2 text-base font-medium text-gray-500 hover:bg-gray-100"
              onClick={() => setMobileMenuOpen(false)}
            >
              Profile
            </Link>
            <button
              onClick={handleSignOut}
              className="block w-full rounded-md px-3 py-2 text-left text-base font-medium text-gray-500 hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </header>
  );
} 