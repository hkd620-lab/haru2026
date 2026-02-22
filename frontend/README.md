# HARU2026 - Local Development Guide

## Prerequisites

- Node.js (v18 or higher)
- npm or pnpm

## Getting Started

1.  **Install dependencies**:

    ```bash
    npm install
    # or
    pnpm install
    ```

2.  **Environment Setup**:
    Create a `.env` file in the root directory and add your Supabase and Gemini keys if necessary.
    The project uses `utils/supabase/info.tsx` for some keys, but you may need to configure others depending on your backend setup.

3.  **Run the development server**:

    ```bash
    npm run dev
    # or
    pnpm dev
    ```

4.  **Build for production**:

    ```bash
    npm run build
    # or
    pnpm build
    ```

## Project Structure

- `src/app`: Application components and pages
- `src/styles`: CSS and Tailwind configuration
- `supabase/functions`: Backend Edge Functions code

## Notes

- The entry point is `src/main.tsx` which mounts to `index.html`.
- Tailwind CSS v4 is configured via `src/styles/index.css`.
