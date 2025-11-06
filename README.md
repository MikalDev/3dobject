# 3dobject
3dObject plugin for Construct 3

## Download

Download the latest release of the 3DObject addon from the [Releases page](https://github.com/MikalDev/3dobject/releases).

For details on usage and examples, see:
https://kindeyegames.itch.io/c3-3dobject-alpha

## Development

If you fork this project and expect to distribute the new version, create a new addon id, so that it won't conflict with the original addon.
See: https://www.construct.net/en/make-games/manuals/addon-sdk/guide/configuring-plugins for more info.

### Building from Source

To create a build locally:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the addon:**
   ```bash
   npm run build
   # or manually:
   ./release-minified.sh 2-82-0
   ```

### Creating a New Release

Releases are automatically created when you push a version tag to GitHub:

1. **Update version number** (updates all version files):
   ```bash
   npm run version:bump 2.83.0
   ```

2. **Commit the version change:**
   ```bash
   git add -A
   git commit -m "chore: bump version to 2.83.0"
   ```

3. **Create and push a tag:**
   ```bash
   git tag v2.83.0
   git push && git push origin v2.83.0
   ```

4. **GitHub Actions will automatically:**
   - Build the minified addon
   - Create a new GitHub Release
   - Upload the .c3addon file as a release asset

The release will be available at: https://github.com/MikalDev/3dobject/releases

PRs are welcome, especially examples, docs, notes on usage, etc. please add under docs

Copyright 2024 Kind Eye Games, LLC

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
