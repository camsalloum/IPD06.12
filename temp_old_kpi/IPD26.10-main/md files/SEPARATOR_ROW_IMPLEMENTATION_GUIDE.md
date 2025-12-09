# Separator Row Implementation Guide

## Overview

A **separator row** is a special table row that appears between the header section and the body section of a table. It serves as a visual divider and should appear as a **continuous horizontal rectangle** with no internal vertical borders between columns.

## Visual Design Goal

The separator row should appear as:
- A **single, unbroken horizontal band** spanning the entire width of the table
- **Top and bottom borders** across all cells (creating the "double line" effect)
- **Left border** only on the first cell (outer edge)
- **Right border** only on the last cell (outer edge)
- **NO internal vertical borders** between any columns

```
┌─────────────────────────────────────────────────────────┐
│                                                         │  ← Separator Row
│                                                         │  (continuous rectangle)
└─────────────────────────────────────────────────────────┘
```

## CSS Implementation Strategy

### Key Principles

1. **Exclude separator rows from general body rules**: Separator rows need their own border rules, so they must be excluded from all general body row border rules.

2. **Override all period border rules**: Period border rules (which create rectangles for each period) should NOT apply to separator rows.

3. **Use high specificity**: Separator row rules must have higher specificity than period border rules to ensure they override correctly.

4. **Place rules in correct order**: Separator row override rules must come AFTER all period border rules in the CSS file.

## Implementation Steps

### Step 1: Basic Separator Row Styling

```css
/* SEPARATOR ROW borders - top and bottom black borders */
/* Remove all internal vertical borders - separator row should be one continuous rectangle */
.sales-by-customer-table .sbc-separator-row td {
  border-top: 2px solid black !important;
  border-bottom: 2px solid black !important;
  border-left: none !important; /* Remove all internal left borders */
  border-right: none !important; /* Remove all internal right borders */
}
```

### Step 2: First Cell - Left Border Only (Outer Edge)

```css
/* Separator row first cell - Left border only (outer edge of rectangle) */
/* This must override all other rules including the column-specific overrides */
.sales-by-customer-table tbody tr.sbc-separator-row td:first-child {
  border-left: 2px solid black !important;
  border-right: none !important;
  border-top: 2px solid black !important;
  border-bottom: 2px solid black !important;
}
```

### Step 3: Last Cell - Right Border Only (Outer Edge)

```css
/* Separator row last cell - MUST have right border (outer edge) - place AFTER all overrides */
.sales-by-customer-table tbody tr.sbc-separator-row td:last-child {
  border-right: 2px solid black !important;
  border-left: none !important;
  border-top: 2px solid black !important;
  border-bottom: 2px solid black !important;
}
```

### Step 4: Exclude Separator Rows from General Body Column Rules

**First Column Rule:**
```css
/* Body first column (Customer Names) - Exclude separator rows */
.sales-by-customer-table tbody tr:not(.sbc-separator-row) td:nth-child(1) {
  border-left: 2px solid black !important;
  border-right: 2px solid black !important;
}
```

**Second Column Rule:**
```css
/* Body second column (Sales Rep Names) - Exclude separator rows */
.sales-by-customer-table tbody tr:not(.sbc-separator-row) td:nth-child(2):not(.metric-cell) {
  border-right: 2px solid black !important;
}
```

### Step 5: Exclude Separator Rows from Period Border Rules

**Critical**: All body row period border rules must exclude separator rows:

```css
/* Period 1 (columns 3-4): Only right on col 4 - left comes from Sales Rep column's right border */
/* Exclude summary rows AND separator rows - they have their own border rules */
.sales-by-customer-table tbody tr:not(:has(.total-sales-label)):not(:has(.number-all-label)):not(.sbc-separator-row) td:nth-child(4):not(.thick-border-bottom) {
  border-right: 2px solid black !important;
}

/* Period 2 (columns 6-7): Left on col 6, right on col 7 */
.sales-by-customer-table tbody tr:not(:has(.total-sales-label)):not(:has(.number-all-label)):not(.sbc-separator-row) td:nth-child(6) {
  border-left: 2px solid black !important;
}
.sales-by-customer-table tbody tr:not(:has(.total-sales-label)):not(:has(.number-all-label)):not(.sbc-separator-row) td:nth-child(7) {
  border-right: 2px solid black !important;
}

/* Repeat for all periods (Periods 3-10)... */
```

### Step 6: Comprehensive Override Rules

Add comprehensive override rules AFTER all period border rules to ensure no vertical borders appear:

```css
/* Force remove all internal vertical borders from separator row (all cells except first and last) */
/* This must override ALL period border rules - use high specificity */
.sales-by-customer-table tbody tr.sbc-separator-row td:not(:first-child):not(:last-child) {
  border-left: none !important;
  border-right: none !important;
  border-top: 2px solid black !important;
  border-bottom: 2px solid black !important;
}

/* Additional override for all separator row cells to ensure no vertical borders */
/* Target specific column positions that might have period borders - use high specificity */
/* EXCLUDE last child - it needs right border (outer edge) */
.sales-by-customer-table tbody tr.sbc-separator-row td:nth-child(3):not(:last-child),
.sales-by-customer-table tbody tr.sbc-separator-row td:nth-child(4):not(:last-child),
.sales-by-customer-table tbody tr.sbc-separator-row td:nth-child(5):not(:last-child),
/* ... continue for all column positions up to the maximum expected ... */
.sales-by-customer-table tbody tr.sbc-separator-row td:nth-child(31):not(:last-child) {
  border-left: none !important;
  border-right: none !important;
  border-top: 2px solid black !important;
  border-bottom: 2px solid black !important;
}
```

### Step 7: Sticky Positioning (If Needed)

If the separator row needs to be sticky (stays visible when scrolling):

```css
/* SEPARATOR ROW between headers and body - FULLY STICKY (vertical scrolling) */
.sales-by-customer-table .sbc-separator-row {
  height: 8px !important;
  line-height: 8px !important;
  padding: 0 !important;
}

.sales-by-customer-table .sbc-separator-row td {
  position: sticky !important;
  top: calc(var(--sbc-hdr-h) * 4) !important; /* Position below 4 header rows */
  z-index: var(--z-hdr1) !important;
  height: 8px !important;
  padding: 0 !important;
  background-color: white !important;
  background-clip: padding-box !important;
}

/* First cell of separator row - STICKY TOP + LEFT (corner) */
.sales-by-customer-table .sbc-separator-row td:first-child {
  position: sticky !important;
  left: 0 !important;
  top: calc(var(--sbc-hdr-h) * 4) !important;
  z-index: var(--z-corner) !important;
  background-color: white !important;
  border-top: 2px solid black !important;
  border-bottom: 2px solid black !important;
  border-left: 2px solid black !important;
  border-right: none !important;
  height: 8px !important;
  padding: 0 !important;
  margin: 0 !important;
  vertical-align: top !important;
}
```

## Common Issues and Solutions

### Issue 1: Vertical Borders Still Appearing

**Problem**: Period border rules are still applying to separator rows.

**Solution**: 
- Add `:not(.sbc-separator-row)` to ALL body row period border rules
- Ensure separator row override rules come AFTER period border rules
- Use higher specificity (`tbody tr.sbc-separator-row` instead of `.sbc-separator-row`)

### Issue 2: Last Cell Missing Right Border

**Problem**: Column-specific override rules are removing the right border from the last cell.

**Solution**:
- Add `:not(:last-child)` to all column-specific override rules
- Place the last cell rule AFTER all override rules
- Ensure the last cell rule explicitly sets `border-right: 2px solid black !important;`

### Issue 3: First Cell Missing Left Border

**Problem**: General body column rules are overriding the separator row first cell rule.

**Solution**:
- Exclude separator rows from general body column rules using `:not(.sbc-separator-row)`
- Use higher specificity for separator row first cell rule (`tbody tr.sbc-separator-row td:first-child`)

## Complete CSS Structure

Here's the recommended order for separator row CSS rules:

1. **General separator row rule** (removes all vertical borders)
2. **First column exclusion** (exclude separator rows from general first column rules)
3. **Second column exclusion** (exclude separator rows from general second column rules)
4. **First cell rule** (left border only)
5. **Last cell rule** (right border only) - **Place this AFTER period border rules**
6. **Period border rules** (for body rows, excluding separator rows)
7. **Separator row override rules** (comprehensive overrides for all columns)
8. **Last cell rule** (repeated AFTER overrides to ensure right border)

## Testing Checklist

- [ ] Separator row appears as continuous horizontal rectangle
- [ ] No vertical borders between columns in separator row
- [ ] Left border present on first cell
- [ ] Right border present on last cell
- [ ] Top border present across all cells
- [ ] Bottom border present across all cells
- [ ] Separator row is sticky (if required)
- [ ] First cell is sticky both horizontally and vertically (if required)
- [ ] No conflicts with period border rules
- [ ] Works correctly with varying number of periods

## Example: Complete Separator Row CSS

```css
/* ========================================
   SEPARATOR ROW - Continuous Rectangle
   Separator row is one continuous horizontal rectangle with:
   - Top border (all cells)
   - Bottom border (all cells)
   - Left border (first cell only - outer edge)
   - Right border (last cell only - outer edge)
   - NO internal vertical borders between columns
   ======================================== */

/* General separator row rule - remove all vertical borders */
.sales-by-customer-table .sbc-separator-row td {
  border-top: 2px solid black !important;
  border-bottom: 2px solid black !important;
  border-left: none !important;
  border-right: none !important;
}

/* First cell - left border only (outer edge) */
.sales-by-customer-table tbody tr.sbc-separator-row td:first-child {
  border-left: 2px solid black !important;
  border-right: none !important;
  border-top: 2px solid black !important;
  border-bottom: 2px solid black !important;
}

/* Comprehensive override for all internal cells */
.sales-by-customer-table tbody tr.sbc-separator-row td:not(:first-child):not(:last-child) {
  border-left: none !important;
  border-right: none !important;
  border-top: 2px solid black !important;
  border-bottom: 2px solid black !important;
}

/* Column-specific overrides (exclude last child) */
.sales-by-customer-table tbody tr.sbc-separator-row td:nth-child(3):not(:last-child),
.sales-by-customer-table tbody tr.sbc-separator-row td:nth-child(4):not(:last-child),
/* ... all column positions ... */
.sales-by-customer-table tbody tr.sbc-separator-row td:nth-child(31):not(:last-child) {
  border-left: none !important;
  border-right: none !important;
  border-top: 2px solid black !important;
  border-bottom: 2px solid black !important;
}

/* Last cell - right border only (outer edge) - MUST come after all overrides */
.sales-by-customer-table tbody tr.sbc-separator-row td:last-child {
  border-right: 2px solid black !important;
  border-left: none !important;
  border-top: 2px solid black !important;
  border-bottom: 2px solid black !important;
}
```

## Notes

- The separator row class name used in this example is `.sbc-separator-row` - adjust for your specific table class name
- The table class name used is `.sales-by-customer-table` - adjust for your specific table class name
- All border rules use `!important` to ensure they override other rules
- The separator row should be placed in the `<tbody>` section, typically as the first row after headers
- If the table has a variable number of columns, you may need to adjust the `nth-child` selectors accordingly







