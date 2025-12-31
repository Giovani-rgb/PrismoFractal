# PRISMO - Music Composition Tool

## Overview
PRISMO is a creative tool for managing song lyrics and musical structure using game-like concepts (chunks, world, DNA). Built with Angular (frontend) and Spring Boot (backend).

## Project Structure
```
frontend/prismo-chunks/        # Angular standalone app
├── src/app/
│   ├── pages/               # Intro, Dashboard, World, Melody DNA, Songs
│   ├── services/            # SessionService, ProjectService
│   ├── dashboard/           # Main dashboard component
│   └── styles.scss          # Global styles
src/main/java/com/prismo/    # Spring Boot backend
├── controller/
│   ├── MusicController.java
│   └── SessionController.java (new)
└── domain/                   # Music, Stanza, MusicPattern
```

## What Was Built (MVP)

### Frontend (Angular)
✅ **SessionService** - localStorage-based session management
✅ **ProjectService** - Mock project data with World and Melody DNA
✅ **Dashboard Component** - Central hub showing:
   - Project name and details
   - World data (BPM, time signature, structure)
   - Melody DNA (ideology, rhythm, harmony, key)
   - Visual arrangement of phrases/stanzas
✅ **Session Flow** - Auto-navigate from intro to dashboard
✅ **Responsive Design** - Dark palette, game-like aesthetic
✅ **Global Styles** - Modern dark theme with gradient accents

### Backend (Java/Spring Boot)
✅ **SessionController** - Mock endpoints:
   - POST /session/start
   - GET /session/current
   - POST /session/end
✅ **CORS Enabled** - Ready for frontend integration

## How to Use

### Frontend Access
The Angular app runs on **port 5000** (visible in Replit preview):
- `/` - Intro screen
- Press ENTER → Dashboard
- Dashboard navigation links to World, Melody DNA, Songs, Settings

### Session Management
Sessions are stored in localStorage automatically:
- Creates session on first app load
- Auto-redirects to dashboard if session exists
- Session data includes: id, projectName, createdAt

### Next Steps
1. **Backend Integration** - Connect frontend to actual Java endpoints
2. **Data Persistence** - Add database for projects
3. **Editing Features** - Implement phrase/world editing
4. **More UI Components** - World editor, Melody DNA editor, Song composer

## Technology Stack
- **Frontend**: Angular 21, TypeScript, SCSS, RxJS
- **Backend**: Java 17, Spring Boot 3.2
- **Storage**: localStorage (frontend), potential database (backend)
- **Styling**: SCSS with dark theme

## Running the Project
```bash
# Frontend (auto-runs on port 5000)
cd frontend/prismo-chunks && npm run serve

# Backend (Java)
mvn clean spring-boot:run

# Backend endpoints ready at http://localhost:8080/session/*
```

## Design Philosophy
- 🎮 Game-like editor interface
- 🧬 Modular chunks concept
- 🎵 Music-focused terminology
- 📱 Responsive across devices
- 🌙 Dark creative environment
