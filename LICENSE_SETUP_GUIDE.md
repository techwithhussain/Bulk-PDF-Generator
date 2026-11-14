# 🔑 License Key System — Setup Guide

## Step 1: Google Sheet Banao

1. Google Sheets kholo: https://sheets.google.com
2. Naya sheet banao naam: "Local PDF Studio - Licenses"
3. Row 1 mein yeh headers likho:

| A | B | C | D | E |
|---|---|---|---|---|
| LICENSE_KEY | USER_NAME | STATUS | CREATED_DATE | NOTES |

4. Example data:
```
TWH-ABCD-1234  | Ahmed Office  | active  | 2024-01-01 | Office Computer
TWH-EFGH-5678  | Sara HR       | active  | 2024-01-01 | HR Department  
TWH-IJKL-9012  | Test User     | blocked | 2024-01-01 | Blocked
```

STATUS values:
- active  → App chalega ✅
- blocked → App nahi chalega ❌
- expired → App nahi chalega ❌

---

## Step 2: Google Apps Script Deploy karo

1. Google Sheet mein: Extensions → Apps Script
2. Yeh code paste karo (Code.gs mein):

```javascript
function doGet(e) {
  var key = e.parameter.key;
  
  if (!key) {
    return ContentService
      .createTextOutput(JSON.stringify({ valid: false, status: 'invalid' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Sheet access
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var data = sheet.getDataRange().getValues();
  
  // Search for key (skip header row)
  for (var i = 1; i < data.length; i++) {
    var rowKey = String(data[i][0]).trim().toUpperCase();
    var inputKey = String(key).trim().toUpperCase();
    
    if (rowKey === inputKey) {
      var status = String(data[i][2]).trim().toLowerCase();
      var userName = String(data[i][1]).trim();
      
      return ContentService
        .createTextOutput(JSON.stringify({
          valid: status === 'active',
          status: status,
          userName: userName
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  // Key not found
  return ContentService
    .createTextOutput(JSON.stringify({ valid: false, status: 'not_found' }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

3. Save karo (Ctrl+S)
4. Deploy → New Deployment
   - Type: Web app
   - Execute as: Me
   - Who has access: Anyone
5. Deploy click karo
6. URL copy karo (looks like):
   https://script.google.com/macros/s/XXXXXXXXXX/exec

---

## Step 3: URL App mein Add karo

File: `electron/ipc/license.js`

Line 7 mein replace karo:
```javascript
// CHANGE THIS LINE:
const VALIDATION_URL = 'https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec'

// TO YOUR URL:
const VALIDATION_URL = 'https://script.google.com/macros/s/AKfycbXXXXXXXXXX/exec'
```

---

## Keys Kaise Banao:

Format: TWH-XXXX-XXXX-XXXX

Examples:
```
TWH-2024-OFF1-ABCD  → Office 1
TWH-2024-OFF2-EFGH  → Office 2
TWH-2024-HOME-IJKL  → Home use
TWH-2024-TEST-MNOP  → Testing
```

Bas koi bhi unique combination likho — 4 characters ka 3 groups.

---

## Kisi Ko Block Karna Ho:

Google Sheet kholo → us key ki row mein STATUS → "blocked" likho → Save

**Bas! Agla baar jab woh internet se connect hoga, app block ho jayega.**

(Offline hoga toh tab tak chalega jab tak internet se connect nahi hoga)

---

## Test Karo:

Browser mein yeh URL kholo:
```
https://script.google.com/macros/s/YOUR_ID/exec?key=TWH-ABCD-1234
```

Response aana chahiye:
```json
{"valid":true,"status":"active","userName":"Ahmed Office"}
```

