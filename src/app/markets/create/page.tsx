'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import DashboardHeader from '@/components/dashboard/Header';
import toast from 'react-hot-toast';

interface Sport {
  id: number;
  name: string;
  type: string;
}

interface Event {
  id: number;
  name: string;
  startTime: string;
  endTime?: string;
  homeTeam?: string;
  awayTeam?: string;
  sportId: number;
}

interface MarketOption {
  name: string;
  price: string;
  metadata?: Record<string, any>;
}

interface FormState {
  name: string;
  description: string;
  type: string;
  eventId: string;
  metadata: Record<string, any>;
  options: MarketOption[];
}

export default function CreateMarketPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [sports, setSports] = useState<Sport[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [selectedSportId, setSelectedSportId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formState, setFormState] = useState<FormState>({
    name: '',
    description: '',
    type: 'winner',
    eventId: '',
    metadata: {},
    options: [
      { name: '', price: '2.00' },
      { name: '', price: '2.00' },
    ],
  });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
    } else if (status === 'authenticated') {
      fetchSportsAndEvents();
    }
  }, [status, router]);

  useEffect(() => {
    // Filter events by selected sport
    if (selectedSportId) {
      setFilteredEvents(events.filter(event => event.sportId === parseInt(selectedSportId)));
    } else {
      setFilteredEvents(events);
    }
  }, [selectedSportId, events]);

  useEffect(() => {
    // Reset market options when market type changes
    resetOptionsForMarketType(formState.type);
  }, [formState.type]);

  const fetchSportsAndEvents = async () => {
    try {
      // Fetch sports
      const sportsResponse = await fetch('/api/sports');
      if (!sportsResponse.ok) throw new Error('Failed to fetch sports');
      const sportsData = await sportsResponse.json();
      setSports(sportsData.sports || []);

      // Fetch events
      const eventsResponse = await fetch('/api/events');
      if (!eventsResponse.ok) throw new Error('Failed to fetch events');
      const eventsData = await eventsResponse.json();
      setEvents(eventsData.events || []);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
      setLoading(false);
    }
  };

  const resetOptionsForMarketType = (marketType: string) => {
    let newOptions: MarketOption[] = [];
    
    switch (marketType) {
      case 'winner':
        newOptions = [
          { name: '', price: '2.00' },
          { name: '', price: '2.00' },
        ];
        setFormState(prev => ({ ...prev, options: newOptions, metadata: {} }));
        break;
        
      case 'over_under':
        // Find the selected event to get teams
        const selectedEvent = events.find(event => event.id.toString() === formState.eventId);
        const line = '220.5'; // Default line value
        newOptions = [
          { 
            name: 'Over', 
            price: '1.91',
            metadata: { type: 'over', line: parseFloat(line) }
          },
          { 
            name: 'Under', 
            price: '1.91',
            metadata: { type: 'under', line: parseFloat(line) }
          },
        ];
        setFormState(prev => ({ 
          ...prev, 
          options: newOptions,
          metadata: { 
            line: parseFloat(line), 
            unit: 'points' 
          }
        }));
        break;
        
      case 'spread':
        const spread = '6.5'; // Default spread value
        const selectedEventForSpread = events.find(event => event.id.toString() === formState.eventId);
        const homeTeam = selectedEventForSpread?.homeTeam || 'Home Team';
        const awayTeam = selectedEventForSpread?.awayTeam || 'Away Team';
        
        newOptions = [
          { 
            name: `${homeTeam} -${spread}`, 
            price: '1.91',
            metadata: { type: 'favorite', points: parseFloat(spread) }
          },
          { 
            name: `${awayTeam} +${spread}`, 
            price: '1.91',
            metadata: { type: 'underdog', points: parseFloat(spread) }
          },
        ];
        setFormState(prev => ({ 
          ...prev, 
          options: newOptions,
          metadata: { 
            spread: parseFloat(spread),
            favorite: 'home'
          }
        }));
        break;
        
      case 'prop':
        newOptions = [
          { name: 'Yes', price: '2.50' },
          { name: 'No', price: '1.65' },
        ];
        setFormState(prev => ({ 
          ...prev, 
          options: newOptions,
          metadata: { 
            propType: 'game_prop'
          }
        }));
        break;
        
      default:
        newOptions = [
          { name: '', price: '2.00' },
          { name: '', price: '2.00' },
        ];
        setFormState(prev => ({ ...prev, options: newOptions, metadata: {} }));
    }
  };

  const handleSportChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedSportId(e.target.value);
    // Reset event selection when sport changes
    setFormState(prev => ({ ...prev, eventId: '' }));
  };

  const handleEventChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const eventId = e.target.value;
    setFormState(prev => ({ ...prev, eventId }));
    
    // Update options based on selected event for certain market types
    if (formState.type === 'spread' || formState.type === 'over_under') {
      resetOptionsForMarketType(formState.type);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleOptionChange = (index: number, field: keyof MarketOption, value: string) => {
    const newOptions = [...formState.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setFormState(prev => ({ ...prev, options: newOptions }));
  };

  const handleAddOption = () => {
    setFormState(prev => ({
      ...prev,
      options: [...prev.options, { name: '', price: '2.00' }],
    }));
  };

  const handleRemoveOption = (index: number) => {
    if (formState.options.length <= 2) {
      toast.error('A market needs at least two options');
      return;
    }
    
    const newOptions = formState.options.filter((_, i) => i !== index);
    setFormState(prev => ({ ...prev, options: newOptions }));
  };

  const handleMetadataChange = (field: string, value: string) => {
    const newMetadata = { ...formState.metadata, [field]: field.includes('line') || field.includes('spread') ? parseFloat(value) : value };
    
    setFormState(prev => ({
      ...prev,
      metadata: newMetadata
    }));
    
    // Update option metadata if needed
    if (field === 'line' && formState.type === 'over_under') {
      const lineValue = parseFloat(value);
      const newOptions = formState.options.map(option => {
        if (option.metadata?.type === 'over' || option.metadata?.type === 'under') {
          return {
            ...option,
            metadata: { ...option.metadata, line: lineValue }
          };
        }
        return option;
      });
      setFormState(prev => ({ ...prev, options: newOptions }));
    } else if (field === 'spread' && formState.type === 'spread') {
      const spreadValue = parseFloat(value);
      const selectedEvent = events.find(event => event.id.toString() === formState.eventId);
      const homeTeam = selectedEvent?.homeTeam || 'Home Team';
      const awayTeam = selectedEvent?.awayTeam || 'Away Team';
      const favorite = formState.metadata.favorite || 'home';
      
      const newOptions = [
        { 
          name: `${favorite === 'home' ? homeTeam : awayTeam} -${value}`, 
          price: formState.options[0]?.price || '1.91',
          metadata: { type: 'favorite', points: spreadValue }
        },
        { 
          name: `${favorite === 'home' ? awayTeam : homeTeam} +${value}`, 
          price: formState.options[1]?.price || '1.91',
          metadata: { type: 'underdog', points: spreadValue }
        },
      ];
      
      setFormState(prev => ({ ...prev, options: newOptions }));
    } else if (field === 'favorite' && formState.type === 'spread') {
      const spreadValue = formState.metadata.spread || 6.5;
      const selectedEvent = events.find(event => event.id.toString() === formState.eventId);
      const homeTeam = selectedEvent?.homeTeam || 'Home Team';
      const awayTeam = selectedEvent?.awayTeam || 'Away Team';
      
      const newOptions = [
        { 
          name: `${value === 'home' ? homeTeam : awayTeam} -${spreadValue}`, 
          price: formState.options[0]?.price || '1.91',
          metadata: { type: 'favorite', points: spreadValue }
        },
        { 
          name: `${value === 'home' ? awayTeam : homeTeam} +${spreadValue}`, 
          price: formState.options[1]?.price || '1.91',
          metadata: { type: 'underdog', points: spreadValue }
        },
      ];
      
      setFormState(prev => ({ ...prev, options: newOptions }));
    }
  };

  const renderMarketTypeSpecificFields = () => {
    switch (formState.type) {
      case 'over_under':
        return (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Line</label>
              <input
                type="number"
                step="0.5"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={formState.metadata.line || ''}
                onChange={(e) => handleMetadataChange('line', e.target.value)}
                placeholder="220.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Unit</label>
              <input
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={formState.metadata.unit || ''}
                onChange={(e) => handleMetadataChange('unit', e.target.value)}
                placeholder="points"
              />
            </div>
          </div>
        );
        
      case 'spread':
        const selectedEvent = events.find(event => event.id.toString() === formState.eventId);
        return (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Spread</label>
              <input
                type="number"
                step="0.5"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={formState.metadata.spread || ''}
                onChange={(e) => handleMetadataChange('spread', e.target.value)}
                placeholder="6.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Favorite</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={formState.metadata.favorite || 'home'}
                onChange={(e) => handleMetadataChange('favorite', e.target.value)}
              >
                <option value="home">{selectedEvent?.homeTeam || 'Home Team'}</option>
                <option value="away">{selectedEvent?.awayTeam || 'Away Team'}</option>
              </select>
            </div>
          </div>
        );
        
      case 'prop':
        return (
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Prop Type</label>
              <select
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                value={formState.metadata.propType || 'game_prop'}
                onChange={(e) => handleMetadataChange('propType', e.target.value)}
              >
                <option value="game_prop">Game Prop</option>
                <option value="player_prop">Player Prop</option>
                <option value="team_prop">Team Prop</option>
              </select>
            </div>
            {formState.metadata.propType === 'player_prop' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Player Name</label>
                <input
                  type="text"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={formState.metadata.player || ''}
                  onChange={(e) => handleMetadataChange('player', e.target.value)}
                  placeholder="LeBron James"
                />
              </div>
            )}
            {formState.metadata.propType === 'team_prop' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Team</label>
                <select
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                  value={formState.metadata.team || ''}
                  onChange={(e) => handleMetadataChange('team', e.target.value)}
                >
                  <option value="">Select Team</option>
                  <option value="home">Home Team</option>
                  <option value="away">Away Team</option>
                </select>
              </div>
            )}
          </div>
        );
        
      default:
        return null;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!formState.name.trim()) {
      toast.error('Market name is required');
      return;
    }
    
    if (!formState.eventId) {
      toast.error('Please select an event');
      return;
    }
    
    // Validate options
    const invalidOptions = formState.options.some(opt => !opt.name.trim() || !opt.price.trim());
    if (invalidOptions) {
      toast.error('All options must have a name and price');
      return;
    }
    
    try {
      setSubmitting(true);
      
      const response = await fetch('/api/markets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formState.name,
          description: formState.description,
          type: formState.type,
          eventId: parseInt(formState.eventId),
          metadata: formState.metadata,
          options: formState.options,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create market');
      }
      
      const data = await response.json();
      toast.success('Market created successfully!');
      
      // Redirect to the new market
      router.push(`/markets/${data.id}`);
    } catch (error) {
      console.error('Error creating market:', error);
      toast.error('Failed to create market');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <DashboardHeader />
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-center items-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardHeader />
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-3xl">
          <div className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h1 className="text-xl font-bold text-gray-900">Create New Market</h1>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6">
              <div className="space-y-6">
                {/* Market Details */}
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Market Details</h2>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Market Name
                      </label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formState.name}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="e.g., Super Bowl Winner 2025"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        id="description"
                        name="description"
                        rows={3}
                        value={formState.description}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                        placeholder="Describe this market..."
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                        Market Type
                      </label>
                      <select
                        id="type"
                        name="type"
                        value={formState.type}
                        onChange={handleInputChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      >
                        <option value="winner">Winner (Moneyline)</option>
                        <option value="over_under">Over/Under (Totals)</option>
                        <option value="spread">Spread (Point Spread)</option>
                        <option value="prop">Proposition</option>
                        <option value="handicap">Handicap</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="sportId" className="block text-sm font-medium text-gray-700">
                        Sport
                      </label>
                      <select
                        id="sportId"
                        value={selectedSportId}
                        onChange={handleSportChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      >
                        <option value="">All Sports</option>
                        {sports.map(sport => (
                          <option key={sport.id} value={sport.id}>{sport.name}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div>
                      <label htmlFor="eventId" className="block text-sm font-medium text-gray-700">
                        Event
                      </label>
                      <select
                        id="eventId"
                        name="eventId"
                        value={formState.eventId}
                        onChange={handleEventChange}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                      >
                        <option value="">Select an Event</option>
                        {filteredEvents.map(event => (
                          <option key={event.id} value={event.id}>
                            {event.name} {event.homeTeam && event.awayTeam ? `(${event.homeTeam} vs ${event.awayTeam})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    {/* Market type specific fields */}
                    {renderMarketTypeSpecificFields()}
                  </div>
                </div>
                
                {/* Market Options */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-gray-900">Market Options</h2>
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Add Option
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {formState.options.map((option, index) => (
                      <div key={index} className="flex items-center space-x-3">
                        <div className="flex-grow">
                          <input
                            type="text"
                            value={option.name}
                            onChange={(e) => handleOptionChange(index, 'name', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder="Option name"
                          />
                        </div>
                        <div className="w-24">
                          <input
                            type="number"
                            step="0.01"
                            min="1.01"
                            value={option.price}
                            onChange={(e) => handleOptionChange(index, 'price', e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                            placeholder="Price"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveOption(index)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => router.push('/markets')}
                      className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`ml-3 inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                        submitting ? 'opacity-75 cursor-not-allowed' : ''
                      }`}
                    >
                      {submitting ? 'Creating...' : 'Create Market'}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 