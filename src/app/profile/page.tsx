'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import DashboardHeader from '@/components/dashboard/Header';
import toast from 'react-hot-toast';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  joinedAt: string;
  tradingLevel: string;
  walletCount: number;
  positionsCount: number;
}

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    }
  }, [status, router]);

  // Fetch profile data
  useEffect(() => {
    const fetchProfile = async () => {
      if (status === 'authenticated' && session?.user) {
        try {
          // In a real implementation, we would fetch from the API
          // const response = await fetch('/api/profile');
          // const data = await response.json();
          
          // For now, using mock data based on the session
          const mockProfile: UserProfile = {
            id: session.user.id as string,
            name: session.user.name || 'Trader',
            email: session.user.email || 'user@example.com',
            avatarUrl: session.user.image || undefined,
            joinedAt: new Date().toISOString(), // In reality, this would come from the database
            tradingLevel: 'Beginner',
            walletCount: 1,
            positionsCount: 3,
          };
          
          setProfile(mockProfile);
          setFormData({
            name: mockProfile.name,
          });
        } catch (error) {
          console.error('Error fetching profile:', error);
          toast.error('Failed to load profile data');
        } finally {
          setLoading(false);
        }
      }
    };

    fetchProfile();
  }, [session, status]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    
    setSavingProfile(true);
    
    try {
      // In a real implementation, we would submit to the API
      // const response = await fetch('/api/profile', {
      //   method: 'PATCH',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     name: formData.name,
      //   }),
      // });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update the session to reflect changes
      await update({
        ...session,
        user: {
          ...session?.user,
          name: formData.name,
        },
      });
      
      // Update local state
      setProfile(prev => {
        if (!prev) return null;
        return {
          ...prev,
          name: formData.name,
        };
      });
      
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Loading...</h2>
          <p className="text-gray-500">Please wait while we load your profile</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return null; // Will redirect in the useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader user={session.user} />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Your Profile</h1>
          <p className="text-gray-600">View and manage your account information</p>
        </div>
        
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {/* Profile Summary */}
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="mb-6 flex flex-col items-center">
              <div className="mb-4 h-24 w-24 overflow-hidden rounded-full bg-gray-200">
                {profile?.avatarUrl ? (
                  <img 
                    src={profile.avatarUrl} 
                    alt={profile.name} 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-blue-600 text-3xl font-bold text-white">
                    {profile?.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <h2 className="text-xl font-bold">{profile?.name}</h2>
              <p className="text-gray-600">{profile?.email}</p>
            </div>
            
            <div className="space-y-4 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">Member Since</span>
                <span>{profile ? new Date(profile.joinedAt).toLocaleDateString() : '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">Trading Level</span>
                <span>{profile?.tradingLevel}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">Wallets</span>
                <span>{profile?.walletCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-500">Positions</span>
                <span>{profile?.positionsCount}</span>
              </div>
            </div>
          </div>
          
          {/* Profile Edit Form */}
          <div className="rounded-lg bg-white p-6 shadow-md md:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Account Information</h2>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 hover:bg-gray-50"
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
            
            {isEditing ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Name</h3>
                  <p className="mt-1">{profile?.name}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-gray-500">Email</h3>
                  <p className="mt-1">{profile?.email}</p>
                </div>
                
                <div className="border-t border-gray-200 pt-4">
                  <p className="text-sm text-gray-600">
                    Email cannot be changed. If you need to update your email, please contact customer support.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Additional Settings */}
        <div className="mt-8">
          <div className="rounded-lg bg-white p-6 shadow-md">
            <h2 className="mb-4 text-lg font-semibold">Account Security</h2>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Password</h3>
                  <p className="text-sm text-gray-500">Last changed: Never</p>
                </div>
                <button
                  type="button"
                  className="rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                  onClick={() => toast.success('Password change functionality will be implemented soon')}
                >
                  Change Password
                </button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Two-Factor Authentication</h3>
                  <p className="text-sm text-gray-500">Not enabled</p>
                </div>
                <button
                  type="button"
                  className="rounded-md bg-gray-100 px-3 py-1 text-sm text-gray-700 hover:bg-gray-200"
                  onClick={() => toast.success('2FA will be available in a future update')}
                >
                  Enable
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 