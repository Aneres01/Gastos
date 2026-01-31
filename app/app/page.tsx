"use client";
import { useEffect, useMemo, useState } from "react";
import { Nav } from "../components/Nav";
import { supabase } from "../../lib/supabaseClient";
import type { Category, Profile, Transaction } from "../../lib/types";
import { ensureProfileAndFamily } from "../../lib/auth";

function moneyBRL(v:number){
  return v.toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
}

function monthRange(date: Date){
  const y = date.getFullYear(), m = date.getMonth();
  const start = new Date(y, m, 1);
  const end = new Date(y, m+1, 1);
  const s = start.toISOString().slice(0,10);
  const e = end.toISOString().slice(0,10);
  return { s, e };
}

export default function AppPage(){
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile|null>(null);
  const [cats, setCats] = useState<Category[]>([]);
  const [tx, setTx] = useState<Transaction[]>([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string|null>(null);
  const [month, setMonth] = useState(() => new Date());

  // form
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [payment, setPayment] = useState("pix");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0,10));

  useEffect(() => {
    async function boot(){
      const { data } = await supabase.auth.getSession();
      if (!data.session) { window.location.href = "/"; return; }
      try {
        await ensureProfileAndFamily();
        const { data: userData } = await supabase.auth.getUser();
        const user = userData.user!;
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        setProfile(prof as any);
      } catch (e:any){
        setErr(e.message ?? String(e));
      } finally {
        setReady(true);
      }
    }
    boot();
  }, []);

  async function load(){
    if (!profile) return;
    setBusy(true); setErr(null);
    try{
      const { data: cdata, error: cerr } = await supabase
        .from("categories")
        .select("*")
        .eq("family_id", profile.family_id)
        .order("name");
      if (cerr) throw cerr;
      const c = (cdata ?? []) as any as Category[];
      setCats(c);
      if (!categoryId && c.length) setCategoryId(c[0].id);

      const { s, e } = monthRange(month);
      const { data: tdata, error: terr } = await supabase
        .from("transactions")
        .select("*")
        .eq("family_id", profile.family_id)
        .gte("date", s)
        .lt("date", e)
        .order("date", { ascending: false });
      if (terr) throw terr;
      setTx((tdata ?? []) as any as Transaction[]);
    }catch(e:any){
      setErr(e.message ?? String(e));
    }finally{
      setBusy(false);
    }
  }

  useEffect(() => { if (profile) load(); }, [profile, month]);

  const total = useMemo(() => tx.reduce((s,t)=>s + Number(t.amount), 0), [tx]);

  const byCat = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of tx){
      map[t.category_id] = (map[t.category_id] ?? 0) + Number(t.amount);
    }
    const rows = Object.entries(map).map(([id, v]) => ({
      id,
      name: cats.find(c=>c.id===id)?.name ?? "Categoria",
      icon: cats.find(c=>c.id===id)?.icon ?? "•",
      value: v
    }));
    rows.sort((a,b)=>b.value-a.value);
    return rows;
  }, [tx, cats]);

  async function addTx(){
    if (!profile) return;
    setBusy(true); setErr(null);
    try{
      const raw = amount.replaceAll(".", "").replaceAll(",", ".").trim();
      const v = Number(raw);
      if (!v || v <= 0) throw new Error("Informe um valor válido");
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user!;
      const { error } = await supabase.from("transactions").insert({
        family_id: profile.family_id,
        created_by: user.id,
        amount: v,
        date,
        category_id: categoryId,
        payment_method: payment,
        description: desc.trim()
      });
      if (error) throw error;
      setAmount(""); setDesc("");
      await load();
    }catch(e:any){
      setErr(e.message ?? String(e));
    }finally{
      setBusy(false);
    }
  }

  async function del(id: string){
    setBusy(true); setErr(null);
    try{
      const { error } = await supabase.from("transactions").delete().eq("id", id);
      if (error) throw error;
      await load();
    }catch(e:any){
      setErr(e.message ?? String(e));
    }finally{
      setBusy(false);
    }
  }

  if (!ready) return <div className="container"><p>Carregando…</p></div>;

  return (
    <>
      <Nav title="CasalGastos" />
      <div className="container">
        {err ? <div className="card" style={{borderColor:"rgba(248,113,113,.5)"}}><b style={{color:"#f87171"}}>Erro:</b> {err}</div> : null}

        <div className="grid cols2" style={{marginTop: 12}}>
          <div className="card">
            <div className="row">
              <div>
                <small>Total do mês</small>
                <div className="kpi">{moneyBRL(total)}</div>
              </div>
              <div className="spacer" />
              <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()-1, 1))}>◀</button>
              <button className="btn" onClick={() => setMonth(new Date())}>Hoje</button>
              <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth()+1, 1))}>▶</button>
            </div>
            <div style={{marginTop: 10}}>
              <small>Top categorias</small>
              <div style={{marginTop: 8}}>
                {byCat.length === 0 ? <small>Sem lançamentos.</small> : null}
                {byCat.slice(0,5).map(r => (
                  <div key={r.id} style={{display:"flex", gap:10, alignItems:"center", padding:"8px 0", borderBottom:"1px solid var(--line)"}}>
                    <span className="badge">{r.icon} {r.name}</span>
                    <div className="spacer" />
                    <b>{moneyBRL(r.value)}</b>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <h2 style={{fontSize:16}}>Adicionar gasto</h2>
            <label>Valor</label>
            <input className="input" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Ex: 12,50" />
            <label>Categoria</label>
            <select value={categoryId} onChange={e=>setCategoryId(e.target.value)}>
              {cats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
            </select>
            <label>Forma de pagamento</label>
            <select value={payment} onChange={e=>setPayment(e.target.value)}>
              <option value="pix">Pix</option>
              <option value="cartao">Cartão</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="boleto">Boleto</option>
            </select>
            <label>Data</label>
            <input className="input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
            <label>Descrição (opcional)</label>
            <input className="input" value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Ex: Farmácia" />
            <div className="row" style={{marginTop: 12}}>
              <button className="btn primary" disabled={busy} onClick={addTx}>{busy ? "Salvando..." : "Salvar"}</button>
              <div className="spacer" />
              <small>{profile ? <>Family Code: <b>{profile.family_id}</b></> : null}</small>
            </div>
          </div>
        </div>

        <div className="card" style={{marginTop: 12}}>
          <div className="row">
            <h2 style={{fontSize:16}}>Lançamentos do mês</h2>
            <div className="spacer" />
            <button className="btn" onClick={load} disabled={busy}>Atualizar</button>
          </div>
          <div style={{overflowX:"auto"}}>
            <table className="table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Categoria</th>
                  <th>Pagamento</th>
                  <th>Descrição</th>
                  <th>Valor</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {tx.map(t => (
                  <tr key={t.id}>
                    <td>{t.date}</td>
                    <td>{cats.find(c=>c.id===t.category_id)?.name ?? "Categoria"}</td>
                    <td><span className="badge">{t.payment_method}</span></td>
                    <td>{t.description}</td>
                    <td><b>{moneyBRL(Number(t.amount))}</b></td>
                    <td><button className="btn" onClick={() => del(t.id)} disabled={busy}>Excluir</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p><small>Dica iPhone: abra no Safari → Compartilhar → “Adicionar à Tela de Início”.</small></p>
        </div>
      </div>
    </>
  )
}
