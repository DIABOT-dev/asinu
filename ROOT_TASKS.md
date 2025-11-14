# Root-Level Deployment Tasks (MVP Rewards Update)

## Context
- Repo: `/root/asinu`
- Change set already merged: Rewards catalog, VP ledger, Donate flag (default OFF)
- Goal: apply DB migration + flip env flags on staging VPS so the MVP Rewards module can be smoked (donation remains disabled)

## Steps for Root Shell
1. **Apply new migration**
   ```bash
   cd /root/asinu
   psql "$DATABASE_URL" -f migrations/117_reward_wallet.sql
   ```
2. **Enable rewards (keep donations off)**
   - Set in `.env.staging` (and deployment secrets):
     ```
     TREE_ENABLED=true
     REWARDS_ENABLED=true
     NEXT_PUBLIC_REWARDS=true
     DONATION_ENABLED=false
     NEXT_PUBLIC_DONATION=false
     ```
   - Redeploy / restart the app so both server + client pick up flags.
3. **Smoke rewards APIs**
   ```bash
   curl -i --cookie "asinu.sid=..." https://<host>/api/rewards/catalog
   curl -i --cookie "asinu.sid=..." https://<host>/api/rewards/redemptions
   ```
   - Optional: POST `/api/rewards/redeem` with one of the seeded item IDs to confirm ledger updates.
4. **Verify mission → VP ledger**
   ```bash
   # after completing a mission with the same session
   psql "$DATABASE_URL" -c "SELECT * FROM vp_ledger ORDER BY created_at DESC LIMIT 5;"
   ```
   Ensure entries are inserted with `reason='mission:<code>'` and balances increment.

> Note: Donation/Payment stays OFF for MVP. When ready to enable, set `DONATION_ENABLED=true`, update `DONATION_PORTAL_URL`, and rerun `/api/donate` smoke.
