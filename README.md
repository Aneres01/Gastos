# CasalGastos (Web/PWA) - PC + Celular por LINK

Sistema moderno (Next.js) que roda no navegador e pode ser instalado como app (PWA) no iPhone/Android.

## 1) Configurar Supabase
1. Crie um projeto no Supabase
2. Rode `supabase/schema.sql` no SQL Editor
3. Pegue URL + Anon key (Settings -> API)

## 2) Rodar localmente
```bash
npm install
cp .env.example .env.local
# edite .env.local com suas chaves
npm run dev
```

## 3) Publicar por link (recomendado)
- Vercel (mais fácil): importe o repo
- Configure as variáveis:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY

## 4) Instalar no iPhone como app
Safari -> Compartilhar -> Adicionar à Tela de Início
