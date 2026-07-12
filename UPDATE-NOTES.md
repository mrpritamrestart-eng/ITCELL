# July 2026 Stationery Completion Update — Revision 2

यह update पुराने prototype को secure internal stationery inventory और billing workflow में बदलता है। Full details `STATIONERY-COMPLETION-REPORT.md` और installation steps `INSTALLATION-GUIDE-HINDI.md` में हैं।

## Revision 2 Fixes

- पूरे application में dark-mode inherited pale text issue हटाया गया। अब headings, forms, dropdown options, tables और audit logs light background पर साफ dark text में दिखेंगे।
- **Current Stock → CSV Actual Stock Reconciliation** जोड़ा गया।
- Sample CSV में सभी active item IDs, item names, units और current system quantity pre-filled आती है।
- User केवल `actual_stock_quantity` और optional `remarks` बदलकर same CSV upload कर सकता है।
- Upload के बाद system quantity को blind overwrite नहीं करता; exact difference की auditable `RECONCILIATION IN/OUT` transaction बनती है।
- Sample download के बाद stock बदल गया हो तो stale CSV upload automatically block होती है।
- Concurrent purchase/out entry के दौरान CSV upload होने पर पूरी operation rollback होती है।
- Recent CSV reconciliation batches Current Stock page पर दिखती हैं।

## New Pages

- Purchase Register
- Out Register
- Stock Ledger
- Stock Adjustment
- Final Vendor Bills
- Admin Audit Log
- Admin Data Maintenance
- Admin Office Settings

## New APIs/Models

- Atomic StockBalance
- StockAdjustment
- StockReconciliation
- AuditLog
- Counter/document numbering
- OfficeSetting
- VendorBill
- Permission PDF
- Final vendor bill workflow

## Mandatory First-run Action

Updated project पहली बार चलाने के बाद Admin → Data Maintenance में one-time migration चलाएँ। Migration से पहले database backup लें। अगर previous complete ZIP पर migration पहले successful चल चुकी है तो Revision 2 के लिए migration दोबारा जरूरी नहीं है; application restart और build पर्याप्त है।
