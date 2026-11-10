import { useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';
import { Check, Send, LogOut } from 'lucide-react';
import {
  Activity,
  ArrowUpRight,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock3,
  Download,
  Filter,
  Flag,
  Globe2,
  LayoutDashboard,
  Link2,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  Users,
  X,
  Shield,
  UserCog,
  Zap,
  type LucideIcon,
} from 'lucide-react';

type Status = 'new' | 'contacted' | 'relance_1' | 'relance_2' | 'not_interested' | 'interested' | 'registration_pending' | 'registered' | 'next_cohort' | 'other_formation';
type Lead = { id: string; name: string; initials: string; phone: string; ambassador: string; source: string; status: Status; created: string; followUp?: string; color: string; formationId?: string | null };

const statusMeta: Record<Status, { label: string; tone: string; dot: string }> = {
  new: { label: 'Nouveaux', tone: 'bg-slate-100 text-slate-700', dot: 'bg-slate-500' },
  contacted: { label: 'Contactés', tone: 'bg-sky-50 text-sky-700', dot: 'bg-sky-500' },
  relance_1: { label: 'Relance 1', tone: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  relance_2: { label: 'Relance 2', tone: 'bg-orange-50 text-orange-700', dot: 'bg-orange-500' },
  not_interested: { label: 'Pas intéressés', tone: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  interested: { label: 'Intéressés', tone: 'bg-fuchsia-50 text-fuchsia-700', dot: 'bg-fuchsia-500' },
  registration_pending: { label: 'Suivis', tone: 'bg-violet-50 text-violet-700', dot: 'bg-violet-500' },
  registered: { label: 'Inscrits', tone: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  next_cohort: { label: 'Prochaine cohorte', tone: 'bg-cyan-50 text-cyan-700', dot: 'bg-cyan-500' },
  other_formation: { label: 'Autre formation', tone: 'bg-teal-50 text-teal-700', dot: 'bg-teal-500' },
};

const allNavItems: { label: string; icon: LucideIcon; count?: string }[] = [
  { label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { label: 'Prospects', icon: Users },
  { label: 'Pipeline', icon: Target },
  { label: 'Ambassadeurs', icon: UserRound },
  { label: 'Formations', icon: BookOpen },
  { label: 'Campagnes', icon: Zap },
  { label: 'Relances', icon: Clock3 },
  { label: 'Activités', icon: Activity },
  { label: 'Rapports', icon: TrendingUp },
  { label: 'Administration', icon: Shield },
];
const ambassadorNavItems: { label: string; icon: LucideIcon; count?: string }[] = [
  { label: 'Vue d\'ensemble', icon: LayoutDashboard },
  { label: 'Prospects', icon: Users },
  { label: 'Pipeline', icon: Target },
];

function App() {
  const [activeNav, setActiveNav] = useState('Vue d\'ensemble');
  const [session, setSession] = useState<Session | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [query, setQuery] = useState('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadFormFormationId, setLeadFormFormationId] = useState<string | null>(null);
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [pendingMove, setPendingMove] = useState<{ status: Status; leadId: string } | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'commercial' | 'ambassador'>('commercial');
  const [profileName, setProfileName] = useState('');
  const isAmbassador = userRole === 'ambassador';
  const navItems = isAmbassador ? ambassadorNavItems : allNavItems;

  const refCode = useMemo(() => new URLSearchParams(window.location.search).get('ref'), []);
  const isReferralPage = Boolean(refCode);

  useEffect(() => {
    let mounted = true;
    const loadLeads = async () => {
      setDataLoading(true);
      setLoadError('');
      const { data, error } = await supabase.from('leads').select('id, first_name, last_name, phone, source, status, created_at, next_follow_up_at, formation_id').order('created_at', { ascending: false });
      if (!mounted) return;
      if (error) {
        setLoadError('Les prospects ne peuvent pas être chargés pour le moment.');
        setLeads([]);
      } else {
        setLeads((data ?? []).map((row) => {
          const name = `${row.first_name} ${row.last_name}`.trim();
          const legacyStatusMap: Record<string, Status> = { to_contact: 'new', follow_up: 'relance_1', unreachable: 'not_interested', lost: 'not_interested' };
          const status = legacyStatusMap[row.status] ?? (Object.keys(statusMeta).includes(row.status) ? row.status as Status : 'new');
          return { id: row.id, name, initials: name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(), phone: row.phone || 'Téléphone non renseigné', ambassador: 'Attribution enregistrée', source: row.source || 'Direct', status, created: new Date(row.created_at).toLocaleDateString('fr-FR'), followUp: row.next_follow_up_at ? new Date(row.next_follow_up_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : undefined, color: 'bg-sky-100 text-sky-700', formationId: row.formation_id ?? null };
        }));
      }
      setDataLoading(false);
    };
    const loadProfile = async (uid: string) => {
      const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', uid).maybeSingle();
      if (!mounted) return;
      if (profile) {
        setProfileName(profile.full_name || '');
        setUserRole((profile.role as typeof userRole) || 'commercial');
      }
    };
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!mounted) return;
      setSession(currentSession);
      setAuthLoading(false);
      if (currentSession) { void loadLeads(); void loadProfile(currentSession.user.id); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, currentSession) => {
      if (!mounted) return;
      setSession(currentSession);
      setAuthLoading(false);
      if (currentSession) { void loadLeads(); void loadProfile(currentSession.user.id); }
      else { setLeads([]); setProfileName(''); setUserRole('commercial'); }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [refreshKey]);

  const filteredLeads = useMemo(() => leads.filter((lead) => lead.name.toLowerCase().includes(query.toLowerCase()) || lead.phone.includes(query)), [leads, query]);
  const interestedCount = leads.filter((lead) => lead.status === 'interested').length;
  const followUpCount = leads.filter((lead) => lead.status === 'relance_1' || lead.status === 'relance_2').length;
  const registeredCount = leads.filter((lead) => lead.status === 'registered').length;
  const conversionRate = leads.length ? `${((registeredCount / leads.length) * 100).toFixed(1).replace('.', ',')}%` : '0%';
  const moveLead = async (status: Status, leadId = draggedLead) => {
    if (leadId === null) return;
    setDraggedLead(null);
    setPendingMove({ status, leadId });
  };
  const confirmMove = async (dueDateIso: string, comment: string) => {
    if (!pendingMove) return;
    const { leadId, status } = pendingMove;
    const { error } = await supabase.from('leads').update({ status, next_follow_up_at: dueDateIso || null }).eq('id', leadId);
    if (error) { setLoadError('Le statut n\'a pas pu être enregistré.'); setPendingMove(null); return; }
    const lead = leads.find((l) => l.id === leadId);
    const activityContent = `${lead?.status ? statusMeta[lead.status].label : '—'} → ${statusMeta[status].label}${comment ? ` : ${comment}` : ''}`;
    await supabase.from('lead_activities').insert({ lead_id: leadId, actor_id: session?.user.id ?? null, type: 'status_changed', content: activityContent });
    setLeads((current) => current.map((l) => l.id === leadId ? { ...l, status, followUp: dueDateIso ? new Date(dueDateIso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : undefined } : l));
    setPendingMove(null);
  };

  if (isReferralPage) return <PublicReferralPage refCode={refCode!} />;

  if (authLoading) return <LoadingScreen />;
  if (!session) return <AuthScreen />;

  return (
    <div className="min-h-screen bg-[#f6f8fb] text-[#193847]">
      <div className={`fixed inset-0 z-30 bg-[#102f3c]/40 transition-opacity lg:hidden ${mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={() => setMobileOpen(false)} />
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[268px] flex-col bg-[#173d4d] text-white shadow-2xl transition-transform lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-24 items-center gap-3 border-b border-white/10 px-7">
          <div className="grid h-11 w-11 place-items-center rounded-xl border border-white/30 bg-white/10 text-sm font-bold tracking-tight">H3E</div>
          <div><p className="text-[15px] font-semibold tracking-wide">H3E CRM</p><p className="mt-0.5 text-[11px] text-white/50">Espace commercial</p></div>
          <button onClick={() => setMobileOpen(false)} className="ml-auto rounded-lg p-2 text-white/60 lg:hidden"><X size={18} /></button>
        </div>
        <div className="px-4 pt-8"><p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-white/35">Menu principal</p><nav className="mt-3 space-y-1">{navItems.map((item) => { const Icon = item.icon; const active = activeNav === item.label; return <button key={item.label} onClick={() => { setActiveNav(item.label); setMobileOpen(false); }} className={`group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] transition ${active ? 'bg-[#c600cb] font-semibold text-white shadow-lg shadow-fuchsia-950/20' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}><Icon size={17} strokeWidth={active ? 2.4 : 1.8} /><span className="flex-1">{item.label}</span>{(item.label === 'Prospects' || item.label === 'Relances') && <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? 'bg-white/20' : 'bg-white/10 text-white/50'}`}>{item.label === 'Prospects' ? leads.length : followUpCount}</span>}</button>; })}</nav></div>
        <div className="mt-auto p-4">{!isAmbassador && <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4"><div className="flex items-center gap-2 text-xs font-medium"><Sparkles size={14} className="text-fuchsia-300" /> Conseil du jour</div><p className="mt-3 text-[12px] leading-5 text-white/60">Vous avez {followUpCount} relance{followUpCount > 1 ? 's' : ''} à traiter pour garder votre pipeline actif.</p><button className="mt-4 text-[11px] font-semibold text-fuchsia-300">Voir mes relances <span aria-hidden="true">→</span></button></div>}<div className="flex items-center gap-3 border-t border-white/10 pt-5"><div className="grid h-9 w-9 place-items-center rounded-full bg-[#d9a6db] text-xs font-bold text-[#713271]">{(profileName || 'U').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">{profileName || 'Utilisateur'}</p><p className="text-[11px] text-white/40">{isAmbassador ? 'Ambassadeur' : 'Administrateur'}</p></div><button onClick={() => supabase.auth.signOut()} className="rounded-lg p-2 text-white/50 transition hover:bg-white/10 hover:text-white" title="Se déconnecter"><LogOut size={16} /></button></div></div>
      </aside>

      <main className="lg:pl-[268px]">
        <header className="sticky top-0 z-20 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/90 px-5 backdrop-blur-xl sm:px-8 lg:px-10">
          <div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-[#173d4d] lg:hidden"><Menu size={21} /></button><div><p className="text-xs text-slate-400">Mercredi 03 octobre 2026</p><h1 className="mt-0.5 text-lg font-bold tracking-tight text-[#173d4d]">Bonjour {profileName || 'Koffi'}, <span className="text-[#c600cb]">voici votre activité.</span></h1></div></div>
          <div className="flex items-center gap-3">{!isAmbassador && <><button className="relative hidden rounded-xl border border-slate-200 p-2.5 text-slate-500 transition hover:border-fuchsia-200 hover:text-[#c600cb] sm:block"><Bell size={18} /><span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-[#c600cb]" /></button><div className="hidden h-8 w-px bg-slate-200 sm:block" /></>}<button onClick={() => { setLeadFormFormationId(null); setShowLeadForm(true); }} className="flex items-center gap-2 rounded-xl bg-[#c600cb] px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-200 transition hover:-translate-y-0.5 hover:bg-[#aa00ae]"><Plus size={16} /> <span className="hidden sm:inline">Nouveau prospect</span><span className="sm:hidden">Nouveau</span></button></div>
        </header>
        {loadError && <div className="mx-5 mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700 sm:mx-8 lg:mx-10">{loadError}</div>}
        {dataLoading && <div className="mx-5 mt-5 rounded-xl border border-sky-100 bg-sky-50 px-4 py-3 text-xs font-medium text-sky-700 sm:mx-8 lg:mx-10">Actualisation des prospects...</div>}

        {activeNav === 'Vue d\'ensemble' ? <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">
          <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2 text-xs font-semibold text-[#c600cb]"><span className="h-1.5 w-1.5 rounded-full bg-[#c600cb]" /> VUE D'ENSEMBLE</div><h2 className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#173d4d]">Pilotez votre croissance</h2><p className="mt-1 text-sm text-slate-500">Suivez vos prospects et transformez chaque opportunité en inscription.</p></div><div className="flex gap-2"><button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 shadow-sm"><CalendarDays size={15} /> Cette semaine <ChevronDown size={14} /></button><button className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 shadow-sm sm:flex"><Download size={15} /> Exporter</button></div></div>

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Total prospects" value={String(leads.length)} change="Données réelles" detail="dans votre espace" icon={Users} color="blue" />
            <KpiCard label="Prospects intéressés" value={String(interestedCount)} change="Données réelles" detail="dans votre pipeline" icon={Target} color="pink" />
            <KpiCard label="Inscriptions confirmées" value={String(registeredCount)} change="Données réelles" detail="dans votre espace" icon={Flag} color="green" />
            <KpiCard label="Taux de conversion" value={conversionRate} change="Calcul automatique" detail="prospect → inscrit" icon={TrendingUp} color="orange" />
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between"><div><h3 className="text-sm font-bold text-[#173d4d]">Nouveaux prospects</h3><p className="mt-1 text-xs text-slate-400">Évolution des 7 derniers jours</p></div><button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"><MoreHorizontal size={18} /></button></div><div className="mt-5 flex items-end gap-3"><span className="text-3xl font-bold tracking-tight text-[#173d4d]">46</span><span className="mb-1 flex items-center gap-1 text-xs font-semibold text-emerald-600"><ArrowUpRight size={14} /> 18.4%</span></div><div className="mt-5 flex h-[145px] items-end gap-2 border-b border-slate-100 px-1 sm:gap-4">{[38, 56, 48, 72, 54, 88, 68, 100, 80, 94, 75, 90].map((height, index) => <div key={index} className="group relative flex h-full flex-1 items-end"><div style={{ height: `${height}%` }} className={`w-full rounded-t-md transition-all duration-500 ${index === 7 ? 'bg-[#c600cb]' : 'bg-[#d9eef1] group-hover:bg-[#a9dadd]'}`} /></div>)}</div><div className="mt-3 flex justify-between text-[10px] text-slate-400"><span>28 sept.</span><span>03 oct.</span></div></div>
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-start justify-between"><div><h3 className="text-sm font-bold text-[#173d4d]">Répartition des sources</h3><p className="mt-1 text-xs text-slate-400">Origine de vos prospects</p></div><button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"><MoreHorizontal size={18} /></button></div><div className="mt-6 flex items-center gap-5"><div className="relative grid h-32 w-32 shrink-0 place-items-center rounded-full" style={{ background: 'conic-gradient(#c600cb 0 38%, #2b7682 38% 62%, #f2a84b 62% 79%, #b9dfe2 79% 91%, #e8eef2 91% 100%)' }}><div className="grid h-20 w-20 place-items-center rounded-full bg-white"><span className="text-xl font-bold text-[#173d4d]">128</span></div></div><div className="min-w-0 flex-1 space-y-3">{[['WhatsApp', '38%', '#c600cb'], ['Facebook', '24%', '#2b7682'], ['Instagram', '17%', '#f2a84b'], ['Website', '12%', '#b9dfe2']].map(([name, value, color]) => <div key={name} className="flex items-center gap-2 text-xs"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /><span className="flex-1 text-slate-500">{name}</span><span className="font-bold text-[#173d4d]">{value}</span></div>)}</div></div></div>
          </section>

          <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm"><div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><h3 className="text-sm font-bold text-[#173d4d]">Pipeline commercial</h3><p className="mt-1 text-xs text-slate-400">Glissez les prospects pour mettre à jour leur étape</p></div><div className="flex items-center gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher..." className="h-9 w-40 rounded-lg border border-slate-200 pl-9 pr-3 text-xs outline-none placeholder:text-slate-400 focus:border-[#c600cb] sm:w-52" /></div><button className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"><Filter size={15} /></button><button className="hidden rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 sm:block"><SlidersHorizontal size={15} /></button></div></div><div className="grid gap-3 overflow-x-auto p-4 sm:grid-cols-3 xl:grid-cols-10">{(Object.keys(statusMeta) as Status[]).map((status) => <PipelineColumn key={status} status={status} leads={filteredLeads.filter((lead) => lead.status === status)} onDragStart={(event, leadId) => { event.dataTransfer.effectAllowed = 'move'; setDraggedLead(leadId); }} onDrop={() => moveLead(status)} />)}</div></section>

          {!isAmbassador && <section className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><h3 className="text-sm font-bold text-[#173d4d]">Activité récente</h3><p className="mt-1 text-xs text-slate-400">Les dernières actions de l'équipe</p></div><button className="text-xs font-semibold text-[#c600cb]">Tout voir</button></div><div className="mt-5 space-y-4">{([{ name: 'Aminata Ouédraogo', action: 'Nouveau prospect créé via WhatsApp', time: 'Il y a 12 min', tone: 'bg-fuchsia-100 text-fuchsia-700', Icon: UserRound }, { name: 'Adama Diallo', action: 'Statut modifié vers Intéressé', time: 'Il y a 48 min', tone: 'bg-blue-100 text-blue-700', Icon: Target }, { name: 'Souleymane Sawadogo', action: 'Inscription confirmée', time: 'Il y a 2 h', tone: 'bg-emerald-100 text-emerald-700', Icon: Flag }] satisfies { name: string; action: string; time: string; tone: string; Icon: LucideIcon }[]).map(({ name, action, time, tone, Icon }) => <div key={name} className="flex items-center gap-3"><div className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`}><Icon size={16} /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-[#173d4d]">{action}</p><p className="mt-0.5 text-[11px] text-slate-400">{name} · {time}</p></div><MoreHorizontal size={16} className="text-slate-300" /></div>)}</div></div><div className="rounded-2xl bg-[#173d4d] p-5 text-white shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fuchsia-300">Performance équipe</p><h3 className="mt-2 text-lg font-bold">Vos ambassadeurs</h3></div><button className="rounded-lg bg-white/10 p-2 text-white/70"><MoreHorizontal size={17} /></button></div><div className="mt-6 space-y-4">{[['Awa Sawadogo', '42 prospects', '75%', 'bg-fuchsia-400'], ['Karim Zongo', '36 prospects', '61%', 'bg-sky-400'], ['Ibrahim Nikiéma', '28 prospects', '48%', 'bg-amber-400']].map(([name, total, progress, bar]) => <div key={name as string}><div className="mb-2 flex items-center justify-between text-xs"><span className="font-medium text-white/80">{name as string}</span><span className="text-white/45">{total as string}</span></div><div className="h-1.5 rounded-full bg-white/10"><div className={`h-full rounded-full ${bar}`} style={{ width: progress }} /></div></div>)}</div><button className="mt-6 flex items-center gap-2 text-xs font-semibold text-fuchsia-300">Voir le classement <ArrowUpRight size={14} /></button></div></section>}
        </div> : <SectionView activeNav={activeNav} leads={filteredLeads} query={query} setQuery={setQuery} onAddLead={(formationId) => { setLeadFormFormationId(formationId); setShowLeadForm(true); }} onMoveLead={moveLead} isAmbassador={isAmbassador} />}
      </main>
      {showLeadForm && <LeadForm initialFormationId={leadFormFormationId} onClose={() => setShowLeadForm(false)} onSaved={() => { setShowLeadForm(false); setLeadFormFormationId(null); setRefreshKey((value) => value + 1); }} isAmbassador={isAmbassador} userId={session?.user.id} />}
      {pendingMove && <DueDateModal leadName={leads.find((l) => l.id === pendingMove.leadId)?.name ?? 'Prospect'} targetLabel={statusMeta[pendingMove.status].label} onCancel={() => setPendingMove(null)} onConfirm={confirmMove} />}
    </div>
  );
}

const ambassadorColors = ['bg-fuchsia-100 text-fuchsia-700', 'bg-blue-100 text-blue-700', 'bg-amber-100 text-amber-700', 'bg-emerald-100 text-emerald-700', 'bg-cyan-100 text-cyan-700', 'bg-rose-100 text-rose-700'];
type Ambassador = { id: string; name: string; code: string; clicks: number; leads: number; registered: number };

function AmbassadorsView({ copy }: { copy: { eyebrow: string; title: string; description: string } }) {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase.from('ambassador_stats').select('id, name, code, click_count, lead_count, registered_count').order('lead_count', { ascending: false });
      if (!mounted) return;
      if (fetchError) { setError('Les ambassadeurs ne peuvent pas être chargés pour le moment.'); setAmbassadors([]); }
      else setAmbassadors((data ?? []).map((row) => ({ id: row.id, name: row.name, code: row.code, clicks: row.click_count ?? 0, leads: row.lead_count ?? 0, registered: row.registered_count ?? 0 })));
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [refreshKey]);
  const header = <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2 text-xs font-semibold text-[#c600cb]"><span className="h-1.5 w-1.5 rounded-full bg-[#c600cb]" /> {copy.eyebrow}</div><h2 className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#173d4d]">{copy.title}</h2><p className="mt-1 text-sm text-slate-500">{copy.description}</p></div><div className="flex gap-2"><button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 shadow-sm"><CalendarDays size={15} /> Cette semaine <ChevronDown size={14} /></button><button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-[#c600cb] px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-200"><Plus size={15} /> Nouvel ambassadeur</button></div></div>;
  if (loading) return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="grid place-items-center py-20"><div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#c600cb]" /></div></div>;
  if (error) return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">{error}</div></div>;
  if (ambassadors.length === 0) return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center"><p className="text-sm font-semibold text-[#173d4d]">Aucun ambassadeur enregistré</p><p className="mt-2 text-xs text-slate-400">Cliquez sur « Nouvel ambassadeur » pour ajouter votre premier partenaire.</p></div>{showForm && <AmbassadorForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); setRefreshKey((v) => v + 1); }} />}</div>;
  return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="grid gap-4 md:grid-cols-3">{ambassadors.map((ambassador, index) => <div key={ambassador.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className={`grid h-11 w-11 place-items-center rounded-xl text-xs font-bold ${ambassadorColors[index % ambassadorColors.length]}`}>{ambassador.name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</div><div><h3 className="text-sm font-bold text-[#173d4d]">{ambassador.name}</h3><p className="mt-1 text-[11px] font-semibold text-[#c600cb]">{ambassador.code}</p></div></div><button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"><MoreHorizontal size={17} /></button></div><div className="mt-6 grid grid-cols-3 divide-x divide-slate-100 border-t border-slate-100 pt-4 text-center"><div><p className="text-lg font-bold text-[#173d4d]">{ambassador.clicks}</p><p className="mt-1 text-[10px] text-slate-400">Clics</p></div><div><p className="text-lg font-bold text-[#173d4d]">{ambassador.leads}</p><p className="mt-1 text-[10px] text-slate-400">Prospects</p></div><div><p className="text-lg font-bold text-emerald-600">{ambassador.registered}</p><p className="mt-1 text-[10px] text-slate-400">Inscrits</p></div></div><CopyLinkButton code={ambassador.code} /></div>)}</div>{showForm && <AmbassadorForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); setRefreshKey((v) => v + 1); }} />}</div>;
}

function AmbassadorForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState({ name: '', email: '', phone: '', code: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const autoCode = values.name.trim() ? values.name.trim().split(/\s+/)[0].toUpperCase().slice(0, 5) + new Date().getFullYear() : '';
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError('');
    const code = values.code.trim() || autoCode;
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-ambassador-account`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${currentSession?.access_token}` },
      body: JSON.stringify({ email: values.email.trim(), password: values.password, name: values.name.trim(), phone: values.phone.trim(), code }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.success) setError(result?.error || 'L\'ambassadeur n\'a pas pu être créé.');
    else onSaved();
    setSaving(false);
  };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#102f3c]/45 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c600cb]">Nouvel ambassadeur</p><h2 className="mt-2 text-xl font-bold text-[#173d4d]">Ajouter un ambassadeur</h2><p className="mt-1 text-xs text-slate-400">Un compte de connexion sera créé pour l\'ambassadeur avec le rôle approprié.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X size={18} /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Nom complet<input value={values.name} onChange={(event) => update('name', event.target.value)} className="field" placeholder="Awa Sawadogo" required /></label><label className="text-xs font-semibold text-slate-600">Email<input type="email" value={values.email} onChange={(event) => update('email', event.target.value)} className="field" placeholder="awa@exemple.com" required /></label><label className="text-xs font-semibold text-slate-600">Téléphone<input value={values.phone} onChange={(event) => update('phone', event.target.value)} className="field" placeholder="+226 70 00 00 00" /></label><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Mot de passe <span className="font-normal text-slate-400">(connexion ambassadeur)</span><input type="password" value={values.password} onChange={(event) => update('password', event.target.value)} className="field" placeholder="••••••••" minLength={6} required /></label><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Code de parrainage <span className="font-normal text-slate-400">(optionnel)</span><input value={values.code} onChange={(event) => update('code', event.target.value)} className="field" placeholder={autoCode || 'AWA2026'} /></label></div>{error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50">Annuler</button><button disabled={saving} className="rounded-xl bg-[#c600cb] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-200 hover:bg-[#aa00ae] disabled:opacity-60">{saving ? 'Création...' : 'Créer l\'ambassadeur'}</button></div></form></div>;
}

type FormationOption = { id: string; name: string };

function FormationGroupedView({ mode, header, leads, query, setQuery, onMoveLead, onAddLead }: { mode: 'prospects' | 'pipeline'; header: JSX.Element; leads: Lead[]; query?: string; setQuery?: (value: string) => void; onMoveLead?: (status: Status, leadId?: string | null) => void; onAddLead: (formationId: string | null) => void }) {
  const [formations, setFormations] = useState<FormationOption[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.from('formations').select('id, name').order('name', { ascending: true });
      if (!mounted) return;
      const loaded = data ?? [];
      setFormations(loaded);
      setExpanded(new Set(loaded.map((formation) => formation.id).concat('unassigned')));
    })();
    return () => { mounted = false; };
  }, []);
  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const formationLeads = (formationId: string | null) => leads.filter((lead) => formationId ? lead.formationId === formationId : !lead.formationId);
  const grouped = [...formations.map((formation) => ({ id: formation.id, name: formation.name, leads: formationLeads(formation.id) })), { id: 'unassigned', name: 'Sans formation', leads: formationLeads(null) }].filter((group) => group.leads.length > 0 || group.id !== 'unassigned' || formations.length === 0);
  const leadTable = (items: Lead[]) => <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-bold">Prospect</th><th className="px-5 py-3 font-bold">Ambassadeur</th><th className="px-5 py-3 font-bold">Source</th><th className="px-5 py-3 font-bold">Statut</th><th className="px-5 py-3 font-bold">Créé le</th></tr></thead><tbody className="divide-y divide-slate-100">{items.map((lead) => <tr key={lead.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className={`grid h-9 w-9 place-items-center rounded-xl text-[10px] font-bold ${lead.color}`}>{lead.initials}</div><div><p className="text-xs font-bold text-[#173d4d]">{lead.name}</p><p className="mt-0.5 text-[11px] text-slate-400">{lead.phone}</p></div></div></td><td className="px-5 py-4 text-xs text-slate-600">{lead.ambassador}</td><td className="px-5 py-4 text-xs text-slate-500">{lead.source}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusMeta[lead.status].tone}`}>{statusMeta[lead.status].label}</span></td><td className="px-5 py-4 text-xs text-slate-500">{lead.created}</td></tr>)}</tbody></table></div>;
  return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{header}{mode === 'prospects' && <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} /><input value={query} onChange={(event) => setQuery?.(event.target.value)} placeholder="Rechercher par nom ou téléphone" className="h-10 w-full rounded-xl border border-slate-200 pl-9 pr-3 text-xs outline-none focus:border-[#c600cb] sm:w-80" /></div><span className="text-xs font-semibold text-slate-500">{leads.length} prospect{leads.length > 1 ? 's' : ''}</span></div>}{mode === 'pipeline' && <div className="mb-5 flex items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-4 text-xs font-semibold text-slate-600 shadow-sm"><Filter size={15} className="text-[#c600cb]" /> Les prospects sont regroupés par formation</div>}<div className="space-y-4">{grouped.map((group) => { const isOpen = expanded.has(group.id); return <section key={group.id} className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"><div className="flex items-center gap-4 p-5"><button onClick={() => toggle(group.id)} className="flex min-w-0 flex-1 items-center gap-4 text-left transition hover:opacity-80"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#c600cb]/10 text-[#c600cb]"><BookOpen size={19} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[#173d4d]">{group.name}</span><span className="mt-1 block text-xs text-slate-400">{group.leads.length} prospect{group.leads.length > 1 ? 's' : ''}</span></span><ChevronDown size={18} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} /></button><button onClick={() => onAddLead(group.id === 'unassigned' ? null : group.id)} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#c600cb] px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#aa00ae]"><Plus size={14} /> <span className="hidden sm:inline">Nouveau prospect</span><span className="sm:hidden">Nouveau</span></button></div>{isOpen && <div className="border-t border-slate-100 p-4">{mode === 'prospects' ? leadTable(group.leads) : <div className="grid gap-3 overflow-x-auto sm:grid-cols-3 xl:grid-cols-7">{(Object.keys(statusMeta) as Status[]).map((status) => <PipelineColumn key={status} status={status} leads={group.leads.filter((lead) => lead.status === status)} onDragStart={(event, leadId) => { event.dataTransfer.effectAllowed = 'move'; setDraggedLead(leadId); }} onDrop={() => { if (draggedLead !== null) { onMoveLead?.(status, draggedLead); setDraggedLead(null); } }} />)}</div>}</div>}</section>; })}</div></div>;
}

function SectionView({ activeNav, leads, query, setQuery, onAddLead, onMoveLead, isAmbassador }: { activeNav: string; leads: Lead[]; query: string; setQuery: (value: string) => void; onAddLead: (formationId: string | null) => void; onMoveLead: (status: Status, leadId?: string | null) => void; isAmbassador: boolean }) {
  const pageCopy: Record<string, { eyebrow: string; title: string; description: string }> = {
    Prospects: { eyebrow: 'GESTION DES PROSPECTS', title: 'Tous les prospects', description: 'Retrouvez, filtrez et suivez chaque opportunité commerciale.' },
    Pipeline: { eyebrow: 'PIPELINE COMMERCIAL', title: 'Avancer les opportunités', description: 'Faites progresser vos prospects jusqu\'à l\'inscription.' },
    Ambassadeurs: { eyebrow: 'RÉSEAU D\'AMBASSADEURS', title: 'Vos ambassadeurs', description: 'Mesurez la contribution de chaque partenaire à votre croissance.' },
    Formations: { eyebrow: 'CATALOGUE DE FORMATIONS', title: 'Nos formations', description: 'Ajoutez et gérez les formations proposées par H3E CRM.' },
    Campagnes: { eyebrow: 'ACQUISITION', title: 'Campagnes actives', description: 'Pilotez vos actions de promotion et leurs performances.' },
    Relances: { eyebrow: 'SUIVI COMMERCIAL', title: 'Mes relances', description: 'Ne laissez aucune opportunité importante sans réponse.' },
    Activités: { eyebrow: 'JOURNAL D\'ÉQUIPE', title: 'Activités récentes', description: 'Gardez une trace claire de chaque interaction commerciale.' },
    Rapports: { eyebrow: 'ANALYSE', title: 'Rapports de performance', description: 'Transformez vos données commerciales en décisions concrètes.' },
  };
  const copy = pageCopy[activeNav];
  const header = <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2 text-xs font-semibold text-[#c600cb]"><span className="h-1.5 w-1.5 rounded-full bg-[#c600cb]" /> {copy.eyebrow}</div><h2 className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#173d4d]">{copy.title}</h2><p className="mt-1 text-sm text-slate-500">{copy.description}</p></div><div className="flex gap-2">{!isAmbassador && <button className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-600 shadow-sm"><CalendarDays size={15} /> Cette semaine <ChevronDown size={14} /></button>}{activeNav === 'Prospects' && <CopyReferralLinkButton />}<button onClick={() => onAddLead(null)} className="flex items-center gap-2 rounded-xl bg-[#c600cb] px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-200"><Plus size={15} /> Nouveau prospect</button></div></div>;
  if (activeNav === 'Prospects') return <FormationGroupedView mode="prospects" header={header} leads={leads} query={query} setQuery={setQuery} onAddLead={onAddLead} />;
  if (activeNav === 'Pipeline') return <FormationGroupedView mode="pipeline" header={header} leads={leads} onMoveLead={onMoveLead} onAddLead={onAddLead} />;
  if (activeNav === 'Ambassadeurs') return <AmbassadorsView copy={pageCopy['Ambassadeurs']} />;
  if (activeNav === 'Formations') return <FormationsView copy={pageCopy['Formations']} />;
  if (activeNav === 'Campagnes') return <CampaignsView />;
  if (activeNav === 'Relances') return <FollowUpsView header={header} />;
  if (activeNav === 'Activités') return <ActivitiesView header={header} />;
  return <ReportsView header={header} />;
}

function ReportsView({ header }: { header: JSX.Element }) {
  const [stats, setStats] = useState<{ totalClicks: number; totalLeads: number; interested: number; registered: number; ambassadors: { name: string; lead_count: number }[]; pipeline: { new: number; contacted: number; interested: number; registered: number } }>({ totalClicks: 0, totalLeads: 0, interested: 0, registered: 0, ambassadors: [], pipeline: { new: 0, contacted: 0, interested: 0, registered: 0 } });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [clicks, leads, ambassadors, pipeline] = await Promise.all([
        supabase.from("clicks").select("id", { count: "exact", head: true }),
        supabase.from("leads").select("status", { count: "exact" }),
        supabase.from("ambassador_stats").select("name, lead_count").order("lead_count", { ascending: false }).limit(5),
        supabase.from("leads").select("status"),
      ]);
      if (!mounted) return;
      const leadRows = leads.data ?? [];
      const pipelineRows = pipeline.data ?? [];
      const count = (s: string) => pipelineRows.filter((r) => r.status === s).length;
      setStats({
        totalClicks: clicks.count ?? 0,
        totalLeads: leads.count ?? 0,
        interested: leadRows.filter((r) => r.status === "interested").length,
        registered: leadRows.filter((r) => r.status === "registered").length,
        ambassadors: ambassadors.data ?? [],
        pipeline: { new: count("new"), contacted: count("contacted"), interested: count("interested"), registered: count("registered") },
      });
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);
  if (loading) return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="grid place-items-center py-20"><div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#c600cb]" /></div></div>;
  const s = stats;
  const maxAmbassadorLeads = Math.max(...s.ambassadors.map((a) => a.lead_count), 1);
  const pipelineTotal = s.pipeline.new + s.pipeline.contacted + s.pipeline.interested + s.pipeline.registered;
  const pct = (n: number) => pipelineTotal ? `${Math.round((n / pipelineTotal) * 100)}%` : '0%';
  const bars = ['bg-[#c600cb]', 'bg-[#2b7682]', 'bg-[#f2a84b]', 'bg-[#b9dfe2]', 'bg-rose-400'];
  const pipelineData = [['Nouveaux', s.pipeline.new, 'bg-slate-400'], ['Contactés', s.pipeline.contacted, 'bg-sky-500'], ['Intéressés', s.pipeline.interested, 'bg-[#c600cb]'], ['Inscrits', s.pipeline.registered, 'bg-emerald-500']];
  return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><KpiCard label="Clics générés" value={String(s.totalClicks)} change="Données réelles" detail="total des clics" icon={Link2} color="blue" /><KpiCard label="Prospects" value={String(s.totalLeads)} change="Données réelles" detail="dans le pipeline" icon={Users} color="pink" /><KpiCard label="Intéressés" value={String(s.interested)} change="Données réelles" detail="statut intéressé" icon={Target} color="orange" /><KpiCard label="Inscrits" value={String(s.registered)} change="Données réelles" detail="inscriptions confirmées" icon={Flag} color="green" /></div><div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_0.8fr]"><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-center justify-between"><div><h3 className="text-sm font-bold text-[#173d4d]">Performance par ambassadeur</h3><p className="mt-1 text-xs text-slate-400">Prospects générés sur la période</p></div></div>{s.ambassadors.length === 0 ? <p className="mt-7 text-xs text-slate-400">Aucun ambassadeur avec des prospects pour le moment.</p> : <div className="mt-7 space-y-5">{s.ambassadors.map((amb, i) => <div key={amb.name}><div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold text-[#173d4d]">{amb.name}</span><span className="text-slate-400">{amb.lead_count} prospects</span></div><div className="h-3 rounded-full bg-slate-100"><div className={`h-full rounded-full ${bars[i % bars.length]}`} style={{ width: `${Math.round((amb.lead_count / maxAmbassadorLeads) * 100)}%` }} /></div></div>)}</div>}</div><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6"><h3 className="text-sm font-bold text-[#173d4d]">Conversion du pipeline</h3><p className="mt-1 text-xs text-slate-400">Du premier contact à l'inscription</p><div className="mt-7 space-y-4">{pipelineData.map(([label, value, bar]) => <div key={label as string}><div className="mb-2 flex items-center justify-between text-xs"><span className="text-slate-500">{label as string}</span><span className="font-bold text-[#173d4d]">{value as number} <span className="font-normal text-slate-400">({pct(value as number)})</span></span></div><div className="h-2 rounded-full bg-slate-100"><div className={`h-full rounded-full ${bar}`} style={{ width: pct(value as number) }} /></div></div>)}</div><div className="mt-7 rounded-xl bg-[#173d4d] p-4 text-white"><div className="flex items-center gap-2 text-xs font-semibold"><TrendingUp size={14} className="text-fuchsia-300" /> Conversion en temps réel</div><p className="mt-2 text-[11px] leading-5 text-white/60">Votre taux de conversion est de {pct(s.registered)} — calculé automatiquement à partir de vos données.</p></div></div></div></div>;
}

function LoadingScreen() {
  return <div className="grid min-h-screen place-items-center bg-[#f6f8fb]"><div className="text-center"><div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#c600cb]" /><p className="mt-4 text-sm font-semibold text-[#173d4d]">Chargement de votre espace</p></div></div>;
}

function AuthScreen() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError(''); setMessage('');
    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (result.error) setError(result.error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect.' : result.error.message);
    else if (mode === 'signup' && result.data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({ id: result.data.user.id, full_name: fullName.trim(), email: email.trim() });
      if (profileError) setError('Le compte est créé, mais votre profil CRM n\'a pas pu être initialisé.');
      else if (!result.data.session) setMessage('Votre compte a été créé. Vérifiez votre email si une confirmation est demandée.');
    }
    setBusy(false);
  };
  return <div className="grid min-h-screen bg-[#173d4d] lg:grid-cols-[1fr_0.9fr]"><div className="hidden flex-col justify-between p-12 text-white lg:flex"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl border border-white/30 bg-white/10 text-sm font-bold">H3E</div><span className="text-lg font-semibold">H3E CRM</span></div><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-fuchsia-300">Espace commercial</p><h1 className="mt-5 max-w-lg text-5xl font-bold leading-tight">Transformez chaque contact en opportunité.</h1><p className="mt-6 max-w-md text-sm leading-6 text-white/60">Centralisez vos prospects, animez votre réseau d'ambassadeurs et suivez vos inscriptions depuis un seul espace.</p></div><p className="text-xs text-white/35">CRM affiliation · H3E CRM</p></div><div className="flex items-center justify-center bg-[#f6f8fb] p-5 sm:p-10"><form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl sm:p-9"><div className="lg:hidden"><div className="mb-8 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#173d4d] text-xs font-bold text-white">H3E</div><span className="font-bold text-[#173d4d]">H3E CRM</span></div></div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c600cb]">{mode === 'login' ? 'CONNEXION SÉCURISÉE' : 'CRÉER UN COMPTE'}</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-[#173d4d]">{mode === 'login' ? 'Bon retour parmi nous' : 'Rejoindre votre espace'}</h2><p className="mt-2 text-sm text-slate-500">{mode === 'login' ? 'Connectez-vous pour retrouver votre activité commerciale.' : 'Créez un compte pour accéder au CRM.'}</p>{mode === 'signup' && <label className="mt-6 block text-xs font-semibold text-slate-600">Nom complet<input value={fullName} onChange={(event) => setFullName(event.target.value)} className="field" placeholder="Koffi Bamba" required /></label>}<label className="mt-6 block text-xs font-semibold text-slate-600">Adresse email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="field" placeholder="vous@exemple.com" required /></label><label className="mt-4 block text-xs font-semibold text-slate-600">Mot de passe<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="field" placeholder="••••••••" minLength={6} required /></label>{error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>}{message && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-700">{message}</p>}<button disabled={busy} className="mt-6 flex w-full items-center justify-center rounded-xl bg-[#c600cb] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-200 transition hover:bg-[#aa00ae] disabled:cursor-not-allowed disabled:opacity-60">{busy ? 'Patientez...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</button><button type="button" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage(''); }} className="mt-5 w-full text-center text-xs font-semibold text-[#c600cb]">{mode === 'login' ? 'Créer un compte' : 'J\'ai déjà un compte'}</button></form></div></div>;
}

function KpiCard({ label, value, change, detail, icon: Icon, color }: { label: string; value: string; change: string; detail: string; icon: typeof Users; color: 'blue' | 'pink' | 'green' | 'orange' }) {
  const colors = { blue: 'bg-sky-50 text-sky-700', pink: 'bg-fuchsia-50 text-fuchsia-700', green: 'bg-emerald-50 text-emerald-700', orange: 'bg-orange-50 text-orange-700' };
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">{label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${colors[color]}`}><Icon size={17} /></span></div><div className="mt-5 flex items-end gap-2"><span className="text-[27px] font-bold tracking-tight text-[#173d4d]">{value}</span><span className="mb-1 text-[11px] font-semibold text-emerald-600">{change}</span></div><div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><ArrowUpRight size={12} className="text-emerald-500" /> {detail}</div></div>;
}

function PipelineColumn({ status, leads, onDragStart, onDrop }: { status: Status; leads: Lead[]; onDragStart: (event: DragEvent<HTMLDivElement>, leadId: string) => void; onDrop: () => void }) {
  const meta = statusMeta[status];
  return <div onDragOver={(event) => event.preventDefault()} onDrop={onDrop} className="min-w-[210px] rounded-xl bg-[#f8fafc] p-3 transition-colors hover:bg-slate-100/80"><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${meta.dot}`} /><span className="text-[11px] font-bold text-[#173d4d]">{meta.label}</span><span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400 shadow-sm">{leads.length}</span></div><button className="text-slate-300 hover:text-slate-500"><Plus size={15} /></button></div><div className="space-y-2">{leads.map((lead) => <div draggable onDragStart={(event) => onDragStart(event, lead.id)} key={lead.id} className="cursor-grab rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-fuchsia-200 hover:shadow-md active:cursor-grabbing"><div className="flex items-start gap-2"><div className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold ${lead.color}`}>{lead.initials}</div><div className="min-w-0"><p className="truncate text-[11px] font-bold text-[#173d4d]">{lead.name}</p><p className="mt-0.5 text-[10px] text-slate-400">{lead.phone}</p></div></div><div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2"><span className="flex items-center gap-1 text-[10px] text-slate-400"><Globe2 size={10} /> {lead.source}</span><span className="text-[10px] text-slate-400">{lead.created}</span></div>{lead.followUp && <div className={`mt-2 flex items-center gap-1 text-[10px] font-semibold ${lead.followUp === 'En retard' ? 'text-rose-500' : 'text-orange-500'}`}><Clock3 size={11} /> {lead.followUp}</div>}</div>)}</div>{leads.length === 0 && <div className="rounded-lg border border-dashed border-slate-200 py-7 text-center text-[10px] text-slate-400">Déposer ici</div>}</div>;
}

function LeadForm({ onClose, onSaved, isAmbassador, userId, initialFormationId }: { onClose: () => void; onSaved: () => void; isAmbassador: boolean; userId?: string; initialFormationId?: string | null }) {
  const [values, setValues] = useState({ firstName: '', lastName: '', phone: '', email: '', source: 'whatsapp', country: '', city: '', formationId: initialFormationId ?? '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ambassadorId, setAmbassadorId] = useState<string | null>(null);
  const [formations, setFormations] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.from('formations').select('id, name').eq('status', 'active').order('name', { ascending: true });
      if (mounted && data) setFormations(data);
    })();
    return () => { mounted = false; };
  }, []);
  useEffect(() => {
    if (!isAmbassador || !userId) return;
    let mounted = true;
    (async () => {
      const { data } = await supabase.from('ambassadors').select('id').eq('profile_id', userId).maybeSingle();
      if (mounted && data) setAmbassadorId(data.id);
    })();
    return () => { mounted = false; };
  }, [isAmbassador, userId]);
  const update = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError('');
    const payload: Record<string, string | null> = { first_name: values.firstName.trim(), last_name: values.lastName.trim(), phone: values.phone.trim(), email: values.email.trim(), source: values.source, status: 'new', country: values.country.trim() || null, city: values.city.trim() || null, formation_id: values.formationId || null };
    if (isAmbassador && ambassadorId) { payload.assigned_to = userId!; payload.first_touch_ambassador_id = ambassadorId; payload.last_touch_ambassador_id = ambassadorId; }
    const { error: insertError } = await supabase.from('leads').insert(payload);
    if (insertError) setError(insertError.message.includes('duplicate') ? 'Ce prospect est déjà enregistré pour cette formation avec ce numéro de téléphone.' : 'Le prospect n\'a pas pu être enregistré.');
    else onSaved();
    setSaving(false);
  };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#102f3c]/45 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c600cb]">Nouveau prospect</p><h2 className="mt-2 text-xl font-bold text-[#173d4d]">Ajouter une opportunité</h2><p className="mt-1 text-xs text-slate-400">Les informations seront ajoutées directement à votre pipeline.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X size={18} /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600">Prénom<input value={values.firstName} onChange={(event) => update('firstName', event.target.value)} className="field" placeholder="Aminata" required /></label><label className="text-xs font-semibold text-slate-600">Nom<input value={values.lastName} onChange={(event) => update('lastName', event.target.value)} className="field" placeholder="Ouédraogo" /></label><label className="text-xs font-semibold text-slate-600">Téléphone<input value={values.phone} onChange={(event) => update('phone', event.target.value)} className="field" placeholder="+226 70 00 00 00" required /></label><label className="text-xs font-semibold text-slate-600">Email<input type="email" value={values.email} onChange={(event) => update('email', event.target.value)} className="field" placeholder="email@exemple.com" /></label><label className="text-xs font-semibold text-slate-600">Pays<input value={values.country} onChange={(event) => update('country', event.target.value)} className="field" placeholder="Burkina Faso" /></label><label className="text-xs font-semibold text-slate-600">Ville<input value={values.city} onChange={(event) => update('city', event.target.value)} className="field" placeholder="Ouagadougou" /></label><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Formation<select value={values.formationId} onChange={(event) => update('formationId', event.target.value)} className="field"><option value="">Sélectionner une formation...</option>{formations.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Source<select value={values.source} onChange={(event) => update('source', event.target.value)} className="field"><option value="whatsapp">WhatsApp</option><option value="facebook">Facebook</option><option value="instagram">Instagram</option><option value="website">Website</option><option value="email">Email</option><option value="other">Autre</option></select></label></div>{error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50">Annuler</button><button disabled={saving} className="rounded-xl bg-[#c600cb] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-200 hover:bg-[#aa00ae] disabled:opacity-60">{saving ? 'Enregistrement...' : 'Ajouter au pipeline'}</button></div></form></div>;
}

function DueDateModal({ leadName, targetLabel, onCancel, onConfirm }: { leadName: string; targetLabel: string; onCancel: () => void; onConfirm: (dueDateIso: string, comment: string) => void }) {
  const [dueDate, setDueDate] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split('T')[0];
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    onConfirm(dueDate ? new Date(dueDate + 'T12:00:00').toISOString() : '', comment.trim());
  };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#102f3c]/45 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c600cb]">Déplacement de prospect</p><h2 className="mt-2 text-xl font-bold text-[#173d4d]">{targetLabel}</h2><p className="mt-1 text-xs text-slate-400">Vous déplacez <span className="font-semibold text-[#173d4d]">{leadName}</span> vers <span className="font-semibold text-[#173d4d]">{targetLabel}</span>. Renseignez la date d'échéance et un commentaire.</p></div><button type="button" onClick={onCancel} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X size={18} /></button></div><div className="mt-6 space-y-4"><label className="block text-xs font-semibold text-slate-600">Date d'échéance <span className="text-rose-500">*</span><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="field mt-1" min={today} required /></label><p className="-mt-2 text-[11px] text-slate-400">Cette date apparaîtra dans le pipeline et la section Relances.</p><label className="block text-xs font-semibold text-slate-600">Commentaire <span className="text-rose-500">*</span><textarea value={comment} onChange={(event) => setComment(event.target.value)} className="field mt-1 min-h-[72px] resize-none" placeholder="Raison du changement, contexte de l'échange..." required /></label><p className="-mt-2 text-[11px] text-slate-400">Ce commentaire sera enregistré dans l'historique du prospect.</p></div><div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onCancel} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50">Annuler</button><button disabled={saving} className="rounded-xl bg-[#c600cb] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-200 hover:bg-[#aa00ae] disabled:opacity-60"><span className="flex items-center gap-2"><CalendarDays size={15} /> Confirmer le déplacement</span></button></div></form></div>;
}

function FormationsView({ copy }: { copy: { eyebrow: string; title: string; description: string } }) {
  const [formations, setFormations] = useState<{ id: string; name: string; description: string; duration: string; price: number; status: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase.from('formations').select('id, name, description, duration, price, status').order('created_at', { ascending: false });
      if (!mounted) return;
      if (fetchError) { setError('Les formations ne peuvent pas être chargées pour le moment.'); setFormations([]); }
      else setFormations(data ?? []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [refreshKey]);
  const statusTone: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', draft: 'bg-slate-100 text-slate-600', archived: 'bg-amber-50 text-amber-700' };
  const statusLabel: Record<string, string> = { active: 'Active', draft: 'Brouillon', archived: 'Archivée' };
  const header = <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2 text-xs font-semibold text-[#c600cb]"><span className="h-1.5 w-1.5 rounded-full bg-[#c600cb]" /> {copy.eyebrow}</div><h2 className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#173d4d]">{copy.title}</h2><p className="mt-1 text-sm text-slate-500">{copy.description}</p></div><div className="flex gap-2"><button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-[#c600cb] px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-200"><Plus size={15} /> Nouvelle formation</button></div></div>;
  if (loading) return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="grid place-items-center py-20"><div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#c600cb]" /></div></div>;
  if (error) return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">{error}</div></div>;
  if (formations.length === 0) return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center"><p className="text-sm font-semibold text-[#173d4d]">Aucune formation enregistrée</p><p className="mt-2 text-xs text-slate-400">Cliquez sur « Nouvelle formation » pour ajouter votre premier programme.</p></div>{showForm && <FormationForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); setRefreshKey((v) => v + 1); }} />}</div>;
  return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{formations.map((f) => <div key={f.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-start justify-between"><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-[#c600cb]/10 text-[#c600cb]"><BookOpen size={20} /></div><div><h3 className="text-sm font-bold text-[#173d4d]">{f.name}</h3><span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone[f.status] ?? 'bg-slate-100 text-slate-600'}`}>{statusLabel[f.status] ?? f.status}</span></div></div><button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"><MoreHorizontal size={17} /></button></div>{f.description && <p className="mt-4 text-xs leading-5 text-slate-500">{f.description}</p>}<div className="mt-5 grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100 pt-4 text-center"><div><p className="text-sm font-bold text-[#173d4d]">{f.duration || '—'}</p><p className="mt-1 text-[10px] text-slate-400">Durée</p></div><div><p className="text-sm font-bold text-[#173d4d]">{f.price > 0 ? `${f.price.toLocaleString('fr-FR')} FCFA` : 'Gratuit'}</p><p className="mt-1 text-[10px] text-slate-400">Tarif</p></div></div></div>)}</div>{showForm && <FormationForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); setRefreshKey((v) => v + 1); }} />}</div>;
}

function FormationForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState({ name: '', description: '', duration: '', price: '', status: 'active' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError('');
    const { error: insertError } = await supabase.from('formations').insert({
      name: values.name.trim(),
      description: values.description.trim(),
      duration: values.duration.trim(),
      price: values.price ? Number(values.price) : 0,
      status: values.status,
    });
    if (insertError) setError('La formation n\'a pas pu être enregistrée. Vérifiez vos droits administrateur.');
    else onSaved();
    setSaving(false);
  };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#102f3c]/45 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c600cb]">Nouvelle formation</p><h2 className="mt-2 text-xl font-bold text-[#173d4d]">Ajouter une formation</h2><p className="mt-1 text-xs text-slate-400">Renseignez les informations du programme de formation.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X size={18} /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Nom de la formation<input value={values.name} onChange={(event) => update('name', event.target.value)} className="field" placeholder="Marketing Digital" required /></label><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Description <span className="font-normal text-slate-400">(optionnel)</span><textarea value={values.description} onChange={(event) => update('description', event.target.value)} className="field min-h-[72px] resize-none" placeholder="Objectif et contenu de la formation..." /></label><label className="text-xs font-semibold text-slate-600">Durée<input value={values.duration} onChange={(event) => update('duration', event.target.value)} className="field" placeholder="3 mois" /></label><label className="text-xs font-semibold text-slate-600">Tarif (FCFA)<input type="number" min="0" value={values.price} onChange={(event) => update('price', event.target.value)} className="field" placeholder="150000" /></label><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Statut<select value={values.status} onChange={(event) => update('status', event.target.value)} className="field"><option value="active">Active</option><option value="draft">Brouillon</option><option value="archived">Archivée</option></select></label></div>{error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50">Annuler</button><button disabled={saving} className="rounded-xl bg-[#c600cb] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-200 hover:bg-[#aa00ae] disabled:opacity-60">{saving ? 'Enregistrement...' : 'Créer la formation'}</button></div></form></div>;
}

function CampaignsView() {
  const [campaigns, setCampaigns] = useState<{ id: string; name: string; status: string; start_date: string; end_date: string; click_count: number; lead_count: number; registered_count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase.from('campaign_stats').select('id, name, status, start_date, end_date, click_count, lead_count, registered_count').order('created_at', { ascending: false });
      if (!mounted) return;
      if (fetchError) { setError('Les campagnes ne peuvent pas être chargées pour le moment.'); setCampaigns([]); }
      else setCampaigns(data ?? []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [refreshKey]);
  const statusTone: Record<string, string> = { active: 'bg-emerald-50 text-emerald-700', draft: 'bg-slate-100 text-slate-600', paused: 'bg-amber-50 text-amber-700', completed: 'bg-sky-50 text-sky-700' };
  const statusLabel: Record<string, string> = { active: 'Active', draft: 'Brouillon', paused: 'En pause', completed: 'Terminée' };
  const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const campaignHeader = <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div className="flex items-center gap-2 text-xs font-semibold text-[#c600cb]"><span className="h-1.5 w-1.5 rounded-full bg-[#c600cb]" /> ACQUISITION</div><div className="flex gap-2"><button onClick={() => setShowForm(true)} className="flex items-center gap-2 rounded-xl bg-[#c600cb] px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-200"><Plus size={15} /> Nouvelle campagne</button></div></div>;
  if (loading) return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{campaignHeader}<div className="grid place-items-center py-20"><div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#c600cb]" /></div></div>;
  if (error) return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{campaignHeader}<div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">{error}</div></div>;
  if (campaigns.length === 0) return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{campaignHeader}<div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center"><p className="text-sm font-semibold text-[#173d4d]">Aucune campagne enregistrée</p><p className="mt-2 text-xs text-slate-400">Cliquez sur « Nouvelle campagne » pour créer votre première action promotionnelle.</p></div>{showForm && <CampaignForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); setRefreshKey((v) => v + 1); }} />}</div>;
  return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{campaignHeader}<div className="grid gap-4 md:grid-cols-2">{campaigns.map((c) => { const conversion = c.lead_count > 0 ? Math.round((c.registered_count / c.lead_count) * 100) : 0; return <div key={c.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone[c.status] ?? 'bg-slate-100 text-slate-600'}`}>{statusLabel[c.status] ?? c.status}</span><h3 className="mt-4 text-sm font-bold text-[#173d4d]">{c.name}</h3><p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400"><CalendarDays size={12} /> {fmtDate(c.start_date)} — {fmtDate(c.end_date)}</p></div><button className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"><MoreHorizontal size={17} /></button></div><div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4"><div><p className="text-lg font-bold text-[#173d4d]">{c.click_count}</p><p className="text-[10px] text-slate-400">Clics</p></div><div><p className="text-lg font-bold text-[#173d4d]">{c.lead_count}</p><p className="text-[10px] text-slate-400">Prospects</p></div><div><p className="text-lg font-bold text-emerald-600">{c.registered_count}</p><p className="text-[10px] text-slate-400">Inscrits</p></div></div><div className="mt-5"><div className="mb-2 flex justify-between text-[10px] text-slate-400"><span>Taux de conversion</span><span className="font-bold text-[#173d4d]">{conversion}%</span></div><div className="h-1.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#c600cb]" style={{ width: `${conversion}%` }} /></div></div></div>; })}</div>{showForm && <CampaignForm onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); setRefreshKey((v) => v + 1); }} />}</div>;
}

function CampaignForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [values, setValues] = useState({ name: '', description: '', startDate: '', endDate: '', status: 'draft' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError('');
    const { error: insertError } = await supabase.from('campaigns').insert({
      name: values.name.trim(),
      description: values.description.trim(),
      start_date: values.startDate || null,
      end_date: values.endDate || null,
      status: values.status,
    });
    if (insertError) setError('La campagne n\'a pas pu être enregistrée. Vérifiez vos droits administrateur.');
    else onSaved();
    setSaving(false);
  };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#102f3c]/45 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-7"><div className="flex items-start justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#c600cb]">Nouvelle campagne</p><h2 className="mt-2 text-xl font-bold text-[#173d4d]">Créer une campagne</h2><p className="mt-1 text-xs text-slate-400">Définissez le nom, la période et le statut de votre action promotionnelle.</p></div><button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X size={18} /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Nom de la campagne<input value={values.name} onChange={(event) => update('name', event.target.value)} className="field" placeholder="Rentrée 2026" required /></label><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Description <span className="font-normal text-slate-400">(optionnel)</span><textarea value={values.description} onChange={(event) => update('description', event.target.value)} className="field min-h-[72px] resize-none" placeholder="Objectif et contexte de la campagne..." /></label><label className="text-xs font-semibold text-slate-600">Date de début<input type="date" value={values.startDate} onChange={(event) => update('startDate', event.target.value)} className="field" /></label><label className="text-xs font-semibold text-slate-600">Date de fin<input type="date" value={values.endDate} onChange={(event) => update('endDate', event.target.value)} className="field" /></label><label className="text-xs font-semibold text-slate-600 sm:col-span-2">Statut<select value={values.status} onChange={(event) => update('status', event.target.value)} className="field"><option value="draft">Brouillon</option><option value="active">Active</option><option value="paused">En pause</option><option value="completed">Terminée</option></select></label></div>{error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>}<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50">Annuler</button><button disabled={saving} className="rounded-xl bg-[#c600cb] px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-200 hover:bg-[#aa00ae] disabled:opacity-60">{saving ? 'Enregistrement...' : 'Créer la campagne'}</button></div></form></div>;
}

function FollowUpsView({ header }: { header: JSX.Element }) {
  const [groups, setGroups] = useState<{ title: string; tone: string; items: { id: string; leadName: string; type: string; dueLabel: string }[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error: fetchError } = await supabase.from('follow_ups').select('id, type, due_date, status, leads(first_name, last_name)').eq('status', 'pending').order('due_date', { ascending: true }).limit(30);
      if (!mounted) return;
      if (fetchError) { setError('Les relances ne peuvent pas être chargées pour le moment.'); setGroups([]); }
      else {
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const today = new Date(); today.setHours(23, 59, 59, 999);
        const overdue: typeof groups[number]['items'] = []; const todayItems: typeof groups[number]['items'] = []; const upcoming: typeof groups[number]['items'] = [];
        for (const row of data ?? []) {
          const due = row.due_date ? new Date(row.due_date) : null;
          const lead = (row.leads as { first_name: string; last_name: string }[] | null)?.[0] ?? null;
          const item = { id: row.id, leadName: lead ? `${lead.first_name} ${lead.last_name}`.trim() : 'Prospect', type: row.type || 'Relance', dueLabel: due ? due.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—' };
          if (!due || due < now) overdue.push(item); else if (due <= today) todayItems.push(item); else upcoming.push(item);
        }
        setGroups([{ title: 'En retard', tone: 'bg-rose-50 text-rose-700', items: overdue }, { title: 'Aujourd\'hui', tone: 'bg-orange-50 text-orange-700', items: todayItems }, { title: 'À venir', tone: 'bg-sky-50 text-sky-700', items: upcoming }]);
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);
  if (loading) return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="grid place-items-center py-20"><div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#c600cb]" /></div></div>;
  if (error) return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">{error}</div></div>;
  const total = groups.reduce((sum, g) => sum + g.items.length, 0);
  if (total === 0) return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center"><p className="text-sm font-semibold text-[#173d4d]">Aucune relance en attente</p><p className="mt-2 text-xs text-slate-400">Toutes les relances sont à jour. Bravo !</p></div></div>;
  return <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="grid gap-5 lg:grid-cols-3">{groups.map((group) => <div key={group.title} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${group.tone}`}>{group.title}</span><p className="mt-3 text-xs text-slate-400">{group.items.length} relance{group.items.length > 1 ? 's' : ''}</p></div></div><div className="mt-5 space-y-3">{group.items.map((item) => <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"><div className="flex items-start gap-2"><div className="grid h-8 w-8 place-items-center rounded-lg bg-white text-[#c600cb] shadow-sm"><Clock3 size={14} /></div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#173d4d]">{item.leadName}</p><p className="mt-1 text-[10px] text-slate-400">{item.type}</p></div></div><p className="mt-3 text-[10px] font-semibold text-[#c600cb]">{item.dueLabel}</p></div>)}</div>{group.items.length === 0 && <p className="py-7 text-center text-[10px] text-slate-400">Rien à afficher</p>}</div>)}</div></div>;
}

function ActivitiesView({ header }: { header: JSX.Element }) {
  const [groups, setGroups] = useState<{ date: string; events: { id: string; actorName: string; action: string; timeLabel: string; icon: LucideIcon; tone: string }[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error: fetchError } = await supabase.from('lead_activities').select('id, type, content, created_at, actor_id, profiles(full_name)').order('created_at', { ascending: false }).limit(50);
      if (!mounted) return;
      if (fetchError) { setError('Les activités ne peuvent pas être chargées pour le moment.'); setGroups([]); }
      else {
        setTotal(data?.length ?? 0);
        const iconMap: Record<string, { icon: LucideIcon; tone: string }> = {
          lead_created: { icon: UserRound, tone: 'bg-fuchsia-100 text-fuchsia-700' },
          status_changed: { icon: Target, tone: 'bg-blue-100 text-blue-700' },
          registered: { icon: Flag, tone: 'bg-emerald-100 text-emerald-700' },
          follow_up_scheduled: { icon: CalendarDays, tone: 'bg-orange-100 text-orange-700' },
          call: { icon: Activity, tone: 'bg-sky-100 text-sky-700' },
          note: { icon: Sparkles, tone: 'bg-amber-100 text-amber-700' },
        };
        const byDate = new Map<string, typeof groups[number]['events']>();
        for (const row of data ?? []) {
          const date = new Date(row.created_at).toLocaleDateString('fr-FR');
          const profile = (row.profiles as { full_name: string }[] | null)?.[0] ?? null;
          const meta = iconMap[row.type] ?? { icon: Activity, tone: 'bg-slate-100 text-slate-600' };
          const entry = { id: row.id, actorName: profile?.full_name || 'Système', action: row.content || row.type, timeLabel: new Date(row.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }), icon: meta.icon, tone: meta.tone };
          if (!byDate.has(date)) byDate.set(date, []); byDate.get(date)!.push(entry);
        }
        setGroups(Array.from(byDate.entries()).map(([date, events]) => ({ date, events })));
      }
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);
  if (loading) return <div className="mx-auto max-w-[980px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="grid place-items-center py-20"><div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#c600cb]" /></div></div>;
  if (error) return <div className="mx-auto max-w-[980px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">{error}</div></div>;
  if (groups.length === 0) return <div className="mx-auto max-w-[980px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center"><p className="text-sm font-semibold text-[#173d4d]">Aucune activité enregistrée</p><p className="mt-2 text-xs text-slate-400">Les actions sur vos prospects apparaîtront ici automatiquement.</p></div></div>;
  return <div className="mx-auto max-w-[980px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-7"><div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-5"><div><h3 className="text-sm font-bold text-[#173d4d]">Journal des activités</h3><p className="mt-1 text-xs text-slate-400">{total} action{total > 1 ? 's' : ''} enregistrée{total > 1 ? 's' : ''}</p></div><button className="rounded-xl border border-slate-200 p-2.5 text-slate-500"><Filter size={15} /></button></div><div className="space-y-6">{groups.map((group) => <div key={group.date}><p className="mb-4 text-[10px] font-bold uppercase tracking-[0.18em] text-[#c600cb]">{group.date}</p><div className="space-y-4 border-l border-slate-200 pl-5">{group.events.map((event) => { const Icon = event.icon; return <div key={event.id} className="relative flex items-start gap-3"><span className="absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-[#c600cb] shadow" /><div className={`grid h-9 w-9 place-items-center rounded-xl ${event.tone}`}><Icon size={16} /></div><div className="flex-1"><p className="text-xs font-semibold text-[#173d4d]">{event.action}</p><p className="mt-1 text-[11px] text-slate-400">{event.actorName} · {event.timeLabel}</p></div><MoreHorizontal size={16} className="text-slate-300" /></div>; })}</div></div>)}</div></div></div>;
}


function AdminView({ copy }: { copy: { eyebrow: string; title: string; description: string } }) {
  const [users, setUsers] = useState<{ id: string; full_name: string; email: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAmbassadorForm, setShowAmbassadorForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const { data, error: fetchError } = await supabase.from('profiles').select('id, full_name, email, role').order('created_at', { ascending: false });
      if (!mounted) return;
      if (fetchError) { setError('Les utilisateurs ne peuvent pas etre charges pour le moment.'); setUsers([]); }
      else setUsers(data ?? []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [refreshKey]);
  const header = <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2 text-xs font-semibold text-[#c600cb]"><span className="h-1.5 w-1.5 rounded-full bg-[#c600cb]" /> {copy.eyebrow}</div><h2 className="mt-2 text-[28px] font-bold tracking-[-0.03em] text-[#173d4d]">{copy.title}</h2><p className="mt-1 text-sm text-slate-500">{copy.description}</p></div><div className="flex gap-2"><button onClick={() => setShowAmbassadorForm(true)} className="flex items-center gap-2 rounded-xl bg-[#c600cb] px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-fuchsia-200"><Plus size={15} /> Creer un ambassadeur</button></div></div>;
  if (loading) return <div className="mx-auto max-w-[1200px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="grid place-items-center py-20"><div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-[#c600cb]" /></div></div>;
  if (error) return <div className="mx-auto max-w-[1200px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">{error}</div></div>;
  const roleTone: Record<string, string> = { admin: 'bg-fuchsia-50 text-fuchsia-700', commercial: 'bg-sky-50 text-sky-700', ambassador: 'bg-emerald-50 text-emerald-700' };
  const roleLabel: Record<string, string> = { admin: 'Administrateur', commercial: 'Commercial', ambassador: 'Ambassadeur' };
  return <div className="mx-auto max-w-[1200px] px-5 py-7 sm:px-8 lg:px-10">{header}<div className="grid gap-4 sm:grid-cols-3">{[{ label: 'Administrateurs', count: users.filter((u) => u.role === 'admin').length, icon: Shield, tone: 'bg-fuchsia-50 text-fuchsia-700' }, { label: 'Ambassadeurs', count: users.filter((u) => u.role === 'ambassador').length, icon: UserRound, tone: 'bg-emerald-50 text-emerald-700' }, { label: 'Commerciaux', count: users.filter((u) => u.role === 'commercial').length, icon: UserCog, tone: 'bg-sky-50 text-sky-700' }].map((stat) => { const Icon = stat.icon; return <div key={stat.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">{stat.label}</span><span className={`grid h-9 w-9 place-items-center rounded-xl ${stat.tone}`}><Icon size={17} /></span></div><p className="mt-4 text-[27px] font-bold tracking-tight text-[#173d4d]">{stat.count}</p></div>; })}</div><div className="mt-5 rounded-2xl border border-slate-200/80 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-100 p-5 sm:p-6"><div><h3 className="text-sm font-bold text-[#173d4d]">Comptes utilisateurs</h3><p className="mt-1 text-xs text-slate-400">Tous les comptes crees dans le systeme</p></div></div><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left"><thead className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-bold">Nom</th><th className="px-5 py-3 font-bold">Email</th><th className="px-5 py-3 font-bold">Role</th></tr></thead><tbody className="divide-y divide-slate-100">{users.map((u) => <tr key={u.id} className="transition hover:bg-slate-50/70"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-[10px] font-bold text-slate-600">{(u.full_name || 'U').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}</div><p className="text-xs font-bold text-[#173d4d]">{u.full_name || 'Sans nom'}</p></div></td><td className="px-5 py-4 text-xs text-slate-500">{u.email}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${roleTone[u.role] ?? 'bg-slate-100 text-slate-600'}`}>{roleLabel[u.role] ?? u.role}</span></td></tr>)}</tbody></table></div></div>{showAmbassadorForm && <AmbassadorForm onClose={() => setShowAmbassadorForm(false)} onSaved={() => { setShowAmbassadorForm(false); setRefreshKey((v) => v + 1); }} />}</div>;
}

function CopyReferralLinkButton() {
  const [open, setOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');
  const [ambassadors, setAmbassadors] = useState<{ id: string; name: string; code: string }[]>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.from('ambassadors').select('id, name, code').eq('status', 'active').order('name', { ascending: true });
      if (mounted && data) setAmbassadors(data);
    })();
    return () => { mounted = false; };
  }, []);
  const copy = async (code: string) => {
    const link = `${window.location.origin}/?ref=${code}`;
    try { await navigator.clipboard.writeText(link); setCopiedCode(code); setTimeout(() => setCopiedCode(''), 2000); } catch { setCopiedCode(''); }
  };
  return <div className="relative"><button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-[#173d4d] shadow-sm transition hover:border-fuchsia-200 hover:text-[#c600cb]"><Link2 size={15} /> <span className="hidden sm:inline">Copier le lien d'inscription</span><span className="sm:hidden">Lien</span></button>{open && <><div className="fixed inset-0 z-30" onClick={() => setOpen(false)} /><div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl"><p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Choisir un ambassadeur</p><div className="max-h-60 overflow-y-auto">{ambassadors.length === 0 && <p className="px-2 py-3 text-xs text-slate-400">Aucun ambassadeur actif.</p>}{ambassadors.map((amb) => <button key={amb.id} onClick={() => copy(amb.code)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs font-semibold text-[#173d4d] transition hover:bg-fuchsia-50"><span className="truncate">{amb.name}</span>{copiedCode === amb.code ? <Check size={14} className="text-emerald-500" /> : <Link2 size={14} className="text-slate-400" />}</button>)}</div></div></>}</div>;
}

function CopyLinkButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/?ref=${code}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { setCopied(false); }
  };
  return <button onClick={copy} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 py-2.5 text-xs font-bold text-[#173d4d] hover:bg-fuchsia-50 hover:text-[#c600cb]">{copied ? <><Check size={14} /> Lien copié !</> : <><Link2 size={14} /> Copier le lien personnel</>}</button>;
}

function PublicReferralPage({ refCode }: { refCode: string }) {
  const [ambassador, setAmbassador] = useState<{ id: string; name: string; code: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [values, setValues] = useState({ firstName: '', lastName: '', phone: '', email: '', formation: '' });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const update = (field: keyof typeof values, value: string) => setValues((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error: rpcError } = await supabase.rpc('resolve_ambassador_by_code', { p_code: refCode });
      if (!mounted) return;
      if (rpcError || !data || data.length === 0) { setNotFound(true); }
      else setAmbassador({ id: data[0].id, name: data[0].name, code: data[0].code });
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [refCode]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true); setError('');
    const { error: insertError } = await supabase.from('leads').insert({
      first_name: values.firstName.trim(),
      last_name: values.lastName.trim(),
      phone: values.phone.trim(),
      email: values.email.trim(),
      source: 'referral',
      status: 'new',
      first_touch_ambassador_id: ambassador?.id,
      last_touch_ambassador_id: ambassador?.id,
      formation: values.formation.trim(),
    });
    if (insertError) setError(insertError.message.includes('duplicate') ? 'Vous êtes déjà inscrit à cette formation avec ce numéro de téléphone. Un conseiller vous contactera bientôt.' : 'Votre inscription n\'a pas pu être enregistrée. Veuillez réessayer.');
    else setSuccess(true);
    setSubmitting(false);
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f6f8fb]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#c600cb]" /></div>;
  if (notFound) return <div className="grid min-h-screen place-items-center bg-[#f6f8fb] px-5"><div className="max-w-md text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-600"><X size={28} /></div><h1 className="mt-5 text-2xl font-bold text-[#173d4d]">Lien invalide</h1><p className="mt-3 text-sm text-slate-500">Ce lien de parrainage n'existe pas ou n'est plus actif. Vérifiez le lien avec votre ambassadeur.</p></div></div>;
  if (success) return <div className="grid min-h-screen place-items-center bg-[#f6f8fb] px-5"><div className="max-w-md text-center"><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600"><Check size={28} /></div><h1 className="mt-5 text-2xl font-bold text-[#173d4d]">Inscription envoyée !</h1><p className="mt-3 text-sm text-slate-500">Merci {values.firstName} ! Votre demande a bien été enregistrée. Un conseiller de H3E CRM vous contactera très bientôt.</p></div></div>;

  return (
    <div className="min-h-screen bg-[#173d4d]">
      <div className="mx-auto max-w-lg px-5 py-12 sm:py-16">
        <div className="mb-10 flex items-center gap-3 text-white"><div className="grid h-11 w-11 place-items-center rounded-xl border border-white/30 bg-white/10 text-sm font-bold">H3E</div><div><p className="text-lg font-semibold">H3E CRM</p><p className="text-[11px] text-white/50">Recommandé par {ambassador?.name}</p></div></div>
        <div className="rounded-3xl bg-white p-7 shadow-2xl sm:p-9">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#c600cb]">INSCRIPTION PROSPECT</p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-[#173d4d]">Rejoignez H3E CRM</h2>
          <p className="mt-2 text-sm text-slate-500">Vous avez été recommandé par <span className="font-semibold text-[#173d4d]">{ambassador?.name}</span>. Laissez vos coordonnées pour être contacté par notre équipe.</p>
          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">Prénom<input value={values.firstName} onChange={(e) => update('firstName', e.target.value)} className="field" placeholder="Aminata" required /></label>
              <label className="text-xs font-semibold text-slate-600">Nom<input value={values.lastName} onChange={(e) => update('lastName', e.target.value)} className="field" placeholder="Ouédraogo" required /></label>
            </div>
            <label className="block text-xs font-semibold text-slate-600">Téléphone / WhatsApp<input value={values.phone} onChange={(e) => update('phone', e.target.value)} className="field" placeholder="+226 70 00 00 00" required /></label>
            <label className="block text-xs font-semibold text-slate-600">Adresse email<input type="email" value={values.email} onChange={(e) => update('email', e.target.value)} className="field" placeholder="vous@exemple.com" /></label>
            <label className="block text-xs font-semibold text-slate-600">Formation souhaitée<input value={values.formation} onChange={(e) => update('formation', e.target.value)} className="field" placeholder="Marketing Digital, Gestion d'entreprise..." /></label>
            {error && <p className="rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700">{error}</p>}
            <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#c600cb] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-200 transition hover:bg-[#aa00ae] disabled:cursor-not-allowed disabled:opacity-60">{submitting ? 'Envoi en cours...' : <><Send size={16} /> Envoyer mon inscription</>}</button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-white/40">CRM affiliation · H3E CRM</p>
      </div>
    </div>
  );
}

export default App;
