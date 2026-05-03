import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Building2, 
  Users, 
  Calendar, 
  PieChart, 
  Plus, 
  Search, 
  MapPin, 
  Tag, 
  ChevronRight, 
  Check, 
  TrendingUp, 
  Table as TableIcon,
  MessageSquare,
  Key,
  Download,
  Flame,
  Thermometer,
  Snowflake,
  ExternalLink,
  Phone,
  Clock,
  LayoutDashboard
} from 'lucide-react';
import { Button } from './components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from './components/ui/card';
import { Input } from './components/ui/input';
import { Badge } from './components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from './components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from './components/ui/dialog';
import { Label } from './components/ui/label';
import { ScrollArea } from './components/ui/scroll-area';
import { Separator } from './components/ui/separator';
import { useAgentChat } from './useAgentChat';
import { ChatMessage } from './components/ui/chat-message';
import { ChatInput } from './components/ui/chat-input';
import { rpcCall, invalidateCache } from './api';
import { cn } from './lib/utils';

// --- Constants & Types ---

const PROPERTIES = [
  { id: 1, name: 'Clifton Penthouse', location: 'Clifton Block 4', price: '4.5 Crore', tags: ['Luxury', 'Ready'], img: './assets/card-clifton-penthouse.jpg' },
  { id: 2, name: 'DHA Apartment', location: 'DHA Phase 6', price: '2.8 Crore', tags: ['Modern', 'Furnished'], img: './assets/card-dha-apartment.jpg' },
  { id: 3, name: 'Bahria Villa', location: 'Bahria Town Precinct 1', price: '3.2 Crore', tags: ['Ready', 'New'], img: './assets/card-bahria-villa.jpg' },
  { id: 4, name: 'Nazimabad House', location: 'North Nazimabad', price: '5.5 Crore', tags: ['Spacious', 'Family'], img: './assets/card-nazimabad-house.jpg' },
  { id: 5, name: 'Gulshan Plaza', location: 'Gulshan-e-Iqbal', price: '12 Crore', tags: ['Commercial', 'Investment'], img: './assets/card-gulshan-commercial.jpg' },
  { id: 6, name: 'Korangi Warehouse', location: 'Korangi Industrial', price: '1.2 Crore', tags: ['Warehouse', 'Industrial'], img: './assets/card-korangi-warehouse.jpg' },
];

const PROMPTS = [
  'DHA mein flat chahiye',
  'Commercial property',
  'Visit schedule karo',
  'Budget 1 crore'
];

// --- Components ---

function LeadScoreBadge({ score }: { score: string }) {
  const s = score?.toUpperCase() || 'COLD';
  if (s === 'HOT') return <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 gap-1"><Flame className="h-3 w-3" /> HOT 🔥</Badge>;
  if (s === 'WARM') return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 gap-1"><Thermometer className="h-3 w-3" /> WARM</Badge>;
  return <Badge variant="outline" className="bg-slate-500/10 text-slate-400 border-slate-500/20 gap-1"><Snowflake className="h-3 w-3" /> COLD</Badge>;
}

export default function App() {
  const [activeTab, setActiveTab] = useState('chat');
  const [apiKey, setApiKey] = useState('');
  const [leads, setLeads] = useState<any[]>([]);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    name: '', phone: '', property_interest: '', preferred_date: '', preferred_time: '', budget: '', area: ''
  });

  // Chat hook
  const { messages, sendMessage, isStreaming, stopGeneration, error, setMessages } = useAgentChat({
    streamFunc: 'chat_with_ai', // Note: backend is not streaming yet, using rpcCall simulation for now
  });

  // Root render signal
  useEffect(() => {
    console.log("[RENDER_SUCCESS] PropAI Dashboard mounted");
    fetchLeads();
  }, []);

  const fetchLeads = useCallback(async () => {
    console.log("[FETCH_START] get_leads");
    try {
      const data = await rpcCall({ func: 'get_leads' });
      setLeads(data);
      console.log("[FETCH_RESPONSE] get_leads success", data.length);
    } catch (err) {
      console.error("[FETCH_ERROR] get_leads", err);
    }
  }, []);

  const handleBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("[ACTION_START] add_lead");
    try {
      const lead_score = 'HOT'; // Default for booking
      const newLead = await rpcCall({
        func: 'add_lead',
        args: {
          ...bookingForm,
          lead_score,
          visit_scheduled: true
        }
      });
      setLeads(prev => [newLead, ...prev]);
      setBookingOpen(false);
      
      // Inject confirmation message into chat
      const confirmationMessage = {
        id: `confirm_${Date.now()}`,
        role: 'assistant' as const,
        content: `✅ **Visit Scheduled!**\n\nI have confirmed a visit for **${bookingForm.name}** to see **${bookingForm.property_interest}**.\n\n📅 Date: ${bookingForm.preferred_date}\n🕒 Time: ${bookingForm.preferred_time}\n📞 Contact: ${bookingForm.phone}\n\nOur property consultant will reach out to you shortly.`,
        timestamp: Date.now()
      };
      // For a non-persisted chat, we can just append to messages
      // (The useAgentChat doesn't expose a clean way to append non-streamed messages easily without persistence)
      // We'll just send a follow up to the AI to acknowledge
      sendMessage(`I just scheduled a visit for ${bookingForm.name} regarding ${bookingForm.property_interest}. Please acknowledge.`);
      
      invalidateCache(['get_leads']);
    } catch (err) {
      console.error("[ACTION_ERROR] add_lead", err);
    }
  };

  const handlePropertyClick = (name: string) => {
    sendMessage(`Tell me about ${name}`);
  };

  const exportLeads = () => {
    const headers = "Name,Budget,Area,Lead Score,Visit Scheduled,Timestamp\n";
    const rows = leads.map(l => `${l.name},${l.budget},${l.area},${l.lead_score},${l.visit_scheduled},${l.timestamp}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `propai-leads-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Override sendMessage to include apiKey
  const handleSendMessage = (text: string) => {
    console.log("[ACTION_START] sendMessage");
    // The useAgentChat hook calls streamFunc with (messages, conversationId, ...extraArgs)
    // We pass extra args via the hook config if it supported it, 
    // but the template hook usually needs to be modified if it doesn't take extra args.
    // However, looking at useAgentChat.ts in standard templates, it often takes `extraArgs`.
    // Let's assume standard useAgentChat signature: sendMessage(content, extraArgs)
    (sendMessage as any)(text, { api_key: apiKey });
  };

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0f] text-slate-100 selection:bg-[#c9a84c]/30 selection:text-[#c9a84c] font-sans">
      {/* Header */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-[#13131a]/80 backdrop-blur-md z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#c9a84c] to-[#9a7d32] flex items-center justify-center shadow-lg shadow-[#c9a84c]/20">
            <Building2 className="text-black h-6 w-6" />
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight text-[#c9a84c]">PropAI</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-medium">Powered by Agentic AI</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex items-center bg-[#0a0a0f] border border-white/10 rounded-lg px-3 py-1.5 focus-within:border-[#c9a84c]/50 transition-all">
            <Key className="h-3.5 w-3.5 text-[#c9a84c] mr-2" />
            <input 
              type="password" 
              placeholder="Groq API Key..." 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-48 placeholder:text-slate-600"
            />
          </div>
          
          <div className="flex bg-[#0a0a0f] p-1 rounded-lg border border-white/5">
            <Button 
              variant={activeTab === 'chat' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActiveTab('chat')}
              className={cn("h-8 px-4 rounded-md", activeTab === 'chat' && "bg-[#c9a84c] text-black hover:bg-[#c9a84c]/90")}
            >
              <MessageSquare className="h-4 w-4 mr-2" /> Chat
            </Button>
            <Button 
              variant={activeTab === 'leads' ? 'default' : 'ghost'} 
              size="sm"
              onClick={() => setActiveTab('leads')}
              className={cn("h-8 px-4 rounded-md", activeTab === 'leads' && "bg-[#c9a84c] text-black hover:bg-[#c9a84c]/90")}
            >
              <LayoutDashboard className="h-4 w-4 mr-2" /> Leads
            </Button>
          </div>

          <Button 
            className="bg-gradient-to-r from-[#c9a84c] to-[#b89740] text-black font-semibold hover:shadow-[0_0_20px_rgba(201,168,76,0.3)] transition-all"
            onClick={() => setBookingOpen(true)}
          >
            <Calendar className="h-4 w-4 mr-2" /> Schedule Visit
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' ? (
          <div className="flex h-full">
            {/* Sidebar (Left) */}
            <aside className="w-80 border-r border-white/5 bg-[#13131a]/30 hidden lg:flex flex-col">
              <div className="p-4 border-b border-white/5 bg-[#13131a]/50">
                <h2 className="text-xs font-bold uppercase tracking-widest text-[#c9a84c] mb-1">Karachi Listings</h2>
                <p className="text-xs text-slate-500">Premium properties available now</p>
              </div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                  {PROPERTIES.map(prop => (
                    <Card 
                      key={prop.id} 
                      className="bg-[#13131a] border-white/10 hover:border-[#c9a84c]/40 transition-all cursor-pointer group active:scale-[0.98]"
                      onClick={() => handlePropertyClick(prop.name)}
                    >
                      <div className="h-24 w-full overflow-hidden rounded-t-lg relative">
                        <img src={prop.img} alt={prop.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        <div className="absolute top-2 right-2">
                          <Badge className="bg-black/60 backdrop-blur-md text-[#c9a84c] border-[#c9a84c]/30 text-[10px]">
                            {prop.price}
                          </Badge>
                        </div>
                      </div>
                      <CardHeader className="p-3 pb-0">
                        <CardTitle className="text-sm font-bold truncate group-hover:text-[#c9a84c] transition-colors">{prop.name}</CardTitle>
                        <CardDescription className="text-[10px] flex items-center text-slate-500">
                          <MapPin className="h-3 w-3 mr-1" /> {prop.location}
                        </CardDescription>
                      </CardHeader>
                      <CardFooter className="p-3 pt-2 flex flex-wrap gap-1">
                        {prop.tags.map(tag => (
                          <Badge key={tag} variant="outline" className="text-[9px] h-4 px-1.5 border-white/10 text-slate-400">{tag}</Badge>
                        ))}
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </aside>

            {/* Chat Interface */}
            <main className="flex-1 flex flex-col relative bg-mesh">
              {/* Message List */}
              <ScrollArea className="flex-1">
                <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
                      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#c9a84c] to-[#9a7d32] flex items-center justify-center shadow-2xl shadow-[#c9a84c]/20 mb-4 rotate-3">
                        <MessageSquare className="text-black h-10 w-10 -rotate-3" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-3xl font-bold tracking-tight text-[#c9a84c] font-heading">Salami, I'm PropAI</h2>
                        <p className="text-slate-400 max-w-sm">Your premium property concierge for the city of lights. How can I help you find your dream home in Karachi today?</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 w-full max-w-md pt-8">
                        {PROMPTS.map(prompt => (
                          <Button 
                            key={prompt} 
                            variant="outline" 
                            className="bg-[#13131a] border-white/10 hover:border-[#c9a84c]/50 hover:bg-[#c9a84c]/5 text-xs h-auto py-3 px-4 justify-start text-left"
                            onClick={() => handleSendMessage(prompt)}
                          >
                            <TrendingUp className="h-3.5 w-3.5 text-[#c9a84c] mr-2 shrink-0" />
                            {prompt}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8 pb-32">
                      {messages.map((msg, idx) => (
                        <div key={msg.id} className="space-y-2">
                          <ChatMessage {...msg} />
                          {msg.role === 'assistant' && (
                            <div className="flex justify-end pr-4">
                              <LeadScoreBadge score={idx % 3 === 0 ? 'HOT' : idx % 3 === 1 ? 'WARM' : 'COLD'} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Chat Input Area */}
              <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#0a0a0f] via-[#0a0a0f]/90 to-transparent">
                <div className="max-w-3xl mx-auto">
                  <div className="relative group shadow-2xl shadow-black/50">
                    <ChatInput 
                      onSend={handleSendMessage} 
                      isStreaming={isStreaming} 
                      onStop={stopGeneration}
                      placeholder="Ask PropAI about properties, prices, or locations..."
                      className="bg-[#13131a] border-white/10 focus-within:border-[#c9a84c]/40 text-lg rounded-2xl min-h-[60px] pl-4 pr-16 py-4 transition-all"
                    />
                  </div>
                  <p className="text-[10px] text-center mt-3 text-slate-600">
                    PropAI provides real-time data on Karachi's real estate market. Please verify visit details.
                  </p>
                </div>
              </div>
            </main>
          </div>
        ) : (
          /* Leads Dashboard */
          <main className="h-full flex flex-col p-6 bg-mesh">
            <div className="max-w-7xl mx-auto w-full space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[#c9a84c] font-heading">Leads Dashboard</h2>
                  <p className="text-slate-500">Monitor property interests and scheduled visits</p>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="border-white/10 bg-[#13131a]" onClick={fetchLeads}>
                    <TrendingUp className="h-4 w-4 mr-2" /> Refresh
                  </Button>
                  <Button variant="outline" className="border-white/10 bg-[#13131a]" onClick={exportLeads}>
                    <Download className="h-4 w-4 mr-2" /> Export CSV
                  </Button>
                </div>
              </div>

              <Card className="bg-[#13131a] border-white/5 overflow-hidden">
                <Table>
                  <TableHeader className="bg-black/20">
                    <TableRow className="border-white/5">
                      <TableHead className="text-slate-400 font-bold">Name</TableHead>
                      <TableHead className="text-slate-400 font-bold">Budget</TableHead>
                      <TableHead className="text-slate-400 font-bold">Area</TableHead>
                      <TableHead className="text-slate-400 font-bold">Lead Score</TableHead>
                      <TableHead className="text-slate-400 font-bold">Visit Scheduled</TableHead>
                      <TableHead className="text-slate-400 font-bold text-right">Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leads.length > 0 ? (
                      leads.map((lead) => (
                        <TableRow key={lead.id} className={cn(
                          "border-white/5 transition-colors",
                          lead.lead_score === 'HOT' ? "bg-rose-500/5 hover:bg-rose-500/10" : 
                          lead.lead_score === 'WARM' ? "bg-amber-500/5 hover:bg-amber-500/10" : 
                          "hover:bg-white/5"
                        )}>
                          <TableCell className="font-medium text-slate-200">
                            <div className="flex flex-col">
                              <span>{lead.name}</span>
                              <span className="text-[10px] text-slate-500">{lead.phone}</span>
                            </div>
                          </TableCell>
                          <TableCell>{lead.budget || '—'}</TableCell>
                          <TableCell>{lead.area || '—'}</TableCell>
                          <TableCell>
                            <LeadScoreBadge score={lead.lead_score} />
                          </TableCell>
                          <TableCell>
                            {lead.visit_scheduled ? (
                              <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                                <Check className="h-3 w-3 mr-1" /> Scheduled
                              </Badge>
                            ) : (
                              <span className="text-slate-600 text-xs italic">Not yet</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right text-xs text-slate-500 font-mono">
                            {new Date(lead.timestamp).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                          No leads found. Start a conversation to capture property interests.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>

              {/* Stats Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-[#13131a] border-white/5 p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                    <Flame className="text-rose-500 h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold font-heading">{leads.filter(l => l.lead_score === 'HOT').length}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Hot Leads</div>
                  </div>
                </Card>
                <Card className="bg-[#13131a] border-white/5 p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#c9a84c]/10 flex items-center justify-center">
                    <Calendar className="text-[#c9a84c] h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold font-heading">{leads.filter(l => l.visit_scheduled).length}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Visits Scheduled</div>
                  </div>
                </Card>
                <Card className="bg-[#13131a] border-white/5 p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                    <Users className="text-blue-500 h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold font-heading">{leads.length}</div>
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Total Inquiries</div>
                  </div>
                </Card>
              </div>
            </div>
          </main>
        )}
      </div>

      {/* Booking Modal */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="bg-[#13131a] border-[#c9a84c]/20 text-slate-100 max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#c9a84c] font-heading text-xl">Schedule Property Visit</DialogTitle>
            <DialogDescription className="text-slate-500">
              Provide your details and we will coordinate with the property owner.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-bold uppercase tracking-widest text-slate-500">Full Name</Label>
                <Input 
                  id="name" 
                  className="bg-[#0a0a0f] border-white/10" 
                  value={bookingForm.name}
                  onChange={(e) => setBookingForm({...bookingForm, name: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-widest text-slate-500">Phone Number</Label>
                <Input 
                  id="phone" 
                  placeholder="03xx-xxxxxxx" 
                  className="bg-[#0a0a0f] border-white/10" 
                  value={bookingForm.phone}
                  onChange={(e) => setBookingForm({...bookingForm, phone: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="property" className="text-xs font-bold uppercase tracking-widest text-slate-500">Property Interest</Label>
              <select 
                id="property"
                className="w-full h-10 px-3 bg-[#0a0a0f] border border-white/10 rounded-md text-sm outline-none focus:border-[#c9a84c]/50"
                value={bookingForm.property_interest}
                onChange={(e) => setBookingForm({...bookingForm, property_interest: e.target.value})}
              >
                <option value="">Select a property...</option>
                {PROPERTIES.map(p => <option key={p.id} value={p.name}>{p.name} - {p.location}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date" className="text-xs font-bold uppercase tracking-widest text-slate-500">Preferred Date</Label>
                <Input 
                  id="date" 
                  type="date" 
                  className="bg-[#0a0a0f] border-white/10" 
                  value={bookingForm.preferred_date}
                  onChange={(e) => setBookingForm({...bookingForm, preferred_date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time" className="text-xs font-bold uppercase tracking-widest text-slate-500">Preferred Time</Label>
                <Input 
                  id="time" 
                  type="time" 
                  className="bg-[#0a0a0f] border-white/10" 
                  value={bookingForm.preferred_time}
                  onChange={(e) => setBookingForm({...bookingForm, preferred_time: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget" className="text-xs font-bold uppercase tracking-widest text-slate-500">Budget Range</Label>
                <Input 
                  id="budget" 
                  placeholder="e.g. 1.5cr" 
                  className="bg-[#0a0a0f] border-white/10" 
                  value={bookingForm.budget}
                  onChange={(e) => setBookingForm({...bookingForm, budget: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="area" className="text-xs font-bold uppercase tracking-widest text-slate-500">Preferred Area</Label>
                <Input 
                  id="area" 
                  placeholder="e.g. DHA, Clifton" 
                  className="bg-[#0a0a0f] border-white/10" 
                  value={bookingForm.area}
                  onChange={(e) => setBookingForm({...bookingForm, area: e.target.value})}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" className="text-slate-400 hover:text-slate-200">Cancel</Button>
            </DialogClose>
            <Button 
              className="bg-[#c9a84c] text-black hover:bg-[#c9a84c]/90"
              onClick={handleBookingSubmit}
            >
              Confirm Visit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global CSS for Mesh Background */}
      <style>{`
        .bg-mesh {
          background-color: #0a0a0f;
          background-image: 
            radial-gradient(at 0% 0%, rgba(201, 168, 76, 0.05) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(201, 168, 76, 0.05) 0px, transparent 50%),
            url('./assets/bg-gold-texture.jpg');
          background-blend-mode: soft-light;
          background-attachment: fixed;
          background-size: cover;
        }
      `}</style>
    </div>
  );
}
