# Deep Styling Audit: SalesByCustomerTableNew vs SalesByCountryTable

## Executive Summary

This document provides a comprehensive comparison of styling differences between `SalesByCustomerTableNew` and `SalesByCountryTable` components, focusing on sticky positioning, responsiveness, borders, font sizes, and all styling-related aspects.

---

## 1. STICKY POSITIONING COMPARISON

### 1.1 Z-Index Layering

**SalesByCustomerTableNew:**
```css
--z-corner: 20;    /* First column header - always on top */
--z-hdr3: 16;      /* First header row (Year) */
--z-hdr2: 15;      /* Second header row (Month) */
--z-hdr1: 14;      /* Third header row (Type) */
--z-firstcol: 12;  /* Body first column */
--z-secondcol: 11; /* Body second column (Sales Rep) - NEW */
--z-header: 10;    /* Generic header fallback */
--z-separator: 1;  /* Period separators */
```

**SalesByCountryTable:**
```css
--z-corner: 20;    /* First column header - always on top */
--z-hdr3: 16;      /* First header row (Year) */
--z-hdr2: 15;      /* Second header row (Month) */
--z-hdr1: 14;      /* Third header row (Type) */
--z-firstcol: 12;  /* Body first column */
--z-header: 10;    /* Generic header fallback */
--z-separator: 1;  /* Period separators */
```

**DIFFERENCE:** SalesByCustomerTableNew has an additional `--z-secondcol: 11` for the Sales Rep column, which SalesByCountryTable does not have.

---

### 1.2 Header Rows Sticky Positioning

**SalesByCustomerTableNew:**
- **4 header rows** (Year, Month, Type, Values/%)
- Row 1: `top: 0`
- Row 2: `top: calc(var(--sbc-hdr-h) * 1)`
- Row 3: `top: calc(var(--sbc-hdr-h) * 2)`
- Row 4: `top: calc(var(--sbc-hdr-h) * 3)`
- Corner header height: `calc(var(--sbc-hdr-h) * 4)` (4 rows)

**SalesByCountryTable:**
- **5 header rows** (Year, Month, Type, Values, %)
- Row 1: `top: 0`
- Row 2: `top: calc(var(--sbc-hdr-h) * 1)`
- Row 3: `top: calc(var(--sbc-hdr-h) * 2)`
- Row 4: `top: calc(var(--sbc-hdr-h) * 3)`
- Row 5: `top: calc(var(--sbc-hdr-h) * 4)`
- Corner header height: `calc(var(--sbc-hdr-h) * 5)` (5 rows)

**DIFFERENCE:** 
- SalesByCountryTable has **5 header rows** vs SalesByCustomerTableNew's **4 header rows**
- This is because SalesByCountryTable separates "Values" and "%" into separate header rows, while SalesByCustomerTableNew combines them in one row

---

### 1.3 First Column (Corner) Sticky Positioning

**SalesByCustomerTableNew:**
```css
.sales-by-customer-table thead tr:first-child th.empty-header {
  position: sticky !important;
  left: 0 !important;
  top: 0 !important;
  z-index: var(--z-corner) !important;
  height: calc(var(--sbc-hdr-h) * 4); /* 4 rows */
  min-width: 200px;
  max-width: 200px;
  background-color: #ffffff !important;
  color: #000000 !important;
  border: none !important; /* NO BORDERS */
}
```

**SalesByCountryTable:**
```css
.sales-by-country-table thead tr:first-child th.empty-header {
  position: sticky !important;
  left: 0 !important;
  top: 0 !important;
  z-index: var(--z-corner) !important;
  height: calc(var(--sbc-hdr-h) * 5); /* 5 rows */
  min-width: 200px;
  max-width: 200px;
  /* NO explicit border: none - borders are applied */
  border-left: 2px solid black !important;
  border-right: 2px solid black !important;
}
```

**DIFFERENCE:**
- Height: 4 rows vs 5 rows
- Borders: SalesByCustomerTableNew explicitly removes borders (`border: none !important`), while SalesByCountryTable has 2px solid black borders

---

### 1.4 Second Column Sticky Positioning

**SalesByCustomerTableNew:**
- **Has a second column (Sales Rep)** that is **NOT sticky**
```css
.sales-by-customer-table thead tr:first-child th.sales-rep-header {
  /* NOT sticky - scrolls horizontally */
  background-color: #ffffff !important;
  height: calc(var(--sbc-hdr-h) * 4);
}
```

**SalesByCountryTable:**
- **No second column** - only one left column (Country Names)

**DIFFERENCE:** SalesByCustomerTableNew has a second non-sticky column for Sales Rep names, which SalesByCountryTable does not have.

---

### 1.5 Body First Column Sticky Positioning

**SalesByCustomerTableNew:**
```css
.sales-by-customer-table tbody tr td:first-child:not(.total-top20-label):not(.total-other-label):not(.total-sales-label):not(.number-all-label) {
  position: sticky !important;
  left: 0 !important;
  z-index: var(--z-firstcol) !important;
  background-color: #ffffff !important;
  min-width: 200px;
  max-width: 200px;
  font-weight: 600 !important;
}
```

**SalesByCountryTable:**
```css
.sales-by-country-table tbody tr:not(.sbc-separator-row) td:first-child {
  position: sticky !important;
  left: 0 !important;
  z-index: var(--z-firstcol) !important;
  background-color: transparent; /* allows row-level/inline */
  min-width: 200px;
  max-width: 200px;
  /* NO explicit font-weight */
}
```

**DIFFERENCE:**
- Background: SalesByCustomerTableNew uses `#ffffff !important`, SalesByCountryTable uses `transparent` to allow inline styles
- Font-weight: SalesByCustomerTableNew has `font-weight: 600 !important`, SalesByCountryTable doesn't set it explicitly
- Selector: SalesByCustomerTableNew excludes summary row labels, SalesByCountryTable excludes separator rows

---

### 1.6 Separator Row Sticky Positioning

**SalesByCustomerTableNew:**
```css
.sales-by-customer-table .sbc-separator-row td {
  position: sticky !important;
  top: calc(var(--sbc-hdr-h) * 4) !important; /* Below 4 header rows */
  z-index: var(--z-hdr1) !important;
  height: 8px !important;
  background-color: white !important;
  border-top: 2px solid black !important;
  border-bottom: 2px solid black !important;
}

.sales-by-customer-table .sbc-separator-row td:first-child {
  position: sticky !important;
  left: 0 !important;
  top: calc(var(--sbc-hdr-h) * 4) !important;
  z-index: var(--z-corner) !important;
}

.sales-by-customer-table .sbc-separator-row td:nth-child(2) {
  /* Second cell - NOT sticky horizontally, but sticky vertically */
  background-color: white !important;
}
```

**SalesByCountryTable:**
```css
.sales-by-country-table .sbc-separator-row td {
  position: sticky !important;
  top: calc(var(--sbc-hdr-h) * 4) !important; /* Below 4 header rows */
  z-index: var(--z-hdr1) !important;
  height: 8px !important;
  background-color: transparent; /* let inline / parent show */
  border-top: 2px solid black !important;
  border-bottom: 2px solid black !important;
}

.sales-by-country-table .sbc-separator-row td:first-child {
  position: sticky !important;
  left: 0 !important;
  top: calc(var(--sbc-hdr-h) * 4) !important;
  z-index: var(--z-corner) !important;
  border-left: 2px solid black !important;
  border-right: 2px solid black !important;
}
```

**DIFFERENCE:**
- Background: SalesByCustomerTableNew uses `white !important`, SalesByCountryTable uses `transparent`
- Borders: SalesByCountryTable has left/right borders on first cell, SalesByCustomerTableNew doesn't
- Second cell: SalesByCustomerTableNew has explicit styling for `td:nth-child(2)`, SalesByCountryTable doesn't

---

## 2. BORDERS COMPARISON

### 2.1 Overall Border Strategy

**SalesByCustomerTableNew:**
- **NO rectangle borders** - explicitly removed
- Comment: `/* ======================================== NO RECTANGLE BORDERS - REMOVED ======================================== */`
- Only separator row has borders (top/bottom)
- First column has `border: none !important`

**SalesByCountryTable:**
- **EXTENSIVE rectangle borders** - 2px solid black borders throughout
- Comment: `/* ======================================== RECTANGLE BORDERS - 6 BOXES (First Column + 5 Periods) ======================================== */`
- First column has left/right borders
- Period columns have left/right borders forming rectangles
- Separator row has borders including left/right on first cell

**DIFFERENCE:** This is the **MAJOR DIFFERENCE** - SalesByCountryTable has comprehensive border rectangles, while SalesByCustomerTableNew has no borders except the separator row.

---

### 2.2 First Column Borders

**SalesByCustomerTableNew:**
```css
.sales-by-customer-table thead tr:first-child th.empty-header {
  border: none !important; /* EXPLICITLY REMOVED */
}
```

**SalesByCountryTable:**
```css
.sales-by-country-table thead tr:first-child th.empty-header {
  border-left: 2px solid black !important;
  border-right: 2px solid black !important;
}

.sales-by-country-table tbody tr td:nth-child(1) {
  border-left: 2px solid black !important;
  border-right: 2px solid black !important;
}
```

**DIFFERENCE:** SalesByCountryTable has 2px solid black borders on first column, SalesByCustomerTableNew explicitly removes them.

---

### 2.3 Period Column Borders

**SalesByCustomerTableNew:**
- **NO period borders** - no border styling for data columns

**SalesByCountryTable:**
- **EXTENSIVE period borders** - borders on header rows 1-4 and body rows
- Row 1: Borders on even columns (2, 4, 6, 8...)
- Row 2-3: Borders on consecutive columns (1, 2, 3, 4...)
- Row 4: Borders on every 2nd cell (%) to complete rectangles
- Body: Borders on columns 2, 4, 6, 8, 10...

**DIFFERENCE:** SalesByCountryTable has complex border logic for period rectangles, SalesByCustomerTableNew has none.

---

### 2.4 Separator Row Borders

**SalesByCustomerTableNew:**
```css
.sales-by-customer-table .sbc-separator-row td {
  border-top: 2px solid black !important;
  border-bottom: 2px solid black !important;
  /* NO left/right borders */
}
```

**SalesByCountryTable:**
```css
.sales-by-country-table .sbc-separator-row td:first-child {
  border-left: 2px solid black !important;
  border-right: 2px solid black !important;
  border-top: 2px solid black !important;
  border-bottom: 2px solid black !important;
}

.sales-by-country-table .sbc-separator-row td:nth-child(2) {
  border-right: 2px solid black !important;
}

/* Period borders on separator row */
.sales-by-country-table .sbc-separator-row td:nth-child(4),
.sales-by-country-table .sbc-separator-row td:nth-child(6),
/* ... more period borders ... */
```

**DIFFERENCE:** SalesByCountryTable has comprehensive border logic on separator row including period borders, SalesByCustomerTableNew only has top/bottom borders.

---

### 2.5 Summary Row Borders

**SalesByCustomerTableNew:**
```css
.sales-by-customer-table .thick-border-bottom {
  border-bottom: 4px solid #333 !important; /* Thick border before summary */
}
```

**SalesByCountryTable:**
- No explicit thick border before summary rows
- Uses standard 2px borders from rectangle system

**DIFFERENCE:** SalesByCustomerTableNew has a 4px thick border before summary rows, SalesByCountryTable doesn't.

---

## 3. FONT SIZES COMPARISON

### 3.1 CSS Variables (Root)

**Both tables use IDENTICAL font size variables:**
```css
--sbc-font-base: clamp(9px, 1.8vw, 12px);
--sbc-font-header: clamp(11px, 2.1vw, 14px);
--sbc-font-label: var(--sbc-font-base);
--sbc-font-accent: calc(var(--sbc-font-base) + 1px);
--sbc-font-corner: calc(var(--sbc-font-header) + 6px);
```

**DIFFERENCE:** None - both use the same font size system.

---

### 3.2 Desktop Font Sizes (1200px+)

**Both tables:**
```css
--sbc-font-base: 11px;
--sbc-font-header: 13px;
--sbc-font-label: 11px;
--sbc-font-accent: 11px;
--sbc-font-corner: 18px;
```

**DIFFERENCE:** None - identical desktop font sizes.

---

### 3.3 Tablet Font Sizes (768px - 1199px)

**Both tables:**
```css
--sbc-font-base: 9px;
--sbc-font-header: 10px;
--sbc-font-label: 9px;
--sbc-font-accent: 9px;
--sbc-font-corner: 14px;
```

**DIFFERENCE:** None - identical tablet font sizes.

---

### 3.4 Mobile Font Sizes (< 768px)

**Both tables:**
```css
--sbc-font-base: 9px;
--sbc-font-header: 10px;
--sbc-font-label: 9px;
--sbc-font-accent: 9px;
--sbc-font-corner: 12px;
```

**DIFFERENCE:** None - identical mobile font sizes.

---

### 3.5 Print Font Sizes

**Both tables:**
```css
--sbc-font-base: 10px;
--sbc-font-header: 11px;
--sbc-font-label: 10px;
--sbc-font-accent: 10px;
--sbc-font-corner: 13px;
```

**DIFFERENCE:** None - identical print font sizes.

---

### 3.6 Specific Cell Font Sizes

**SalesByCustomerTableNew:**
```css
.sales-by-customer-table .summary-label {
  font-size: 12px !important;
}

.sales-by-customer-table .summary-cell {
  font-size: 12px !important;
}

.sales-by-customer-table tbody tr td:nth-child(2) {
  font-size: 12px !important; /* Sales Rep column */
}
```

**SalesByCountryTable:**
```css
.sales-by-country-table .row-label {
  font-size: var(--sbc-font-label); /* Uses variable */
}

.sales-by-country-table .country-name-cell {
  font-size: var(--sbc-font-accent); /* Uses variable */
}

.sales-by-country-table .delta-cell {
  font-size: var(--sbc-font-base) !important;
}
```

**DIFFERENCE:**
- SalesByCustomerTableNew uses **hardcoded 12px** for summary rows and Sales Rep column
- SalesByCountryTable uses **CSS variables** for most font sizes
- SalesByCustomerTableNew's approach is less flexible but more explicit

---

## 4. RESPONSIVITY COMPARISON

### 4.1 Container Classes

**SalesByCustomerTableNew:**
- `.table-view` (not `.sbc-table-view`)
- `.table-container` (not `.sbc-table-container`)
- `.table-container-for-export`

**SalesByCountryTable:**
- `.sbc-table-view`
- `.sbc-table-container`
- `.sbc-table-container-for-export`

**DIFFERENCE:** Different class name prefixes - SalesByCustomerTableNew uses generic `.table-*`, SalesByCountryTable uses `.sbc-table-*`.

---

### 4.2 Container Styling

**Both tables have IDENTICAL container styling:**
```css
width: 100% !important;
max-width: 100% !important;
overflow-x: auto !important;
overflow-y: auto !important;
max-height: 80vh !important;
min-height: 50vh !important;
```

**DIFFERENCE:** None - identical container behavior.

---

### 4.3 Desktop Responsiveness (1200px+)

**SalesByCustomerTableNew:**
```css
@media (min-width: 1200px) {
  .sales-by-customer-table thead th {
    padding: 4px 4px !important;
  }
  .sales-by-customer-table td {
    padding: 4px 6px;
  }
}
```

**SalesByCountryTable:**
```css
@media (min-width: 1200px) {
  .sales-by-country-table thead th {
    padding: 4px 4px !important;
  }
  .sales-by-country-table td {
    padding: 4px 6px;
  }
  
  /* ADDITIONAL: Data cell widths */
  .sales-by-country-table .data-value-cell {
    min-width: 90px !important;
    max-width: 90px !important;
  }
  .sales-by-country-table .data-percent-cell {
    min-width: 50px !important;
    max-width: 50px !important;
  }
}
```

**DIFFERENCE:** SalesByCountryTable has explicit cell width constraints for data cells, SalesByCustomerTableNew doesn't.

---

### 4.4 Tablet Responsiveness (768px - 1199px)

**SalesByCustomerTableNew:**
```css
@media (min-width: 768px) and (max-width: 1199px) {
  .sales-by-customer-table th,
  .sales-by-customer-table td {
    padding: 3px 4px;
  }
}
```

**SalesByCountryTable:**
```css
@media (min-width: 768px) and (max-width: 1199px) {
  .sales-by-country-table th,
  .sales-by-country-table td {
    padding: 3px 4px;
  }
  
  /* ADDITIONAL: Data cell widths */
  .sales-by-country-table .data-value-cell {
    min-width: 70px !important;
    max-width: 70px !important;
  }
  .sales-by-country-table .data-percent-cell {
    min-width: 45px !important;
    max-width: 45px !important;
  }
  .sales-by-country-table .delta-cell {
    min-width: 55px !important;
    max-width: 55px !important;
  }
}
```

**DIFFERENCE:** SalesByCountryTable has explicit cell width constraints for tablet, SalesByCustomerTableNew doesn't.

---

### 4.5 Mobile Responsiveness (< 768px)

**SalesByCustomerTableNew:**
```css
@media (max-width: 767px) {
  /* Only font size changes - no other mobile-specific styling */
}
```

**SalesByCountryTable:**
```css
@media (max-width: 767px) {
  /* EXTENSIVE mobile styling: */
  - Table layout changes
  - Column width optimizations
  - Padding adjustments
  - Sticky positioning preservation
  - Row label sizing (140px)
  - Data cell widths (70px/40px)
  - Delta cell widths (50px)
  - Color scheme maintenance
  - Overflow handling
}
```

**DIFFERENCE:** 
- **MAJOR DIFFERENCE** - SalesByCountryTable has **comprehensive mobile styling** (200+ lines)
- SalesByCustomerTableNew has **minimal mobile styling** (only font sizes)
- SalesByCountryTable handles mobile much more thoroughly

---

### 4.6 Mobile Landscape Responsiveness

**SalesByCustomerTableNew:**
- **NO mobile landscape media query**

**SalesByCountryTable:**
```css
@media (max-width: 1024px) and (orientation: landscape) {
  /* EXTENSIVE mobile landscape styling - similar to portrait */
}
```

**DIFFERENCE:** SalesByCountryTable has dedicated mobile landscape styling, SalesByCustomerTableNew doesn't.

---

### 4.7 iPad Specific Considerations

**Both tables:**
- iPad falls into tablet breakpoint (768px - 1199px)
- Both use same tablet font sizes (9px base, 10px header)
- Both use same tablet padding (3px 4px)

**DIFFERENCE:** None for iPad specifically, but SalesByCountryTable has more comprehensive tablet cell width constraints.

---

### 4.8 iPhone Specific Considerations

**SalesByCustomerTableNew:**
- Uses mobile breakpoint (< 768px)
- Only font size adjustments
- No cell width constraints
- No overflow optimizations

**SalesByCountryTable:**
- Uses mobile breakpoint (< 768px)
- Comprehensive cell width constraints
- Row label sizing (140px)
- Data cell widths (70px/40px)
- Delta cell widths (50px)
- Overflow handling
- Sticky positioning preservation

**DIFFERENCE:** SalesByCountryTable has much better iPhone optimization.

---

## 5. BACKGROUND COLORS COMPARISON

### 5.1 First Column Background

**SalesByCustomerTableNew:**
```css
.sales-by-customer-table tbody tr td:first-child:not(.summary-label) {
  background-color: #ffffff !important;
}
```

**SalesByCountryTable:**
```css
.sales-by-country-table tbody tr:not(.sbc-separator-row) td:first-child {
  background-color: transparent; /* allows row-level/inline */
}

.sales-by-country-table .row-label {
  background-color: #f8f9fa !important; /* Light gray */
}
```

**DIFFERENCE:**
- SalesByCustomerTableNew: White background (`#ffffff`)
- SalesByCountryTable: Light gray background (`#f8f9fa`) for row labels

---

### 5.2 Summary Row Backgrounds

**SalesByCustomerTableNew:**
```css
/* Summary rows use inline styles from JS */
.total-top20-label { /* Blue: #2196F3 */ }
.total-other-label { /* Blue: #1565C0 */ }
.total-sales-label { /* Blue: #0D47A1 */ }
.number-all-label { /* Blue: #1976D2 */ }
```

**SalesByCountryTable:**
```css
.sales-by-country-table .total-metric-row td.row-label.total-row-label {
  background-color: #7A6764 !important; /* Brown */
  color: #fff !important;
}
```

**DIFFERENCE:**
- SalesByCustomerTableNew: Multiple blue shades for different summary rows
- SalesByCountryTable: Single brown color (`#7A6764`) for total row

---

### 5.3 Country/Customer Name Cell Background

**SalesByCustomerTableNew:**
```css
.sales-by-customer-table tbody tr td:first-child {
  background-color: #ffffff !important;
}
```

**SalesByCountryTable:**
```css
.sales-by-country-table .metric-row td.row-label.country-name-cell {
  background-color: #f8f9fa !important; /* Light gray */
  font-weight: bold !important;
}
```

**DIFFERENCE:**
- SalesByCustomerTableNew: White background
- SalesByCountryTable: Light gray background (`#f8f9fa`)

---

### 5.4 Delta Cell Background

**Both tables:**
```css
background-color: #f8f9fa !important; /* Light gray */
```

**DIFFERENCE:** None - identical delta cell backgrounds.

---

## 6. PADDING COMPARISON

### 6.1 Header Cell Padding

**Both tables:**
```css
padding: 4px 6px !important; /* Default */
```

**Desktop:**
```css
padding: 4px 4px !important;
```

**Tablet:**
```css
padding: 3px 4px;
```

**Mobile:**
```css
padding: 4px 2px; /* SalesByCountryTable */
padding: 3px 2px; /* SalesByCountryTable */
```

**DIFFERENCE:** SalesByCountryTable has more granular mobile padding adjustments.

---

### 6.2 Body Cell Padding

**Both tables:**
```css
padding: clamp(2px, 0.5vw, 8px) clamp(3px, 0.7vw, 12px); /* Default */
```

**Desktop:**
```css
padding: 4px 6px;
```

**Tablet:**
```css
padding: 3px 4px;
```

**Mobile:**
```css
padding: 3px 2px; /* SalesByCountryTable */
```

**DIFFERENCE:** SalesByCountryTable has more mobile-specific padding adjustments.

---

### 6.3 First Column Padding

**SalesByCustomerTableNew:**
```css
padding-left: 12px !important;
```

**SalesByCountryTable:**
```css
padding-left: 12px !important; /* Same */
```

**DIFFERENCE:** None - identical first column padding.

---

## 7. COLUMN WIDTHS COMPARISON

### 7.1 First Column Width

**Both tables:**
```css
min-width: 200px;
max-width: 200px;
```

**Mobile:**
```css
min-width: 120px; /* SalesByCountryTable */
min-width: 140px; /* SalesByCountryTable - row-label */
```

**DIFFERENCE:** SalesByCountryTable has mobile-specific width adjustments, SalesByCustomerTableNew doesn't.

---

### 7.2 Second Column (Sales Rep) Width

**SalesByCustomerTableNew:**
- Uses percentage-based width: `13%` (from JS `columnWidths.salesRep`)
- No explicit min/max width in CSS

**SalesByCountryTable:**
- No second column

**DIFFERENCE:** SalesByCustomerTableNew has a second column with percentage-based width.

---

### 7.3 Data Cell Widths

**SalesByCustomerTableNew:**
- Uses percentage-based widths from JS
- No explicit min/max widths in CSS

**SalesByCountryTable:**
```css
/* Desktop */
.data-value-cell { min-width: 90px; max-width: 90px; }
.data-percent-cell { min-width: 50px; max-width: 50px; }

/* Tablet */
.data-value-cell { min-width: 70px; max-width: 70px; }
.data-percent-cell { min-width: 45px; max-width: 45px; }

/* Mobile */
.data-value-cell { min-width: 70px; max-width: 70px; }
.data-percent-cell { min-width: 40px; max-width: 40px; }
```

**DIFFERENCE:** SalesByCountryTable has explicit cell width constraints for all breakpoints, SalesByCustomerTableNew relies on percentage-based widths.

---

### 7.4 Delta Cell Widths

**SalesByCustomerTableNew:**
- Uses percentage-based width: `4.5%` (from JS)
- No explicit min/max width in CSS

**SalesByCountryTable:**
```css
/* Desktop */
.delta-cell { min-width: 70px; max-width: 70px; }

/* Tablet */
.delta-cell { min-width: 55px; max-width: 55px; }

/* Mobile */
.delta-cell { min-width: 50px; max-width: 50px; }
```

**DIFFERENCE:** SalesByCountryTable has explicit delta cell widths, SalesByCustomerTableNew uses percentage-based.

---

## 8. WHITE SPACE & TEXT HANDLING

### 8.1 First Column Text Handling

**SalesByCustomerTableNew:**
```css
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
```

**SalesByCountryTable:**
```css
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
```

**DIFFERENCE:** None - identical text handling.

---

### 8.2 Data Column Text Handling

**SalesByCustomerTableNew:**
```css
.sales-by-customer-table td:not(:first-child):not(:nth-child(2)),
.sales-by-customer-table thead th:not(:first-child):not(.sales-rep-header) {
  white-space: nowrap !important;
}
```

**SalesByCountryTable:**
```css
.sales-by-country-table td:not(:first-child),
.sales-by-country-table thead th:not(:first-child) {
  white-space: nowrap !important;
}
```

**DIFFERENCE:** SalesByCustomerTableNew excludes second column (Sales Rep) from nowrap, SalesByCountryTable doesn't have this exclusion.

---

## 9. SUMMARY ROWS STYLING

### 9.1 Summary Row Structure

**SalesByCustomerTableNew:**
- 4 summary rows:
  1. Total Top 20 Customers (Blue: #2196F3)
  2. Total Other Customers (Blue: #1565C0)
  3. Total Sales (Blue: #0D47A1)
  4. Number of All Customers (Blue: #1976D2)

**SalesByCountryTable:**
- 1 summary row:
  1. Total (Brown: #7A6764)

**DIFFERENCE:** SalesByCustomerTableNew has 4 summary rows with different blue shades, SalesByCountryTable has 1 brown total row.

---

### 9.2 Summary Row Sticky Positioning

**SalesByCustomerTableNew:**
```css
.sales-by-customer-table .total-top20-label,
.sales-by-customer-table .total-other-label,
.sales-by-customer-table .total-sales-label,
.sales-by-customer-table .number-all-label {
  position: sticky !important;
  left: 0 !important;
  z-index: var(--z-firstcol) !important;
  /* NO background-color - let inline styles work */
}
```

**SalesByCountryTable:**
```css
.sales-by-country-table .total-metric-row td.row-label.total-row-label {
  /* Sticky positioning inherited from first column rules */
  background-color: #7A6764 !important;
}
```

**DIFFERENCE:** SalesByCustomerTableNew explicitly handles sticky positioning for each summary row type, SalesByCountryTable relies on inherited rules.

---

## 10. PSEUDO-ELEMENT BACKGROUNDS

### 10.1 First Column Pseudo-Elements

**SalesByCustomerTableNew:**
```css
.sales-by-customer-table tbody tr td:first-child:not(.summary-label)::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #fff;
  z-index: -1;
  pointer-events: none;
}
```

**SalesByCountryTable:**
```css
.sales-by-country-table tbody tr:not(.sbc-separator-row) td:first-child::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: -3px; /* Extends slightly */
  bottom: 0;
  background-color: #fff;
  z-index: -1;
  pointer-events: none;
}
```

**DIFFERENCE:** SalesByCountryTable extends pseudo-element slightly (`right: -3px`) to cover bleed, SalesByCustomerTableNew doesn't.

---

## 11. KEY DIFFERENCES SUMMARY

### Critical Differences:

1. **BORDERS:**
   - SalesByCountryTable: Extensive 2px solid black rectangle borders
   - SalesByCustomerTableNew: No borders (explicitly removed)

2. **HEADER ROWS:**
   - SalesByCountryTable: 5 header rows
   - SalesByCustomerTableNew: 4 header rows

3. **SECOND COLUMN:**
   - SalesByCustomerTableNew: Has Sales Rep column (not sticky)
   - SalesByCountryTable: No second column

4. **MOBILE RESPONSIVENESS:**
   - SalesByCountryTable: Comprehensive mobile styling (200+ lines)
   - SalesByCustomerTableNew: Minimal mobile styling (font sizes only)

5. **CELL WIDTHS:**
   - SalesByCountryTable: Explicit min/max widths for all breakpoints
   - SalesByCustomerTableNew: Percentage-based widths from JS

6. **SUMMARY ROWS:**
   - SalesByCustomerTableNew: 4 summary rows with different blue shades
   - SalesByCountryTable: 1 brown total row

7. **BACKGROUND COLORS:**
   - SalesByCustomerTableNew: White backgrounds for first column
   - SalesByCountryTable: Light gray (`#f8f9fa`) for row labels

8. **CLASS NAMING:**
   - SalesByCustomerTableNew: Generic `.table-*` classes
   - SalesByCountryTable: `.sbc-table-*` classes

---

## 12. RECOMMENDATIONS

### For SalesByCustomerTableNew:

1. **Add Mobile Responsiveness:** Implement comprehensive mobile styling similar to SalesByCountryTable
2. **Add Cell Width Constraints:** Add explicit min/max widths for better control
3. **Consider Borders:** Evaluate if rectangle borders would improve readability
4. **Standardize Class Names:** Consider using `.sbc-` prefix for consistency
5. **Add Mobile Landscape Support:** Add dedicated landscape media query

### For SalesByCountryTable:

1. **Consider Second Column:** If Sales Rep column is needed, add it with proper sticky handling
2. **Review Summary Rows:** Consider if multiple summary rows like SalesByCustomerTableNew would be useful

---

## END OF AUDIT







