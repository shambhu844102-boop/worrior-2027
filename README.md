# WORRIOR 2027

A private study collaboration web app for a six-member student group.

## Features in this starter
- Email/password sign-in
- Admin-only member creation through a Supabase Edge Function
- Group chat with Supabase Realtime
- Private file uploads and signed download links
- Assignment creation
- Member directory and suggested weekly schedule
- Jitsi Meet room embedded in the app
- Responsive dark Discord-inspired UI

## 1. Requirements
- Node.js 20+
- A Supabase account/project
- Git and a GitHub account (for deployment)

## 2. Run locally
```bash
npm install
cp .env.example .env
```
Fill `.env` with your Supabase Project URL and anon/public key from **Supabase → Project Settings → API**.

Then run:
```bash
npm run dev
```
Open the local URL printed by Vite.

## 3. Set up the database
1. Open your Supabase project.
2. Open **SQL Editor → New query**.
3. Paste and run `supabase/schema.sql`.
4. In **Authentication → Users**, create the first admin user.
5. Copy that user's UUID.
6. Run this SQL, replacing the placeholder:
```sql
update public.profiles
set role = 'admin'
where id = 'YOUR_AUTH_USER_UUID';
```
7. Sign in to the app using that admin account.

The database trigger creates a profile automatically for newly created Auth users.

## 4. Deploy the admin account function
Install Supabase CLI and log in:
```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```
Set function secrets (never put the service-role key in `.env` or frontend code):
```bash
supabase secrets set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
supabase secrets set SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase secrets set APP_ORIGIN=https://YOUR-APP-DOMAIN.vercel.app
```
Deploy:
```bash
supabase functions deploy admin-create-member
```
The Settings page can now create member accounts. Only a profile whose role is `admin` can use this function.

## 5. Create the six accounts
1. Sign in with the admin account.
2. Open Settings.
3. Create the remaining student accounts one by one.
4. Share each temporary password privately.
5. Ask members not to reuse passwords from other accounts.

The admin account counts toward the six-member limit.

## 6. Deploy frontend to Vercel
1. Push this folder to a private GitHub repository.
2. Import the repository in Vercel.
3. Add environment variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Vercel uses `vercel.json` to route app paths to the SPA.

## 7. Jitsi notes — read before using
This starter embeds the public `meet.jit.si` service. It is convenient for testing, but it is not private authentication: anyone who learns the room name may attempt to enter. Use a long, unguessable room name and share it only inside the group. Do not discuss sensitive personal information in public Jitsi rooms.

For stronger production privacy, use a managed Jitsi provider or self-host Jitsi with authentication and room moderation. Configure the Jitsi domain in `src/App.jsx` when you change providers.

## 8. Security and production checklist
- Keep the Supabase service-role key only in Edge Function secrets.
- Keep the GitHub repository private while it contains project configuration.
- Never commit `.env`.
- Configure `APP_ORIGIN` to your exact deployed domain rather than `*`.
- Enable email/password policies and use strong, unique passwords.
- Review Supabase Auth rate limits and database backups.
- Restrict allowed file types and set a storage quota.
- Add password reset, assignment submissions, moderation and audit logs before inviting a larger group.
- Test with separate student accounts before relying on it for school work.

## Current starter limitations
- Jitsi room name is shared by all app users and does not itself enforce app membership.
- Chat is a basic group channel; private DMs, reactions and moderation are not included.
- Assignments can be created and viewed; student submission workflow is a future feature.
- The schedule is a suggested static template.
- There is no built-in recording feature.
- This is a starter implementation, not a security-audited production service.

## Suggested next upgrades
1. Member password reset and profile editing
2. Assignment submissions and teacher feedback
3. Admin moderation and message deletion
4. Subject-specific channels
5. Shared whiteboard
6. Push notifications
