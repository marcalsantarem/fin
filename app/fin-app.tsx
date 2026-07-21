"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness, CalendarClock,
  Car, ChartNoAxesCombined, Check, ChevronLeft, ChevronRight, Clock3,
  CreditCard, Download, Ellipsis, Eye, EyeOff, Filter, GraduationCap, HeartPulse,
  Home, Landmark, LayoutDashboard, LoaderCircle, LogOut, Menu, Moon, MoreHorizontal,
  Palette, Pencil, Plus, ReceiptText, RefreshCw, Search, Settings, ShieldCheck,
  ShoppingBasket, Sparkles, Tag, Trash2, TrendingUp, Utensils,
  WalletCards, X, Zap, type LucideIcon,
} from "lucide-react";
import { createClient } from "@/src/lib/supabase/client";
import {
  emptyFinanceData, loadFinanceData, type Account, type Category, type CreditCardRow,
  type FinanceData, type InstallmentGroup, type Recurrence, type TransactionRow,
} from "@/src/lib/supabase/data";

type Section = "dashboard" | "transactions" | "accounts" | "cards" | "installments" | "recurrences" | "categories" | "reports" | "settings" | "login" | "register";
type EntityKind = "account" | "card" | "installment" | "recurrence" | "category";
type Toast = { message: string; error?: boolean } | null;

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const statusLabel: Record<TransactionRow["status"], string> = { paid: "Pago", pending: "Pendente", overdue: "Atrasado", cancelled: "Cancelado", scheduled: "Agendado" };
const statusDb = { Pago: "paid", Pendente: "pending", Agendado: "scheduled" } as const;
const accountTypeLabel: Record<string, string> = { checking: "Conta corrente", digital: "Conta digital", cash: "Dinheiro físico", savings: "Poupança", investment: "Investimento", other: "Outro" };
const frequencyLabel: Record<string, string> = { weekly: "Semanal", monthly: "Mensal", quarterly: "Trimestral", semiannual: "Semestral", annual: "Anual" };

const nav: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "transactions", label: "Lançamentos", icon: ArrowRight },
  { id: "accounts", label: "Contas", icon: Landmark },
  { id: "cards", label: "Cartões", icon: CreditCard },
  { id: "installments", label: "Parcelamentos", icon: CalendarClock },
  { id: "recurrences", label: "Recorrências", icon: RefreshCw },
  { id: "categories", label: "Categorias", icon: Tag },
  { id: "reports", label: "Relatórios", icon: ChartNoAxesCombined },
];

function cents(value: number | string | undefined) { return Math.round(Number(value ?? 0) * 100); }
function reais(value: number | null | undefined) { return money.format(Number(value ?? 0) / 100); }
function dateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`; }
function firstDay(date: string) { return `${date.slice(0, 7)}-01`; }
function CategoryGlyph({ icon, size = 18 }: { icon?: string | null; size?: number }) {
  if (icon === "home") return <Home size={size} />;
  if (icon === "utensils") return <Utensils size={size} />;
  if (icon === "shopping-basket") return <ShoppingBasket size={size} />;
  if (icon === "car") return <Car size={size} />;
  if (icon === "heart-pulse") return <HeartPulse size={size} />;
  if (icon === "graduation-cap") return <GraduationCap size={size} />;
  if (icon === "briefcase-business") return <BriefcaseBusiness size={size} />;
  if (icon === "credit-card") return <CreditCard size={size} />;
  if (icon === "refresh-cw") return <RefreshCw size={size} />;
  if (icon === "receipt-text") return <ReceiptText size={size} />;
  if (icon === "sparkles") return <Sparkles size={size} />;
  if (icon === "landmark") return <Landmark size={size} />;
  if (icon === "zap") return <Zap size={size} />;
  return <Tag size={size} />;
}
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U"; }
function parseSource(source?: string) { const [kind, id] = (source ?? "").split(":"); return { account_id: kind === "account" ? id : null, credit_card_id: kind === "card" ? id : null }; }

const transactionSchema = z.object({
  description: z.string().min(2, "Informe uma descrição"),
  amount: z.coerce.number().positive("Informe um valor maior que zero"),
  type: z.enum(["Entrada", "Despesa"]),
  categoryId: z.string().min(1, "Selecione uma categoria"),
  source: z.string().min(1, "Selecione uma conta ou cartão"),
  dueDate: z.string().min(1, "Informe a data"),
  status: z.enum(["Pago", "Pendente", "Agendado"]),
  notes: z.string().optional(),
});
type TransactionFormInput = z.input<typeof transactionSchema>;
type TransactionForm = z.output<typeof transactionSchema>;

const entitySchema = z.object({
  name: z.string().optional(), description: z.string().optional(), amount: z.coerce.number().optional(),
  balance: z.coerce.number().optional(), count: z.coerce.number().optional(), type: z.string().optional(),
  categoryId: z.string().optional(), source: z.string().optional(), accountId: z.string().optional(),
  closingDay: z.coerce.number().optional(), dueDay: z.coerce.number().optional(), day: z.coerce.number().optional(),
  date: z.string().optional(), frequency: z.string().optional(), color: z.string().optional(),
}).superRefine((value, context) => {
  if (!value.name?.trim() && !value.description?.trim()) context.addIssue({ code: "custom", path: ["name"], message: "Informe um nome ou descrição" });
});
type EntityFormInput = z.input<typeof entitySchema>;
type EntityForm = z.output<typeof entitySchema>;

export function FinApp({ initialSection = "dashboard", openComposer = false }: { initialSection?: string; openComposer?: boolean }) {
  const safeInitial = ([...nav.map((item) => item.id), "settings", "login", "register"] as string[]).includes(initialSection) ? initialSection as Section : "dashboard";
  const [supabase] = useState<SupabaseClient>(() => createClient());
  const [active, setActive] = useState<Section>(safeInitial);
  const [user, setUser] = useState<User | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [data, setData] = useState<FinanceData>(emptyFinanceData);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [composer, setComposer] = useState(openComposer);
  const [entityComposer, setEntityComposer] = useState<EntityKind | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [period, setPeriod] = useState(dateKey());
  const [toast, setToast] = useState<Toast>(null);

  const refresh = useCallback(async () => {
    setDataLoading(true); setDataError("");
    try { setData(await loadFinanceData(supabase)); }
    catch (error) { setDataError(error instanceof Error ? error.message : "Não foi possível carregar os dados."); }
    finally { setDataLoading(false); }
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: session }) => {
      const currentUser = session.session?.user ?? null;
      setUser(currentUser);
      setSessionLoading(false);
      if (currentUser) void refresh();
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setSessionLoading(false);
      if (session?.user) void refresh();
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase, refresh]);

  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; }, [dark]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 3200); return () => window.clearTimeout(timer); }, [toast]);

  const go = (section: Section) => {
    setActive(section); setMenuOpen(false);
    window.history.pushState({}, "", section === "dashboard" ? "/dashboard" : `/${section}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const run = async (operation: () => PromiseLike<{ error: { message: string } | null }>, success: string) => {
    const result = await operation();
    if (result.error) throw new Error(result.error.message);
    await refresh(); setToast({ message: success });
  };

  const saveTransaction = async (value: TransactionForm) => {
    if (!user) return;
    const source = parseSource(value.source);
    try {
      await run(() => supabase.from("transactions").insert({
        user_id: user.id, type: value.type === "Entrada" ? "income" : "expense", description: value.description,
        amount_cents: cents(value.amount), transaction_date: value.dueDate, due_date: value.dueDate,
        paid_date: value.status === "Pago" ? value.dueDate : null, competence_month: firstDay(value.dueDate),
        category_id: value.categoryId, status: statusDb[value.status], notes: value.notes || null, ...source,
      }), "Lançamento salvo no Supabase");
      setComposer(false);
    } catch (error) { setToast({ message: error instanceof Error ? error.message : "Erro ao salvar lançamento", error: true }); throw error; }
  };

  const saveEntity = async (kind: EntityKind, value: EntityForm) => {
    if (!user) return;
    try {
      if (kind === "account") await run(() => supabase.from("accounts").insert({ user_id: user.id, name: value.name, type: value.type, initial_balance_cents: cents(value.balance), current_balance_cents: cents(value.balance), color: value.color || "#315c4d", icon: "landmark" }), "Conta criada");
      if (kind === "card") await run(() => supabase.from("credit_cards").insert({ user_id: user.id, name: value.name, account_id: value.accountId, limit_amount_cents: cents(value.amount), closing_day: value.closingDay, due_day: value.dueDay, color: value.color || "#49305d" }), "Cartão criado");
      if (kind === "category") await run(() => supabase.from("categories").insert({ user_id: user.id, name: value.name, type: value.type, color: value.color || "#718079", icon: "tag" }), "Categoria criada");
      if (kind === "recurrence") {
        const source = parseSource(value.source);
        await run(() => supabase.from("recurrences").insert({ user_id: user.id, description: value.description, amount_cents: cents(value.amount), type: value.type, frequency: value.frequency, day_of_month: value.day, start_date: value.date, category_id: value.categoryId, active: true, ...source }), "Recorrência criada");
      }
      if (kind === "installment") {
        const source = parseSource(value.source);
        const result = await supabase.rpc("create_installment_plan", { p_description: value.description, p_total_amount_cents: cents(value.amount), p_count: value.count, p_first_due_date: value.date, p_category_id: value.categoryId, p_account_id: source.account_id, p_credit_card_id: source.credit_card_id, p_notes: null });
        if (result.error) throw new Error(result.error.message);
        await refresh(); setToast({ message: "Parcelamento e parcelas criados" });
      }
      setEntityComposer(null);
    } catch (error) { setToast({ message: error instanceof Error ? error.message : "Erro ao salvar", error: true }); throw error; }
  };

  const togglePaid = async (transaction: TransactionRow) => {
    const paid = transaction.status !== "paid";
    try { await run(() => supabase.from("transactions").update({ status: paid ? "paid" : "pending", paid_date: paid ? new Date().toISOString().slice(0, 10) : null }).eq("id", transaction.id), paid ? "Marcado como pago" : "Marcado como pendente"); }
    catch (error) { setToast({ message: error instanceof Error ? error.message : "Erro ao atualizar", error: true }); }
  };

  const deleteTransaction = async (transaction: TransactionRow) => {
    if (!window.confirm(`Excluir “${transaction.description}”?`)) return;
    try { await run(() => supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", transaction.id), "Lançamento removido"); }
    catch (error) { setToast({ message: error instanceof Error ? error.message : "Erro ao remover", error: true }); }
  };

  const toggleRecurrence = async (recurrence: Recurrence) => {
    try { await run(() => supabase.from("recurrences").update({ active: !recurrence.active }).eq("id", recurrence.id), recurrence.active ? "Recorrência pausada" : "Recorrência ativada"); }
    catch (error) { setToast({ message: error instanceof Error ? error.message : "Erro ao atualizar", error: true }); }
  };

  const saveProfile = async (name: string) => {
    if (!user) return;
    try { await run(() => supabase.from("profiles").update({ name }).eq("user_id", user.id), "Configurações salvas"); }
    catch (error) { setToast({ message: error instanceof Error ? error.message : "Erro ao salvar", error: true }); }
  };

  if (sessionLoading) return <LoadingScreen label="Conectando ao Supabase" />;
  if (!user) {
    const mode = active === "register" ? "register" : "login";
    return <AuthScreen mode={mode} supabase={supabase} onSwitch={() => setActive(mode === "login" ? "register" : "login")} />;
  }

  const displayName = data.profile?.name || user.user_metadata?.name || user.email?.split("@")[0] || "Usuário";
  const monthly = data.transactions.filter((transaction) => transaction.competence_month.startsWith(period));
  const income = monthly.filter((transaction) => transaction.type === "income" && transaction.status !== "cancelled").reduce((sum, transaction) => sum + transaction.amount_cents, 0);
  const expense = monthly.filter((transaction) => transaction.type === "expense" && transaction.status !== "cancelled").reduce((sum, transaction) => sum + transaction.amount_cents, 0);
  const paidExpense = monthly.filter((transaction) => transaction.type === "expense" && transaction.status === "paid").reduce((sum, transaction) => sum + transaction.amount_cents, 0);
  const pendingExpense = monthly.filter((transaction) => transaction.type === "expense" && ["pending", "overdue", "scheduled"].includes(transaction.status)).reduce((sum, transaction) => sum + transaction.amount_cents, 0);

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row"><Link className="brand" href="/dashboard" onClick={(event) => { event.preventDefault(); go("dashboard"); }}>FIN</Link><button className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={19} /></button></div>
        <nav className="main-nav" aria-label="Navegação principal">{nav.map(({ id, label, icon: Icon }) => <a key={id} href={`/${id}`} className={active === id ? "active" : ""} onClick={(event) => { event.preventDefault(); go(id); }}><Icon size={18} strokeWidth={1.9} /><span>{label}</span></a>)}</nav>
        <div className="sidebar-bottom">
          <div className="insight-card"><div className="insight-icon"><Sparkles size={17} /></div><strong>{income > expense ? "Mês positivo" : "Atenção ao orçamento"}</strong><p>{income ? `Você preservou ${Math.max(0, Math.round((income - expense) / income * 100))}% das entradas neste mês.` : "Cadastre entradas para acompanhar sua taxa de economia."}</p><div className="mini-progress"><span style={{ width: `${income ? Math.max(0, Math.min(100, (income - expense) / income * 100)) : 0}%` }} /></div></div>
          <button className={`nav-settings ${active === "settings" ? "active" : ""}`} onClick={() => go("settings")}><Settings size={18} /><span>Configurações</span></button>
          <button className="profile-card" onClick={() => go("settings")}><span className="avatar">{initials(displayName)}</span><span><strong>{displayName}</strong><small>{user.email}</small></span><Ellipsis size={18} /></button>
        </div>
      </aside>
      {menuOpen && <button className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}
      <main className="main-area">
        <header className="topbar"><button className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={21} /></button><div className="mobile-brand">FIN</div><div className="topbar-actions"><label className="search-box"><Search size={17} /><input placeholder="Buscar lançamento..." aria-label="Buscar lançamento" /><kbd>⌘ K</kbd></label><button className="icon-button" onClick={() => setDark(!dark)} aria-label="Alternar tema"><Moon size={18} /></button><button className="icon-button notification" aria-label="Notificações"><Bell size={18} /><span /></button><button className="primary-button compact" onClick={() => setComposer(true)}><Plus size={18} />Novo lançamento</button></div></header>
        <div className="content">
          {dataLoading && <div className="data-loading"><LoaderCircle size={17} className="spin" />Sincronizando com o Supabase…</div>}
          {dataError && <div className="data-error"><span>{dataError}</span><button onClick={() => void refresh()}>Tentar novamente</button></div>}
          {active === "dashboard" && <Dashboard period={period} setPeriod={setPeriod} name={displayName} data={data} income={income} expense={expense} paidExpense={paidExpense} pendingExpense={pendingExpense} onNew={() => setComposer(true)} onNavigate={go} />}
          {active === "transactions" && <TransactionsScreen transactions={data.transactions} onNew={() => setComposer(true)} onTogglePaid={togglePaid} onDelete={deleteTransaction} />}
          {active === "accounts" && <AccountsScreen accounts={data.accounts} transactions={data.transactions} onNew={() => setEntityComposer("account")} />}
          {active === "cards" && <CardsScreen cards={data.cards} transactions={data.transactions} onNew={() => setEntityComposer("card")} />}
          {active === "installments" && <InstallmentsScreen groups={data.installments} transactions={data.transactions} onNew={() => setEntityComposer("installment")} />}
          {active === "recurrences" && <RecurrencesScreen recurrences={data.recurrences} onNew={() => setEntityComposer("recurrence")} onToggle={toggleRecurrence} />}
          {active === "categories" && <CategoriesScreen categories={data.categories} onNew={() => setEntityComposer("category")} />}
          {active === "reports" && <ReportsScreen transactions={data.transactions} />}
          {active === "settings" && <SettingsScreen name={displayName} email={user.email ?? ""} dark={dark} setDark={setDark} onSave={saveProfile} onLogout={() => void supabase.auth.signOut()} />}
        </div>
      </main>
      <nav className="bottom-nav" aria-label="Navegação mobile">{[nav[0], nav[1], nav[2], nav[3]].map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "active" : ""} onClick={() => go(id)}><Icon size={20} /><span>{label.split(" ")[0]}</span></button>)}<button onClick={() => setMenuOpen(true)}><Menu size={20} /><span>Menu</span></button></nav>
      {composer && <TransactionModal categories={data.categories} accounts={data.accounts} cards={data.cards} onClose={() => setComposer(false)} onSave={saveTransaction} />}
      {entityComposer && <EntityModal kind={entityComposer} accounts={data.accounts} cards={data.cards} categories={data.categories} onClose={() => setEntityComposer(null)} onSave={(value) => saveEntity(entityComposer, value)} />}
      {toast && <div className={`toast ${toast.error ? "toast-error" : ""}`}>{toast.error ? <X size={17} /> : <Check size={17} />}{toast.message}</div>}
    </div>
  );
}

function Dashboard({ period, setPeriod, name, data, income, expense, paidExpense, pendingExpense, onNew, onNavigate }: { period: string; setPeriod: (value: string) => void; name: string; data: FinanceData; income: number; expense: number; paidExpense: number; pendingExpense: number; onNew: () => void; onNavigate: (section: Section) => void }) {
  const periods = useMemo(() => Array.from({ length: 12 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - index); return dateKey(date); }), []);
  const monthly = data.transactions.filter((transaction) => transaction.competence_month.startsWith(period));
  const categories = Object.values(monthly.filter((transaction) => transaction.type === "expense" && transaction.status !== "cancelled").reduce<Record<string, { name: string; value: number; color: string }>>((acc, transaction) => { const key = transaction.category?.name ?? "Sem categoria"; acc[key] ??= { name: key, value: 0, color: transaction.category?.color ?? "#718079" }; acc[key].value += transaction.amount_cents / 100; return acc; }, {})).sort((a, b) => b.value - a.value);
  const flow = Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - (5 - index)); const key = dateKey(date); const items = data.transactions.filter((transaction) => transaction.competence_month.startsWith(key) && transaction.status !== "cancelled"); return { month: monthName.format(new Date(`${key}-01T00:00:00Z`)).replace(".", ""), entrada: items.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount_cents / 100, 0), despesa: items.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount_cents / 100, 0) }; });
  const upcoming = data.transactions.filter((transaction) => transaction.type === "expense" && transaction.due_date && ["pending", "overdue", "scheduled"].includes(transaction.status)).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")).slice(0, 3);
  const futureInstallments = data.transactions.filter((transaction) => transaction.installment_group_id && transaction.status !== "paid" && transaction.status !== "cancelled").reduce((sum, transaction) => sum + transaction.amount_cents, 0);
  return <>
    <section className="page-heading dashboard-heading"><div><span className="eyebrow">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date()).toUpperCase()}</span><h1>Olá, {name.split(" ")[0]}.</h1><p>{income >= expense ? "Seu mês está equilibrado. Continue assim." : "Suas despesas estão acima das entradas deste mês."}</p></div><div className="heading-actions"><div className="period-control"><button aria-label="Mês anterior"><ChevronLeft size={17} /></button><select value={period} onChange={(event) => setPeriod(event.target.value)}>{periods.map((value) => <option key={value} value={value}>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T00:00:00Z`))}</option>)}</select><button aria-label="Próximo mês"><ChevronRight size={17} /></button></div><button className="secondary-button" onClick={() => onNavigate("reports")}><Download size={17} />Relatórios</button></div></section>
    <section className="metric-grid"><Metric label="Saldo previsto" value={reais(income - expense)} note="entradas menos despesas" icon={WalletCards} accent="forest" /><Metric label="Entradas" value={reais(income)} note={`${monthly.filter((item) => item.type === "income").length} lançamentos`} icon={ArrowDownLeft} accent="green" /><Metric label="Despesas pagas" value={reais(paidExpense)} note={`${monthly.filter((item) => item.status === "paid" && item.type === "expense").length} pagamentos`} icon={ArrowUpRight} accent="coral" /><Metric label="A pagar" value={reais(pendingExpense)} note={`${monthly.filter((item) => item.type === "expense" && ["pending", "overdue", "scheduled"].includes(item.status)).length} lançamentos`} icon={Clock3} accent="gold" /></section>
    <section className="dashboard-grid">
      <article className="panel flow-panel"><PanelHeader title="Fluxo mensal" subtitle="Dados reais dos últimos 6 meses"><span className="sync-badge"><Check size={12} />Supabase</span></PanelHeader><div className="chart-legend"><span><i className="dot income" />Entradas</span><span><i className="dot expense" />Despesas</span></div><div className="flow-chart">{flow.some((item) => item.entrada || item.despesa) ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={flow} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 4" /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="entrada" stroke="#2e6b57" strokeWidth={2.5} fill="#2e6b5722" /><Area type="monotone" dataKey="despesa" stroke="#d8785f" strokeWidth={2.2} fill="transparent" strokeDasharray="5 4" /></AreaChart></ResponsiveContainer> : <EmptyState compact title="Sem histórico ainda" description="Os próximos lançamentos formarão este gráfico." />}</div></article>
      <article className="panel spending-panel"><PanelHeader title="Gastos por categoria" subtitle="Distribuição neste mês" /><div className="donut-wrap">{categories.length ? <><div className="donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categories} dataKey="value" innerRadius={58} outerRadius={78} paddingAngle={2} stroke="none">{categories.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer><div className="donut-total"><span>Total</span><strong>{reais(expense)}</strong></div></div><div className="category-legend">{categories.slice(0, 5).map((item) => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{expense ? Math.round(item.value * 10000 / expense) : 0}%</strong></div>)}</div></> : <EmptyState compact title="Sem despesas" description="Nenhum gasto neste mês." />}</div><button className="text-button" onClick={() => onNavigate("reports")}>Ver relatório completo <ArrowRight size={15} /></button></article>
      <article className="panel transactions-panel"><PanelHeader title="Lançamentos recentes" subtitle="Últimas movimentações"><button className="text-button" onClick={() => onNavigate("transactions")}>Ver todos <ArrowRight size={15} /></button></PanelHeader>{data.transactions.length ? <TransactionList transactions={data.transactions.slice(0, 5)} /> : <EmptyState title="Nenhum lançamento" description="Cadastre sua primeira entrada ou despesa." action="Novo lançamento" onAction={onNew} />}</article>
      <article className="panel due-panel"><PanelHeader title="Próximos vencimentos" subtitle={`Parcelas futuras: ${reais(futureInstallments)}`}><span className="count-badge">{upcoming.length}</span></PanelHeader>{upcoming.length ? <div className="due-list">{upcoming.map((transaction) => <DueItem key={transaction.id} transaction={transaction} />)}</div> : <EmptyState compact title="Tudo em dia" description="Nenhum vencimento pendente." />}<button className="secondary-button full" onClick={onNew}><Plus size={16} />Adicionar lançamento</button></article>
    </section>
  </>;
}

function Metric({ label, value, note, icon: Icon, accent }: { label: string; value: string; note: string; icon: LucideIcon; accent: string }) { return <article className="metric-card"><div className={`metric-icon ${accent}`}><Icon size={19} /></div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>; }

function TransactionsScreen({ transactions, onNew, onTogglePaid, onDelete }: { transactions: TransactionRow[]; onNew: () => void; onTogglePaid: (transaction: TransactionRow) => void; onDelete: (transaction: TransactionRow) => void }) {
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("Todos");
  const filtered = transactions.filter((transaction) => transaction.description.toLowerCase().includes(query.toLowerCase()) && (status === "Todos" || statusLabel[transaction.status] === status));
  const totalIncome = transactions.filter((item) => item.type === "income" && item.status !== "cancelled").reduce((sum, item) => sum + item.amount_cents, 0); const totalExpense = transactions.filter((item) => item.type === "expense" && item.status !== "cancelled").reduce((sum, item) => sum + item.amount_cents, 0);
  return <><PageTitle eyebrow="MOVIMENTAÇÕES" title="Lançamentos" subtitle="Dados sincronizados com o Supabase." action={<button className="primary-button" onClick={onNew}><Plus size={18} />Novo lançamento</button>} /><div className="summary-strip"><div><span>Entradas</span><strong className="positive">{reais(totalIncome)}</strong></div><div><span>Despesas</span><strong>{reais(totalExpense)}</strong></div><div><span>Resultado</span><strong>{reais(totalIncome - totalExpense)}</strong></div></div><section className="panel data-panel"><div className="filter-row"><label className="search-box wide"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por descrição..." /></label><select value={status} onChange={(event) => setStatus(event.target.value)}><option>Todos</option><option>Pago</option><option>Pendente</option><option>Agendado</option><option>Atrasado</option><option>Cancelado</option></select><button className="secondary-button"><Filter size={16} />Filtros</button></div>{filtered.length ? <div className="table-wrap"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Conta/cartão</th><th>Data</th><th>Status</th><th className="align-right">Valor</th><th /></tr></thead><tbody>{filtered.map((transaction) => <TransactionTableRow key={transaction.id} transaction={transaction} onTogglePaid={onTogglePaid} onDelete={onDelete} />)}</tbody></table></div> : <EmptyState title="Nenhum resultado" description={transactions.length ? "Altere a busca ou os filtros." : "Crie seu primeiro lançamento."} action={transactions.length ? undefined : "Novo lançamento"} onAction={onNew} />}</section></>;
}

function AccountsScreen({ accounts, transactions, onNew }: { accounts: Account[]; transactions: TransactionRow[]; onNew: () => void }) {
  const balance = (account: Account) => account.initial_balance_cents + transactions.filter((item) => item.account_id === account.id && item.status === "paid").reduce((sum, item) => sum + (item.type === "income" ? item.amount_cents : -item.amount_cents), 0);
  const total = accounts.reduce((sum, account) => sum + balance(account), 0);
  return <><PageTitle eyebrow="PATRIMÔNIO" title="Contas" subtitle="Saldos calculados a partir dos lançamentos pagos." action={<button className="primary-button" onClick={onNew}><Plus size={18} />Nova conta</button>} /><div className="account-total panel"><div><span>Saldo total disponível</span><strong>{reais(total)}</strong><small><TrendingUp size={14} />{accounts.length} contas ativas</small></div><div className="balance-art"><span /><span /><span /></div></div>{accounts.length ? <div className="card-grid thirds">{accounts.map((account) => <AccountCard key={account.id} account={account} balance={balance(account)} />)}</div> : <section className="panel"><EmptyState title="Nenhuma conta cadastrada" description="Cadastre uma conta ou carteira para começar." action="Nova conta" onAction={onNew} /></section>}</>;
}

function CardsScreen({ cards, transactions, onNew }: { cards: CreditCardRow[]; transactions: TransactionRow[]; onNew: () => void }) {
  return <><PageTitle eyebrow="CRÉDITO" title="Cartões" subtitle="Faturas calculadas a partir das compras vinculadas." action={<button className="primary-button" onClick={onNew}><Plus size={18} />Novo cartão</button>} />{cards.length ? <div className="card-grid halves">{cards.map((card, index) => { const used = transactions.filter((item) => item.credit_card_id === card.id && item.type === "expense" && item.status !== "cancelled").reduce((sum, item) => sum + item.amount_cents, 0); return <CreditCardView key={card.id} card={card} used={used} gradient={index % 2 ? "charcoal" : "purple"} />; })}</div> : <section className="panel"><EmptyState title="Nenhum cartão cadastrado" description="Adicione um cartão para acompanhar limite e fatura." action="Novo cartão" onAction={onNew} /></section>}</>;
}

function InstallmentsScreen({ groups, transactions, onNew }: { groups: InstallmentGroup[]; transactions: TransactionRow[]; onNew: () => void }) {
  const remaining = transactions.filter((item) => item.installment_group_id && item.status !== "paid" && item.status !== "cancelled").reduce((sum, item) => sum + item.amount_cents, 0);
  return <><PageTitle eyebrow="PLANEJAMENTO" title="Parcelamentos" subtitle="Acompanhe parcelas criadas pelo Supabase." action={<button className="primary-button" onClick={onNew}><Plus size={18} />Nova compra parcelada</button>} /><div className="summary-strip"><div><span>Saldo parcelado</span><strong>{reais(remaining)}</strong></div><div><span>Planos ativos</span><strong>{groups.length}</strong></div><div><span>Parcelas futuras</span><strong>{transactions.filter((item) => item.installment_group_id && item.status !== "paid").length}</strong></div></div>{groups.length ? <div className="plans-grid">{groups.map((group) => { const items = transactions.filter((item) => item.installment_group_id === group.id); const paid = items.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount_cents, 0); const progress = group.total_amount_cents ? Math.round(paid / group.total_amount_cents * 100) : 0; const next = items.filter((item) => item.status !== "paid" && item.status !== "cancelled").sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0]; return <article className="panel plan-card" key={group.id}><div className="plan-top"><span className="plan-icon"><CalendarClock /></span><button className="icon-button"><MoreHorizontal size={18} /></button></div><h3>{group.description}</h3><p>{items.filter((item) => item.status === "paid").length} de {group.installments_count} parcelas pagas</p><div className="progress"><span style={{ width: `${progress}%` }} /></div><div className="plan-values"><span><small>Pago</small><strong>{reais(paid)}</strong></span><span><small>Total</small><strong>{reais(group.total_amount_cents)}</strong></span></div><div className="next-installment"><Clock3 size={15} /><span>Próxima</span><strong>{next ? `${reais(next.amount_cents)} • ${shortDate.format(new Date(`${next.due_date}T00:00:00Z`))}` : "Concluído"}</strong></div></article>; })}</div> : <section className="panel"><EmptyState title="Nenhum parcelamento" description="Crie uma compra parcelada e o Supabase gerará as parcelas." action="Nova compra parcelada" onAction={onNew} /></section>}</>;
}

function RecurrencesScreen({ recurrences, onNew, onToggle }: { recurrences: Recurrence[]; onNew: () => void; onToggle: (recurrence: Recurrence) => void }) { return <><PageTitle eyebrow="AUTOMAÇÃO" title="Recorrências" subtitle="Despesas e entradas repetidas armazenadas no Supabase." action={<button className="primary-button" onClick={onNew}><Plus size={18} />Nova recorrência</button>} />{recurrences.length ? <section className="panel recurring-list">{recurrences.map((recurrence) => <div className="recurring-row" key={recurrence.id}><span className="tx-icon"><RefreshCw size={18} /></span><div><strong>{recurrence.description}</strong><small>{recurrence.category?.name ?? "Sem categoria"} • {frequencyLabel[recurrence.frequency]}{recurrence.day_of_month ? `, dia ${recurrence.day_of_month}` : ""}</small></div><strong className="recurring-amount">{reais(recurrence.amount_cents)}</strong><button className={`toggle ${recurrence.active ? "on" : ""}`} onClick={() => onToggle(recurrence)} aria-label={recurrence.active ? "Pausar" : "Ativar"}><span /></button><button className="icon-button"><MoreHorizontal size={18} /></button></div>)}</section> : <section className="panel"><EmptyState title="Nenhuma recorrência" description="Automatize aluguel, assinaturas e outras movimentações." action="Nova recorrência" onAction={onNew} /></section>}</>;
}

function CategoriesScreen({ categories, onNew }: { categories: Category[]; onNew: () => void }) { const roots = categories.filter((category) => !category.parent_id); return <><PageTitle eyebrow="ORGANIZAÇÃO" title="Categorias" subtitle="Categorias criadas automaticamente e personalizadas por você." action={<button className="primary-button" onClick={onNew}><Plus size={18} />Nova categoria</button>} />{roots.length ? <div className="category-grid">{roots.map((category) => <article className="panel category-card" key={category.id}><span style={{ background: `${category.color}18`, color: category.color }}><CategoryGlyph icon={category.icon} size={20} /></span><div><strong>{category.name}</strong><small>{categories.filter((item) => item.parent_id === category.id).length} subcategorias • {category.type === "income" ? "Entrada" : "Despesa"}</small></div><button className="icon-button"><Pencil size={16} /></button></article>)}</div> : <section className="panel"><EmptyState title="Nenhuma categoria" description="O gatilho de cadastro deveria criar as categorias padrão." action="Nova categoria" onAction={onNew} /></section>}</>;
}

function ReportsScreen({ transactions }: { transactions: TransactionRow[] }) {
  const flow = Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - (5 - index)); const key = dateKey(date); const items = transactions.filter((transaction) => transaction.competence_month.startsWith(key) && transaction.status !== "cancelled"); return { month: monthName.format(new Date(`${key}-01T00:00:00Z`)).replace(".", ""), entrada: items.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount_cents / 100, 0), despesa: items.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount_cents / 100, 0) }; });
  const totalIncome = transactions.filter((item) => item.type === "income" && item.status !== "cancelled").reduce((sum, item) => sum + item.amount_cents, 0); const totalExpense = transactions.filter((item) => item.type === "expense" && item.status !== "cancelled").reduce((sum, item) => sum + item.amount_cents, 0);
  return <><PageTitle eyebrow="ANÁLISES" title="Relatórios" subtitle="Consolidação dos seus dados reais." action={<button className="secondary-button" onClick={() => window.print()}><Download size={17} />Exportar</button>} /><div className="report-filters"><button className="active">Semestral</button></div><div className="report-grid"><article className="panel report-wide"><PanelHeader title="Evolução financeira" subtitle="Entradas e despesas nos últimos seis meses" /><div className="report-chart">{flow.some((item) => item.entrada || item.despesa) ? <ResponsiveContainer width="100%" height="100%"><BarChart data={flow} barGap={5}><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value / 1000}k`} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="entrada" fill="#315c4d" radius={[5, 5, 0, 0]} /><Bar dataKey="despesa" fill="#e3a18d" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyState title="Sem dados para o gráfico" description="Cadastre lançamentos para gerar o relatório." />}</div></article><article className="panel"><PanelHeader title="Resumo geral" /><div className="report-summary"><div><span>Receitas</span><strong>{reais(totalIncome)}</strong></div><div><span>Despesas</span><strong>{reais(totalExpense)}</strong></div><div><span>Economia</span><strong className="positive">{reais(totalIncome - totalExpense)}</strong></div><div><span>Taxa de economia</span><strong>{totalIncome ? Math.round((totalIncome - totalExpense) / totalIncome * 100) : 0}%</strong></div></div></article></div></>;
}

function SettingsScreen({ name, email, dark, setDark, onSave, onLogout }: { name: string; email: string; dark: boolean; setDark: (value: boolean) => void; onSave: (name: string) => void; onLogout: () => void }) { const [profileName, setProfileName] = useState(name); return <><PageTitle eyebrow="PREFERÊNCIAS" title="Configurações" subtitle="Seu perfil sincronizado com o Supabase." /><div className="settings-layout"><div className="settings-menu"><button className="active"><Settings size={17} />Geral</button><button><ShieldCheck size={17} />Segurança</button><button><Palette size={17} />Aparência</button></div><section className="panel settings-panel"><h2>Preferências gerais</h2><p>Atualize seus dados e aparência.</p><div className="settings-field"><span><strong>Nome</strong><small>Salvo em profiles</small></span><input value={profileName} onChange={(event) => setProfileName(event.target.value)} /></div><div className="settings-field"><span><strong>E-mail</strong><small>Gerenciado pelo Supabase Auth</small></span><input value={email} disabled /></div><div className="settings-field"><span><strong>Tema escuro</strong><small>Preferência deste dispositivo</small></span><button className={`toggle ${dark ? "on" : ""}`} onClick={() => setDark(!dark)}><span /></button></div><div className="settings-actions"><button className="danger-button" onClick={onLogout}><LogOut size={17} />Sair</button><button className="primary-button" onClick={() => onSave(profileName)}><Check size={17} />Salvar alterações</button></div></section></div></>;
}

function TransactionModal({ categories, accounts, cards, onClose, onSave }: { categories: Category[]; accounts: Account[]; cards: CreditCardRow[]; onClose: () => void; onSave: (value: TransactionForm) => Promise<void> }) {
  const today = new Date().toISOString().slice(0, 10); const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<TransactionFormInput, unknown, TransactionForm>({ resolver: zodResolver(transactionSchema), defaultValues: { type: "Despesa", status: "Pendente", dueDate: today, categoryId: "", source: "" } }); const type = useWatch({ control, name: "type" });
  const compatible = categories.filter((category) => category.active && category.type === (type === "Entrada" ? "income" : "expense"));
  return <Modal title="Lançamento" subtitle="Será salvo diretamente no Supabase." onClose={onClose}><form onSubmit={handleSubmit(onSave)}><div className="type-tabs"><label className={type === "Despesa" ? "active expense" : ""}><input type="radio" value="Despesa" {...register("type")} /><ArrowUpRight size={17} />Despesa</label><label className={type === "Entrada" ? "active income" : ""}><input type="radio" value="Entrada" {...register("type")} /><ArrowDownLeft size={17} />Entrada</label></div><FormField label="Descrição" error={errors.description?.message}><input autoFocus placeholder="Ex.: Supermercado" {...register("description")} /></FormField><div className="form-grid"><FormField label="Valor" error={errors.amount?.message}><div className="money-input"><span>R$</span><input type="number" step="0.01" placeholder="0,00" {...register("amount")} /></div></FormField><FormField label="Data" error={errors.dueDate?.message}><input type="date" {...register("dueDate")} /></FormField></div><div className="form-grid"><FormField label="Categoria" error={errors.categoryId?.message}><select {...register("categoryId")}><option value="">Selecione</option>{compatible.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></FormField><FormField label="Conta ou cartão" error={errors.source?.message}><SourceSelect accounts={accounts} cards={cards} register={register("source")} /></FormField></div><FormField label="Status"><select {...register("status")}><option>Pendente</option><option>Pago</option><option>Agendado</option></select></FormField><FormField label="Observação"><textarea rows={3} placeholder="Opcional" {...register("notes")} /></FormField><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}Salvar lançamento</button></div></form></Modal>;
}

function EntityModal({ kind, accounts, cards, categories, onClose, onSave }: { kind: EntityKind; accounts: Account[]; cards: CreditCardRow[]; categories: Category[]; onClose: () => void; onSave: (value: EntityForm) => Promise<void> }) {
  const today = new Date().toISOString().slice(0, 10); const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EntityFormInput, unknown, EntityForm>({ resolver: zodResolver(entitySchema), defaultValues: { type: kind === "account" ? "digital" : "expense", color: "#315c4d", frequency: "monthly", date: today, closingDay: 20, dueDay: 25, day: new Date().getDate(), count: 2 } });
  const titles: Record<EntityKind, string> = { account: "Conta", card: "Cartão", installment: "Compra parcelada", recurrence: "Recorrência", category: "Categoria" };
  return <Modal title={titles[kind]} subtitle="Os dados serão protegidos pelas políticas RLS." onClose={onClose}><form onSubmit={handleSubmit(onSave)}>
    {(kind === "account" || kind === "card" || kind === "category") && <FormField label="Nome" error={errors.name?.message}><input autoFocus placeholder={`Nome da ${titles[kind].toLowerCase()}`} {...register("name")} /></FormField>}
    {(kind === "installment" || kind === "recurrence") && <FormField label="Descrição" error={errors.name?.message}><input autoFocus placeholder="Descrição" {...register("description")} /></FormField>}
    {kind === "account" && <><div className="form-grid"><FormField label="Tipo"><select {...register("type")}><option value="digital">Conta digital</option><option value="checking">Conta corrente</option><option value="cash">Dinheiro físico</option><option value="savings">Poupança</option><option value="investment">Investimento</option><option value="other">Outro</option></select></FormField><FormField label="Saldo inicial"><div className="money-input"><span>R$</span><input type="number" step="0.01" {...register("balance")} /></div></FormField></div><FormField label="Cor"><input type="color" {...register("color")} /></FormField></>}
    {kind === "card" && <><div className="form-grid"><FormField label="Limite"><div className="money-input"><span>R$</span><input type="number" step="0.01" required {...register("amount")} /></div></FormField><FormField label="Conta de pagamento"><select required {...register("accountId")}><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></FormField></div><div className="form-grid"><FormField label="Dia de fechamento"><input type="number" min="1" max="31" {...register("closingDay")} /></FormField><FormField label="Dia de vencimento"><input type="number" min="1" max="31" {...register("dueDay")} /></FormField></div><FormField label="Cor"><input type="color" {...register("color")} /></FormField></>}
    {kind === "category" && <><FormField label="Tipo"><select {...register("type")}><option value="expense">Despesa</option><option value="income">Entrada</option></select></FormField><FormField label="Cor"><input type="color" {...register("color")} /></FormField></>}
    {kind === "installment" && <><div className="form-grid"><FormField label="Valor total"><div className="money-input"><span>R$</span><input type="number" step="0.01" required {...register("amount")} /></div></FormField><FormField label="Parcelas"><input type="number" min="2" required {...register("count")} /></FormField></div><div className="form-grid"><FormField label="Primeiro vencimento"><input type="date" required {...register("date")} /></FormField><FormField label="Categoria"><CategorySelect categories={categories.filter((category) => category.type === "expense")} register={register("categoryId")} /></FormField></div><FormField label="Conta ou cartão"><SourceSelect accounts={accounts} cards={cards} register={register("source")} /></FormField></>}
    {kind === "recurrence" && <><div className="form-grid"><FormField label="Valor"><div className="money-input"><span>R$</span><input type="number" step="0.01" required {...register("amount")} /></div></FormField><FormField label="Tipo"><select {...register("type")}><option value="expense">Despesa</option><option value="income">Entrada</option></select></FormField></div><div className="form-grid"><FormField label="Frequência"><select {...register("frequency")}><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="semiannual">Semestral</option><option value="annual">Anual</option></select></FormField><FormField label="Dia"><input type="number" min="1" max="31" {...register("day")} /></FormField></div><div className="form-grid"><FormField label="Data inicial"><input type="date" {...register("date")} /></FormField><FormField label="Categoria"><CategorySelect categories={categories} register={register("categoryId")} /></FormField></div><FormField label="Conta ou cartão"><SourceSelect accounts={accounts} cards={cards} register={register("source")} /></FormField></>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}Salvar</button></div>
  </form></Modal>;
}

function AuthScreen({ mode, supabase, onSwitch }: { mode: "login" | "register"; supabase: SupabaseClient; onSwitch: () => void }) {
  const [visible, setVisible] = useState(false); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [loading, setLoading] = useState(false); const registerMode = mode === "register";
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); setError(""); setNotice(""); const result = registerMode ? await supabase.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: `${window.location.origin}/dashboard` } }) : await supabase.auth.signInWithPassword({ email, password }); setLoading(false); if (result.error) setError(result.error.message); else if (registerMode && !result.data.session) setNotice("Cadastro realizado. Confirme o e-mail para entrar."); };
  const reset = async () => { if (!email) { setError("Informe seu e-mail primeiro."); return; } const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/settings` }); if (resetError) setError(resetError.message); else setNotice("Enviamos o link de recuperação para seu e-mail."); };
  return <div className="auth-shell"><section className="auth-visual"><Link className="brand light" href="/">FIN</Link><div className="auth-message"><span className="eyebrow">CLAREZA FINANCEIRA</span><h1>Seu dinheiro,<br />no lugar certo.</h1><p>Seus dados agora são salvos com segurança no Supabase.</p><div className="auth-proof"><span className="auth-mini-card"><ShieldCheck /><i><small>Banco</small><strong>RLS ativo</strong></i></span><span className="auth-mini-card"><RefreshCw /><i><small>Dados</small><strong>Sincronizados</strong></i></span></div></div><small className="auth-footer">© 2026 FIN</small></section><section className="auth-form-wrap"><form className="auth-form" onSubmit={submit}><div className="auth-mobile-brand">FIN</div><span className="eyebrow">BEM-VINDO</span><h2>{registerMode ? "Crie sua conta" : "Acesse sua conta"}</h2><p>{registerMode ? "Seu perfil e categorias serão criados automaticamente." : "Entre com sua conta do Supabase."}</p>{registerMode && <FormField label="Nome"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome completo" /></FormField>}<FormField label="E-mail"><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" /></FormField><FormField label="Senha"><div className="password-input"><input type={visible ? "text" : "password"} required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" /><button type="button" onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></FormField>{!registerMode && <div className="auth-options"><span /><button type="button" onClick={reset}>Esqueci a senha</button></div>}{error && <div className="auth-alert error">{error}</div>}{notice && <div className="auth-alert success">{notice}</div>}<button className="primary-button auth-submit" type="submit" disabled={loading}>{loading ? <LoaderCircle size={18} className="spin" /> : registerMode ? "Criar conta" : "Entrar"}<ArrowRight size={18} /></button><div className="auth-switch">{registerMode ? "Já tem uma conta?" : "Ainda não tem uma conta?"}<button type="button" onClick={onSwitch}>{registerMode ? "Entrar" : "Criar conta"}</button></div><div className="secure-note"><ShieldCheck size={15} />Cada usuário acessa somente os próprios dados.</div></form></section></div>;
}

function LoadingScreen({ label }: { label: string }) { return <div className="loading-screen"><span className="brand">FIN</span><LoaderCircle className="spin" size={24} /><p>{label}</p></div>; }
function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={title}><button className="modal-backdrop" onClick={onClose} aria-label="Fechar" /><div className="modal-card"><div className="modal-header"><div><span className="eyebrow">NOVO</span><h2>{title}</h2><p>{subtitle}</p></div><button type="button" className="icon-button" onClick={onClose}><X size={19} /></button></div>{children}</div></div>; }
function PageTitle({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) { return <section className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="heading-actions">{action}</div>}</section>; }
function PanelHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) { return <div className="panel-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{children}</div>; }
function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className={`form-field ${error ? "has-error" : ""}`}><span>{label}</span>{children}{error && <small>{error}</small>}</label>; }
function EmptyState({ title, description, action, onAction, compact = false }: { title: string; description: string; action?: string; onAction?: () => void; compact?: boolean }) { return <div className={`empty-state ${compact ? "compact-empty" : ""}`}><span><ReceiptText size={compact ? 18 : 24} /></span><strong>{title}</strong><p>{description}</p>{action && onAction && <button className="secondary-button" onClick={onAction}><Plus size={15} />{action}</button>}</div>; }
function SourceSelect({ accounts, cards, register }: { accounts: Account[]; cards: CreditCardRow[]; register: object }) { return <select required {...register}><option value="">Selecione</option><optgroup label="Contas">{accounts.map((account) => <option key={account.id} value={`account:${account.id}`}>{account.name}</option>)}</optgroup>{cards.length > 0 && <optgroup label="Cartões">{cards.map((card) => <option key={card.id} value={`card:${card.id}`}>{card.name}</option>)}</optgroup>}</select>; }
function CategorySelect({ categories, register }: { categories: Category[]; register: object }) { return <select required {...register}><option value="">Selecione</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>; }
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) { if (!active || !payload?.length) return null; return <div className="chart-tooltip"><strong>{label}</strong>{payload.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}: {money.format(item.value)}</span>)}</div>; }

function TransactionList({ transactions }: { transactions: TransactionRow[] }) { return <div className="transaction-list">{transactions.map((transaction) => { const positive = transaction.type === "income"; return <div className="transaction-item" key={transaction.id}><span className="tx-icon"><CategoryGlyph icon={transaction.category?.icon} size={17} /></span><div className="tx-main"><strong>{transaction.description}</strong><small>{transaction.category?.name ?? "Sem categoria"} • {shortDate.format(new Date(`${transaction.due_date ?? transaction.transaction_date}T00:00:00Z`))}</small></div><span className={`status status-${statusLabel[transaction.status].toLowerCase()}`}>{statusLabel[transaction.status]}</span><strong className={`tx-amount ${positive ? "positive" : ""}`}>{positive ? "+ " : "− "}{reais(transaction.amount_cents)}</strong><span /></div>; })}</div>; }
function TransactionTableRow({ transaction, onTogglePaid, onDelete }: { transaction: TransactionRow; onTogglePaid: (transaction: TransactionRow) => void; onDelete: (transaction: TransactionRow) => void }) { const positive = transaction.type === "income"; return <tr><td><div className="table-title"><span className="tx-icon"><CategoryGlyph icon={transaction.category?.icon} size={17} /></span><strong>{transaction.description}</strong></div></td><td>{transaction.category?.name ?? "—"}</td><td>{transaction.account?.name ?? transaction.credit_card?.name ?? "—"}</td><td>{shortDate.format(new Date(`${transaction.due_date ?? transaction.transaction_date}T00:00:00Z`))}</td><td><button className={`status status-${statusLabel[transaction.status].toLowerCase()} status-button`} onClick={() => onTogglePaid(transaction)}>{statusLabel[transaction.status]}</button></td><td className={`align-right amount ${positive ? "positive" : ""}`}>{positive ? "+ " : "− "}{reais(transaction.amount_cents)}</td><td><div className="row-actions"><button className="icon-button" title={transaction.status === "paid" ? "Marcar pendente" : "Marcar pago"} onClick={() => onTogglePaid(transaction)}><Check size={16} /></button><button className="icon-button danger-icon" title="Excluir" onClick={() => onDelete(transaction)}><Trash2 size={16} /></button></div></td></tr>; }
function DueItem({ transaction }: { transaction: TransactionRow }) { const date = new Date(`${transaction.due_date}T00:00:00Z`); return <div className="due-item"><span className="date-block coral"><strong>{String(date.getUTCDate()).padStart(2, "0")}</strong><small>{monthName.format(date).replace(".", "").toUpperCase()}</small></span><div><strong>{transaction.description}</strong><small>{transaction.category?.name ?? "Sem categoria"}</small></div><strong>{reais(transaction.amount_cents)}</strong><span /></div>; }
function AccountCard({ account, balance }: { account: Account; balance: number }) { return <article className="panel account-card"><div className="account-card-top"><span style={{ background: account.color }}><Landmark size={19} /></span><button className="icon-button"><MoreHorizontal size={18} /></button></div><small>{accountTypeLabel[account.type] ?? account.type}</small><h3>{account.name}</h3><span>Saldo disponível</span><strong>{reais(balance)}</strong><div className="account-card-footer"><span className={`status ${account.active ? "status-pago" : "status-cancelado"}`}>{account.active ? "Ativa" : "Inativa"}</span><button>Ver extrato <ArrowRight size={14} /></button></div></article>; }
function CreditCardView({ card, used, gradient }: { card: CreditCardRow; used: number; gradient: string }) { const percent = card.limit_amount_cents ? Math.min(100, Math.round(used / card.limit_amount_cents * 100)) : 0; return <article className="panel credit-widget"><div className={`credit-visual ${gradient}`}><div><span className="credit-brand">FIN</span><CreditCard size={25} /></div><strong>•••• •••• •••• {card.id.slice(-4).toUpperCase()}</strong><div><span><small>CARTÃO</small>{card.name.toUpperCase()}</span><span><small>VENCE</small>DIA {card.due_day}</span></div></div><div className="credit-data"><div><span>Fatura atual</span><strong>{reais(used)}</strong><small>Fecha todo dia {card.closing_day}</small></div><button className="icon-button"><MoreHorizontal size={18} /></button><div className="limit-row"><span>Limite utilizado</span><strong>{percent}%</strong></div><div className="progress"><span style={{ width: `${percent}%` }} /></div><small>{reais(Math.max(0, card.limit_amount_cents - used))} disponível de {reais(card.limit_amount_cents)}</small></div></article>; }
