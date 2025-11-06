# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Construct 3 plugin that enables loading and displaying 3D models (glTF/GLB format) with animation support. The plugin is written in JavaScript and provides advanced 3D capabilities beyond Construct 3's built-in 3D shape object.

## Common Development Commands

### Building the Plugin
```bash
# Build using npm (recommended - uses minified release)
npm run build

# Create a minified production build manually
./release-minified.sh 2-82-0

# Standard release (non-minified)
./release.sh 2-82-0

# Windows PowerShell build
./release.ps1 2-82-0
```

### Version Management
```bash
# Update version across all files (package.json, addon.json, plugin.js)
npm run version:bump 2.83.0
```

### Development Workflow
1. Edit source files in `src/` directory
2. Build locally using `npm run build` for testing
3. The `.c3addon` file will be created in `dist/`
4. Import the addon into Construct 3 for testing
5. Use example projects in `examples/` for testing specific features

### Release Workflow (GitHub Actions)
**Note: Releases are now automated via GitHub Actions when you push a version tag.**

1. **Update version:**
   ```bash
   npm run version:bump 2.83.0
   ```

2. **Commit and tag:**
   ```bash
   git add -A
   git commit -m "chore: bump version to 2.83.0"
   git tag v2.83.0
   git push && git push origin v2.83.0
   ```

3. **Automated Process:**
   - GitHub Actions builds the minified addon
   - Creates a GitHub Release with the tag
   - Uploads the .c3addon file as a release asset
   - Available at: https://github.com/MikalDev/3dobject/releases

### Important Notes
- The `dist/` directory is now in `.gitignore` - built files are no longer committed
- Version numbers must be synchronized across `package.json`, `src/addon.json`, and `src/plugin.js`
- Use the `npm run version:bump` script to ensure consistency
- GitHub Actions validates version consistency on every build

## High-Level Architecture

### Plugin Structure
The plugin follows Construct 3's addon architecture with separate editor and runtime components:

- **Editor Side** (`src/plugin.js`, `src/instance.js`): Handles property definitions and editor UI
- **Runtime Side** (`src/c3runtime/`): Executes during game runtime
  - `plugin.js`: Runtime initialization and rendering
  - `instance.js`: Core 3D object functionality (1000+ lines)
  - `gltfModel.js`: glTF parsing and model management
  - `gltfWorker.js`: Web worker for animation processing
  - `DRACOLoader.js`: Handles Draco-compressed geometry

### Key Architectural Decisions

1. **Web Worker for Animations**: Animation calculations are offloaded to a web worker (`gltfWorker.js`) to prevent main thread blocking. The worker handles skeletal animation blending and interpolation.

2. **Material System**: Dynamic material properties are managed through a flexible system that allows runtime changes to textures, colors, and other material parameters.

3. **Integration with C3 Systems**: The plugin integrates with Construct 3's:
   - Lighting system (supports dynamic lights)
   - Effect compositor
   - Collision system (bounding box based)
   - Layout/layer rendering pipeline

4. **Resource Management**: 
   - Textures are cached and reused when possible
   - GPU buffers are managed efficiently
   - Unused resources are properly disposed

### Important Implementation Details

- **Animation Blending**: Located in `src/c3runtime/instance.js:1200+`, supports blending between multiple animations
- **Draco Support**: Recently added in `src/c3runtime/DRACOLoader.js`, requires special handling during model loading
- **Node Transforms**: Recently refactored to handle skinned vs static geometry differently (see recent commits)
- **WebGL Rendering**: Custom shader integration in `src/c3runtime/plugin.js`

### ACEs (Actions, Conditions, Expressions)
Defined in `src/aces.json` and implemented in `src/c3runtime/actions.js`, `conditions.js`, and `expressions.js`. When adding new functionality:
1. Add definition to `aces.json`
2. Implement in appropriate runtime file
3. Update documentation if adding significant features

## Code Style
- No semicolons (Prettier configured)
- 120 character line width
- Consistent with Construct 3 plugin conventions

## Testing
No formal test framework. Testing is done through:
- Example projects in `examples/` directory
- Manual testing in Construct 3 editor
- Key test scenarios: animations, materials, lighting, performance with multiple objects

## Current Development Focus
Based on recent commits:
- Draco compression support
- Performance optimizations for node transforms
- Caching improvements for better runtime performance