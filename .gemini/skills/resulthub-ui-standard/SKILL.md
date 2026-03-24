---
name: resulthub-ui-standard
description: UI/UX design standards for ResultHub. Use when creating new components, pages, or modifying existing layouts to maintain visual consistency, color palette, and spacing.
---
# ResultHub UI Standard Skill

This skill defines the visual language and component patterns for the ResultHub application.

## Core Design Tokens

### Color Palette (Tailwind)
*   **Primary Action**: `bg-indigo-600` (hover: `bg-indigo-700`)
*   **Success**: `text-green-600` / `bg-green-50`
*   **Failure/Danger**: `text-red-600` / `bg-red-50`
*   **Backgrounds**: `bg-gray-50` (Main), `bg-white` (Sidebar/Cards)
*   **Borders**: `border-gray-100` or `border-gray-200`

### Visual Style
*   **Corners**: Large rounded corners (`rounded-lg`, `rounded-xl`, `rounded-3xl`)
*   **Shadows**: Subtle, soft shadows (`shadow-xl shadow-gray-200/50`)
*   **Typography**: Clean sans-serif font (`font-sans`). Headings use `font-bold` or `font-extrabold`.

## Component Patterns

### 1. Sidebar Layout
*   Width: `w-72`
*   Style: White background, right border, flex column.
*   Navigation Items: Use `NavItem` pattern with `transition-all duration-200`. Active state uses `bg-indigo-600 text-white shadow-lg`.

### 2. Main Content Area
*   Max Width: `max-w-5xl` (or `max-w-4xl`)
*   Container: White card with `rounded-3xl` and `p-10`.
*   Header: Page title (`text-4xl font-bold`) and a descriptive subtitle (`text-gray-500 text-lg`).

### 3. Forms & Buttons
*   **Buttons**: Bold text, `py-3 px-4`, `rounded-lg`. Primary button is indigo.
*   **Inputs**: `border-gray-300 rounded-lg`, `focus:ring-indigo-500`.
*   **Loading States**: Use `RefreshCcw` with `animate-spin` and `animate-pulse` for progress bars.

### 4. Tables & Data
*   Style: `border-collapse`, `text-left`.
*   Rows: `border-b border-gray-50`, `hover:bg-gray-50`.
*   Actions: Inline buttons (e.g., `Trash2`) should be subtle/gray and become fully visible on row hover.

## Icons (Lucide-React)
*   Always use `lucide-react` for iconography.
*   Size: Standard `size={20}` for nav/table actions, `size={24}` for titles.

## Guiding Principles
*   **Simplicity**: Avoid cluttered interfaces. Use generous padding (`p-10`, `p-12`).
*   **Consistency**: Always derive project/module/device tags as uppercase pills.
*   **Interactivity**: Every action button should have a hover state and a distinct "disabled" state (`disabled:bg-gray-400`).
