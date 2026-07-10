# Permission and Comparative Quotations Update

## Added pages

- `/stationery-bills/permission-comparative`
- `/stationery-bills/permission-comparative/firms`
- `/stationery-bills/permission-comparative/permissions`
- `/stationery-bills/permission-comparative/bill-calculations`
- `/stationery-bills/permission-comparative/comparative-performa`

## Added APIs

- `/api/stationery/firms`
- `/api/stationery/permissions`
- `/api/stationery/permissions/source`
- `/api/stationery/quotation-calculations`
- `/api/stationery/comparative-quotation-pdf`

## Added database models

- `Firm`
- `PermissionBatch`
- `QuotationCalculation`

## Main workflow

1. Add and permanently save firm names.
2. Select month and load PS/Branch data from Stationery Out Records.
3. Edit item names and quantities, add/remove items, or duplicate a branch for split bills.
4. Save final permission records.
5. Select one or more permission records and three firms.
6. Enter item-wise rates for the second and third firm and manually enter the first firm total.
7. Save the calculation with an Invoice No.
8. Preview and download the two-page PDF named with the Invoice No.

## Required environment variables

Keep the existing `.env.local` values, including:

- `MONGODB_URI`
- Existing admin login environment variables

## Commands

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run lint
npm run build
```

The project passed TypeScript, ESLint and production build checks during this update.
