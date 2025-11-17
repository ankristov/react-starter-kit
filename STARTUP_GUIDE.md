# 🚀 Forcefield App - Startup Guide

Complete guide on how to start your Forcefield application with best practices and all available options.

---

## Quick Start (Fastest Option)

```bash
# Navigate to project directory
cd /path/to/forcefield

# Run the startup script
./scripts/dev_restart.sh

# App opens at: http://localhost:5174
```

**Time to ready:** ~5-10 seconds ⚡

---

## Startup Options & When to Use Them

### 1️⃣ **Frontend Only** (Most Common)
Best for: UI development, testing, general work

```bash
./scripts/dev_restart.sh
```

**What it does:**
- Cleans up any old processes
- Starts Vite dev server on port 5174
- Hot Module Replacement (HMR) enabled
- Opens browser automatically

**Features:**
- Instant feedback on code changes
- No build step needed
- Perfect for rapid development

---

### 2️⃣ **Frontend + Video Smoothing Server**
Best for: Testing video smoothing/interpolation feature

```bash
./scripts/dev_restart.sh --with-interpolate
```

**What it does:**
- Starts Vite dev server (port 5174)
- Starts Express/FFmpeg server (port 3002)
- Checks FFmpeg installation
- Installs server dependencies if needed

**Ports used:**
- **5174** - Vite dev server (UI)
- **3002** - Video interpolation server (backend)

**Requirements:**
- FFmpeg must be installed:
  ```bash
  # macOS
  brew install ffmpeg
  
  # Ubuntu/Debian
  sudo apt-get install ffmpeg
  ```

**Time to ready:** ~10-15 seconds

---

### 3️⃣ **Manual Startup (Advanced)**
Best for: Debugging, custom configurations

```bash
# Terminal 1 - Frontend only
npm run dev

# Terminal 2 - Video server (optional, in separate terminal)
npm run start-interpolate-server
# or with auto-restart on file changes:
npm run dev-interpolate-server
```

**Advantages:**
- See logs separately
- Kill/restart services independently
- Debug each service in isolation

---

### 4️⃣ **Production Preview**
Best for: Testing production build locally

```bash
npm run build        # Create optimized build
npm run preview      # Serve production build
```

App opens at: `http://localhost:4173`

---

## Shutdown & Cleanup

### Clean Shutdown (Recommended)

```bash
./scripts/shutdown.sh
```

**What it does:**
- Gracefully stops Vite dev server
- Stops video interpolation server
- Kills any FFmpeg processes
- Clears lingering processes on dev ports
- Shows count of services stopped

### Manual Shutdown

```bash
# Kill all Node processes
killall node

# Or use Ctrl+C in each terminal
```

---

## Best Practices

### ✅ DO:
1. **Use `./scripts/dev_restart.sh`** - Most efficient for 99% of use cases
2. **Kill old processes before restarting** - Script does this automatically
3. **Check FFmpeg is installed** - Required only for video smoothing
4. **Use `--with-interpolate` only when needed** - Saves system resources
5. **Monitor logs** - Helps identify issues quickly

### ❌ DON'T:
1. **Don't run multiple instances of the same port** - Use shutdown script first
2. **Don't kill processes while video is processing** - Wait for completion
3. **Don't skip FFmpeg installation** - Video smoothing will fail gracefully
4. **Don't mix manual and script startup** - Causes port conflicts
5. **Don't forget to rebuild after major changes** - Sometimes needed with TypeScript

---

## Troubleshooting

### Port Already in Use

**Problem:** Error: "Port 5174 is already in use"

**Solution:**
```bash
# Use the shutdown script
./scripts/shutdown.sh

# Or manually kill process on that port
lsof -ti:5174 | xargs kill -9
```

### Changes Not Appearing

**Problem:** Code changes not showing up in browser

**Solution:**
```bash
# Hard refresh browser (Cmd+Shift+R or Ctrl+Shift+R)

# Or restart with script
./scripts/dev_restart.sh
```

### Video Smoothing Not Working

**Problem:** "Interpolation server is not available"

**Causes & Solutions:**
1. **FFmpeg not installed:**
   ```bash
   brew install ffmpeg  # macOS
   ```

2. **Didn't start with `--with-interpolate`:**
   ```bash
   ./scripts/dev_restart.sh --with-interpolate
   ```

3. **Port 3002 in use:**
   ```bash
   ./scripts/shutdown.sh
   ./scripts/dev_restart.sh --with-interpolate
   ```

### High CPU Usage

**Problem:** Dev server or FFmpeg consuming too much CPU

**Solution:**
- For video processing: This is normal while smoothing videos
- Reduces automatically after processing completes
- Increase timeout if processing takes too long

### TypeScript Errors in IDE

**Problem:** IDE shows errors but app builds fine

**Solution:**
```bash
npm install  # Ensure dependencies are installed
npm run typecheck  # Run TypeScript check
```

---

## Performance Tips

### ⚡ Fastest Startup
```bash
./scripts/dev_restart.sh
```
**~5 seconds** - Recommended for most work

### 🎥 For Video Work
```bash
./scripts/dev_restart.sh --with-interpolate
```
**~10-15 seconds** - Includes backend services

### 📦 For Production Testing
```bash
npm run build && npm run preview
```
**~30 seconds** - Full build + preview

---

## Development Workflow

### Typical Day Development Flow

```bash
# 1. Morning - Start fresh
./scripts/dev_restart.sh

# 2. Work normally - Hot module replacement handles updates

# 3. If UI issues appear - Hard refresh browser (Cmd+Shift+R)

# 4. If deep TypeScript changes - Restart script
./scripts/dev_restart.sh

# 5. Evening - Clean shutdown
./scripts/shutdown.sh
```

### Multi-Terminal Setup (Advanced)

```bash
# Terminal 1 - Frontend dev
./scripts/dev_restart.sh

# Terminal 2 - Video processing (if needed)
cd server && npm run dev
# or
npm run dev-interpolate-server

# Terminal 3 - Monitoring
watch -n 1 'ps aux | grep -E "(node|vite|ffmpeg)" | grep -v grep'
```

---

## Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `dev_restart.sh` | Start dev environment | `./scripts/dev_restart.sh [--with-interpolate]` |
| `shutdown.sh` | Stop all services | `./scripts/shutdown.sh [--verbose]` |
| `npm run dev` | Start Vite dev server | Direct npm command |
| `npm run build` | Production build | Direct npm command |
| `npm run preview` | Preview production build | Direct npm command |

---

## Environment Variables

```bash
# No config needed for local development
# All defaults work out of the box

# For production, see .env.example
```

---

## Common Commands Cheatsheet

```bash
# Start development
./scripts/dev_restart.sh

# Start with video smoothing
./scripts/dev_restart.sh --with-interpolate

# Stop everything
./scripts/shutdown.sh

# Check running services (verbose)
./scripts/shutdown.sh --verbose

# Install dependencies
npm install

# Build for production
npm run build

# Preview production build
npm run preview

# Check TypeScript errors
npm run typecheck

# Lint code
npm run lint

# Hard restart (manual)
killall node; npm run dev
```

---

## Ports Reference

| Service | Port | Protocol | Status |
|---------|------|----------|--------|
| Vite Dev Server | 5174 | HTTP | Always running |
| Video Interpolation | 3002 | HTTP | Optional (with `--with-interpolate`) |
| Production Preview | 4173 | HTTP | Only when using `npm run preview` |

---

## FAQ

**Q: How fast can I start developing?**
A: ~5 seconds with `./scripts/dev_restart.sh` ⚡

**Q: Do I need to install FFmpeg?**
A: Only if you want video smoothing feature. Recommended: `brew install ffmpeg`

**Q: Can I work on multiple features simultaneously?**
A: Yes! Use multiple terminals with `npm run dev` in separate windows

**Q: Does HMR (Hot Module Replacement) work?**
A: Yes! Changes appear instantly. If not, hard refresh browser (Cmd+Shift+R)

**Q: How do I clean up if something breaks?**
A: Run `./scripts/shutdown.sh` then `./scripts/dev_restart.sh`

**Q: Can I use this in Docker?**
A: Yes! See `Dockerfile` and `docker run` commands in main README

**Q: What's the production build process?**
A: `npm run build` creates optimized files in `dist/` folder

---

## Next Steps

1. **Start the app:**
   ```bash
   ./scripts/dev_restart.sh
   ```

2. **Make changes** and see them instantly with HMR

3. **Test video smoothing** (optional):
   ```bash
   ./scripts/dev_restart.sh --with-interpolate
   ```

4. **Build for production:**
   ```bash
   npm run build && npm run preview
   ```

5. **Deploy** when ready (see main README for deployment options)

---

Happy coding! 🎬✨
