# SAHUR D'OR 2026 — version connectée Supabase

## Fichiers
- `index.html`, `style.css`, `app.js`
- `security-policies.sql` : politiques RLS de référence

## Configuration déjà renseignée
- Project URL Supabase
- Publishable key fournie par l'utilisateur (clé publique destinée au navigateur)

## À faire avant les vrais votes
1. Dans Supabase > Authentication > URL Configuration, ajouter l'URL de production dans Site URL et Redirect URLs. Pour tester localement, ajouter par exemple `http://localhost:5500/**`.
2. Dans Supabase > Authentication > Providers > Discord, vérifier que Discord est activé et que Client ID/Secret sont corrects.
3. Dans Discord Developer Portal > OAuth2 > Redirects, mettre le Callback URL exact fourni par Supabase (généralement `https://<project-ref>.supabase.co/auth/v1/callback`).
4. Vérifier que la table `nominees` contient les 12 candidats et que `votes.user_id` a une contrainte UNIQUE.
5. Vérifier les politiques RLS avec `security-policies.sql`. Les utilisateurs authentifiés peuvent insérer leur propre vote et lire uniquement leur propre bulletin.
6. Héberger le site en HTTPS. Ne pas ouvrir `index.html` en `file://` pour tester OAuth ; utiliser un serveur local ou un hébergeur.
7. Vérifier les paramètres de confidentialité et les permissions du fournisseur Discord.

## Limites de cette version
- Connexion OAuth Discord et lecture/écriture Supabase sont branchées dans le front-end.
- Cette version ne vérifie PAS encore l'appartenance à un serveur Discord précis. Le simple OAuth Discord ne prouve pas qu'un compte est membre de votre serveur.
- Aucun écran administrateur de clôture/révélation n'est encore fourni.
- Les résultats ne sont pas affichés par le site. Les votes restent lisibles uniquement par leur propriétaire grâce aux politiques RLS.
- Les secrets Discord et la clé `service_role` ne doivent jamais être placés dans le navigateur.
- Le projet doit être testé sur l'URL réellement autorisée dans Supabase avant l'ouverture des votes.
