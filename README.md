# 🦸 Community Hero – Hyperlocal Problem Solver

> An AI-powered civic engagement platform that enables citizens to report, verify, track, and resolve local infrastructure issues through intelligent automation and transparent collaboration.

## 📌 Overview

Community Hero is a full-stack web application built to improve the way communities report and manage civic issues such as potholes, garbage accumulation, water leakages, damaged streetlights, and other public infrastructure problems.

The platform combines **Google Gemini AI** with an intuitive citizen portal and an authority dashboard to streamline issue reporting, classification, verification, and resolution.

---

## ✨ Features

### 👥 Citizen Portal

* 📸 AI-powered image-based issue reporting
* 📍 GPS/location-based issue submission
* 🗺️ Interactive SVG city map with issue visualization
* ✅ Community verification of reported issues
* 🏅 Gamification with badges and community engagement
* 📊 Real-time issue tracking

### 🏛️ Authority Dashboard

* 📈 Executive analytics dashboard
* 🚨 Severity-based issue prioritization
* 🔧 Repair dispatch and status management
* 📊 Department-wise workload visualization
* 📉 Resolution metrics and performance tracking

### 🤖 AI-Powered Intelligence

* Image understanding using **Google Gemini 2.5 Flash**
* Automatic issue categorization
* Severity assessment
* Department recommendation
* Structured JSON generation for backend processing

---

## 🏗️ Architecture

```text
Citizen
    │
    ▼
React + Vite Frontend
    │
    ▼
Express Backend
    │
    ▼
Gemini 2.5 Flash
(Image Analysis)
    │
    ▼
Structured Issue Data
    │
    ▼
Authority Dashboard + Interactive SVG Map
```

---

## 🛠️ Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS
* Motion
* Recharts

### Backend

* Node.js
* Express.js

### AI

* Google AI Studio
* Google Gemini 2.5 Flash
* Google GenAI SDK

### Other

* SVG Interactive Mapping
* TypeScript
* npm

---

## 📂 Project Structure

```text
Community-Hero/
├── assets/                     # Static assets
├── src/
│   ├── components/             # Reusable React UI components
│   ├── server/                 # Backend service modules
│   ├── utils/                  # Utility/helper functions
│   ├── App.tsx                 # Main application component
│   ├── main.tsx                # React application entry point
│   ├── index.css               # Global styles
│   ├── mockData.ts             # Seed/mock issue data
│   └── types.ts                # TypeScript interfaces
│
├── .env.example                # Environment variable template
├── .gitignore
├── index.html                  # Vite HTML entry
├── metadata.json               # Application metadata
├── package.json                # Project dependencies and scripts
├── package-lock.json
├── README.md
├── server.ts                   # Express backend entry point
├── tsconfig.json               # TypeScript configuration
└── vite.config.ts              # Vite configuration
```

---

## 🚀 Getting Started

### Clone the repository

```bash
git clone https://github.com/yourusername/community-hero.git
cd community-hero
```

### Install dependencies

```bash
npm install
```

### Configure environment variables

Create a `.env` file:

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

### Run the application

```bash
npm run dev
```

---

## 🤖 AI Workflow

1. User uploads an image of a civic issue.
2. The backend securely sends the image to **Google Gemini 2.5 Flash**.
3. Gemini analyzes the image and returns:

   * Issue category
   * Severity level
   * Recommended department
   * Safety assessment
   * Structured description
4. The backend stores the structured data.
5. Citizens and authorities can monitor and manage the issue through their respective dashboards.

---

## 🎯 Problem Statement

**Community Hero – Hyperlocal Problem Solver**

Communities often face challenges in reporting and tracking local civic issues due to fragmented systems and limited transparency.

Community Hero addresses this challenge by providing an AI-powered platform that enables efficient issue reporting, verification, tracking, and resolution while encouraging transparency, accountability, and community participation.

---

## 🌟 Future Enhancements

* Firebase Authentication
* Firestore database integration
* Google Maps integration
* Real-time notifications
* Duplicate issue detection
* Predictive analytics
* AI-powered civic assistant
* Progressive Web App (PWA)
* Mobile application

---

## 👨‍💻 Built With

* Google AI Studio
* Google Gemini 2.5 Flash
* React
* Vite
* Express.js
* Tailwind CSS
* TypeScript
* Recharts

---

## 📜 License

This project was developed for a hackathon and is intended for educational and demonstration purposes.

---
