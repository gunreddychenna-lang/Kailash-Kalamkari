# Inventory Management with Barcode & COUNTIF

## 🎯 Your Workflow is Already Working!

Your website automatically reads the **qty** column from Google Sheets and:
- Shows products when **qty > 0** (in stock)
- Marks products as **SOLD OUT** when **qty = 0**
- Hides sold-out products from the main grid (but keeps them visible with badge)

## 📊 Your Google Sheets Setup

### Sheet Structure (Example):
```
Column A: code        (e.g., KS001)
Column B: fabric      (e.g., Pure Kanchipuram Silk)
Column C: price       (e.g., 15000)
Column D: qty         (Your COUNTIF formula goes here!)
Column E: image link  (Google Drive URL)
Column F: description (Product details)
Column H: barcode     (Product barcode)
```

## 🔢 How to Use COUNTIF for Quantity

### Step 1: Set Up Your Billing/Closing Sheet
Create a separate sheet (e.g., named "Closing") with your billing software data:
```
Column A: Barcode
Column B: Product Name
Column C: Quantity Sold
```

### Step 2: Use COUNTIF Formula in Main Sheet

In your **qty column (Column D)**, use this formula:

```excel
=COUNTIF('Closing'!A:A, H2)
```

**What this does:**
- Looks at the "Closing" sheet
- Counts how many times the barcode in H2 appears
- Returns that count as the quantity

### Example:
```
Main Sheet:
Row 2: Code=KS001, Barcode=12345, Qty Formula: =COUNTIF('Closing'!A:A, H2)

Closing Sheet:
Row 5: Barcode=12345 (sold 1 unit)
Row 8: Barcode=12345 (sold 1 unit)

Result: Qty = 2 (found 2 matches)
```

## 📝 Complete Formula Examples

### Basic COUNTIF (Count occurrences):
```excel
=COUNTIF('Closing'!A:A, H2)
```

### COUNTIF with Multiple Sheets:
```excel
=COUNTIF('Closing'!A:A, H2) + COUNTIF('Billing'!A:A, H2)
```

### COUNTIF with Condition (Only count if > 0):
```excel
=MAX(0, COUNTIF('Closing'!A:A, H2))
```

### COUNTIF with Date Range (Today's sales only):
```excel
=COUNTIFS('Closing'!A:A, H2, 'Closing'!B:B, ">="&TODAY()-1)
```

## 🔄 Your Daily Workflow

### Morning (Update Inventory):
1. Export closing data from billing software
2. Paste into "Closing" sheet
3. The COUNTIF formulas automatically calculate quantities
4. Website updates automatically within 30 seconds

### Example Daily Update:
```
Yesterday's Sales (paste into Closing sheet):
- Barcode 12345: 2 units sold
- Barcode 67890: 1 unit sold
- Barcode 11111: 0 units sold

Main Sheet Qty Column (auto-updates):
- Product 12345: Was 10, Now 8 (10-2)
- Product 67890: Was 5, Now 4 (5-1)
- Product 11111: Was 3, Now 3 (no change)

Website Result:
- Product 12345: Shows as "In Stock" (qty=8)
- Product 67890: Shows as "In Stock" (qty=4)
- Product 11111: Shows as "In Stock" (qty=3)
```

## ⚙️ Advanced: Track Remaining Stock

If you want to track **remaining stock** instead of **sold quantity**:

### Option 1: Direct Stock Count
```excel
=InitialStock - COUNTIF('Closing'!A:A, H2)
```
Where InitialStock is a fixed number (e.g., 10)

### Option 2: Stock from Another Sheet
```excel
=StockSheet!B2 - COUNTIF('Closing'!A:A, H2)
```

## 🎨 How Website Reads Your Data

### What Happens Automatically:
1. Website fetches data from Google Sheets every 30 seconds
2. Reads the **qty** column value
3. If **qty > 0**: Shows product normally
4. If **qty = 0**: Shows "SOLD OUT" badge
5. If **qty is empty**: Treats as 0 (sold out)

### Code Reference (script.js line 189):
```javascript
qty: Number(item.qty) || 0,
```

This means:
- If qty is 5 → Product shows as available
- If qty is 0 → Product shows as SOLD OUT
- If qty is empty → Product shows as SOLD OUT
- If qty is "5" (text) → Converts to 5 and shows as available

## ✅ Testing Your Setup

### Test 1: Verify COUNTIF Works
1. In Google Sheets, manually enter a number in qty column
2. Refresh website (http://localhost:8000)
3. Product should show/not show based on qty

### Test 2: Verify SOLD OUT Badge
1. Set qty to 0
2. Refresh website
3. Product should show with red "SOLD OUT" badge
4. Product image should be grayscale

### Test 3: Verify Auto-Update
1. Keep website open
2. Change qty in Google Sheets
3. Wait 30 seconds
4. Website automatically updates (no refresh needed)

## 🚀 Pro Tips

### Tip 1: Use IF with COUNTIF
```excel
=IF(COUNTIF('Closing'!A:A, H2)>0, COUNTIF('Closing'!A:A, H2), 0)
```

### Tip 2: Track Multiple Locations
```excel
=COUNTIF('Store1'!A:A, H2) + COUNTIF('Store2'!A:A, H2) + COUNTIF('Online'!A:A, H2)
```

### Tip 3: Minimum Stock Alert
```excel
=IF(COUNTIF('Closing'!A:A, H2)>=5, COUNTIF('Closing'!A:A, H2), "LOW STOCK")
```

## 📋 Checklist for Your Setup

- [ ] Google Sheet has columns: code, fabric, price, qty, image link, description, barcode
- [ ] Barcode is in column H
- [ ] Closing/Billing sheet has barcode column
- [ ] Qty column has COUNTIF formula: `=COUNTIF('Closing'!A:A, H2)`
- [ ] Google Sheet is published to web (File → Share → Publish to web)
- [ ] Website is running and fetching data

## 🎉 Summary

**Your Workflow:**
```
Billing Software → Export Closing Data → Paste in Google Sheets → 
COUNTIF calculates qty → Website reads qty → Shows/Hides products
```

**Everything is automatic!** Just paste your closing data and the website handles the rest.

---

**Status**: ✅ Your barcode + COUNTIF workflow is fully supported and working!