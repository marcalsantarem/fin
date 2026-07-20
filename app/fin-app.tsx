"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import Link from "next/link";
import { z } from "zod";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness,
  CalendarClock, Car, ChartNoAxesCombined, Check, ChevronDown, ChevronLeft,
  ChevronRight, Clock3, CreditCard, DollarSign, Download,
  Ellipsis, Eye, EyeOff, Filter, GraduationCap, HeartPulse, Home, Landmark,
  LayoutDashboard, LogOut, Menu, Moon, MoreHorizontal, Palette, Pencil,
  Plus, ReceiptText, RefreshCw, Search, Settings, ShieldCheck, ShoppingBasket,
  Sparkles, Tag, TrendingDown, TrendingUp, Utensils, WalletCards, X, Zap,
  type LucideIcon,
} from "lucide-react";

type Section =
  | "dashboard" | "transactions" | "accounts" | "cards" | "installments"
  | "recurrences" | "categories" | "reports" | "settings" | "login" | "register";

type TxStatus = "Pago" | "Pendente" | "Atrasado" | "Agendado" | "Cancelado";
type TxType = "Entrada" | "Despesa";
type Transaction = {
  id: number; description: string; category: string; account: string; date: string;
  amount: number; status: TxStatus; type: TxType; icon: LucideIcon;
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

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

const initialTransactions: Transaction[] = [
  { id: 1, description: "Salário", category: "Trabalho", account: "Nubank", date: "05 jul", amount: 8200, status: "Pago", type: "Entrada", icon: BriefcaseBusiness },
  { id: 2, description: "Aluguel", category: "Moradia", account: "Inter", date: "08 jul", amount: -2350, status: "Pago", type: "Despesa", icon: Home },
  { id: 3, description: "Supermercado Pão", category: "Alimentação", account: "Nubank", date: "12 jul", amount: -487.36, status: "Pago", type: "Despesa", icon: ShoppingBasket },
  { id: 4, description: "Internet fibra", category: "Assinaturas", account: "Inter", date: "18 jul", amount: -119.9, status: "Pendente", type: "Despesa", icon: Zap },
  { id: 5, description: "Consulta médica", category: "Saúde", account: "Nubank", date: "22 jul", amount: -380, status: "Agendado", type: "Despesa", icon: HeartPulse },
  { id: 6, description: "Freela Identidade", category: "Trabalho", account: "Inter", date: "25 jul", amount: 1250, status: "Pendente", type: "Entrada", icon: Sparkles },
];

const expenseData = [
  { name: "Moradia", value: 2350, color: "#244d40" },
  { name: "Alimentação", value: 1184, color: "#d9a441" },
  { name: "Transporte", value: 732, color: "#cb6d55" },
  { name: "Saúde", value: 468, color: "#7d9382" },
  { name: "Outros", value: 615, color: "#a8b5aa" },
];

const flowData = [
  { month: "Fev", entrada: 7900, despesa: 5750 },
  { month: "Mar", entrada: 8300, despesa: 6210 },
  { month: "Abr", entrada: 8200, despesa: 5530 },
  { month: "Mai", entrada: 9450, despesa: 6820 },
  { month: "Jun", entrada: 8200, despesa: 5910 },
  { month: "Jul", entrada: 9450, despesa: 5349 },
];

const transactionSchema = z.object({
  description: z.string().min(2, "Informe uma descrição"),
  amount: z.coerce.number().positive("Informe um valor maior que zero"),
  type: z.enum(["Entrada", "Despesa"]),
  category: z.string().min(1, "Selecione uma categoria"),
  account: z.string().min(1, "Selecione uma conta"),
  dueDate: z.string().min(1, "Informe a data"),
  status: z.enum(["Pago", "Pendente", "Agendado"]),
  notes: z.string().optional(),
});
type TransactionForm = z.infer<typeof transactionSchema>;

export function FinApp({ initialSection = "dashboard", openComposer = false }: { initialSection?: string; openComposer?: boolean }) {
  const safeInitial = ([...nav.map((item) => item.id), "settings", "login", "register"] as string[]).includes(initialSection)
    ? initialSection as Section : "dashboard";
  const [active, setActive] = useState<Section>(safeInitial);
  const [transactions, setTransactions] = useState(initialTransactions);
  const [composer, setComposer] = useState(openComposer);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [period, setPeriod] = useState("Julho 2026");
  const [toast, setToast] = useState("");

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const go = (section: Section) => {
    setActive(section);
    setMenuOpen(false);
    window.history.pushState({}, "", section === "dashboard" ? "/dashboard" : `/${section}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (active === "login" || active === "register") {
    return <AuthScreen mode={active} onEnter={() => go("dashboard")} onSwitch={() => go(active === "login" ? "register" : "login")} />;
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <Link className="brand" href="/dashboard" onClick={(event) => { event.preventDefault(); go("dashboard"); }}>FIN</Link>
          <button className="icon-button sidebar-close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu"><X size={19} /></button>
        </div>
        <nav className="main-nav" aria-label="Navegação principal">
          {nav.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`/${id}`} className={active === id ? "active" : ""} onClick={(event) => { event.preventDefault(); go(id); }}>
              <Icon size={18} strokeWidth={1.9} /><span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="insight-card">
            <div className="insight-icon"><Sparkles size={17} /></div>
            <strong>Reserva em dia</strong>
            <p>Você guardou 18% da renda este mês.</p>
            <div className="mini-progress"><span style={{ width: "72%" }} /></div>
          </div>
          <button className={`nav-settings ${active === "settings" ? "active" : ""}`} onClick={() => go("settings")}>
            <Settings size={18} /><span>Configurações</span>
          </button>
          <button className="profile-card" onClick={() => go("settings")}>
            <span className="avatar">MA</span><span><strong>Marcos Alves</strong><small>marcos@fin.com</small></span><Ellipsis size={18} />
          </button>
        </div>
      </aside>

      {menuOpen && <button className="menu-backdrop" onClick={() => setMenuOpen(false)} aria-label="Fechar menu" />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setMenuOpen(true)} aria-label="Abrir menu"><Menu size={21} /></button>
          <div className="mobile-brand">FIN</div>
          <div className="topbar-actions">
            <label className="search-box"><Search size={17} /><input placeholder="Buscar lançamento..." aria-label="Buscar lançamento" /><kbd>⌘ K</kbd></label>
            <button className="icon-button" onClick={() => setDark(!dark)} aria-label="Alternar tema"><Moon size={18} /></button>
            <button className="icon-button notification" aria-label="Notificações"><Bell size={18} /><span /></button>
            <button className="primary-button compact" onClick={() => setComposer(true)}><Plus size={18} />Novo lançamento</button>
          </div>
        </header>

        <div className="content">
          {active === "dashboard" && <Dashboard period={period} setPeriod={setPeriod} transactions={transactions} onNew={() => setComposer(true)} onNavigate={go} />}
          {active === "transactions" && <TransactionsScreen transactions={transactions} onNew={() => setComposer(true)} />}
          {active === "accounts" && <AccountsScreen onToast={setToast} />}
          {active === "cards" && <CardsScreen onToast={setToast} />}
          {active === "installments" && <InstallmentsScreen onToast={setToast} />}
          {active === "recurrences" && <RecurrencesScreen onToast={setToast} />}
          {active === "categories" && <CategoriesScreen onToast={setToast} />}
          {active === "reports" && <ReportsScreen />}
          {active === "settings" && <SettingsScreen dark={dark} setDark={setDark} onLogout={() => go("login")} onToast={setToast} />}
        </div>
      </main>

      <nav className="bottom-nav" aria-label="Navegação mobile">
        {[nav[0], nav[1], nav[2], nav[3]].map(({ id, label, icon: Icon }) => (
          <button key={id} className={active === id ? "active" : ""} onClick={() => go(id)}><Icon size={20} /><span>{label.split(" ")[0]}</span></button>
        ))}
        <button onClick={() => setMenuOpen(true)}><Menu size={20} /><span>Menu</span></button>
      </nav>

      {composer && <TransactionModal onClose={() => setComposer(false)} onSave={(value) => {
        const isExpense = value.type === "Despesa";
        setTransactions((current) => [{ id: Date.now(), description: value.description, category: value.category, account: value.account, date: "Hoje", amount: (isExpense ? -1 : 1) * value.amount, status: value.status, type: value.type, icon: isExpense ? ReceiptText : DollarSign }, ...current]);
        setComposer(false); setToast("Lançamento adicionado com sucesso");
      }} />}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}

function Dashboard({ period, setPeriod, transactions, onNew, onNavigate }: {
  period: string; setPeriod: (value: string) => void; transactions: Transaction[]; onNew: () => void; onNavigate: (value: Section) => void;
}) {
  return (
    <>
      <section className="page-heading dashboard-heading">
        <div><span className="eyebrow">SEGUNDA-FEIRA, 20 DE JULHO</span><h1>Olá, Marcos.</h1><p>Seu mês está equilibrado. Continue assim.</p></div>
        <div className="heading-actions">
          <div className="period-control"><button aria-label="Mês anterior"><ChevronLeft size={17} /></button><select value={period} onChange={(e) => setPeriod(e.target.value)}><option>Junho 2026</option><option>Julho 2026</option><option>Agosto 2026</option></select><button aria-label="Próximo mês"><ChevronRight size={17} /></button></div>
          <button className="secondary-button" onClick={() => onNavigate("reports")}><Download size={17} />Exportar</button>
        </div>
      </section>

      <section className="metric-grid">
        <Metric label="Saldo previsto" value="R$ 4.101,07" change="12,4%" up icon={WalletCards} accent="forest" spark={[12,18,15,25,23,32,35]} />
        <Metric label="Entradas" value="R$ 9.450,00" change="15,2%" up icon={ArrowDownLeft} accent="green" spark={[15,15,22,21,29,26,34]} />
        <Metric label="Despesas pagas" value="R$ 4.698,93" change="6,8%" icon={ArrowUpRight} accent="coral" spark={[34,30,32,24,26,21,19]} />
        <Metric label="A pagar" value="R$ 650,00" note="3 lançamentos" icon={Clock3} accent="gold" spark={[18,22,17,26,22,21,14]} />
      </section>

      <section className="dashboard-grid">
        <article className="panel flow-panel">
          <PanelHeader title="Fluxo mensal" subtitle="Entradas e despesas nos últimos 6 meses"><button className="ghost-select">Últimos 6 meses <ChevronDown size={15} /></button></PanelHeader>
          <div className="chart-legend"><span><i className="dot income" />Entradas</span><span><i className="dot expense" />Despesas</span></div>
          <div className="flow-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={flowData} margin={{ top: 12, right: 8, bottom: 0, left: -18 }}>
                <defs><linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2e6b57" stopOpacity={0.22}/><stop offset="100%" stopColor="#2e6b57" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 4" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => `${v / 1000}k`} tick={{ fill: "var(--muted)", fontSize: 12 }} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="entrada" stroke="#2e6b57" strokeWidth={2.5} fill="url(#incomeGradient)" />
                <Area type="monotone" dataKey="despesa" stroke="#d8785f" strokeWidth={2.2} fill="transparent" strokeDasharray="5 4" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel spending-panel">
          <PanelHeader title="Gastos por categoria" subtitle="Distribuição neste mês"><button className="icon-button"><MoreHorizontal size={19} /></button></PanelHeader>
          <div className="donut-wrap">
            <div className="donut"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expenseData} dataKey="value" innerRadius={58} outerRadius={78} paddingAngle={2} stroke="none">{expenseData.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie></PieChart></ResponsiveContainer><div className="donut-total"><span>Total</span><strong>R$ 5,3 mil</strong></div></div>
            <div className="category-legend">{expenseData.map((item, index) => <div key={item.name}><span><i style={{ background: item.color }} />{item.name}</span><strong>{[44,22,14,9,11][index]}%</strong></div>)}</div>
          </div>
          <button className="text-button" onClick={() => onNavigate("reports")}>Ver relatório completo <ArrowRight size={15} /></button>
        </article>

        <article className="panel transactions-panel">
          <PanelHeader title="Lançamentos recentes" subtitle="Últimas movimentações"><button className="text-button" onClick={() => onNavigate("transactions")}>Ver todos <ArrowRight size={15} /></button></PanelHeader>
          <TransactionList transactions={transactions.slice(0, 5)} />
        </article>

        <article className="panel due-panel">
          <PanelHeader title="Próximos vencimentos" subtitle="Até o fim do mês"><span className="count-badge">3</span></PanelHeader>
          <div className="due-list">
            <DueItem day="22" month="JUL" title="Consulta médica" category="Saúde" amount="R$ 380,00" color="coral" />
            <DueItem day="25" month="JUL" title="Fatura Nubank" category="Cartão" amount="R$ 1.274,50" color="violet" />
            <DueItem day="29" month="JUL" title="Academia" category="Saúde" amount="R$ 129,90" color="green" />
          </div>
          <button className="secondary-button full" onClick={onNew}><Plus size={16} />Adicionar lançamento</button>
        </article>
      </section>
    </>
  );
}

function Metric({ label, value, change, note, up, icon: Icon, accent, spark }: { label: string; value: string; change?: string; note?: string; up?: boolean; icon: LucideIcon; accent: string; spark: number[] }) {
  const points = spark.map((v, i) => `${i * 12},${42 - v}`).join(" ");
  return <article className="metric-card"><div className={`metric-icon ${accent}`}><Icon size={19} /></div><div className="metric-copy"><span>{label}</span><strong>{value}</strong><small className={up ? "positive" : change ? "negative" : ""}>{change && (up ? <TrendingUp size={13} /> : <TrendingDown size={13} />)}{change || note}{change && " vs. mês anterior"}</small></div><svg className="sparkline" viewBox="0 0 72 44" aria-hidden="true"><polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></article>;
}

function TransactionsScreen({ transactions, onNew }: { transactions: Transaction[]; onNew: () => void }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Todos");
  const filtered = useMemo(() => transactions.filter((tx) => tx.description.toLowerCase().includes(query.toLowerCase()) && (status === "Todos" || tx.status === status)), [transactions, query, status]);
  return <>
    <PageTitle eyebrow="MOVIMENTAÇÕES" title="Lançamentos" subtitle="Acompanhe tudo o que entra e sai." action={<button className="primary-button" onClick={onNew}><Plus size={18} />Novo lançamento</button>} />
    <div className="summary-strip"><div><span>Entradas no mês</span><strong className="positive">R$ 9.450,00</strong></div><div><span>Despesas no mês</span><strong>R$ 5.348,93</strong></div><div><span>Resultado</span><strong>R$ 4.101,07</strong></div></div>
    <section className="panel data-panel">
      <div className="filter-row"><label className="search-box wide"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por descrição..." /></label><select value={status} onChange={(e) => setStatus(e.target.value)}><option>Todos</option><option>Pago</option><option>Pendente</option><option>Agendado</option></select><button className="secondary-button"><Filter size={16}/>Mais filtros</button></div>
      <div className="table-wrap"><table><thead><tr><th>Descrição</th><th>Categoria</th><th>Conta</th><th>Data</th><th>Status</th><th className="align-right">Valor</th><th /></tr></thead><tbody>{filtered.map((tx) => <TransactionRow key={tx.id} tx={tx} />)}</tbody></table></div>
      <div className="table-footer"><span>{filtered.length} de {transactions.length} lançamentos</span><div><button disabled><ChevronLeft size={16}/></button><button className="selected">1</button><button><ChevronRight size={16}/></button></div></div>
    </section>
  </>;
}

function AccountsScreen({ onToast }: { onToast: (message: string) => void }) {
  return <><PageTitle eyebrow="PATRIMÔNIO" title="Contas" subtitle="Seus saldos organizados em um só lugar." action={<button className="primary-button" onClick={() => onToast("Nova conta pronta para configurar")}><Plus size={18}/>Nova conta</button>} />
    <div className="account-total panel"><div><span>Saldo total disponível</span><strong>R$ 18.724,62</strong><small><TrendingUp size={14}/> R$ 2.311,20 neste mês</small></div><div className="balance-art"><span/><span/><span/></div></div>
    <div className="card-grid thirds"><AccountCard name="Nubank" type="Conta digital" amount="R$ 7.842,31" color="#6e3f8e" icon={CreditCard}/><AccountCard name="Banco Inter" type="Conta corrente" amount="R$ 4.128,42" color="#e56f2d" icon={Landmark}/><AccountCard name="Reserva" type="Poupança" amount="R$ 6.753,89" color="#2e6b57" icon={ShieldCheck}/></div>
  </>;
}

function CardsScreen({ onToast }: { onToast: (message: string) => void }) {
  return <><PageTitle eyebrow="CRÉDITO" title="Cartões" subtitle="Faturas, limites e vencimentos sem surpresas." action={<button className="primary-button" onClick={() => onToast("Novo cartão pronto para configurar")}><Plus size={18}/>Novo cartão</button>} />
    <div className="card-grid halves"><CreditCardView brand="Nubank" ending="4821" used={3274.5} limit={7500} due="25 jul" gradient="purple"/><CreditCardView brand="Inter Gold" ending="1097" used={1820.72} limit={6000} due="10 ago" gradient="charcoal"/></div>
    <section className="panel"><PanelHeader title="Compras nesta fatura" subtitle="Nubank • fecha em 4 dias"><button className="text-button">Ver fatura <ArrowRight size={15}/></button></PanelHeader><TransactionList transactions={initialTransactions.filter((t) => t.type === "Despesa").slice(0,4)}/></section>
  </>;
}

function InstallmentsScreen({ onToast }: { onToast: (message: string) => void }) {
  const plans = [{ title:"Notebook MacBook Air", meta:"6 de 12 parcelas", paid:7200, total:14400, next:"R$ 1.200,00 • 25 jul", progress:50 },{ title:"Curso de especialização", meta:"3 de 10 parcelas", paid:1350, total:4500, next:"R$ 450,00 • 08 ago", progress:30 },{ title:"Móveis sala", meta:"8 de 8 parcelas", paid:3200, total:3200, next:"Concluído", progress:100 }];
  return <><PageTitle eyebrow="PLANEJAMENTO" title="Parcelamentos" subtitle="Visualize compromissos presentes e futuros." action={<button className="primary-button" onClick={() => onToast("Nova compra parcelada pronta para cadastrar")}><Plus size={18}/>Nova compra parcelada</button>} />
    <div className="summary-strip"><div><span>Saldo parcelado</span><strong>R$ 10.350,00</strong></div><div><span>Próximos 3 meses</span><strong>R$ 4.950,00</strong></div><div><span>Planos ativos</span><strong>2</strong></div></div>
    <div className="plans-grid">{plans.map((p) => <article className="panel plan-card" key={p.title}><div className="plan-top"><span className="plan-icon"><CalendarClock/></span><button className="icon-button"><MoreHorizontal size={18}/></button></div><h3>{p.title}</h3><p>{p.meta}</p><div className="progress"><span style={{width:`${p.progress}%`}}/></div><div className="plan-values"><span><small>Pago</small><strong>{money.format(p.paid)}</strong></span><span><small>Total</small><strong>{money.format(p.total)}</strong></span></div><div className="next-installment"><Clock3 size={15}/><span>Próxima</span><strong>{p.next}</strong></div></article>)}</div>
  </>;
}

function RecurrencesScreen({ onToast }: { onToast: (message: string) => void }) {
  const recurring = [{name:"Aluguel",category:"Moradia",amount:2350,day:"Todo dia 08",active:true,icon:Home},{name:"Internet fibra",category:"Assinaturas",amount:119.9,day:"Todo dia 18",active:true,icon:Zap},{name:"Academia",category:"Saúde",amount:129.9,day:"Todo dia 29",active:true,icon:HeartPulse},{name:"Curso de inglês",category:"Educação",amount:280,day:"Todo dia 05",active:false,icon:GraduationCap}];
  return <><PageTitle eyebrow="AUTOMAÇÃO" title="Recorrências" subtitle="Despesas que se repetem, sempre sob controle." action={<button className="primary-button" onClick={() => onToast("Nova recorrência pronta para cadastrar")}><Plus size={18}/>Nova recorrência</button>} />
    <section className="panel recurring-list">{recurring.map(({name,category,amount,day,active,icon:Icon}) => <div className="recurring-row" key={name}><span className="tx-icon"><Icon size={18}/></span><div><strong>{name}</strong><small>{category} • {day}</small></div><strong className="recurring-amount">{money.format(amount)}</strong><button className={`toggle ${active ? "on" : ""}`} onClick={() => onToast(`${name} ${active ? "pausada" : "ativada"}`)}><span/></button><button className="icon-button"><MoreHorizontal size={18}/></button></div>)}</section>
  </>;
}

function CategoriesScreen({ onToast }: { onToast: (message: string) => void }) {
  const categories = [{name:"Moradia",count:4,color:"#315c4d",icon:Home},{name:"Alimentação",count:3,color:"#d9a441",icon:Utensils},{name:"Transporte",count:2,color:"#cb6d55",icon:Car},{name:"Saúde",count:2,color:"#769786",icon:HeartPulse},{name:"Educação",count:1,color:"#6f74a7",icon:GraduationCap},{name:"Trabalho",count:2,color:"#4b7691",icon:BriefcaseBusiness}];
  return <><PageTitle eyebrow="ORGANIZAÇÃO" title="Categorias" subtitle="Personalize como suas finanças são organizadas." action={<button className="primary-button" onClick={() => onToast("Nova categoria pronta para criar")}><Plus size={18}/>Nova categoria</button>} />
    <div className="category-grid">{categories.map(({name,count,color,icon:Icon}) => <article className="panel category-card" key={name}><span style={{background:`${color}18`,color}}><Icon size={20}/></span><div><strong>{name}</strong><small>{count} subcategorias</small></div><button className="icon-button"><Pencil size={16}/></button></article>)}</div>
  </>;
}

function ReportsScreen() {
  return <><PageTitle eyebrow="ANÁLISES" title="Relatórios" subtitle="Decisões melhores começam com uma visão clara." action={<button className="secondary-button"><Download size={17}/>Exportar PDF</button>} />
    <div className="report-filters"><button className="active">Mensal</button><button>Semestral</button><button>Anual</button><button>Personalizado</button><select><option>Julho 2026</option></select></div>
    <div className="report-grid"><article className="panel report-wide"><PanelHeader title="Evolução financeira" subtitle="Comparativo de entradas e despesas"/><div className="report-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={flowData} barGap={5}><CartesianGrid vertical={false} stroke="var(--line)"/><XAxis dataKey="month" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} tickFormatter={(v)=>`${v/1000}k`}/><Tooltip content={<ChartTooltip/>}/><Bar dataKey="entrada" fill="#315c4d" radius={[5,5,0,0]}/><Bar dataKey="despesa" fill="#e3a18d" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div></article>
      <article className="panel"><PanelHeader title="Resumo do período"/><div className="report-summary"><div><span>Receitas</span><strong>R$ 51.500,00</strong></div><div><span>Despesas</span><strong>R$ 35.569,93</strong></div><div><span>Economia</span><strong className="positive">R$ 15.930,07</strong></div><div><span>Taxa de economia</span><strong>30,9%</strong></div></div></article></div>
  </>;
}

function SettingsScreen({ dark, setDark, onLogout, onToast }: { dark:boolean; setDark:(v:boolean)=>void; onLogout:()=>void; onToast:(m:string)=>void }) {
  return <><PageTitle eyebrow="PREFERÊNCIAS" title="Configurações" subtitle="Deixe o FIN do seu jeito." />
    <div className="settings-layout"><div className="settings-menu"><button className="active"><Settings size={17}/>Geral</button><button><Bell size={17}/>Notificações</button><button><ShieldCheck size={17}/>Segurança</button><button><Palette size={17}/>Aparência</button></div><section className="panel settings-panel"><h2>Preferências gerais</h2><p>Atualize moeda, aparência e informações da conta.</p><div className="settings-field"><span><strong>Nome</strong><small>Como você aparece no aplicativo</small></span><input defaultValue="Marcos Alves"/></div><div className="settings-field"><span><strong>Moeda principal</strong><small>Usada nos valores e relatórios</small></span><select defaultValue="BRL"><option value="BRL">Real brasileiro (BRL)</option></select></div><div className="settings-field"><span><strong>Tema escuro</strong><small>Reduz o brilho em ambientes escuros</small></span><button className={`toggle ${dark ? "on" : ""}`} onClick={()=>setDark(!dark)}><span/></button></div><div className="settings-actions"><button className="danger-button" onClick={onLogout}><LogOut size={17}/>Sair</button><button className="primary-button" onClick={()=>onToast("Configurações salvas")}><Check size={17}/>Salvar alterações</button></div></section></div>
  </>;
}

function TransactionModal({ onClose, onSave }: { onClose: () => void; onSave: (value: TransactionForm) => void }) {
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<TransactionForm>({ resolver: zodResolver(transactionSchema), defaultValues: { type:"Despesa", status:"Pendente", dueDate:"2026-07-20", category:"", account:"" } });
  const type = useWatch({ control, name: "type" });
  return <div className="modal-layer" role="dialog" aria-modal="true" aria-label="Novo lançamento"><button className="modal-backdrop" onClick={onClose} aria-label="Fechar"/><form className="modal-card" onSubmit={handleSubmit(onSave)}><div className="modal-header"><div><span className="eyebrow">NOVO</span><h2>Lançamento</h2><p>Registre uma entrada ou despesa.</p></div><button type="button" className="icon-button" onClick={onClose}><X size={19}/></button></div>
    <div className="type-tabs"><label className={type === "Despesa" ? "active expense" : ""}><input type="radio" value="Despesa" {...register("type")}/><ArrowUpRight size={17}/>Despesa</label><label className={type === "Entrada" ? "active income" : ""}><input type="radio" value="Entrada" {...register("type")}/><ArrowDownLeft size={17}/>Entrada</label></div>
    <FormField label="Descrição" error={errors.description?.message}><input autoFocus placeholder="Ex.: Supermercado" {...register("description")}/></FormField>
    <div className="form-grid"><FormField label="Valor" error={errors.amount?.message}><div className="money-input"><span>R$</span><input type="number" step="0.01" placeholder="0,00" {...register("amount")}/></div></FormField><FormField label="Vencimento" error={errors.dueDate?.message}><input type="date" {...register("dueDate")}/></FormField></div>
    <div className="form-grid"><FormField label="Categoria" error={errors.category?.message}><select {...register("category")}><option value="">Selecione</option><option>Moradia</option><option>Alimentação</option><option>Transporte</option><option>Saúde</option><option>Trabalho</option><option>Outros</option></select></FormField><FormField label="Conta" error={errors.account?.message}><select {...register("account")}><option value="">Selecione</option><option>Nubank</option><option>Inter</option><option>Reserva</option></select></FormField></div>
    <FormField label="Status"><select {...register("status")}><option>Pendente</option><option>Pago</option><option>Agendado</option></select></FormField><FormField label="Observação"><textarea rows={3} placeholder="Opcional" {...register("notes")}/></FormField>
    <div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={isSubmitting}><Check size={17}/>Salvar lançamento</button></div></form></div>;
}

function AuthScreen({ mode, onEnter, onSwitch }: { mode: "login"|"register"; onEnter:()=>void; onSwitch:()=>void }) {
  const [visible,setVisible]=useState(false); const registerMode=mode==="register";
  return <div className="auth-shell"><section className="auth-visual"><Link className="brand light" href="/">FIN</Link><div className="auth-message"><span className="eyebrow">CLAREZA FINANCEIRA</span><h1>Seu dinheiro,<br/>no lugar certo.</h1><p>Planeje o presente e construa o futuro com uma visão completa das suas finanças.</p><div className="auth-proof"><span className="auth-mini-card"><TrendingUp/> <i><small>Saldo previsto</small><strong>+ R$ 4.101</strong></i></span><span className="auth-mini-card"><ShieldCheck/><i><small>Dados</small><strong>Protegidos</strong></i></span></div></div><small className="auth-footer">© 2026 FIN</small></section><section className="auth-form-wrap"><form className="auth-form" onSubmit={(e)=>{e.preventDefault();onEnter();}}><div className="auth-mobile-brand">FIN</div><span className="eyebrow">BEM-VINDO</span><h2>{registerMode?"Crie sua conta":"Acesse sua conta"}</h2><p>{registerMode?"Comece agora a organizar sua vida financeira.":"Entre para continuar acompanhando suas finanças."}</p>{registerMode&&<FormField label="Nome"><input required placeholder="Seu nome completo"/></FormField>}<FormField label="E-mail"><input type="email" required placeholder="voce@email.com"/></FormField><FormField label="Senha"><div className="password-input"><input type={visible?"text":"password"} required minLength={6} placeholder="••••••••"/><button type="button" onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></FormField>{!registerMode&&<div className="auth-options"><label><input type="checkbox"/>Lembrar de mim</label><button type="button">Esqueci a senha</button></div>}<button className="primary-button auth-submit" type="submit">{registerMode?"Criar conta":"Entrar"}<ArrowRight size={18}/></button><div className="auth-switch">{registerMode?"Já tem uma conta?":"Ainda não tem uma conta?"}<button type="button" onClick={onSwitch}>{registerMode?"Entrar":"Criar conta"}</button></div><div className="secure-note"><ShieldCheck size={15}/>Seus dados são criptografados e protegidos.</div></form></section></div>;
}

function PageTitle({ eyebrow, title, subtitle, action }: { eyebrow:string; title:string; subtitle:string; action?:React.ReactNode }) { return <section className="page-heading"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{subtitle}</p></div>{action&&<div className="heading-actions">{action}</div>}</section>; }
function PanelHeader({ title, subtitle, children }: { title:string; subtitle?:string; children?:React.ReactNode }) { return <div className="panel-header"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div>{children}</div>; }
function FormField({ label, error, children }: { label:string; error?:string; children:React.ReactNode }) { return <label className={`form-field ${error?"has-error":""}`}><span>{label}</span>{children}{error&&<small>{error}</small>}</label>; }
function ChartTooltip({active,payload,label}:{active?:boolean;payload?:Array<{name:string;value:number;color:string}>;label?:string}) { if(!active||!payload?.length)return null; return <div className="chart-tooltip"><strong>{label}</strong>{payload.map((p)=><span key={p.name}><i style={{background:p.color}}/>{p.name}: {money.format(p.value)}</span>)}</div>; }

function TransactionList({ transactions }: { transactions: Transaction[] }) { return <div className="transaction-list">{transactions.map((tx)=><div className="transaction-item" key={tx.id}><span className="tx-icon"><tx.icon size={17}/></span><div className="tx-main"><strong>{tx.description}</strong><small>{tx.category} • {tx.date}</small></div><span className={`status status-${tx.status.toLowerCase()}`}>{tx.status}</span><strong className={`tx-amount ${tx.amount>0?"positive":""}`}>{tx.amount>0?"+ ":"− "}{money.format(Math.abs(tx.amount))}</strong><button className="icon-button"><MoreHorizontal size={18}/></button></div>)}</div>; }
function TransactionRow({tx}:{tx:Transaction}) { const Icon=tx.icon; return <tr><td><div className="table-title"><span className="tx-icon"><Icon size={17}/></span><strong>{tx.description}</strong></div></td><td>{tx.category}</td><td>{tx.account}</td><td>{tx.date}</td><td><span className={`status status-${tx.status.toLowerCase()}`}>{tx.status}</span></td><td className={`align-right amount ${tx.amount>0?"positive":""}`}>{tx.amount>0?"+ ":"− "}{money.format(Math.abs(tx.amount))}</td><td><button className="icon-button"><MoreHorizontal size={17}/></button></td></tr>; }
function DueItem({day,month,title,category,amount,color}:{day:string;month:string;title:string;category:string;amount:string;color:string}) { return <div className="due-item"><span className={`date-block ${color}`}><strong>{day}</strong><small>{month}</small></span><div><strong>{title}</strong><small>{category}</small></div><strong>{amount}</strong><button className="icon-button"><MoreHorizontal size={17}/></button></div>; }
function AccountCard({name,type,amount,color,icon:Icon}:{name:string;type:string;amount:string;color:string;icon:LucideIcon}) { return <article className="panel account-card"><div className="account-card-top"><span style={{background:color}}><Icon size={19}/></span><button className="icon-button"><MoreHorizontal size={18}/></button></div><small>{type}</small><h3>{name}</h3><span>Saldo disponível</span><strong>{amount}</strong><div className="account-card-footer"><span className="status status-pago">Ativa</span><button>Ver extrato <ArrowRight size={14}/></button></div></article>; }
function CreditCardView({brand,ending,used,limit,due,gradient}:{brand:string;ending:string;used:number;limit:number;due:string;gradient:string}) { const percent=Math.round(used/limit*100); return <article className="panel credit-widget"><div className={`credit-visual ${gradient}`}><div><span className="credit-brand">FIN</span><CreditCard size={25}/></div><strong>•••• •••• •••• {ending}</strong><div><span><small>TITULAR</small>MARCOS ALVES</span><span><small>VALIDADE</small>08/30</span></div></div><div className="credit-data"><div><span>{brand} • Fatura atual</span><strong>{money.format(used)}</strong><small>Vence em {due}</small></div><button className="icon-button"><MoreHorizontal size={18}/></button><div className="limit-row"><span>Limite utilizado</span><strong>{percent}%</strong></div><div className="progress"><span style={{width:`${percent}%`}}/></div><small>{money.format(limit-used)} disponível de {money.format(limit)}</small></div></article>; }
