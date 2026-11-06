# Interio – AI Interior Redesign Platform

Interio is an AI-powered interior design platform that transforms ordinary rooms into beautiful, personalized spaces. Users can upload room photos, choose their preferred design style and budget, and generate AI-powered redesign concepts.

## Features

- **AI-Powered Redesign:** Generate redesigned room concepts using AI.
- **Personalized Design:** Choose room types, interior styles, and estimated budgets.
- **User Authentication:** Secure sign-up and login using Supabase.
- **My Projects:** Save, view, and manage previously generated designs.
- **Cloud Storage:** Store project images securely using Supabase Storage.
- **Download Designs:** Download redesigned room images.

## Tech Stack

| Technology | Purpose |
|---|---|
| React.js | Frontend development |
| Vite | Development and build tool |
| CSS | User interface and styling |
| Node.js | Backend runtime |
| Express.js | Backend API |
| Supabase | Authentication, database and storage |
| Hugging Face FLUX.2-klein-4B | AI image generation |

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/shah564-hub/interio-ai-interior-design.git
cd interio-ai-interior-design
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
HF_TOKEN=your_huggingface_token
```

Never commit your `.env` file or expose private API tokens.

### 4. Start the backend

```bash
node server.js
```

The backend runs at:

`http://localhost:3001`

### 5. Start the frontend

Open another terminal and run:

```bash
npm run dev
```

Open:

`http://localhost:5173`

## Project Structure

```text
interio-ai-interior-design/
├── public/
├── src/
│   ├── assets/
│   ├── App.jsx
│   ├── App.css
│   ├── Auth.jsx
│   ├── index.css
│   ├── main.jsx
│   └── supabaseClient.js
├── server.js
├── package.json
├── vite.config.js
└── README.md
```

## Future Enhancements

- More AI-powered interior design styles
- Advanced room customization
- Additional design recommendations
- Public deployment

## Author

**Shah564-hub**

GitHub: https://github.com/shah564-hub

---

*Interio – Design your everyday.*
