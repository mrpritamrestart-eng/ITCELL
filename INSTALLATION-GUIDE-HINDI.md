# Updated ZIP लगाने की आसान प्रक्रिया

## 1. पहले Backup लें

1. अपने पुराने project folder की पूरी copy बनाकर अलग रख दें।
2. MongoDB Atlas में database backup/export लें।
3. पुरानी `.env.local` file की copy अलग सुरक्षित रखें।

## 2. ZIP की Files लगाएँ

सबसे सुरक्षित तरीका:

1. ZIP extract करें।
2. Extracted project folder को नए नाम से रखें, जैसे `IT-CELL-UPDATED`।
3. पुरानी `.env.local` file नए folder में copy करें।
4. पुराने `node_modules` और `.next` folder copy न करें।

## 3. `.env.local` Update करें

पुराने MongoDB values वही रखें। ये values जरूर मौजूद हों:

```env
MONGODB_URI=आपकी_पुरानी_MongoDB_URI
MONGODB_DB_NAME=आपका_database_name
ADMIN_USERNAME=admin
ADMIN_PASSWORD=अपना_strong_password
ADMIN_AUTH_TOKEN=कम_से_कम_16_character_का_long_random_secret
ALLOW_OPENING_STOCK_EDIT=false
SEED_STATIONERY_ENABLED=false
```

`ADMIN_AUTH_TOKEN` password से अलग रखें। Example को 그대로 use न करें।

## 4. VS Code Terminal में Commands

Project folder खोलें और terminal में:

```bash
npm install
npm run check
```

`npm run check` lint, TypeScript और production build तीनों verify करेगा।

Development run:

```bash
npm run dev
```

Browser में खोलें:

```text
http://localhost:3000
```

## 5. पहली बार Login

`.env.local` में दिए `ADMIN_USERNAME` और `ADMIN_PASSWORD` से login करें।

## 6. One-time Migration — केवल एक बार

1. **Admin** खोलें।
2. **Data Maintenance** खोलें।
3. **Run One-time Migration** दबाएँ।
4. Prompt में `MIGRATE` लिखें।
5. Successful message आने तक browser बंद न करें।

Migration क्या करती है:

- पुराने Purchase/Out records को document numbers देती है।
- पुराने status/audit-compatible fields backfill करती है।
- पुराने stock transactions से नया fast StockBalance बनाती है।
- आवश्यक database indexes create करती है।

अगर negative legacy stock मिलता है तो migration जानबूझकर रुक जाएगी। ऐसी स्थिति में listed item की पुरानी Purchase/Out entries verify करें; system गलत balance को zero मानकर छिपाएगा नहीं।

## 7. Migration के बाद Verification

1. Current Stock खोलें।
2. 5–10 important items का balance पुराने records/manual stock से मिलाएँ।
3. Stock Ledger में Opening + Purchase + Adjustment + Reconciliation − Out verify करें।
4. Branch और Item master check करें।
5. Admin → Office Settings में office/district/signature labels भरें।

## 8. Daily Use का सही क्रम

- नया सामान आया: **Purchase Entry**
- किसी एक item की physical correction/return/damage: **Stock Adjustment**
- सभी items का physical stock एक साथ मिलाना: **Current Stock → CSV Actual Stock Reconciliation**
- branch को सामान दिया: **Out Entry**
- month complete: **Permissions** load/edit/finalize
- permission PDF download
- three firms calculation save
- comparative PDF download
- Final Vendor Bill draft बनाकर approve करें
- payment होने पर Mark Paid करें

## 9. CSV से Actual Stock कैसे Set करें

1. **Current Stock** page खोलें।
2. **Download Sample CSV** दबाएँ।
3. CSV में केवल `actual_stock_quantity` और जरूरत हो तो `remarks` बदलें।
4. Item ID, item name, unit, current system quantity या rows delete/edit न करें।
5. File को CSV format में save करें।
6. Verification date, reason और completed CSV select करके **Upload & Set Actual Stock** दबाएँ।
7. System current और actual quantity का difference Stock Ledger में `RECONCILIATION IN/OUT` के रूप में save करेगा।

Sample download के बाद कोई purchase/out entry हुई हो तो old CSV reject होगी। Fresh sample download करके नई quantity भरें।

## 10. गलत Entry कैसे सुधारें

- Purchase/Out को database से manually delete न करें।
- Register खोलकर **Cancel** use करें और reason भरें।
- System automatic stock reversal करेगा।
- Finalized permission से linked Out Entry cancel करनी हो तो पहले permission unlock करें।
- Opening Stock locked हो तो Stock Adjustment use करें।

## 11. ZIP लगाते समय क्या Copy नहीं करना

- `.next`
- `node_modules`
- कोई पुरानी build cache
- किसी दूसरे व्यक्ति की `.env.local`

नई ZIP में ये folders जानबूझकर शामिल नहीं किए गए हैं।
