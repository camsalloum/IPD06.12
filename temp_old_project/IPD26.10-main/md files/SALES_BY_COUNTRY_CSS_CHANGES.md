# Sales by Country Table CSS Changes - Complete Documentation

## Overview
This document details all changes made to `src/components/dashboard/SalesByCountryTable.css` to match the Product Group table styling while adapting for 5 header rows and 2 columns per period (Values + %).

---

## Initial Changes (Font Matching)

### 1. Font Family
- **Changed from:** `'DejaVu Sans', 'Segoe UI', Arial, sans-serif`
- **Changed to:** `Arial, sans-serif`
- **Reason:** Match Product Group table font family

### 2. Table Font Size
- **Changed from:** `font-size: 13px` (fixed)
- **Changed to:** `font-size: clamp(9px, 1.8vw, 12px)` (responsive)
- **Reason:** Match Product Group responsive font sizing

### 3. Header Font Size
- **Changed from:** `font-size: 14px` (fixed)
- **Changed to:** `font-size: clamp(11px, 2.1vw, 14px)` (responsive)
- **Added:** `line-height: 1.2`
- **Reason:** Match Product Group header font sizing

### 4. Empty Header (Countries Column)
- **Font-size:** `16px` → `22px`
- **Font-weight:** `700` → `bold`
- **Added:** `font-family: Arial, sans-serif`
- **Added:** `line-height: 1.1`
- **Reason:** Match Product Group first column header styling

### 5. Row Label Styling
- **Font-weight:** `600` → `normal`
- **Font-size:** `12px` (explicit)
- **Added:** `padding-left: 12px`
- **Reason:** Match Product Group row label styling

### 6. Body Cell Line-Height
- **Changed from:** `line-height: 1.25`
- **Changed to:** `line-height: 1.15`
- **Reason:** Match Product Group table line-height

### 7. Cell Padding
- **Changed from:** `padding: 8px` (fixed)
- **Changed to:** `padding: clamp(2px, 0.5vw, 8px) clamp(3px, 0.7vw, 12px)` (responsive)
- **Reason:** Match Product Group responsive padding

---

## STEP 1: Foundation - CSS Variables and Base Structure

### 8. Added CSS Variables (`:root`)
```css
--sc-hdr-h: 28px          /* Sticky header row height */
--z-corner: 20            /* First column header z-index */
--z-hdr5: 17              /* Star row z-index */
--z-hdr4: 16              /* Year row z-index */
--z-hdr3: 15              /* Month row z-index */
--z-hdr2: 14              /* Type row z-index */
--z-hdr1: 13              /* Values/% row z-index */
--z-firstcol: 12          /* Body first column z-index */
--z-header: 10            /* Generic header z-index */
--z-separator: 1          /* Separator row z-index */
```
**Reason:** Enable consistent sticky positioning and z-index layering

### 9. Changed Border-Collapse Model
- **Changed from:** `border-collapse: collapse`
- **Changed to:** `border-collapse: separate`
- **Added:** `border-spacing: 0`
- **Reason:** Required for sticky headers to work properly

### 10. Updated Base Table Structure
- **Added:** `min-width: 100%`
- **Updated:** Font sizing to responsive `clamp()`
- **Added:** Background color declarations
- **Reason:** Match Product Group table structure

### 11. Star Row Styling Updates
- **Height:** `36px` → `var(--sc-hdr-h) !important` (28px)
- **Added:** `min-height: var(--sc-hdr-h) !important`
- **Added:** `max-height: var(--sc-hdr-h) !important`
- **Line-height:** `36px` → `var(--sc-hdr-h)`
- **Font-size:** `28px` (maintained)
- **Reason:** Consistent height management using CSS variables

### 12. Header Base Styling
- **Added:** `position: sticky !important`
- **Added:** `height: var(--sc-hdr-h) !important` (28px)
- **Added:** `min-height` and `max-height` constraints
- **Changed padding:** `4px 6px !important`
- **Added:** `background-color: transparent`
- **Added:** `background-clip: padding-box !important`
- **Added:** `overflow: hidden !important`
- **Reason:** Enable sticky positioning and proper layering

### 13. White Underlay Pseudo-Elements
- **Added:** `::before` pseudo-elements for headers without inline backgrounds
- **Purpose:** Prevents content bleed while allowing inline colors to show
- **Z-index:** `-1` to stay behind content

### 14. First Column Header (Countries) - Sticky Corner
- **Added:** `position: sticky !important`
- **Added:** `left: 0 !important`
- **Added:** `top: calc(var(--sc-hdr-h) * 1) !important` (28px - below star row)
- **Added:** `z-index: var(--z-corner) !important`
- **Height:** `calc(var(--sc-hdr-h) * 4) !important` (112px - spans rows 2-5)
- **Added:** White underlay `::before` pseudo-element
- **Reason:** Create sticky corner cell that stays fixed during scroll

### 15. Star Row First Cell - Sticky Corner
- **Added:** `position: sticky !important`
- **Added:** `left: 0 !important`
- **Added:** `top: 0 !important`
- **Added:** `z-index: var(--z-corner) !important`
- **Added:** White underlay `::before` pseudo-element
- **Reason:** Star row first cell also needs sticky corner positioning

### 16. Container and Layout Updates
- **Updated `.table-view`:** `overflow: visible` (let child handle scrolling)
- **Added `.table-container-for-export`:** Export wrapper
- **Updated `.table-container`:** 
  - `overflow-x: auto !important` (horizontal scroll forced)
  - `overflow-y: auto !important` (vertical scroll when needed)
  - `max-height: 80vh !important`
  - `min-height: 50vh !important`
  - `will-change: scroll-position !important`
  - `contain: layout !important`
- **Added:** Scrollbar styling (webkit-scrollbar)
- **Reason:** Match Product Group container behavior

---

## STEP 2: Sticky Headers - 5-Tier System

### 17. Five Sticky Header Tiers Implementation
- **Row 1 (Star):** `top: 0`, `z-index: var(--z-hdr5) !important`
- **Row 2 (Year):** `top: calc(var(--sc-hdr-h) * 1) !important` (28px), `z-index: var(--z-hdr4) !important`
- **Row 3 (Month):** `top: calc(var(--sc-hdr-h) * 2) !important` (56px), `z-index: var(--z-hdr3) !important`
- **Row 4 (Type):** `top: calc(var(--sc-hdr-h) * 3) !important` (84px), `z-index: var(--z-hdr2) !important`
- **Row 5 (Values/%):** `top: calc(var(--sc-hdr-h) * 4) !important` (112px), `z-index: var(--z-hdr1) !important`
- **Reason:** Create layered sticky effect where each header row sticks at correct position

### 18. Sticky Corner Positioning
- **Star row first cell:** `position: sticky`, `left: 0`, `top: 0`, `z-index: --z-corner`
- **Countries header (Row 2):** `position: sticky`, `left: 0`, `top: 28px`, `z-index: --z-corner`
- **Reason:** Corner cells need highest z-index to stay above all headers

---

## STEP 3: Borders - 2px Solid Black Rectangles

### 19. Removed Default Borders
- **Added:** `border: none` to base `.sales-by-country-table th, td`
- **Reason:** Prevent default borders from interfering with custom border system

### 20. Top Borders
- **Row 2 (Year - first header row with borders):** `border-top: 2px solid black !important`
- **Note:** Star row (Row 1) has NO borders as specified
- **Reason:** Define rectangle boundaries

### 21. Bottom Borders
- **Last body row:** `border-bottom: 2px solid black !important`
- **Reason:** Complete rectangle boundaries at bottom

### 22. First Column Borders (Countries)
- **Header:** `border-left: 2px solid black !important`, `border-right: 2px solid black !important`
- **Body:** `border-left: 2px solid black !important`, `border-right: 2px solid black !important`
- **Excludes:** Separator row using `:not(.sc-separator-row)`
- **Reason:** First column rectangle boundaries

### 23. Period Rectangle Borders
**Structure:** Each period = 2 columns (Values + %)
- **Row 2 (Year):** Right borders on colspan=2 cells, left borders for Period 2+
- **Row 3 (Month):** Borders for all periods (deltas filtered out)
- **Row 4 (Type):** Borders for all periods (deltas filtered out)
- **Row 5 (Values/%):** 
  - Period 1: Right borders only
  - Period 2+: Left borders on Values columns, right borders on % columns
- **Body rows:** 
  - Period 1: Right borders on Values and % columns
  - Period 2+: Left borders on Values columns, right borders on % columns
- **Delta columns:** No period borders (not part of rectangles)
- **Reason:** Create visual period rectangles matching Product Group structure

---

## STEP 4: Separator Row - Added in JS and Styled

### 24. Separator Row CSS Styling
- **Height:** `8px !important`
- **Position:** `sticky` at `top: calc(var(--sc-hdr-h) * 5) !important` (140px - below 5 header rows)
- **Z-index:** `var(--z-hdr1) !important`
- **Borders:** 
  - `border: none !important` (remove all first)
  - `border-top: 2px solid black !important`
  - `border-bottom: 2px solid black !important`
  - `border-left: none !important`
  - `border-right: none !important`
- **Background:** `white !important`
- **Added:** `min-height` and `max-height` constraints
- **Reason:** Visual separator between headers and body, sticky during scroll

### 25. Separator Row First Cell (Corner)
- **Position:** `sticky`, `left: 0`, `top: calc(var(--sc-hdr-h) * 5)`
- **Z-index:** `var(--z-corner) !important`
- **Borders:** `border-left: 2px solid black`, `border-right: 2px solid black`
- **Reason:** Corner cell needs highest z-index and proper borders

### 26. Separator Row Period Column Borders
- **Period boundaries:** 
  - Left borders on Period 2+ Values columns (nth-child 5, 8, 11, 14, 17, 20)
  - Right borders on all % columns (nth-child 3, 6, 9, 12, 15, 18, 21)
- **Reason:** Match header/body period rectangle borders

### 27. Updated Body Selectors
- **Excluded separator row:** All body row styles use `:not(.sc-separator-row)`
- **Affected selectors:**
  - `tbody tr:not(.sc-separator-row) td:first-child` (text-align, borders)
  - `tbody tr:not(.sc-separator-row) td:nth-child(X)` (period borders)
- **Reason:** Prevent separator row from inheriting body row styles

---

## STEP 5: Sticky First Column - Body Rows

### 28. Body First Column Sticky Positioning
- **Added:** `position: sticky !important`
- **Added:** `left: 0 !important`
- **Added:** `z-index: var(--z-firstcol) !important`
- **Added:** `padding-left: 12px !important`
- **Added:** `white-space: nowrap`
- **Added:** `text-overflow: ellipsis`
- **Width:** `min-width: 200px`, `max-width: 200px`
- **Background:** `transparent` (allows row-level/inline colors)
- **Reason:** Country names stay visible during horizontal scroll

### 29. First Column Pseudo-Element Backgrounds
- **Added:** `::before` pseudo-elements for white underlay
- **Targets:** 
  - `thead tr:nth-child(2) th.empty-header::before`
  - `thead tr:nth-child(1) th.empty-header.star-cell::before`
  - `tbody tr:not(.sc-separator-row) td:first-child::before`
- **Extended:** `right: -3px` on body cells to cover bleed from scrolling cells
- **Reason:** Prevent content from showing through sticky first column

---

## STEP 7: Responsive - Desktop (1200px+)

### 30. Desktop Media Query
```css
@media (min-width: 1200px) {
  .sales-by-country-table {
    font-size: 12px;
    min-width: 100%;
  }
  .sales-by-country-table thead th {
    font-size: 14px;
    padding: 4px 6px !important;
  }
  .sales-by-country-table td {
    padding: 8px 12px;
  }
}
```
**Reason:** Optimize for large screens with comfortable spacing

---

## STEP 8: Responsive - Tablet (768px-1199px)

### 31. Tablet Media Query
```css
@media (min-width: 768px) and (max-width: 1199px) {
  .sales-by-country-table {
    font-size: 11px;
    min-width: 100%;
  }
  .sales-by-country-table thead th {
    font-size: 12px;
  }
  .sales-by-country-table th,
  .sales-by-country-table td {
    padding: 6px 8px;
  }
}
```
**Reason:** Balanced sizing for medium screens

---

## STEP 9: Responsive - Mobile Portrait (<768px)

### 32. Mobile Portrait Media Query Base
- **Table font-size:** `9px`
- **Table layout:** `auto` (for responsive column widths)
- **Header font-size:** `10px`
- **Padding:** `3px 2px` (reduced for space)
- **White-space:** `nowrap` with `text-overflow: ellipsis`

### 33. Mobile Sticky Header Tiers
- **All 5 tiers maintained** with correct `top` positions:
  - Row 1: `top: 0`
  - Row 2: `top: calc(var(--sc-hdr-h) * 1)` (28px)
  - Row 3: `top: calc(var(--sc-hdr-h) * 2)` (56px)
  - Row 4: `top: calc(var(--sc-hdr-h) * 3)` (84px)
  - Row 5: `top: calc(var(--sc-hdr-h) * 4)` (112px)
- **Z-index values preserved**

### 34. Mobile Separator Row
- **Sticky positioning maintained:** `top: calc(var(--sc-hdr-h) * 5)` (140px)
- **Borders:** `2px solid black` (top and bottom)
- **Added:** `min-height: 8px`, `max-height: 8px`
- **Background:** `white !important`

### 35. Mobile First Column
- **Width:** `120px` (reduced from 200px)
- **Sticky left positioning maintained**
- **Star row first cell:** Sticky corner at `top: 0`
- **Countries header:** Sticky corner at `top: 28px`

### 36. Mobile Row Labels
- **Width:** `120px` (reduced from 200px)
- **Font-size:** `10px`
- **Padding:** Optimized for mobile

### 37. Mobile Container
- **Updated:** `.table-view` padding to `8px`
- **Enhanced scrolling:** `-webkit-overflow-scrolling: touch`
- **Max-height:** `80vh` for internal scrolling

---

## STEP 10: Responsive - Mobile Landscape (<1024px landscape)

### 38. Mobile Landscape Media Query
- **Same optimizations as mobile portrait**
- **Adjusted for landscape orientation**
- **All sticky functionality preserved**
- **Font sizes and padding:** Same as portrait
- **Container behavior:** Same as portrait

---

## Final Fix: Separator Row Border Issue in Portrait

### 39. Fixed Separator Row Borders
**Problem:** Separator row showing thin grey borders instead of thick black borders in portrait view

**Solution:**
- **Added:** `border: none !important` first to remove all borders
- **Then applied:** `border-top: 2px solid black !important`
- **Then applied:** `border-bottom: 2px solid black !important`
- **Explicitly set:** `border-left: none !important` and `border-right: none !important`
- **Added:** `min-height: 8px !important` and `max-height: 8px !important`
- **Changed background:** `transparent` → `white !important`
- **Applied to:**
  - Base `.sc-separator-row td` rule
  - Mobile portrait media query
  - Mobile landscape media query

**Reason:** Ensure separator row always shows 2px black borders regardless of inherited styles

---

## Additional Changes

### 40. Print Styles
```css
@media print {
  .sales-by-country-table { 
    font-size: 10px; 
    background: #fff; 
  }
  .sales-by-country-table th, 
  .sales-by-country-table td { 
    padding: 4px 6px; 
  }
}
```
**Reason:** Optimize table for printing

### 41. Removed Duplicate CSS
- **Removed:** Duplicate `.table-container` definition
- **Reason:** Clean up and avoid conflicts

### 42. Updated Comments
- **Added:** Comprehensive documentation comments
- **Organized:** Into logical sections with headers
- **Reason:** Maintainability and clarity

---

## Key Differences from Product Group Table

1. **Header Rows:** 5 rows (Star + Year + Month + Type + Values/%) vs Product Group's 3 rows
2. **Data Columns:** 2 columns per period (Values + %) vs Product Group's 1 column per period
3. **Star Row:** No borders (unlike other header rows)
4. **Separator Position:** `top: calc(var(--sc-hdr-h) * 5)` (140px) vs Product Group's `calc(var(--pg-hdr-h) * 3)` (84px)

---

## File Structure

```
src/components/dashboard/SalesByCountryTable.css
├── CSS Variables (:root)
├── Core Table Styling
├── Star Row Styling
├── Header Styling (Rows 2-5)
├── Five Sticky Header Tiers
├── First Column Header (Countries)
├── Row Label Styling
├── First Column Body Cells (Sticky Left)
├── Rectangle Borders (2px solid black)
├── Separator Row Styling
├── Period Border Rectangles
├── Base Container & Layout
├── Header & Title Styling
├── Responsive Breakpoints
│   ├── Desktop (1200px+)
│   ├── Tablet (768px-1199px)
│   ├── Mobile Portrait (<768px)
│   └── Mobile Landscape (<1024px)
├── Print Styles
└── Table Options Styling
```

---

## Summary Statistics

- **Total Major Changes:** ~42 major modifications
- **CSS Variables:** 10 new variables added
- **Sticky Positions:** 5 header tiers + separator row + first column
- **Border Rules:** ~50+ specific border rules for period rectangles
- **Media Queries:** 4 breakpoints (Desktop, Tablet, Mobile Portrait, Mobile Landscape)
- **Responsive Coverage:** All screen sizes covered
- **File Size:** ~1,145 lines (well-organized and documented)

---

## JavaScript Changes

### Separator Row Addition
**File:** `src/components/dashboard/SalesByCountryTable.js`

**Added after `</thead>` and before first country row:**
```jsx
{/* Separator row between headers and body */}
<tr className="sc-separator-row">
  <td></td>
  {extendedColumns.map((col, index) => {
    if (col.columnType === 'delta') {
      return <td key={`separator-delta-${index}`}></td>;
    } else {
      return (
        <React.Fragment key={`separator-fragment-${index}`}>
          <td></td>
          <td></td>
        </React.Fragment>
      );
    }
  })}
</tr>
```

**Reason:** Visual separator between headers and body, matching Product Group table

---

## Testing Checklist

- [x] Sticky headers work correctly (all 5 tiers)
- [x] Star row has no borders
- [x] Separator row has 2px black borders (top and bottom)
- [x] First column (Countries) is sticky left
- [x] Period rectangles have proper 2px black borders
- [x] Font sizes match Product Group
- [x] Responsive behavior works on all screen sizes
- [x] Mobile portrait view displays correctly
- [x] Mobile landscape view displays correctly
- [x] Desktop view displays correctly
- [x] Tablet view displays correctly
- [x] All borders are 2px solid black (not 1px grey)
- [x] Separator row sticky positioning correct (below 5 headers)

---

## Notes

- All styling matches Product Group table patterns
- Adapted for 5 header rows (including star row with no borders)
- Adapted for 2 columns per period (Values + %)
- Fully responsive across all device sizes
- Sticky functionality works on desktop and mobile
- Separator row properly styled with 2px black borders

---

**Date Created:** 2025-01-27  
**Last Updated:** 2025-01-27  
**Status:** Complete ✅

