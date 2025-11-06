#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Get the new version from command line arguments
const newVersion = process.argv[2];

if (!newVersion) {
    console.error('Usage: node scripts/bump-version.js <version>');
    console.error('Example: node scripts/bump-version.js 2.82.0');
    process.exit(1);
}

// Validate version format (semantic versioning)
const versionRegex = /^\d+\.\d+\.\d+$/;
if (!versionRegex.test(newVersion)) {
    console.error('Error: Version must be in format X.Y.Z (e.g., 2.82.0)');
    process.exit(1);
}

// Convert semantic version to dash format for build scripts
const dashVersion = newVersion.replace(/\./g, '-');

console.log(`Updating version to ${newVersion} (build format: ${dashVersion})`);

// File paths
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const addonJsonPath = path.join(__dirname, '..', 'src', 'addon.json');
const pluginJsPath = path.join(__dirname, '..', 'src', 'plugin.js');

// Update package.json
try {
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    packageJson.version = newVersion;
    packageJson.release = dashVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
    console.log('✓ Updated package.json');
} catch (error) {
    console.error('✗ Failed to update package.json:', error.message);
    process.exit(1);
}

// Update addon.json
try {
    const addonJson = JSON.parse(fs.readFileSync(addonJsonPath, 'utf8'));
    addonJson.version = newVersion;
    fs.writeFileSync(addonJsonPath, JSON.stringify(addonJson, null, 2) + '\n');
    console.log('✓ Updated src/addon.json');
} catch (error) {
    console.error('✗ Failed to update src/addon.json:', error.message);
    process.exit(1);
}

// Update plugin.js
try {
    let pluginJs = fs.readFileSync(pluginJsPath, 'utf8');

    // Update PLUGIN_VERSION constant
    pluginJs = pluginJs.replace(
        /const PLUGIN_VERSION = "[\d.]+"/,
        `const PLUGIN_VERSION = "${newVersion}"`
    );

    fs.writeFileSync(pluginJsPath, pluginJs);
    console.log('✓ Updated src/plugin.js');
} catch (error) {
    console.error('✗ Failed to update src/plugin.js:', error.message);
    process.exit(1);
}

console.log('\nVersion successfully updated to ' + newVersion);
console.log('\nNext steps:');
console.log('1. Review the changes: git diff');
console.log('2. Commit the version bump: git commit -am "chore: bump version to ' + newVersion + '"');
console.log('3. Create a tag: git tag v' + newVersion);
console.log('4. Push changes and tag: git push && git push origin v' + newVersion);