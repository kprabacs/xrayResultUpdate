---
name: resulthub-ui-standard
description: UI/UX design standards for ResultHub. Use when creating new components, pages, or modifying existing layouts to maintain visual consistency, color palette, and spacing.
---
# ResultHub UI Standard Skill

This skill defines the visual language and component patterns for the ResultHub application.

## Core Design Tokens

### Color Palette (Tailwind)
*   **Primary Action**: `bg-indigo-600` (hover: `bg-indigo-700`)
*   **Secondary Action**: `bg-gray-200` / `bg-gray-500`
*   **Success**: `text-green-800` / `bg-green-50` / `bg-green-100`
*   **Failure/Danger**: `text-red-800` / `bg-red-50` / `bg-red-100`
*   **Warning/Issue**: `text-amber-800` / `bg-amber-50`
*   **Backgrounds**: `bg-gray-50` (Main), `bg-white` (Sidebar/Cards)
*   **Borders**: `border-gray-100` or `border-gray-200`

### Visual Style
*   **Corners**: Rounded corners ranging from `rounded-lg` (buttons/inputs) to `rounded-xl`/`rounded-3xl` (cards/containers).
*   **Shadows**: Subtle, soft shadows (`shadow-xl shadow-gray-200/50`).
*   **Typography**: Clean sans-serif font (`font-sans`). Headings use `font-bold` or `font-extrabold`.

## Component Patterns

### 1. Multi-Step Workflow Layout
*   **Structure**: Sequential steps (e.g., Step 1 to Step 5) to guide users through complex data ingestion.
*   **Sections**: Use card-based layouts with `p-6` or `p-10` padding to group related fields (e.g., "Report Metadata", "Xray Details").

### 2. Form Patterns
*   **Workflow Selection**: Use buttons for primary type selection (Cucumber vs. Xray) and `select` dropdowns for specific workflows.
*   **Inputs**: `border-gray-300 rounded-lg`, `focus:ring-indigo-500`.
*   **Datalists**: Use `datalist` for providing suggestions in text inputs (e.g., Module options).
*   **Buttons**: Bold text, `py-3 px-4`, `rounded-lg`. Primary button is indigo. "Evaluate" actions should use secondary gray styles.

### 3. Loading & Feedback
*   **Progress Bars**: Use horizontal bars with `bg-indigo-600` and `animate-pulse` during long-running async operations.
*   **Notifications**: Color-coded blocks (green/red/amber) with icons to indicate success, error, or issues found.

### 4. Tables & Data
*   **Style**: `border-collapse`, `text-left`.
*   **Rows**: `border-b border-gray-50`, `hover:bg-gray-50`.
*   **Excel Integration**: Visual cues or buttons for triggering `.xlsx` downloads as part of the workflow.

## Icons (Lucide-React)
*   Always use `lucide-react` for iconography.
*   **Common Icons**:
    - `UploadCloud`: Primary file drop area.
    - `File`: File metadata/selection.
    - `CheckCircle`: Success states.
    - `AlertCircle`: Errors or issues found.
    - `RefreshCcw`: Loading or retry actions.
    - `Trash2`: Deletion/Clear actions.

## Guiding Principles
*   **Simplicity**: Avoid cluttered interfaces. Use generous spacing (`space-y-8`, `gap-6`).
*   **Progressive Disclosure**: Only show metadata or Xray detail sections when the relevant workflow/action is selected.
*   **Interactivity**: Ensure every action button has a hover state and a distinct "disabled" state (`disabled:bg-gray-400`).
