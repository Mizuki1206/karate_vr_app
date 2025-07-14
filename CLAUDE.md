# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a WebXR/VR hand tracking application designed for Meta Quest 3. It uses:
- **Server**: Node.js with Express.js serving HTTPS
- **Client**: Three.js for 3D graphics and WebXR API for VR functionality
- **Main Purpose**: VR hand tracking game where users match hand/head positions with targets

## Essential Commands

```bash
# Install dependencies
npm install

# Generate SSL certificates (required for WebXR)
npm run generate-cert

# Start HTTPS server
npm start

# Development mode with auto-reload
npm run dev
```

## Architecture

### Server (`server.js`)
- HTTPS Express server on port 3000
- Binds to 0.0.0.0 for local network access
- Serves static files from `/public`
- Exposes Three.js from node_modules at `/three/`

### Client Applications

#### Main Hand Tracking Game (`/public/index.html`)
- VR mode with WebXR hand tracking (25 joints per hand)
- Non-VR fallback mode with mouse controls
- Target spawning system with collision detection
- Particle effects and sound system
- Score tracking and HUD display
- Supports both primitive shapes and GLTF models as targets

#### Additional Tools
- `/public/ball.html` - Alternative hand tracking experience
- `/public/make_gltf.html` - Creates GLTF models from images
- `/public/show_gltf.html` - GLTF model viewer

### Key WebXR Implementation Details
- Uses WebXR Hand Input API for joint tracking
- Hand visualization: red (left), blue (right)
- Real-time collision detection between joints and targets
- Requires VR session with 'hand-tracking' feature

## Key Development Notes

1. **HTTPS is mandatory** - WebXR APIs require secure context
2. **Self-signed certificates** - Used for local development (see `generate-cert.js`)
3. **Local network access** - Server binds to all interfaces for Quest device testing
4. **Japanese UI** - Interface text in Japanese, code/comments in English
5. **Three.js version** - Currently using r128 (older version, be aware of API differences)

## Meta Quest 3 Testing

To test on Quest:
1. Ensure device and development machine are on same network
2. Find your IP: `ifconfig` (Mac/Linux) or `ipconfig` (Windows)
3. Access via `https://<your-ip>:3000` on Quest browser
4. Accept certificate warning
5. Enable hand tracking in Quest settings before launching

## Project Structure

```
/public/
  ├── index.html          # Main VR hand tracking game
  ├── ball.html          # Alternative VR experience
  ├── make_gltf.html     # GLTF creation tool
  ├── show_gltf.html     # GLTF viewer
  └── [audio/model files]
/certs/                  # SSL certificates (generated)
server.js               # Express HTTPS server
generate-cert.js        # Certificate generation script
```

## Important Files

- `META_QUEST_SETUP.md` - Comprehensive setup guide (Japanese)
- `certs/` - SSL certificate directory (gitignored)
- `generate-cert.js` - Certificate generation script