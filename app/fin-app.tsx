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
  ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness, CalendarClock, CalendarRange,
  Car, ChartNoAxesCombined, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3,
  CreditCard, Download, Ellipsis, Eye, EyeOff, Filter, GraduationCap, HeartPulse,
  Home, KeyRound, Landmark, LayoutDashboard, LoaderCircle, LogOut, Menu, Moon, MoreHorizontal,
  Monitor, Palette, Pencil, Plus, ReceiptText, RefreshCw, Search, Settings, ShieldCheck, Sun,
  ShoppingBasket, Sparkles, Tag, Trash2, TrendingUp, Utensils,
  WalletCards, X, Zap, type LucideIcon,
} from "lucide-react";
import { createClient } from "@/src/lib/supabase/client";
import {
  emptyFinanceData, loadFinanceData, type Account, type Category, type CreditCardRow,
  type FinanceData, type InstallmentGroup, type Recurrence, type TransactionRow,
} from "@/src/lib/supabase/data";

type Section = "dashboard" | "transactions" | "planning" | "accounts" | "cards" | "installments" | "recurrences" | "categories" | "reports" | "settings" | "login" | "register";
type EntityKind = "account" | "card" | "installment" | "recurrence" | "category";
type EditableEntity = Account | CreditCardRow | Category | Recurrence;
type EntityComposer = { kind: EntityKind; item?: EditableEntity; parentId?: string } | null;
type Toast = { message: string; error?: boolean } | null;
type ThemeId = "classic" | "atelier" | "pulse" | "lumen" | "aurora" | "vertex" | "sumi" | "dopamine" | "terminal";
type ColorMode = "light" | "dark" | "system";

const themeIds: ThemeId[] = ["classic", "atelier", "pulse", "lumen", "aurora", "vertex", "sumi", "dopamine", "terminal"];
const colorModes: ColorMode[] = ["light", "dark", "system"];
const themeCatalog: { id: ThemeId; name: string; tag: string; description: string }[] = [
  { id: "classic", name: "Clássico", tag: "FIN original", description: "Verde sereno, navegação lateral e leitura objetiva." },
  { id: "atelier", name: "Ateliê", tag: "Editorial", description: "Terracota, tipografia expressiva e composição assimétrica." },
  { id: "pulse", name: "Pulse", tag: "Tecnológico", description: "Violeta elétrico, brilho sutil e dashboard modular." },
  { id: "lumen", name: "Lumen", tag: "Essencial", description: "Ultraclean, silencioso e desenhado para destacar somente o que importa." },
  { id: "aurora", name: "Aurora", tag: "Imersivo", description: "Luzes polares, vidro fosco e profundidade em uma composição bento." },
  { id: "vertex", name: "Vértice", tag: "Neo brutal", description: "Cobalto, amarelo ácido e blocos expressivos com personalidade radical." },
  { id: "sumi", name: "Sumi", tag: "Ink & seal", description: "Papel de arroz, tinta profunda e um selo vermelho em uma composição japonesa contemporânea." },
  { id: "dopamine", name: "Dopamina", tag: "Playful", description: "Cores doces, formas elásticas e cartões flutuantes com uma energia otimista." },
  { id: "terminal", name: "Terminal 84", tag: "Retro-futuro", description: "Fósforo verde, âmbar e uma central de comando inspirada nos computadores dos anos 80." },
];
function validTheme(value: unknown): ThemeId { return themeIds.includes(value as ThemeId) ? value as ThemeId : "classic"; }
function validColorMode(value: unknown): ColorMode { return colorModes.includes(value as ColorMode) ? value as ColorMode : "system"; }

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
const monthName = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" });
const fullMonthName = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const statusLabel: Record<TransactionRow["status"], string> = { paid: "Pago", pending: "Pendente", overdue: "Atrasado", cancelled: "Cancelado", scheduled: "Agendado" };
const forecastStatuses: TransactionRow["status"][] = ["pending", "overdue", "scheduled"];
const statusDb = { Pago: "paid", Pendente: "pending", Agendado: "scheduled" } as const;
const accountTypeLabel: Record<string, string> = { checking: "Conta corrente", digital: "Conta digital", cash: "Dinheiro físico", savings: "Poupança", investment: "Investimento", other: "Outro" };
const frequencyLabel: Record<string, string> = { weekly: "Semanal", monthly: "Mensal", quarterly: "Trimestral", semiannual: "Semestral", annual: "Anual" };

const nav: { id: Section; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "Visão geral", icon: LayoutDashboard },
  { id: "transactions", label: "Lançamentos", icon: ArrowRight },
  { id: "planning", label: "Planejamento", icon: CalendarRange },
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
function shiftMonthKey(key: string, amount: number) { const [year, month] = key.split("-").map(Number); const date = new Date(Date.UTC(year, month - 1 + amount, 1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`; }
function monthOrdinal(key: string) { const [year, month] = key.split("-").map(Number); return year * 12 + month - 1; }
function daysInMonthKey(key: string) { const [year, month] = key.split("-").map(Number); return new Date(Date.UTC(year, month, 0)).getUTCDate(); }
function recurrenceDate(recurrence: Recurrence, month: string) { const preferredDay = recurrence.day_of_month ?? (Number(recurrence.start_date.slice(8, 10)) || 1); const day = Math.min(Math.max(preferredDay, 1), daysInMonthKey(month)); return `${month}-${String(day).padStart(2, "0")}`; }
function recurrenceCoversMonth(recurrence: Recurrence, month: string) { const dueDate = recurrenceDate(recurrence, month); return dueDate >= recurrence.start_date && (!recurrence.end_date || dueDate <= recurrence.end_date); }
function transactionMonth(transaction: TransactionRow) { return (transaction.due_date ?? transaction.transaction_date).slice(0, 7); }
function isRealized(transaction: TransactionRow) { return transaction.status === "paid"; }
function isForecast(transaction: TransactionRow) { return forecastStatuses.includes(transaction.status); }
function signedAmount(transaction: TransactionRow) { return transaction.type === "income" ? transaction.amount_cents : -transaction.amount_cents; }
function accountBalance(account: Account, transactions: TransactionRow[]) { return account.initial_balance_cents + transactions.filter((item) => item.account_id === account.id && isRealized(item)).reduce((sum, item) => sum + signedAmount(item), 0); }
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
function isCategoryAvailable(category: Category, categories: Category[]) {
  if (!category.active) return false;
  if (!category.parent_id) return true;
  return categories.some((parent) => parent.id === category.parent_id && parent.active);
}

const transactionSchema = z.object({
  description: z.string().trim().min(2, "Informe uma descrição").max(160, "Use até 160 caracteres"),
  amount: z.coerce.number().positive("Informe um valor maior que zero"),
  type: z.enum(["Entrada", "Despesa"]),
  categoryId: z.string().min(1, "Selecione uma categoria"),
  source: z.string().min(1, "Selecione uma conta ou cartão"),
  dueDate: z.string().min(1, "Informe a data"),
  status: z.enum(["Pago", "Pendente", "Agendado"]),
  notes: z.string().max(500, "Use até 500 caracteres").optional(),
});
type TransactionFormInput = z.input<typeof transactionSchema>;
type TransactionForm = z.output<typeof transactionSchema>;

const entitySchema = z.object({
  name: z.string().max(80, "Use até 80 caracteres").optional(), description: z.string().max(160, "Use até 160 caracteres").optional(), amount: z.coerce.number().optional(),
  balance: z.coerce.number().optional(), count: z.coerce.number().optional(), type: z.string().optional(),
  categoryId: z.string().optional(), parentId: z.string().optional(), source: z.string().optional(), accountId: z.string().optional(),
  closingDay: z.coerce.number().optional(), dueDay: z.coerce.number().optional(), day: z.coerce.number().optional(),
  date: z.string().optional(), frequency: z.string().optional(), color: z.string().optional(), unlimited: z.boolean().optional(),
}).superRefine((value, context) => {
  if (!value.name?.trim() && !value.description?.trim()) context.addIssue({ code: "custom", path: ["name"], message: "Informe um nome ou descrição" });
  if (value.amount !== undefined && value.amount <= 0 && !value.unlimited) context.addIssue({ code: "custom", path: ["amount"], message: "Informe um valor maior que zero" });
  if (value.count !== undefined && value.count < 2) context.addIssue({ code: "custom", path: ["count"], message: "Use ao menos duas parcelas" });
  for (const field of ["closingDay", "dueDay", "day"] as const) {
    const day = value[field];
    if (day !== undefined && (day < 1 || day > 31)) context.addIssue({ code: "custom", path: [field], message: "Use um dia entre 1 e 31" });
  }
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
  const [entityComposer, setEntityComposer] = useState<EntityComposer>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeId>("classic");
  const [colorMode, setColorMode] = useState<ColorMode>("system");
  const [systemDark, setSystemDark] = useState(false);
  const [period, setPeriod] = useState(dateKey());
  const [globalSearch, setGlobalSearch] = useState("");
  const [transactionScope, setTransactionScope] = useState<{ query?: string; sourceId?: string; installmentId?: string }>({});
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const refresh = useCallback(async () => {
    setDataLoading(true); setDataError("");
    try {
      const nextData = await loadFinanceData(supabase);
      if (nextData.profile) { setTheme(validTheme(nextData.profile.theme)); setColorMode(validColorMode(nextData.profile.color_mode)); }
      setData(nextData);
    }
    catch (error) { setDataError(error instanceof Error ? error.message : "Não foi possível carregar os dados."); }
    finally { setDataLoading(false); }
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: identity }) => {
      const currentUser = identity.user ?? null;
      setUser(currentUser);
      setSessionLoading(false);
      if (currentUser) void refresh();
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setSessionLoading(false);
      if (session?.user) window.setTimeout(() => void refresh(), 0);
      else setData(emptyFinanceData);
    });
    return () => listener.subscription.unsubscribe();
  }, [supabase, refresh]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(query.matches);
    update(); query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const dark = colorMode === "dark" || (colorMode === "system" && systemDark);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.dataset.design = theme;
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  }, [dark, theme]);
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
      }), "Lançamento salvo");
      setComposer(false);
    } catch (error) { setToast({ message: error instanceof Error ? error.message : "Erro ao salvar lançamento", error: true }); throw error; }
  };

  const saveEntity = async (composerState: Exclude<EntityComposer, null>, value: EntityForm) => {
    if (!user) return;
    const { kind, item } = composerState;
    try {
      if (kind === "account") {
        const payload = { name: value.name?.trim(), type: value.type, initial_balance_cents: cents(value.balance), color: value.color || "#315c4d", icon: "landmark" };
        await run(() => item ? supabase.from("accounts").update(payload).eq("id", item.id).eq("user_id", user.id) : supabase.from("accounts").insert({ ...payload, user_id: user.id, current_balance_cents: cents(value.balance) }), item ? "Conta atualizada" : "Conta criada");
      }
      if (kind === "card") {
        const payload = { name: value.name?.trim(), account_id: value.accountId || null, limit_amount_cents: value.unlimited ? 0 : cents(value.amount), has_limit: !value.unlimited, closing_day: value.closingDay, due_day: value.dueDay, color: value.color || "#49305d" };
        await run(() => item ? supabase.from("credit_cards").update(payload).eq("id", item.id).eq("user_id", user.id) : supabase.from("credit_cards").insert({ ...payload, user_id: user.id }), item ? "Cartão atualizado" : "Cartão criado");
      }
      if (kind === "category") {
        const category = item as Category | undefined;
        const parentId = value.parentId !== undefined ? value.parentId || null : composerState.parentId || null;
        const parent = parentId ? data.categories.find((candidate) => candidate.id === parentId) : undefined;
        const hasChildren = category ? data.categories.some((candidate) => candidate.parent_id === category.id) : false;
        if (category && category.type !== value.type && (data.transactions.some((row) => row.category_id === category.id) || data.recurrences.some((row) => row.category_id === category.id) || hasChildren)) throw new Error("O tipo não pode ser alterado enquanto a categoria estiver em uso.");
        if (parentId && (!parent || parent.parent_id || parent.id === category?.id || parent.type !== value.type)) throw new Error("Selecione uma categoria principal compatível.");
        if (hasChildren && parentId) throw new Error("Uma categoria com subcategorias não pode se tornar subcategoria.");
        const payload = { name: value.name?.trim(), type: value.type, parent_id: parentId, color: value.color || "#718079", icon: category?.icon || "tag" };
        await run(() => item ? supabase.from("categories").update(payload).eq("id", item.id).eq("user_id", user.id) : supabase.from("categories").insert({ ...payload, user_id: user.id }), item ? "Categoria atualizada" : "Categoria criada");
      }
      if (kind === "recurrence") {
        const source = parseSource(value.source);
        const payload = { description: value.description?.trim(), amount_cents: cents(value.amount), type: value.type, frequency: value.frequency, day_of_month: value.day, start_date: value.date, category_id: value.categoryId, ...source };
        await run(() => item ? supabase.from("recurrences").update(payload).eq("id", item.id).eq("user_id", user.id) : supabase.from("recurrences").insert({ ...payload, user_id: user.id, active: true }), item ? "Recorrência atualizada" : "Recorrência criada");
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
    if (!user) return;
    try { await run(() => supabase.from("transactions").update({ status: paid ? "paid" : "pending", paid_date: paid ? new Date().toISOString().slice(0, 10) : null }).eq("id", transaction.id).eq("user_id", user.id), paid ? "Marcado como pago" : "Marcado como pendente"); }
    catch (error) { setToast({ message: error instanceof Error ? error.message : "Erro ao atualizar", error: true }); }
  };

  const deleteTransaction = async (transaction: TransactionRow) => {
    if (!user) return;
    if (!window.confirm(`Excluir “${transaction.description}”?`)) return;
    try { await run(() => supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", transaction.id).eq("user_id", user.id), "Lançamento removido"); }
    catch (error) { setToast({ message: error instanceof Error ? error.message : "Erro ao remover", error: true }); }
  };

  const deleteInstallmentPlan = async (group: InstallmentGroup) => {
    if (!user) return;
    if (!window.confirm(`Excluir “${group.description}” e todas as ${group.installments_count} parcelas?`)) return;
    const { error } = await supabase.rpc("delete_installment_plan", { p_group_id: group.id });
    if (error) { setToast({ message: error.message, error: true }); return; }
    await refresh();
    setToast({ message: "Parcelamento e parcelas removidos" });
  };

  const toggleRecurrence = async (recurrence: Recurrence) => {
    if (!user) return;
    try { await run(() => supabase.from("recurrences").update({ active: !recurrence.active }).eq("id", recurrence.id).eq("user_id", user.id), recurrence.active ? "Recorrência pausada" : "Recorrência ativada"); }
    catch (error) { setToast({ message: error instanceof Error ? error.message : "Erro ao atualizar", error: true }); }
  };

  const saveProfile = async (name: string) => {
    if (!user) return;
    if (name.trim().length < 2) { setToast({ message: "Informe um nome válido.", error: true }); return; }
    try { await run(() => supabase.from("profiles").update({ name: name.trim() }).eq("user_id", user.id), "Configurações salvas"); }
    catch (error) { setToast({ message: error instanceof Error ? error.message : "Erro ao salvar", error: true }); }
  };

  const saveAppearance = async (nextTheme: ThemeId, nextMode: ColorMode) => {
    if (!user) return;
    const previousTheme = theme; const previousMode = colorMode;
    setTheme(nextTheme); setColorMode(nextMode);
    setData((current) => ({ ...current, profile: current.profile ? { ...current.profile, theme: nextTheme, color_mode: nextMode } : current.profile }));
    const { error } = await supabase.from("profiles").update({ theme: nextTheme, color_mode: nextMode }).eq("user_id", user.id);
    if (error) {
      setTheme(previousTheme); setColorMode(previousMode);
      setData((current) => ({ ...current, profile: current.profile ? { ...current.profile, theme: previousTheme, color_mode: previousMode } : current.profile }));
      setToast({ message: error.message, error: true });
      return;
    }
    setToast({ message: "Tema salvo no seu perfil" });
  };

  const changePassword = async (currentPassword: string, password: string) => {
    if (!user?.email) return false;
    const verification = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verification.error) { setToast({ message: "A senha atual não confere.", error: true }); return false; }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) { setToast({ message: error.message, error: true }); return false; }
    setToast({ message: "Senha atualizada com segurança" }); return true;
  };

  const resetFinanceData = async (currentPassword: string) => {
    if (!user?.email) return false;
    const verification = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
    if (verification.error || verification.data.user?.id !== user.id) { setToast({ message: "A senha atual não confere.", error: true }); return false; }
    const { error } = await supabase.rpc("reset_finance_data");
    if (error) { setToast({ message: error.message, error: true }); return false; }
    setPeriod(dateKey()); setGlobalSearch(""); setTransactionScope({});
    await refresh();
    setToast({ message: "Dados apagados. Sua conta está pronta para recomeçar." });
    return true;
  };

  const setEntityActive = async (kind: "account" | "card" | "category", item: Account | CreditCardRow | Category) => {
    if (!user) return;
    const table = kind === "account" ? "accounts" : kind === "card" ? "credit_cards" : "categories";
    try { await run(() => supabase.from(table).update({ active: !item.active }).eq("id", item.id).eq("user_id", user.id), item.active ? "Item desativado" : "Item ativado"); }
    catch (error) { setToast({ message: error instanceof Error ? error.message : "Erro ao atualizar", error: true }); }
  };

  const removeEntity = async (kind: "account" | "card" | "category" | "recurrence", item: Account | CreditCardRow | Category | Recurrence) => {
    if (!user) return;
    const inUse = kind === "account" ? data.transactions.some((row) => row.account_id === item.id) || data.cards.some((card) => card.account_id === item.id) || data.recurrences.some((row) => row.account_id === item.id)
      : kind === "card" ? data.transactions.some((row) => row.credit_card_id === item.id) || data.recurrences.some((row) => row.credit_card_id === item.id)
      : kind === "category" ? data.transactions.some((row) => row.category_id === item.id) || data.recurrences.some((row) => row.category_id === item.id) || data.categories.some((row) => row.parent_id === item.id)
      : data.transactions.some((row) => row.recurrence_id === item.id);
    if (inUse && kind !== "recurrence") { await setEntityActive(kind, item as Account | CreditCardRow | Category); setToast({ message: "O item está em uso e foi desativado para preservar o histórico." }); return; }
    const label = "description" in item ? item.description : item.name;
    if (!window.confirm(`Remover “${label}”?`)) return;
    const table = kind === "account" ? "accounts" : kind === "card" ? "credit_cards" : kind === "category" ? "categories" : "recurrences";
    try { await run(() => supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq("id", item.id).eq("user_id", user.id), "Item removido"); }
    catch (error) { setToast({ message: error instanceof Error ? error.message : "Erro ao remover", error: true }); }
  };

  if (sessionLoading) return <LoadingScreen label="Preparando seu espaço" />;
  if (!user) {
    const mode = active === "register" ? "register" : "login";
    return <AuthScreen mode={mode} supabase={supabase} onSwitch={() => setActive(mode === "login" ? "register" : "login")} />;
  }

  const displayName = data.profile?.name || user.user_metadata?.name || user.email?.split("@")[0] || "Usuário";
  const monthly = data.transactions.filter((transaction) => transaction.competence_month.startsWith(period));
  const realizedIncome = monthly.filter((transaction) => transaction.type === "income" && isRealized(transaction)).reduce((sum, transaction) => sum + transaction.amount_cents, 0);
  const realizedExpense = monthly.filter((transaction) => transaction.type === "expense" && isRealized(transaction)).reduce((sum, transaction) => sum + transaction.amount_cents, 0);
  const forecastExpense = monthly.filter((transaction) => transaction.type === "expense" && isForecast(transaction)).reduce((sum, transaction) => sum + transaction.amount_cents, 0);
  const alerts = data.transactions.filter((transaction) => transaction.type === "expense" && transaction.due_date && isForecast(transaction)).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")).slice(0, 5);
  const openTransactionSearch = () => { setTransactionScope({ query: globalSearch.trim() }); go("transactions"); };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row"><Link className="brand" href="/dashboard" onClick={(event) => { event.preventDefault(); go("dashboard"); }}>FIN</Link><button className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={19} /></button></div>
        <nav className="main-nav" aria-label="Navegação principal">{nav.map(({ id, label, icon: Icon }) => <a key={id} href={`/${id}`} className={active === id ? "active" : ""} onClick={(event) => { event.preventDefault(); go(id); }}><Icon size={18} strokeWidth={1.9} /><span>{label}</span></a>)}</nav>
        <div className="sidebar-bottom">
          <div className="insight-card"><div className="insight-icon"><Sparkles size={17} /></div><strong>{realizedIncome > realizedExpense ? "Mês realizado positivo" : "Atenção ao realizado"}</strong><p>{realizedIncome ? `Você preservou ${Math.max(0, Math.round((realizedIncome - realizedExpense) / realizedIncome * 100))}% do que já recebeu neste mês.` : "As previsões ficam separadas até serem confirmadas."}</p><div className="mini-progress"><span style={{ width: `${realizedIncome ? Math.max(0, Math.min(100, (realizedIncome - realizedExpense) / realizedIncome * 100)) : 0}%` }} /></div></div>
          <button className={`nav-settings ${active === "settings" ? "active" : ""}`} onClick={() => go("settings")}><Settings size={18} /><span>Configurações</span></button>
          <button className="profile-card" onClick={() => go("settings")}><span className="avatar">{initials(displayName)}</span><span><strong>{displayName}</strong><small>{user.email}</small></span><Ellipsis size={18} /></button>
        </div>
      </aside>
      {menuOpen && <button className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}
      <main className="main-area">
        <header className="topbar"><button className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={21} /></button><div className="mobile-brand">FIN</div><div className="topbar-actions"><label className="search-box"><Search size={17} /><input value={globalSearch} onChange={(event) => setGlobalSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") openTransactionSearch(); }} placeholder="Buscar lançamento..." aria-label="Buscar lançamento" /><kbd>Enter</kbd></label><button className="icon-button" onClick={() => void saveAppearance(theme, dark ? "light" : "dark")} aria-label={dark ? "Usar modo claro" : "Usar modo escuro"} title={colorMode === "system" ? "Modo automático ativo" : undefined}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button><div className="notification-wrap"><button className="icon-button notification" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-expanded={notificationsOpen} aria-label="Notificações"><Bell size={18} />{alerts.length > 0 && <span />}</button>{notificationsOpen && <div className="notification-panel"><strong>Próximos vencimentos</strong>{alerts.length ? alerts.map((item) => <button key={item.id} onClick={() => { setNotificationsOpen(false); setTransactionScope({ query: item.description }); go("transactions"); }}><span>{item.description}</span><small>{item.due_date ? shortDate.format(new Date(`${item.due_date}T00:00:00Z`)) : ""} • {reais(item.amount_cents)}</small></button>) : <p>Nenhuma pendência no momento.</p>}</div>}</div><button className="primary-button compact" onClick={() => setComposer(true)}><Plus size={18} />Novo lançamento</button></div></header>
        <div className="content">
          {dataLoading && <div className="data-loading"><LoaderCircle size={17} className="spin" />Atualizando seus dados…</div>}
          {dataError && <div className="data-error"><span>{dataError}</span><button onClick={() => void refresh()}>Tentar novamente</button></div>}
          {active === "dashboard" && <Dashboard period={period} setPeriod={setPeriod} name={displayName} data={data} realizedIncome={realizedIncome} realizedExpense={realizedExpense} forecastExpense={forecastExpense} onNew={() => setComposer(true)} onNavigate={go} />}
          {active === "transactions" && <TransactionsScreen key={`${transactionScope.query ?? ""}:${transactionScope.sourceId ?? ""}:${transactionScope.installmentId ?? ""}`} transactions={data.transactions} categories={data.categories} initialQuery={transactionScope.query} sourceId={transactionScope.sourceId} installmentId={transactionScope.installmentId} onNew={() => setComposer(true)} onTogglePaid={togglePaid} onDelete={deleteTransaction} />}
          {active === "planning" && <PlanningScreen transactions={data.transactions} accounts={data.accounts} cards={data.cards} recurrences={data.recurrences} onNew={() => setComposer(true)} />}
          {active === "accounts" && <AccountsScreen accounts={data.accounts} transactions={data.transactions} onNew={() => setEntityComposer({ kind: "account" })} onEdit={(item) => setEntityComposer({ kind: "account", item })} onActive={(item) => void setEntityActive("account", item)} onRemove={(item) => void removeEntity("account", item)} onStatement={(item) => { setTransactionScope({ sourceId: item.id }); go("transactions"); }} />}
          {active === "cards" && <CardsScreen cards={data.cards} transactions={data.transactions} onNew={() => setEntityComposer({ kind: "card" })} onEdit={(item) => setEntityComposer({ kind: "card", item })} onActive={(item) => void setEntityActive("card", item)} onRemove={(item) => void removeEntity("card", item)} onStatement={(item) => { setTransactionScope({ sourceId: item.id }); go("transactions"); }} />}
          {active === "installments" && <InstallmentsScreen groups={data.installments} transactions={data.transactions} onNew={() => setEntityComposer({ kind: "installment" })} onStatement={(item) => { setTransactionScope({ installmentId: item.id }); go("transactions"); }} onRemove={(item) => void deleteInstallmentPlan(item)} />}
          {active === "recurrences" && <RecurrencesScreen recurrences={data.recurrences} onNew={() => setEntityComposer({ kind: "recurrence" })} onToggle={toggleRecurrence} onEdit={(item) => setEntityComposer({ kind: "recurrence", item })} onRemove={(item) => void removeEntity("recurrence", item)} />}
          {active === "categories" && <CategoriesScreen categories={data.categories} onNew={() => setEntityComposer({ kind: "category" })} onNewSubcategory={(parent) => setEntityComposer({ kind: "category", parentId: parent.id })} onEdit={(item) => setEntityComposer({ kind: "category", item })} onActive={(item) => void setEntityActive("category", item)} onRemove={(item) => void removeEntity("category", item)} />}
          {active === "reports" && <ReportsScreen transactions={data.transactions} />}
          {active === "settings" && <SettingsScreen name={displayName} email={user.email ?? ""} emailVerified={Boolean(user.email_confirmed_at)} providers={(user.app_metadata.providers ?? [user.app_metadata.provider]).filter(Boolean) as string[]} theme={theme} colorMode={colorMode} onAppearance={saveAppearance} onSave={saveProfile} onPassword={changePassword} onResetData={resetFinanceData} onLogout={() => void supabase.auth.signOut()} />}
        </div>
      </main>
      <nav className="bottom-nav" aria-label="Navegação mobile">{[nav[0], nav[1], nav[2], nav[3]].map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "active" : ""} onClick={() => go(id)}><Icon size={20} /><span>{label.split(" ")[0]}</span></button>)}<button onClick={() => setMenuOpen(true)}><Menu size={20} /><span>Menu</span></button></nav>
      {composer && <TransactionModal categories={data.categories} accounts={data.accounts} cards={data.cards} onClose={() => setComposer(false)} onSave={saveTransaction} />}
      {entityComposer && <EntityModal kind={entityComposer.kind} item={entityComposer.item} parentId={entityComposer.parentId} accounts={data.accounts} cards={data.cards} categories={data.categories} onClose={() => setEntityComposer(null)} onSave={(value) => saveEntity(entityComposer, value)} />}
      {toast && <div className={`toast ${toast.error ? "toast-error" : ""}`}>{toast.error ? <X size={17} /> : <Check size={17} />}{toast.message}</div>}
    </div>
  );
}

function Dashboard({ period, setPeriod, name, data, realizedIncome, realizedExpense, forecastExpense, onNew, onNavigate }: { period: string; setPeriod: (value: string) => void; name: string; data: FinanceData; realizedIncome: number; realizedExpense: number; forecastExpense: number; onNew: () => void; onNavigate: (section: Section) => void }) {
  const periods = useMemo(() => Array.from({ length: 12 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - index); return dateKey(date); }), []);
  const shiftPeriod = (amount: number) => { const date = new Date(`${period}-01T12:00:00`); date.setMonth(date.getMonth() + amount); const next = dateKey(date); if (periods.includes(next)) setPeriod(next); };
  const monthly = data.transactions.filter((transaction) => transaction.competence_month.startsWith(period));
  const categories = Object.values(monthly.filter((transaction) => transaction.type === "expense" && isRealized(transaction)).reduce<Record<string, { name: string; value: number; color: string }>>((acc, transaction) => { const key = transaction.category?.name ?? "Sem categoria"; acc[key] ??= { name: key, value: 0, color: transaction.category?.color ?? "#718079" }; acc[key].value += transaction.amount_cents / 100; return acc; }, {})).sort((a, b) => b.value - a.value);
  const flow = Array.from({ length: 6 }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - (5 - index)); const key = dateKey(date); const items = data.transactions.filter((transaction) => transaction.competence_month.startsWith(key) && isRealized(transaction)); return { month: monthName.format(new Date(`${key}-01T00:00:00Z`)).replace(".", ""), entrada: items.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount_cents / 100, 0), despesa: items.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount_cents / 100, 0) }; });
  const upcoming = data.transactions.filter((transaction) => transaction.type === "expense" && transaction.due_date && isForecast(transaction)).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? "")).slice(0, 3);
  const futureInstallments = data.transactions.filter((transaction) => transaction.installment_group_id && isForecast(transaction)).reduce((sum, transaction) => sum + transaction.amount_cents, 0);
  return <>
    <section className="page-heading dashboard-heading"><div><span className="eyebrow">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date()).toUpperCase()}</span><h1>Olá, {name.split(" ")[0]}.</h1><p>{realizedIncome >= realizedExpense ? "Seu resultado realizado está equilibrado. As previsões aparecem separadamente." : "Os pagamentos já realizados superam as entradas recebidas neste mês."}</p></div><div className="heading-actions"><div className="period-control"><button onClick={() => shiftPeriod(-1)} disabled={period === periods.at(-1)} aria-label="Mês anterior"><ChevronLeft size={17} /></button><select value={period} onChange={(event) => setPeriod(event.target.value)}>{periods.map((value) => <option key={value} value={value}>{new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value}-01T00:00:00Z`))}</option>)}</select><button onClick={() => shiftPeriod(1)} disabled={period === periods[0]} aria-label="Próximo mês"><ChevronRight size={17} /></button></div><button className="secondary-button" onClick={() => onNavigate("reports")}><Download size={17} />Relatórios</button></div></section>
    <section className="metric-grid"><Metric label="Resultado realizado" value={reais(realizedIncome - realizedExpense)} note="somente valores confirmados" icon={WalletCards} accent="forest" /><Metric label="Entradas recebidas" value={reais(realizedIncome)} note={`${monthly.filter((item) => item.type === "income" && isRealized(item)).length} recebimentos`} icon={ArrowDownLeft} accent="green" /><Metric label="Despesas pagas" value={reais(realizedExpense)} note={`${monthly.filter((item) => item.type === "expense" && isRealized(item)).length} pagamentos`} icon={ArrowUpRight} accent="coral" /><Metric label="Próximas saídas" value={reais(forecastExpense)} note={`${monthly.filter((item) => item.type === "expense" && isForecast(item)).length} previstas`} icon={Clock3} accent="gold" /></section>
    <section className="dashboard-grid">
      <article className="panel flow-panel"><PanelHeader title="Fluxo mensal" subtitle="Dados reais dos últimos 6 meses" /><div className="chart-legend"><span><i className="dot income" />Entradas</span><span><i className="dot expense" />Despesas</span></div><div className="flow-chart">{flow.some((item) => item.entrada || item.despesa) ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={flow} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 4" /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}k`} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="entrada" stroke="var(--green)" strokeWidth={2.5} fill="color-mix(in srgb, var(--green) 13%, transparent)" /><Area type="monotone" dataKey="despesa" stroke="var(--coral)" strokeWidth={2.2} fill="transparent" strokeDasharray="5 4" /></AreaChart></ResponsiveContainer> : <EmptyState compact title="Sem histórico ainda" description="Os próximos lançamentos formarão este gráfico." />}</div></article>
      <article className="panel spending-panel"><PanelHeader title="Gastos por categoria" subtitle="Somente despesas pagas neste mês" /><div className="donut-wrap">{categories.length ? <><div className="donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categories} dataKey="value" innerRadius={58} outerRadius={78} paddingAngle={2} stroke="none">{categories.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer><div className="donut-total"><span>Total pago</span><strong>{reais(realizedExpense)}</strong></div></div><div className="category-legend">{categories.slice(0, 5).map((item) => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{realizedExpense ? Math.round(item.value * 10000 / realizedExpense) : 0}%</strong></div>)}</div></> : <EmptyState compact title="Sem despesas pagas" description="Os valores previstos ficam no Planejamento." />}</div><button className="text-button" onClick={() => onNavigate("reports")}>Ver relatório completo <ArrowRight size={15} /></button></article>
      <article className="panel transactions-panel"><PanelHeader title="Lançamentos recentes" subtitle="Últimas movimentações"><button className="text-button" onClick={() => onNavigate("transactions")}>Ver todos <ArrowRight size={15} /></button></PanelHeader>{data.transactions.length ? <TransactionList transactions={data.transactions.slice(0, 5)} /> : <EmptyState title="Nenhum lançamento" description="Cadastre sua primeira entrada ou despesa." action="Novo lançamento" onAction={onNew} />}</article>
      <article className="panel due-panel"><PanelHeader title="Próximos vencimentos" subtitle={`Parcelas futuras: ${reais(futureInstallments)}`}><span className="count-badge">{upcoming.length}</span></PanelHeader>{upcoming.length ? <div className="due-list">{upcoming.map((transaction) => <DueItem key={transaction.id} transaction={transaction} />)}</div> : <EmptyState compact title="Tudo em dia" description="Nenhum vencimento pendente." />}<button className="secondary-button full" onClick={onNew}><Plus size={16} />Adicionar lançamento</button></article>
    </section>
  </>;
}

function Metric({ label, value, note, icon: Icon, accent }: { label: string; value: string; note: string; icon: LucideIcon; accent: string }) { return <article className="metric-card"><div className={`metric-icon ${accent}`}><Icon size={19} /></div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div></article>; }

function TransactionsScreen({ transactions, categories, initialQuery = "", sourceId, installmentId, onNew, onTogglePaid, onDelete }: { transactions: TransactionRow[]; categories: Category[]; initialQuery?: string; sourceId?: string; installmentId?: string; onNew: () => void; onTogglePaid: (transaction: TransactionRow) => void; onDelete: (transaction: TransactionRow) => void }) {
  const [query, setQuery] = useState(initialQuery); const [status, setStatus] = useState("Todos"); const [type, setType] = useState("Todos"); const [categoryId, setCategoryId] = useState(""); const [advanced, setAdvanced] = useState(Boolean(sourceId || installmentId));
  const filtered = transactions.filter((transaction) => transaction.description.toLowerCase().includes(query.toLowerCase()) && (status === "Todos" || statusLabel[transaction.status] === status) && (type === "Todos" || transaction.type === type) && (!categoryId || transaction.category_id === categoryId) && (!sourceId || transaction.account_id === sourceId || transaction.credit_card_id === sourceId) && (!installmentId || transaction.installment_group_id === installmentId));
  const totalIncome = transactions.filter((item) => item.type === "income" && isRealized(item)).reduce((sum, item) => sum + item.amount_cents, 0); const totalExpense = transactions.filter((item) => item.type === "expense" && isRealized(item)).reduce((sum, item) => sum + item.amount_cents, 0);
  return <><PageTitle eyebrow="MOVIMENTAÇÕES" title="Lançamentos" subtitle="Os totais consideram apenas valores já pagos ou recebidos." action={<button className="primary-button" onClick={onNew}><Plus size={18} />Novo lançamento</button>} /><div className="summary-strip"><div><span>Entradas recebidas</span><strong className="positive">{reais(totalIncome)}</strong></div><div><span>Despesas pagas</span><strong>{reais(totalExpense)}</strong></div><div><span>Resultado realizado</span><strong>{reais(totalIncome - totalExpense)}</strong></div></div><section className="panel data-panel transaction-data-panel"><div className="filter-row"><label className="search-box wide"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por descrição..." /></label><select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por status"><option>Todos</option><option>Pago</option><option>Pendente</option><option>Agendado</option><option>Atrasado</option><option>Cancelado</option></select><button className={`secondary-button ${advanced ? "active-filter" : ""}`} onClick={() => setAdvanced(!advanced)} aria-expanded={advanced}><Filter size={16} />Filtros</button></div>{advanced && <div className="advanced-filters"><select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filtrar por tipo"><option value="Todos">Todos os tipos</option><option value="income">Entradas</option><option value="expense">Despesas</option></select><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-label="Filtrar por categoria"><option value="">Todas as categorias</option><CategoryOptions categories={categories} /></select><button onClick={() => { setType("Todos"); setCategoryId(""); setStatus("Todos"); setQuery(""); }}>Limpar filtros</button>{(sourceId || installmentId) && <span>Exibindo apenas o extrato selecionado</span>}</div>}{filtered.length ? <div className="table-wrap"><table className="transaction-table"><thead><tr><th>Descrição</th><th>Categoria</th><th>Conta/cartão</th><th>Data</th><th>Status</th><th className="align-right">Valor</th><th /></tr></thead><tbody>{filtered.map((transaction) => <TransactionTableRow key={transaction.id} transaction={transaction} onTogglePaid={onTogglePaid} onDelete={onDelete} />)}</tbody></table></div> : <EmptyState title="Nenhum resultado" description={transactions.length ? "Altere a busca ou os filtros." : "Crie seu primeiro lançamento."} action={transactions.length ? undefined : "Novo lançamento"} onAction={onNew} />}</section></>;
}

function AccountsScreen({ accounts, transactions, onNew, onEdit, onActive, onRemove, onStatement }: { accounts: Account[]; transactions: TransactionRow[]; onNew: () => void; onEdit: (item: Account) => void; onActive: (item: Account) => void; onRemove: (item: Account) => void; onStatement: (item: Account) => void }) {
  const balance = (account: Account) => accountBalance(account, transactions);
  const total = accounts.reduce((sum, account) => sum + balance(account), 0);
  return <><PageTitle eyebrow="PATRIMÔNIO" title="Contas" subtitle="Saldos calculados a partir dos lançamentos pagos." action={<button className="primary-button" onClick={onNew}><Plus size={18} />Nova conta</button>} /><div className="account-total panel"><div><span>Saldo total disponível</span><strong>{reais(total)}</strong><small><TrendingUp size={14} />{accounts.filter((item) => item.active).length} contas ativas</small></div><div className="balance-art"><span /><span /><span /></div></div>{accounts.length ? <div className="card-grid thirds">{accounts.map((account) => <AccountCard key={account.id} account={account} balance={balance(account)} onEdit={() => onEdit(account)} onActive={() => onActive(account)} onRemove={() => onRemove(account)} onStatement={() => onStatement(account)} />)}</div> : <section className="panel"><EmptyState title="Nenhuma conta cadastrada" description="Cadastre uma conta ou carteira para começar." action="Nova conta" onAction={onNew} /></section>}</>;
}

function CardsScreen({ cards, transactions, onNew, onEdit, onActive, onRemove, onStatement }: { cards: CreditCardRow[]; transactions: TransactionRow[]; onNew: () => void; onEdit: (item: CreditCardRow) => void; onActive: (item: CreditCardRow) => void; onRemove: (item: CreditCardRow) => void; onStatement: (item: CreditCardRow) => void }) {
  return <><PageTitle eyebrow="CRÉDITO" title="Cartões" subtitle="Faturas calculadas a partir das compras vinculadas." action={<button className="primary-button" onClick={onNew}><Plus size={18} />Novo cartão</button>} />{cards.length ? <div className="card-grid halves">{cards.map((card, index) => { const used = transactions.filter((item) => item.credit_card_id === card.id && item.type === "expense" && item.status !== "cancelled").reduce((sum, item) => sum + item.amount_cents, 0); return <CreditCardView key={card.id} card={card} used={used} gradient={index % 2 ? "charcoal" : "purple"} onEdit={() => onEdit(card)} onActive={() => onActive(card)} onRemove={() => onRemove(card)} onStatement={() => onStatement(card)} />; })}</div> : <section className="panel"><EmptyState title="Nenhum cartão cadastrado" description="Adicione um cartão para acompanhar limite e fatura." action="Novo cartão" onAction={onNew} /></section>}</>;
}

function InstallmentsScreen({ groups, transactions, onNew, onStatement, onRemove }: { groups: InstallmentGroup[]; transactions: TransactionRow[]; onNew: () => void; onStatement: (item: InstallmentGroup) => void; onRemove: (item: InstallmentGroup) => void }) {
  const remaining = transactions.filter((item) => item.installment_group_id && isForecast(item)).reduce((sum, item) => sum + item.amount_cents, 0);
  return <><PageTitle eyebrow="PLANEJAMENTO" title="Parcelamentos" subtitle="Acompanhe suas compras parceladas e o que ainda falta pagar." action={<button className="primary-button" onClick={onNew}><Plus size={18} />Nova compra parcelada</button>} /><div className="summary-strip"><div><span>Saldo parcelado</span><strong>{reais(remaining)}</strong></div><div><span>Planos ativos</span><strong>{groups.length}</strong></div><div><span>Parcelas futuras</span><strong>{transactions.filter((item) => item.installment_group_id && isForecast(item)).length}</strong></div></div>{groups.length ? <div className="plans-grid">{groups.map((group) => { const items = transactions.filter((item) => item.installment_group_id === group.id); const paid = items.filter(isRealized).reduce((sum, item) => sum + item.amount_cents, 0); const progress = group.total_amount_cents ? Math.round(paid / group.total_amount_cents * 100) : 0; const next = items.filter(isForecast).sort((a, b) => (a.due_date ?? "").localeCompare(b.due_date ?? ""))[0]; return <article className="panel plan-card" key={group.id}><div className="plan-top"><span className="plan-icon"><CalendarClock /></span><ActionMenu label="Ações do parcelamento" items={[{ label: "Ver parcelas", icon: ReceiptText, onClick: () => onStatement(group) }, { label: "Excluir parcelamento", icon: Trash2, danger: true, onClick: () => onRemove(group) }]} /></div><h3>{group.description}</h3><p>{items.filter(isRealized).length} de {group.installments_count} parcelas pagas</p><div className="progress"><span style={{ width: `${progress}%` }} /></div><div className="plan-values"><span><small>Pago</small><strong>{reais(paid)}</strong></span><span><small>Total</small><strong>{reais(group.total_amount_cents)}</strong></span></div><div className="next-installment"><Clock3 size={15} /><span>Próxima</span><strong>{next ? `${reais(next.amount_cents)} • ${shortDate.format(new Date(`${next.due_date}T00:00:00Z`))}` : "Concluído"}</strong></div></article>; })}</div> : <section className="panel"><EmptyState title="Nenhum parcelamento" description="Crie uma compra parcelada para acompanhar cada vencimento." action="Nova compra parcelada" onAction={onNew} /></section>}</>;
}

type PlanningItem = {
  id: string;
  type: TransactionRow["type"];
  description: string;
  amount_cents: number;
  date: string;
  month: string;
  categoryName: string;
  categoryIcon: string | null;
  sourceName: string;
  status: TransactionRow["status"] | "recurring";
};

function PlanningScreen({ transactions, accounts, cards, recurrences, onNew }: { transactions: TransactionRow[]; accounts: Account[]; cards: CreditCardRow[]; recurrences: Recurrence[]; onNew: () => void }) {
  const currentMonth = dateKey();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const forecast = transactions.filter(isForecast);
  const forecastMonth = (transaction: TransactionRow) => transactionMonth(transaction) < currentMonth ? currentMonth : transactionMonth(transaction);
  const materializedOccurrences = new Set(transactions.filter((transaction) => transaction.recurrence_id).map((transaction) => `${transaction.recurrence_id}:${transactionMonth(transaction)}`));
  const monthlyExpenses = recurrences.filter((recurrence) => recurrence.active && recurrence.type === "expense" && recurrence.frequency === "monthly");
  const recurrenceItemsForMonth = (month: string): PlanningItem[] => monthlyExpenses
    .filter((recurrence) => recurrenceCoversMonth(recurrence, month) && !materializedOccurrences.has(`${recurrence.id}:${month}`))
    .map((recurrence) => ({
      id: `recurrence:${recurrence.id}:${month}`,
      type: "expense",
      description: recurrence.description,
      amount_cents: recurrence.amount_cents,
      date: recurrenceDate(recurrence, month),
      month,
      categoryName: recurrence.category?.name ?? "Sem categoria",
      categoryIcon: null,
      sourceName: recurrence.account_id ? accounts.find((account) => account.id === recurrence.account_id)?.name ?? "Conta definida" : recurrence.credit_card_id ? cards.find((card) => card.id === recurrence.credit_card_id)?.name ?? "Cartão definido" : "Origem recorrente",
      status: "recurring",
    }));
  const forecastItems: PlanningItem[] = forecast.map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    description: transaction.description,
    amount_cents: transaction.amount_cents,
    date: transaction.due_date ?? transaction.transaction_date,
    month: forecastMonth(transaction),
    categoryName: transaction.category?.name ?? "Sem categoria",
    categoryIcon: transaction.category?.icon ?? null,
    sourceName: transaction.account?.name ?? transaction.credit_card?.name ?? "Sem origem",
    status: transaction.status,
  }));
  const recurringExpenseThrough = (month: string) => monthlyExpenses.reduce((total, recurrence) => {
    let firstMonth = recurrence.start_date.slice(0, 7) > currentMonth ? recurrence.start_date.slice(0, 7) : currentMonth;
    if (!recurrenceCoversMonth(recurrence, firstMonth)) firstMonth = shiftMonthKey(firstMonth, 1);
    let lastMonth = recurrence.end_date && recurrence.end_date.slice(0, 7) < month ? recurrence.end_date.slice(0, 7) : month;
    if (!recurrenceCoversMonth(recurrence, lastMonth)) lastMonth = shiftMonthKey(lastMonth, -1);
    if (firstMonth > lastMonth) return total;
    const coveredMonths = monthOrdinal(lastMonth) - monthOrdinal(firstMonth) + 1;
    const alreadyMaterialized = new Set(transactions
      .filter((transaction) => transaction.recurrence_id === recurrence.id)
      .map(transactionMonth)
      .filter((transactionMonthKey) => transactionMonthKey >= firstMonth && transactionMonthKey <= lastMonth)).size;
    return total + Math.max(coveredMonths - alreadyMaterialized, 0) * recurrence.amount_cents;
  }, 0);
  const currentBalance = accounts.reduce((sum, account) => sum + accountBalance(account, transactions), 0);
  const projectionThrough = (month: string) => currentBalance + forecast.filter((transaction) => forecastMonth(transaction) <= month).reduce((sum, transaction) => sum + signedAmount(transaction), 0) - recurringExpenseThrough(month);
  const selectedItems = [...forecastItems.filter((item) => item.month === selectedMonth), ...recurrenceItemsForMonth(selectedMonth)].sort((a, b) => a.date.localeCompare(b.date));
  const expectedIncome = selectedItems.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount_cents, 0);
  const expectedExpense = selectedItems.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount_cents, 0);
  const projectedBalance = projectionThrough(selectedMonth);
  const selectedLabel = fullMonthName.format(new Date(`${selectedMonth}-01T00:00:00Z`));
  const horizon = Array.from({ length: 6 }, (_, index) => { const key = shiftMonthKey(selectedMonth, index); const items = [...forecastItems.filter((item) => item.month === key), ...recurrenceItemsForMonth(key)]; return { key, month: monthName.format(new Date(`${key}-01T00:00:00Z`)).replace(".", ""), saldo: projectionThrough(key) / 100, entrada: items.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount_cents / 100, 0), despesa: items.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount_cents / 100, 0) }; });
  const nextTwelveMonths = Array.from({ length: 12 }, (_, index) => shiftMonthKey(currentMonth, index));
  const firstNegativeMonth = nextTwelveMonths.find((month) => projectionThrough(month) < 0);
  const commitment = expectedIncome ? Math.round(expectedExpense / expectedIncome * 100) : expectedExpense ? 100 : 0;
  const changeMonth = (amount: number) => { const next = shiftMonthKey(selectedMonth, amount); if (next >= currentMonth) setSelectedMonth(next); };

  return <>
    <PageTitle eyebrow="VISÃO DE FUTURO" title="Planejamento" subtitle="Antecipe lançamentos futuros e despesas recorrentes mensais sem misturá-los ao realizado." action={<div className="planning-heading-actions"><div className="planning-month-control"><button type="button" onClick={() => changeMonth(-1)} disabled={selectedMonth === currentMonth} aria-label="Mês anterior"><ChevronLeft size={18} /></button><input type="month" min={currentMonth} value={selectedMonth} onChange={(event) => { if (event.target.value >= currentMonth) setSelectedMonth(event.target.value); }} aria-label="Mês do planejamento" /><button type="button" onClick={() => changeMonth(1)} aria-label="Próximo mês"><ChevronRight size={18} /></button></div><button className="primary-button" onClick={onNew}><Plus size={18} />Novo agendamento</button></div>} />

    <section className="planning-hero panel">
      <div className="planning-hero-copy"><span>Saldo estimado ao fim de {selectedLabel}</span><strong>{reais(projectedBalance)}</strong><p>Saldo disponível hoje somado aos lançamentos previstos e às despesas recorrentes mensais ativas até o mês selecionado.</p></div>
      <div className="planning-hero-values"><span><small>Saldo disponível hoje</small><b>{reais(currentBalance)}</b></span><span><small>Variação prevista acumulada</small><b className={projectedBalance - currentBalance >= 0 ? "positive" : "negative"}>{reais(projectedBalance - currentBalance)}</b></span></div>
    </section>

    <section className="planning-summary">
      <article className="panel planning-kpi"><span className="planning-kpi-icon income"><ArrowDownLeft size={19} /></span><div><small>Entradas previstas</small><strong className="positive">{reais(expectedIncome)}</strong><p>{selectedItems.filter((item) => item.type === "income").length} lançamentos em {selectedLabel}</p></div></article>
      <article className="panel planning-kpi"><span className="planning-kpi-icon expense"><ArrowUpRight size={19} /></span><div><small>Saídas previstas</small><strong className="negative">{reais(expectedExpense)}</strong><p>{selectedItems.filter((item) => item.type === "expense").length} compromissos no mês</p></div></article>
      <article className="panel planning-kpi"><span className="planning-kpi-icon result"><WalletCards size={19} /></span><div><small>Resultado previsto do mês</small><strong className={expectedIncome - expectedExpense >= 0 ? "positive" : "negative"}>{reais(expectedIncome - expectedExpense)}</strong><p>Sem alterar os totais realizados</p></div></article>
    </section>

    <section className="planning-grid">
      <article className="panel planning-chart-panel"><PanelHeader title="Trajetória projetada" subtitle={`Saldo acumulado a partir de ${selectedLabel}`} /><div className="planning-chart">{accounts.length || forecast.length || monthlyExpenses.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={horizon} margin={{ top: 16, right: 18, bottom: 0, left: -8 }}><defs><linearGradient id="planningBalance" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--forest-2)" stopOpacity=".34" /><stop offset="100%" stopColor="var(--forest-2)" stopOpacity="0" /></linearGradient></defs><CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 4" /><XAxis dataKey="month" tickLine={false} axisLine={false} /><YAxis tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} /><Tooltip content={<ChartTooltip />} /><Area type="monotone" dataKey="saldo" name="Saldo projetado" stroke="var(--forest-2)" strokeWidth={3} fill="url(#planningBalance)" /></AreaChart></ResponsiveContainer> : <EmptyState compact title="Sem projeção ainda" description="Cadastre um saldo, um lançamento futuro ou uma recorrência mensal." />}</div><div className="planning-chart-legend"><span><i />Saldo projetado</span><small>Inclui recorrências mensais ativas. Quando o lançamento da recorrência já existe, ele prevalece e o valor não é duplicado.</small></div></article>
      <article className={`panel planning-health ${firstNegativeMonth ? "at-risk" : "healthy"}`}><span className="planning-health-icon">{firstNegativeMonth ? <Clock3 size={22} /> : <ShieldCheck size={22} />}</span><small>LEITURA DOS PRÓXIMOS 12 MESES</small><h3>{firstNegativeMonth ? "Atenção ao caixa futuro" : "Horizonte financeiramente saudável"}</h3><p>{firstNegativeMonth ? `Pelos lançamentos atuais, o saldo pode ficar negativo em ${fullMonthName.format(new Date(`${firstNegativeMonth}-01T00:00:00Z`))}.` : "Nenhum dos próximos doze meses termina com saldo projetado negativo."}</p><div className="planning-health-facts"><span><small>Comprometimento no mês</small><strong>{commitment}%</strong></span><span><small>Lançamentos previstos</small><strong>{selectedItems.length}</strong></span></div></article>
    </section>

    <section className="panel planning-agenda"><PanelHeader title={`Agenda de ${selectedLabel}`} subtitle="Lançamentos não realizados e recorrências mensais ativas"><span className="count-badge">{selectedItems.length}</span></PanelHeader>{selectedItems.length ? <div className="planning-list">{selectedItems.map((item) => { const date = new Date(`${item.date}T00:00:00Z`); const positive = item.type === "income"; const label = item.status === "recurring" ? "Recorrente" : statusLabel[item.status]; return <article className="planning-item" key={item.id}><span className="date-block"><strong>{String(date.getUTCDate()).padStart(2, "0")}</strong><small>{monthName.format(date).replace(".", "").toUpperCase()}</small></span><span className="tx-icon">{item.status === "recurring" ? <RefreshCw size={17} /> : <CategoryGlyph icon={item.categoryIcon} size={17} />}</span><div><strong>{item.description}</strong><small>{item.categoryName} • {item.sourceName}{item.status === "recurring" ? " • mensal" : ""}</small></div><span className={`status status-${label.toLowerCase()}`}>{label}</span><strong className={positive ? "positive" : "negative"}>{positive ? "+ " : "− "}{reais(item.amount_cents)}</strong></article>; })}</div> : <EmptyState title="Nenhum valor previsto neste mês" description="Você pode navegar para outro mês ou criar um novo agendamento." action="Novo agendamento" onAction={onNew} />}</section>
  </>;
}

function RecurrencesScreen({ recurrences, onNew, onToggle, onEdit, onRemove }: { recurrences: Recurrence[]; onNew: () => void; onToggle: (recurrence: Recurrence) => void; onEdit: (recurrence: Recurrence) => void; onRemove: (recurrence: Recurrence) => void }) { return <><PageTitle eyebrow="AUTOMAÇÃO" title="Recorrências" subtitle="Despesas e entradas que se repetem automaticamente." action={<button className="primary-button" onClick={onNew}><Plus size={18} />Nova recorrência</button>} />{recurrences.length ? <section className="panel recurring-list">{recurrences.map((recurrence) => <div className="recurring-row" key={recurrence.id}><span className="tx-icon"><RefreshCw size={18} /></span><div><strong>{recurrence.description}</strong><small>{recurrence.category?.name ?? "Sem categoria"} • {frequencyLabel[recurrence.frequency]}{recurrence.day_of_month ? `, dia ${recurrence.day_of_month}` : ""}</small></div><strong className="recurring-amount">{reais(recurrence.amount_cents)}</strong><button className={`toggle ${recurrence.active ? "on" : ""}`} onClick={() => onToggle(recurrence)} aria-label={recurrence.active ? "Pausar" : "Ativar"}><span /></button><ActionMenu label={`Ações de ${recurrence.description}`} items={[{ label: "Editar", icon: Pencil, onClick: () => onEdit(recurrence) }, { label: recurrence.active ? "Pausar" : "Ativar", icon: RefreshCw, onClick: () => onToggle(recurrence) }, { label: "Remover", icon: Trash2, danger: true, onClick: () => onRemove(recurrence) }]} /></div>)}</section> : <section className="panel"><EmptyState title="Nenhuma recorrência" description="Automatize aluguel, assinaturas e outras movimentações." action="Nova recorrência" onAction={onNew} /></section>}</>;
}

function CategoriesScreen({ categories, onNew, onNewSubcategory, onEdit, onActive, onRemove }: { categories: Category[]; onNew: () => void; onNewSubcategory: (parent: Category) => void; onEdit: (category: Category) => void; onActive: (category: Category) => void; onRemove: (category: Category) => void }) {
  const roots = categories.filter((category) => !category.parent_id);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(roots.filter((root) => categories.some((category) => category.parent_id === root.id)).map((root) => root.id)));
  const toggle = (id: string) => setExpanded((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const addSubcategory = (parent: Category) => { setExpanded((current) => new Set(current).add(parent.id)); onNewSubcategory(parent); };

  return <>
    <PageTitle eyebrow="ORGANIZAÇÃO" title="Categorias" subtitle="Organize seus lançamentos em categorias e subcategorias." action={<button className="primary-button" onClick={onNew}><Plus size={18} />Nova categoria</button>} />
    {roots.length ? <>
      <div className="category-grid">{roots.map((category) => {
        const children = categories.filter((item) => item.parent_id === category.id);
        const isExpanded = expanded.has(category.id);
        const regionId = `subcategories-${category.id}`;
        return <article className={`panel category-card ${category.active ? "" : "is-inactive"}`} key={category.id}>
          <div className="category-card-head"><span className="category-icon" style={{ background: `${category.color}18`, color: category.color }}><CategoryGlyph icon={category.icon} size={21} /></span><div className="category-copy"><strong>{category.name}</strong><small>{category.type === "income" ? "Entrada" : "Despesa"}{category.active ? "" : " • Inativa"}</small></div><ActionMenu label={`Ações de ${category.name}`} items={[{ label: "Nova subcategoria", icon: Plus, onClick: () => addSubcategory(category) }, { label: "Editar categoria", icon: Pencil, onClick: () => onEdit(category) }, { label: category.active ? "Desativar" : "Ativar", icon: RefreshCw, onClick: () => onActive(category) }, { label: "Remover", icon: Trash2, danger: true, onClick: () => onRemove(category) }]} /></div>
          <button type="button" className="category-expand" onClick={() => toggle(category.id)} aria-expanded={isExpanded} aria-controls={regionId}><span>{children.length ? `${children.length} ${children.length === 1 ? "subcategoria" : "subcategorias"}` : "Adicionar subcategoria"}</span><ChevronDown size={17} className={isExpanded ? "rotated" : ""} /></button>
          {isExpanded && <div className="subcategory-list" id={regionId}>{children.map((child) => <div className={`subcategory-row ${child.active ? "" : "is-inactive"}`} key={child.id}><span className="subcategory-line" /><span className="subcategory-icon" style={{ color: child.color }}><CategoryGlyph icon={child.icon} size={16} /></span><div><strong>{child.name}</strong><small>{child.active && category.active ? "Disponível nos lançamentos" : "Inativa"}</small></div><ActionMenu label={`Ações da subcategoria ${child.name}`} items={[{ label: "Editar", icon: Pencil, onClick: () => onEdit(child) }, { label: child.active ? "Desativar" : "Ativar", icon: RefreshCw, onClick: () => onActive(child) }, { label: "Remover", icon: Trash2, danger: true, onClick: () => onRemove(child) }]} /></div>)}<button type="button" className="add-subcategory" onClick={() => addSubcategory(category)}><Plus size={15} />{children.length ? "Adicionar outra" : "Criar primeira subcategoria"}</button></div>}
        </article>;
      })}</div>
    </> : <section className="panel"><EmptyState title="Nenhuma categoria" description="Crie sua primeira categoria para organizar os lançamentos." action="Nova categoria" onAction={onNew} /></section>}
  </>;
}

function ReportsScreen({ transactions }: { transactions: TransactionRow[] }) {
  const [months, setMonths] = useState(6);
  const flow = Array.from({ length: months }, (_, index) => { const date = new Date(); date.setMonth(date.getMonth() - (months - 1 - index)); const key = dateKey(date); const items = transactions.filter((transaction) => transaction.competence_month.startsWith(key) && isRealized(transaction)); return { key, month: monthName.format(new Date(`${key}-01T00:00:00Z`)).replace(".", ""), entrada: items.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount_cents / 100, 0), despesa: items.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount_cents / 100, 0) }; });
  const periodKeys = new Set(flow.map((item) => item.key)); const scoped = transactions.filter((item) => periodKeys.has(item.competence_month.slice(0, 7)) && isRealized(item)); const totalIncome = scoped.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount_cents, 0); const totalExpense = scoped.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount_cents, 0);
  return <><PageTitle eyebrow="ANÁLISES" title="Relatórios" subtitle="Consolidação somente do que já foi pago ou recebido." action={<button className="secondary-button" onClick={() => window.print()}><Download size={17} />Exportar</button>} /><div className="report-filters">{[{ value: 3, label: "Trimestral" }, { value: 6, label: "Semestral" }, { value: 12, label: "Anual" }].map((option) => <button key={option.value} className={months === option.value ? "active" : ""} onClick={() => setMonths(option.value)}>{option.label}</button>)}</div><div className="report-grid"><article className="panel report-wide"><PanelHeader title="Evolução realizada" subtitle={`Recebimentos e pagamentos nos últimos ${months} meses`} /><div className="report-chart">{flow.some((item) => item.entrada || item.despesa) ? <ResponsiveContainer width="100%" height="100%"><BarChart data={flow} barGap={5}><CartesianGrid vertical={false} stroke="var(--line)" /><XAxis dataKey="month" axisLine={false} tickLine={false} /><YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `${value / 1000}k`} /><Tooltip content={<ChartTooltip />} /><Bar dataKey="entrada" name="Entradas recebidas" fill="var(--green)" radius={[5, 5, 0, 0]} /><Bar dataKey="despesa" name="Despesas pagas" fill="var(--coral)" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyState title="Sem dados realizados" description="Marque lançamentos como pagos para gerar o relatório." />}</div></article><article className="panel"><PanelHeader title="Resumo realizado" /><div className="report-summary"><div><span>Receitas recebidas</span><strong>{reais(totalIncome)}</strong></div><div><span>Despesas pagas</span><strong>{reais(totalExpense)}</strong></div><div><span>Resultado realizado</span><strong className="positive">{reais(totalIncome - totalExpense)}</strong></div><div><span>Taxa de economia</span><strong>{totalIncome ? Math.round((totalIncome - totalExpense) / totalIncome * 100) : 0}%</strong></div></div></article></div></>;
}

function SettingsScreen({ name, email, emailVerified, providers, theme, colorMode, onAppearance, onSave, onPassword, onResetData, onLogout }: { name: string; email: string; emailVerified: boolean; providers: string[]; theme: ThemeId; colorMode: ColorMode; onAppearance: (theme: ThemeId, mode: ColorMode) => void | Promise<void>; onSave: (name: string) => void | Promise<void>; onPassword: (current: string, password: string) => Promise<boolean>; onResetData: (current: string) => Promise<boolean>; onLogout: () => void }) {
  const [tab, setTab] = useState<"general" | "security" | "appearance">("general"); const [profileName, setProfileName] = useState(name); const [currentPassword, setCurrentPassword] = useState(""); const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [passwordError, setPasswordError] = useState(""); const [savingPassword, setSavingPassword] = useState(false);
  const [resetOpen, setResetOpen] = useState(false); const [resetPassword, setResetPassword] = useState(""); const [resetError, setResetError] = useState(""); const [resetting, setResetting] = useState(false);
  const hasPassword = providers.includes("email"); const hasGoogle = providers.includes("google");
  const submitReset = async (event: React.FormEvent) => { event.preventDefault(); setResetError(""); if (!resetPassword) { setResetError("Digite sua senha atual."); return; } setResetting(true); const cleared = await onResetData(resetPassword); setResetting(false); if (cleared) { setResetPassword(""); setResetOpen(false); } else setResetError("Não foi possível confirmar a senha ou apagar os dados."); };
  const submitPassword = async (event: React.FormEvent) => { event.preventDefault(); setPasswordError(""); if (password.length < 8) { setPasswordError("A nova senha precisa ter ao menos 8 caracteres."); return; } if (password !== confirmPassword) { setPasswordError("A confirmação não corresponde à nova senha."); return; } if (currentPassword === password) { setPasswordError("Escolha uma senha diferente da atual."); return; } setSavingPassword(true); const changed = await onPassword(currentPassword, password); setSavingPassword(false); if (changed) { setCurrentPassword(""); setPassword(""); setConfirmPassword(""); } };
  return <><PageTitle eyebrow="PREFERÊNCIAS" title="Configurações" subtitle="Personalize sua experiência e proteja sua conta." /><div className="settings-layout"><div className="settings-menu" role="tablist" aria-label="Configurações"><button role="tab" aria-selected={tab === "general"} className={tab === "general" ? "active" : ""} onClick={() => setTab("general")}><Settings size={17} />Geral</button><button role="tab" aria-selected={tab === "security"} className={tab === "security" ? "active" : ""} onClick={() => setTab("security")}><ShieldCheck size={17} />Segurança</button><button role="tab" aria-selected={tab === "appearance"} className={tab === "appearance" ? "active" : ""} onClick={() => setTab("appearance")}><Palette size={17} />Aparência</button></div>
    {tab === "general" && <section className="panel settings-panel" role="tabpanel"><h2>Preferências gerais</h2><p>Atualize os dados do seu perfil.</p><div className="settings-field"><span><strong>Nome</strong><small>Exibido somente dentro da sua conta</small></span><input value={profileName} maxLength={80} autoComplete="name" onChange={(event) => setProfileName(event.target.value)} /></div><div className="settings-field"><span><strong>E-mail</strong><small>Seu endereço de acesso à conta</small></span><input value={email} disabled /></div><div className="danger-zone"><span><strong>Recomeçar do zero</strong><small>Apaga contas, cartões, lançamentos, recorrências e demais dados financeiros. Seu acesso permanece ativo e as categorias iniciais são recriadas.</small>{!hasPassword && <em>Para sua segurança, esta ação exige uma conta com senha.</em>}</span><button type="button" className="danger-button" disabled={!hasPassword} onClick={() => setResetOpen(true)}><Trash2 size={17} />Apagar todos os dados</button></div><div className="settings-actions"><button className="danger-button" onClick={onLogout}><LogOut size={17} />Sair</button><button className="primary-button" onClick={() => void onSave(profileName)}><Check size={17} />Salvar alterações</button></div></section>}
    {tab === "security" && <section className="panel settings-panel" role="tabpanel"><h2>Segurança da conta</h2><p>Provedores conectados e credenciais da sua conta.</p><div className="security-status"><ShieldCheck size={19} /><span><strong>E-mail {emailVerified ? "confirmado" : "ainda não confirmado"}</strong><small>{hasGoogle ? "Conta Google conectada com OAuth seguro." : emailVerified ? "Sua identidade de e-mail foi verificada." : "Abra a mensagem de confirmação enviada para seu e-mail."}</small></span><div className="provider-pills">{hasGoogle && <i><b className="google-mark">G</b>Google</i>}{hasPassword && <i><KeyRound size={12} />E-mail e senha</i>}</div></div>{hasPassword ? <form onSubmit={submitPassword}><div className="settings-field"><span><strong>Senha atual</strong><small>Confirmamos sua identidade antes da troca</small></span><input type="password" required autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div><div className="settings-field"><span><strong>Nova senha</strong><small>Mínimo de 8 caracteres</small></span><input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></div><div className="settings-field"><span><strong>Confirmar nova senha</strong><small>Repita a senha escolhida</small></span><input type="password" required minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div>{passwordError && <div className="auth-alert error">{passwordError}</div>}<div className="settings-actions"><button type="button" className="danger-button" onClick={onLogout}><LogOut size={17} />Encerrar sessão</button><button className="primary-button" type="submit" disabled={savingPassword}>{savingPassword ? <LoaderCircle className="spin" size={17} /> : <KeyRound size={17} />}Atualizar senha</button></div></form> : <><div className="oauth-security-card"><b className="google-mark">G</b><span><strong>Protegida pela sua Conta Google</strong><small>Senha e verificação em duas etapas são gerenciadas diretamente pelo Google.</small></span></div><div className="settings-actions"><button type="button" className="danger-button" onClick={onLogout}><LogOut size={17} />Encerrar sessão</button></div></>}</section>}
    {tab === "appearance" && <section className="panel settings-panel appearance-panel" role="tabpanel"><div className="appearance-heading"><span><h2>Temas</h2><p>Escolha uma interface completa. A preferência acompanha sua conta em qualquer dispositivo.</p></span><span className="saved-profile"><Check size={14} />Salvo no perfil</span></div><div className="theme-gallery" role="radiogroup" aria-label="Tema da interface">{themeCatalog.map((option) => <button type="button" key={option.id} role="radio" aria-checked={theme === option.id} className={`theme-choice ${theme === option.id ? "active" : ""}`} onClick={() => void onAppearance(option.id, colorMode)}><span className={`theme-preview preview-${option.id}`} aria-hidden="true"><i className="preview-nav" /><i className="preview-title" /><i className="preview-kpi one" /><i className="preview-kpi two" /><i className="preview-chart" /></span><span className="theme-choice-copy"><span><strong>{option.name}</strong><em>{option.tag}</em></span><small>{option.description}</small></span>{theme === option.id && <i className="theme-check"><Check size={13} /></i>}</button>)}</div><div className="mode-setting"><span><strong>Modo de cor</strong><small>Todos os temas foram desenhados para claro e escuro.</small></span><div className="mode-switch" role="radiogroup" aria-label="Modo de cor"><button type="button" role="radio" aria-checked={colorMode === "light"} className={colorMode === "light" ? "active" : ""} onClick={() => void onAppearance(theme, "light")}><Sun size={16} />Claro</button><button type="button" role="radio" aria-checked={colorMode === "dark"} className={colorMode === "dark" ? "active" : ""} onClick={() => void onAppearance(theme, "dark")}><Moon size={16} />Escuro</button><button type="button" role="radio" aria-checked={colorMode === "system"} className={colorMode === "system" ? "active" : ""} onClick={() => void onAppearance(theme, "system")}><Monitor size={16} />Automático</button></div></div><div className="security-note"><ShieldCheck size={16} />Somente os identificadores do tema e do modo são armazenados; nenhum dado financeiro é incluído.</div></section>}
  </div>{resetOpen && <Modal eyebrow="AÇÃO IRREVERSÍVEL" title="Apagar todos os dados?" subtitle="Sua conta de acesso será mantida, mas os dados financeiros não poderão ser recuperados." onClose={() => { if (!resetting) { setResetOpen(false); setResetPassword(""); setResetError(""); } }}><form onSubmit={submitReset}><div className="reset-warning"><Trash2 size={20} /><span><strong>Esta ação deixa o FIN como uma conta recém-criada.</strong><small>Contas, cartões, lançamentos, parcelamentos, recorrências e personalizações serão eliminados.</small></span></div><FormField label="Confirme sua senha atual"><input type="password" required autoFocus autoComplete="current-password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} /></FormField>{resetError && <div className="auth-alert error">{resetError}</div>}<div className="modal-actions"><button type="button" className="secondary-button" disabled={resetting} onClick={() => { setResetOpen(false); setResetPassword(""); setResetError(""); }}>Cancelar</button><button type="submit" className="danger-button destructive-confirm" disabled={resetting}>{resetting ? <LoaderCircle size={17} className="spin" /> : <Trash2 size={17} />}Apagar definitivamente</button></div></form></Modal>}</>;
}

function TransactionModal({ categories, accounts, cards, onClose, onSave }: { categories: Category[]; accounts: Account[]; cards: CreditCardRow[]; onClose: () => void; onSave: (value: TransactionForm) => Promise<void> }) {
  const today = new Date().toISOString().slice(0, 10); const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<TransactionFormInput, unknown, TransactionForm>({ resolver: zodResolver(transactionSchema), defaultValues: { type: "Despesa", status: "Pendente", dueDate: today, categoryId: "", source: "" } }); const type = useWatch({ control, name: "type" });
  const compatible = categories.filter((category) => category.type === (type === "Entrada" ? "income" : "expense") && isCategoryAvailable(category, categories));
  return <Modal title="Lançamento" subtitle="Revise os dados antes de salvar." onClose={onClose}><form onSubmit={handleSubmit(onSave)}><div className="type-tabs"><label className={type === "Despesa" ? "active expense" : ""}><input type="radio" value="Despesa" {...register("type")} /><ArrowUpRight size={17} />Despesa</label><label className={type === "Entrada" ? "active income" : ""}><input type="radio" value="Entrada" {...register("type")} /><ArrowDownLeft size={17} />Entrada</label></div><FormField label="Descrição" error={errors.description?.message}><input autoFocus placeholder="Ex.: Supermercado" {...register("description")} /></FormField><div className="form-grid"><FormField label="Valor" error={errors.amount?.message}><div className="money-input"><span>R$</span><input type="number" step="0.01" placeholder="0,00" {...register("amount")} /></div></FormField><FormField label="Data" error={errors.dueDate?.message}><input type="date" {...register("dueDate")} /></FormField></div><div className="form-grid"><FormField label="Categoria" error={errors.categoryId?.message}><select {...register("categoryId")}><option value="">Selecione</option><CategoryOptions categories={compatible} /></select></FormField><FormField label={type === "Entrada" ? "Conta" : "Conta ou cartão"} error={errors.source?.message}><SourceSelect accounts={accounts} cards={cards} includeCards={type === "Despesa"} register={register("source")} /></FormField></div><FormField label="Status"><select {...register("status")}><option>Pendente</option><option>Pago</option><option>Agendado</option></select></FormField><FormField label="Observação"><textarea rows={3} maxLength={500} placeholder="Opcional" {...register("notes")} /></FormField><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={isSubmitting}>{isSubmitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}Salvar lançamento</button></div></form></Modal>;
}

function EntityModal({ kind, item, parentId, accounts, cards, categories, onClose, onSave }: { kind: EntityKind; item?: EditableEntity; parentId?: string; accounts: Account[]; cards: CreditCardRow[]; categories: Category[]; onClose: () => void; onSave: (value: EntityForm) => Promise<void> }) {
  const requestedParent = parentId ? categories.find((category) => category.id === parentId) : undefined;
  const today = new Date().toISOString().slice(0, 10); const base: EntityFormInput = { type: kind === "account" ? "digital" : requestedParent?.type ?? "expense", parentId: parentId ?? "", color: requestedParent?.color ?? "#315c4d", frequency: "monthly", date: today, closingDay: 20, dueDay: 25, day: new Date().getDate(), count: 2, unlimited: false };
  if (item && kind === "account") { const account = item as Account; Object.assign(base, { name: account.name, type: account.type, balance: account.initial_balance_cents / 100, color: account.color }); }
  if (item && kind === "card") { const card = item as CreditCardRow; Object.assign(base, { name: card.name, accountId: card.account_id ?? "", amount: card.has_limit ? card.limit_amount_cents / 100 : undefined, unlimited: !card.has_limit, closingDay: card.closing_day, dueDay: card.due_day, color: card.color }); }
  if (item && kind === "category") { const category = item as Category; Object.assign(base, { name: category.name, type: category.type, parentId: category.parent_id ?? "", color: category.color }); }
  if (item && kind === "recurrence") { const recurrence = item as Recurrence; Object.assign(base, { description: recurrence.description, amount: recurrence.amount_cents / 100, type: recurrence.type, frequency: recurrence.frequency, day: recurrence.day_of_month ?? undefined, date: recurrence.start_date, categoryId: recurrence.category_id ?? "", source: recurrence.account_id ? `account:${recurrence.account_id}` : recurrence.credit_card_id ? `card:${recurrence.credit_card_id}` : "" }); }
  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<EntityFormInput, unknown, EntityForm>({ resolver: zodResolver(entitySchema), defaultValues: base }); const entityType = useWatch({ control, name: "type" }); const selectedParentId = useWatch({ control, name: "parentId" }); const unlimitedCard = useWatch({ control, name: "unlimited" });
  const editingCategory = kind === "category" && item ? item as Category : undefined;
  const hasChildren = Boolean(editingCategory && categories.some((category) => category.parent_id === editingCategory.id));
  const parentOptions = categories.filter((category) => !category.parent_id && category.id !== editingCategory?.id && category.type === entityType);
  useEffect(() => { if (kind !== "category" || !selectedParentId) return; const parent = categories.find((category) => category.id === selectedParentId); if (!parent || parent.type !== entityType) setValue("parentId", ""); }, [categories, entityType, kind, selectedParentId, setValue]);
  const titles: Record<EntityKind, string> = { account: "Conta", card: "Cartão", installment: "Compra parcelada", recurrence: "Recorrência", category: "Categoria" };
  const categoryIsChild = kind === "category" && Boolean(parentId || editingCategory?.parent_id);
  const modalTitle = categoryIsChild ? "Subcategoria" : titles[kind];
  return <Modal eyebrow={item ? "EDITAR" : "NOVO"} title={modalTitle} subtitle={requestedParent ? `Será organizada dentro de ${requestedParent.name}.` : "Revise as informações antes de salvar."} onClose={onClose}><form onSubmit={handleSubmit(onSave)}>
    {(kind === "account" || kind === "card" || kind === "category") && <FormField label="Nome" error={errors.name?.message}><input autoFocus placeholder={`Nome da ${titles[kind].toLowerCase()}`} {...register("name")} /></FormField>}
    {(kind === "installment" || kind === "recurrence") && <FormField label="Descrição" error={errors.name?.message}><input autoFocus placeholder="Descrição" {...register("description")} /></FormField>}
    {kind === "account" && <><div className="form-grid"><FormField label="Tipo"><select {...register("type")}><option value="digital">Conta digital</option><option value="checking">Conta corrente</option><option value="cash">Dinheiro físico</option><option value="savings">Poupança</option><option value="investment">Investimento</option><option value="other">Outro</option></select></FormField><FormField label="Saldo inicial"><div className="money-input"><span>R$</span><input type="number" step="0.01" {...register("balance")} /></div></FormField></div><FormField label="Cor"><input type="color" {...register("color")} /></FormField></>}
    {kind === "card" && <><label className="unlimited-option"><input type="checkbox" {...register("unlimited")} /><span><strong>Cartão sem limite predefinido</strong><small>A fatura continua sendo calculada, mas o FIN não exibirá limite disponível.</small></span></label><div className="form-grid"><FormField label="Limite"><div className={`money-input ${unlimitedCard ? "is-disabled" : ""}`}><span>R$</span><input type="number" step="0.01" required={!unlimitedCard} disabled={unlimitedCard} placeholder={unlimitedCard ? "Sem limite" : "0,00"} {...register("amount")} /></div></FormField><FormField label="Conta de pagamento"><select required {...register("accountId")}><option value="">Selecione</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></FormField></div><div className="form-grid"><FormField label="Dia de fechamento"><input type="number" min="1" max="31" {...register("closingDay")} /></FormField><FormField label="Dia de vencimento"><input type="number" min="1" max="31" {...register("dueDay")} /></FormField></div><FormField label="Cor"><input type="color" {...register("color")} /></FormField></>}
    {kind === "category" && <><div className="form-grid"><FormField label="Tipo"><select {...register("type")}><option value="expense">Despesa</option><option value="income">Entrada</option></select></FormField><FormField label="Categoria principal"><select {...register("parentId")} disabled={hasChildren}><option value="">Nenhuma — categoria principal</option>{parentOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>{hasChildren && <em className="form-help">Mova ou remova as subcategorias antes de alterar este nível.</em>}</FormField></div><FormField label="Cor"><input type="color" {...register("color")} /></FormField></>}
    {kind === "installment" && <><div className="form-grid"><FormField label="Valor total"><div className="money-input"><span>R$</span><input type="number" step="0.01" required {...register("amount")} /></div></FormField><FormField label="Parcelas"><input type="number" min="2" required {...register("count")} /></FormField></div><div className="form-grid"><FormField label="Primeiro vencimento"><input type="date" required {...register("date")} /></FormField><FormField label="Categoria"><CategorySelect categories={categories.filter((category) => category.type === "expense")} register={register("categoryId")} /></FormField></div><FormField label="Conta ou cartão"><SourceSelect accounts={accounts} cards={cards} register={register("source")} /></FormField></>}
    {kind === "recurrence" && <><div className="form-grid"><FormField label="Valor" error={errors.amount?.message}><div className="money-input"><span>R$</span><input type="number" step="0.01" required {...register("amount")} /></div></FormField><FormField label="Tipo"><select {...register("type")}><option value="expense">Despesa</option><option value="income">Entrada</option></select></FormField></div><div className="form-grid"><FormField label="Frequência"><select {...register("frequency")}><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="semiannual">Semestral</option><option value="annual">Anual</option></select></FormField><FormField label="Dia" error={errors.day?.message}><input type="number" min="1" max="31" {...register("day")} /></FormField></div><div className="form-grid"><FormField label="Data inicial"><input type="date" required {...register("date")} /></FormField><FormField label="Categoria"><CategorySelect categories={categories.filter((category) => category.type === entityType)} register={register("categoryId")} /></FormField></div><FormField label={entityType === "income" ? "Conta" : "Conta ou cartão"}><SourceSelect accounts={accounts} cards={cards} includeCards={entityType !== "income"} register={register("source")} /></FormField></>}
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" type="submit" disabled={isSubmitting}>{isSubmitting ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}Salvar</button></div>
  </form></Modal>;
}

function AuthScreen({ mode, supabase, onSwitch }: { mode: "login" | "register"; supabase: SupabaseClient; onSwitch: () => void }) {
  const [visible, setVisible] = useState(false); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState(""); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [loading, setLoading] = useState<"email" | "google" | null>(null); const registerMode = mode === "register";
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading("email"); setError(""); setNotice(""); const result = registerMode ? await supabase.auth.signUp({ email, password, options: { data: { name }, emailRedirectTo: `${window.location.origin}/dashboard` } }) : await supabase.auth.signInWithPassword({ email, password }); setLoading(null); if (result.error) setError(result.error.message); else if (registerMode && !result.data.session) setNotice("Cadastro realizado. Confirme o e-mail para entrar."); };
  const google = async () => { setLoading("google"); setError(""); setNotice(""); const { error: googleError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/dashboard`, scopes: "openid email profile" } }); if (googleError) { setError(googleError.message); setLoading(null); } };
  const reset = async () => { if (!email) { setError("Informe seu e-mail primeiro."); return; } const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/settings` }); if (resetError) setError(resetError.message); else setNotice("Enviamos o link de recuperação para seu e-mail."); };
  return <div className="auth-shell"><section className="auth-visual"><Link className="brand light" href="/">FIN</Link><div className="auth-message"><span className="eyebrow">CONTROLE SEM COMPLICAÇÃO</span><h1>Seu dinheiro.<br />Mais claro.</h1><p>Acompanhe contas, lançamentos e planos em um só lugar, com uma experiência simples do início ao fim.</p><div className="auth-art" aria-hidden="true"><span className="auth-art-glow" /><span className="auth-art-card"><i /><i /><i /><b /></span></div></div><small className="auth-footer">© 2026 FIN</small></section><section className="auth-form-wrap"><form className="auth-form" onSubmit={submit}><div className="auth-mobile-brand">FIN</div><span className="eyebrow">{registerMode ? "NOVA CONTA" : "BEM-VINDO DE VOLTA"}</span><h2>{registerMode ? "Comece agora" : "Entre no FIN"}</h2><p>{registerMode ? "Crie sua conta em poucos segundos." : "Use sua conta Google ou entre com seu e-mail."}</p><button className="google-button" type="button" disabled={Boolean(loading)} onClick={() => void google()}>{loading === "google" ? <LoaderCircle size={19} className="spin" /> : <b className="google-mark">G</b>}Continuar com Google</button><div className="auth-divider"><span>ou continue com e-mail</span></div>{registerMode && <FormField label="Nome"><input required maxLength={80} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Seu nome completo" /></FormField>}<FormField label="E-mail"><input type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" /></FormField><FormField label="Senha"><div className="password-input"><input type={visible ? "text" : "password"} required minLength={registerMode ? 8 : 6} autoComplete={registerMode ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"}>{visible ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></FormField>{!registerMode && <div className="auth-options"><span /><button type="button" onClick={reset}>Esqueci a senha</button></div>}{error && <div className="auth-alert error">{error}</div>}{notice && <div className="auth-alert success">{notice}</div>}<button className="primary-button auth-submit" type="submit" disabled={Boolean(loading)}>{loading === "email" ? <LoaderCircle size={19} className="spin" /> : registerMode ? "Criar minha conta" : "Entrar"}<ArrowRight size={19} /></button><div className="auth-switch">{registerMode ? "Já tem uma conta?" : "Ainda não tem uma conta?"}<button type="button" onClick={onSwitch}>{registerMode ? "Entrar" : "Criar conta"}</button></div></form></section></div>;
}

function LoadingScreen({ label }: { label: string }) { return <div className="loading-screen"><span className="brand">FIN</span><LoaderCircle className="spin" size={24} /><p>{label}</p></div>; }
function Modal({ title, subtitle, eyebrow = "NOVO", onClose, children }: { title: string; subtitle: string; eyebrow?: string; onClose: () => void; children: React.ReactNode }) { useEffect(() => { const close = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); }; window.addEventListener("keydown", close); return () => window.removeEventListener("keydown", close); }, [onClose]); return <div className="modal-layer" role="dialog" aria-modal="true" aria-label={title}><button className="modal-backdrop" onClick={onClose} aria-label="Fechar" /><div className="modal-card"><div className="modal-header"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={19} /></button></div>{children}</div></div>; }
function PageTitle({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) { return <section className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="heading-actions">{action}</div>}</section>; }
function PanelHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) { return <div className="panel-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{children}</div>; }
function ActionMenu({ label, items, trigger }: { label: string; items: { label: string; icon?: LucideIcon; danger?: boolean; onClick: () => void }[]; trigger?: React.ReactNode }) { return <details className="action-menu"><summary className="icon-button" aria-label={label}>{trigger ?? <MoreHorizontal size={18} />}</summary><div>{items.map((item) => { const Icon = item.icon; return <button type="button" key={item.label} className={item.danger ? "danger" : ""} onClick={(event) => { event.currentTarget.closest("details")?.removeAttribute("open"); item.onClick(); }}>{Icon && <Icon size={15} />}{item.label}</button>; })}</div></details>; }
function FormField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) { return <label className={`form-field ${error ? "has-error" : ""}`}><span>{label}</span>{children}{error && <small>{error}</small>}</label>; }
function EmptyState({ title, description, action, onAction, compact = false }: { title: string; description: string; action?: string; onAction?: () => void; compact?: boolean }) { return <div className={`empty-state ${compact ? "compact-empty" : ""}`}><span><ReceiptText size={compact ? 18 : 24} /></span><strong>{title}</strong><p>{description}</p>{action && onAction && <button className="secondary-button" onClick={onAction}><Plus size={15} />{action}</button>}</div>; }
function SourceSelect({ accounts, cards, register, includeCards = true }: { accounts: Account[]; cards: CreditCardRow[]; register: object; includeCards?: boolean }) { const activeAccounts = accounts.filter((item) => item.active); const activeCards = cards.filter((item) => item.active); return <select required {...register}><option value="">Selecione</option><optgroup label="Contas">{activeAccounts.map((account) => <option key={account.id} value={`account:${account.id}`}>{account.name}</option>)}</optgroup>{includeCards && activeCards.length > 0 && <optgroup label="Cartões">{activeCards.map((card) => <option key={card.id} value={`card:${card.id}`}>{card.name}</option>)}</optgroup>}</select>; }
function CategoryOptions({ categories }: { categories: Category[] }) {
  const roots = categories.filter((category) => !category.parent_id);
  const rootIds = new Set(roots.map((category) => category.id));
  const orphans = categories.filter((category) => category.parent_id && !rootIds.has(category.parent_id));
  return <>{roots.map((root) => { const children = categories.filter((category) => category.parent_id === root.id); return children.length ? <optgroup key={root.id} label={root.name}><option value={root.id}>{root.name} (geral)</option>{children.map((child) => <option key={child.id} value={child.id}>↳ {child.name}</option>)}</optgroup> : <option key={root.id} value={root.id}>{root.name}</option>; })}{orphans.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</>;
}
function CategorySelect({ categories, register }: { categories: Category[]; register: object }) { const available = categories.filter((item) => isCategoryAvailable(item, categories)); return <select required {...register}><option value="">Selecione</option><CategoryOptions categories={available} /></select>; }
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) { if (!active || !payload?.length) return null; return <div className="chart-tooltip"><strong>{label}</strong>{payload.map((item) => <span key={item.name}><i style={{ background: item.color }} />{item.name}: {money.format(item.value)}</span>)}</div>; }

function TransactionList({ transactions }: { transactions: TransactionRow[] }) { return <div className="transaction-list">{transactions.map((transaction) => { const positive = transaction.type === "income"; return <div className="transaction-item" key={transaction.id}><span className="tx-icon"><CategoryGlyph icon={transaction.category?.icon} size={17} /></span><div className="tx-main"><strong>{transaction.description}</strong><small>{transaction.category?.name ?? "Sem categoria"} • {shortDate.format(new Date(`${transaction.due_date ?? transaction.transaction_date}T00:00:00Z`))}</small></div><span className={`status status-${statusLabel[transaction.status].toLowerCase()}`}>{statusLabel[transaction.status]}</span><strong className={`tx-amount ${positive ? "positive" : ""}`}>{positive ? "+ " : "− "}{reais(transaction.amount_cents)}</strong><span /></div>; })}</div>; }
function TransactionTableRow({ transaction, onTogglePaid, onDelete }: { transaction: TransactionRow; onTogglePaid: (transaction: TransactionRow) => void; onDelete: (transaction: TransactionRow) => void }) { const positive = transaction.type === "income"; return <tr><td data-label="Descrição"><div className="table-title"><span className="tx-icon"><CategoryGlyph icon={transaction.category?.icon} size={17} /></span><strong>{transaction.description}</strong></div></td><td data-label="Categoria">{transaction.category?.name ?? "—"}</td><td data-label="Conta ou cartão">{transaction.account?.name ?? transaction.credit_card?.name ?? "—"}</td><td data-label="Data">{shortDate.format(new Date(`${transaction.due_date ?? transaction.transaction_date}T00:00:00Z`))}</td><td data-label="Status"><button className={`status status-${statusLabel[transaction.status].toLowerCase()} status-button`} onClick={() => onTogglePaid(transaction)}>{statusLabel[transaction.status]}</button></td><td data-label="Valor" className={`align-right amount ${positive ? "positive" : ""}`}>{positive ? "+ " : "− "}{reais(transaction.amount_cents)}</td><td data-label="Ações"><div className="row-actions"><button className="icon-button" title={transaction.status === "paid" ? "Marcar pendente" : "Marcar pago"} onClick={() => onTogglePaid(transaction)}><Check size={16} /></button><button className="icon-button danger-icon" title="Excluir" onClick={() => onDelete(transaction)}><Trash2 size={16} /></button></div></td></tr>; }
function DueItem({ transaction }: { transaction: TransactionRow }) { const date = new Date(`${transaction.due_date}T00:00:00Z`); return <div className="due-item"><span className="date-block coral"><strong>{String(date.getUTCDate()).padStart(2, "0")}</strong><small>{monthName.format(date).replace(".", "").toUpperCase()}</small></span><div><strong>{transaction.description}</strong><small>{transaction.category?.name ?? "Sem categoria"}</small></div><strong>{reais(transaction.amount_cents)}</strong><span /></div>; }
function AccountCard({ account, balance, onEdit, onActive, onRemove, onStatement }: { account: Account; balance: number; onEdit: () => void; onActive: () => void; onRemove: () => void; onStatement: () => void }) { return <article className={`panel account-card ${account.active ? "" : "is-inactive"}`}><div className="account-card-top"><span style={{ background: account.color }}><Landmark size={19} /></span><ActionMenu label={`Ações de ${account.name}`} items={[{ label: "Editar", icon: Pencil, onClick: onEdit }, { label: "Ver extrato", icon: ReceiptText, onClick: onStatement }, { label: account.active ? "Desativar" : "Ativar", icon: RefreshCw, onClick: onActive }, { label: "Remover", icon: Trash2, danger: true, onClick: onRemove }]} /></div><small>{accountTypeLabel[account.type] ?? account.type}</small><h3>{account.name}</h3><span>Saldo disponível</span><strong>{reais(balance)}</strong><div className="account-card-footer"><span className={`status ${account.active ? "status-pago" : "status-cancelado"}`}>{account.active ? "Ativa" : "Inativa"}</span><button onClick={onStatement}>Ver extrato <ArrowRight size={14} /></button></div></article>; }
function CreditCardView({ card, used, gradient, onEdit, onActive, onRemove, onStatement }: { card: CreditCardRow; used: number; gradient: string; onEdit: () => void; onActive: () => void; onRemove: () => void; onStatement: () => void }) { const percent = card.has_limit && card.limit_amount_cents ? Math.min(100, Math.round(used / card.limit_amount_cents * 100)) : 0; return <article className={`panel credit-widget ${card.active ? "" : "is-inactive"}`}><div className={`credit-visual ${gradient}`}><div><span className="credit-brand">FIN</span><CreditCard size={25} /></div><strong>CARTÃO CADASTRADO</strong><div><span><small>CARTÃO</small>{card.name.toUpperCase()}</span><span><small>VENCE</small>DIA {card.due_day}</span></div></div><div className="credit-data"><div><span>Fatura atual</span><strong>{reais(used)}</strong><small>Fecha todo dia {card.closing_day}</small></div><ActionMenu label={`Ações de ${card.name}`} items={[{ label: "Editar", icon: Pencil, onClick: onEdit }, { label: "Ver lançamentos", icon: ReceiptText, onClick: onStatement }, { label: card.active ? "Desativar" : "Ativar", icon: RefreshCw, onClick: onActive }, { label: "Remover", icon: Trash2, danger: true, onClick: onRemove }]} />{card.has_limit ? <><div className="limit-row"><span>Limite utilizado</span><strong>{percent}%</strong></div><div className="progress"><span style={{ width: `${percent}%` }} /></div><small>{reais(Math.max(0, card.limit_amount_cents - used))} disponível de {reais(card.limit_amount_cents)}</small></> : <div className="unlimited-card-note"><Zap size={15} /><span><strong>Sem limite predefinido</strong><small>Acompanhe apenas o valor acumulado da fatura.</small></span></div>}</div></article>; }
