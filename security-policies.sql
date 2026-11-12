-- SAHUR D'OR 2026 : politiques RLS attendues
-- À exécuter dans Supabase SQL Editor si les politiques équivalentes ne sont pas déjà présentes.

alter table public.nominees enable row level security;
alter table public.votes enable row level security;

drop policy if exists "Nominees visible to everyone" on public.nominees;
create policy "Nominees visible to everyone"
on public.nominees for select to anon, authenticated
using (true);

drop policy if exists "One vote per user" on public.votes;
create policy "One vote per user"
on public.votes for insert to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can view own vote" on public.votes;
create policy "Users can view own vote"
on public.votes for select to authenticated
using (auth.uid() = user_id);

-- La contrainte UNIQUE sur votes.user_id empêche un deuxième bulletin par utilisateur.
-- Ne créez aucune politique SELECT publique sur votes : les résultats restent privés.
