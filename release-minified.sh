#!/bin/bash

# Enhanced release script with minification
# Usage: ./release-minified.sh <version>

if [ -z "$1" ]; then
    echo "Usage: $0 <version>"
    echo "Example: $0 1.2.3"
    exit 1
fi

VERSION="$1"
BUILD_DIR="build"
DIST_DIR="dist"
OUTPUT_FILE="$DIST_DIR/3DObject-$VERSION.c3addon"

echo "🚀 Building 3DObject C3 Addon v$VERSION with minification..."

# Create directories
mkdir -p "$BUILD_DIR" "$DIST_DIR"

# Copy all files from src to build
echo "📁 Copying files to build directory..."
cp -r src/* "$BUILD_DIR/"

# Define files to minify (largest 6 JS files, excluding base64-encoded draco decoder and already minified files)
declare -a FILES_TO_MINIFY=(
    "c3runtime/gltfWorker.js"
    "gl-matrix.js"
    "c3runtime/gltfModel.js"
    "c3runtime/gltfData.js"
    "c3runtime/gltfModelW.js"
    "c3runtime/instance.js"
)

echo "⚡ Minifying JavaScript files..."
TOTAL_BEFORE=0
TOTAL_AFTER=0

for file in "${FILES_TO_MINIFY[@]}"; do
    if [ -f "$BUILD_DIR/$file" ]; then
        # Get original size
        BEFORE=$(stat -f%z "$BUILD_DIR/$file" 2>/dev/null || stat -c%s "$BUILD_DIR/$file" 2>/dev/null)
        TOTAL_BEFORE=$((TOTAL_BEFORE + BEFORE))
        
        echo "  🔧 Minifying $file ($(numfmt --to=si $BEFORE)B)..."
        
        # Apply conservative minification using terser
        npx terser "$BUILD_DIR/$file" \
            --compress sequences=true,dead_code=true,conditionals=true,booleans=true,unused=true,if_return=true,join_vars=true \
            --mangle reserved=['DracoDecoderModule','Module','globalThis'] \
            --keep-fnames \
            --output "$BUILD_DIR/$file.min" \
            --source-map
        
        # Check if minification was successful
        if [ $? -eq 0 ] && [ -f "$BUILD_DIR/$file.min" ]; then
            # Get minified size
            AFTER=$(stat -f%z "$BUILD_DIR/$file.min" 2>/dev/null || stat -c%s "$BUILD_DIR/$file.min" 2>/dev/null)
            TOTAL_AFTER=$((TOTAL_AFTER + AFTER))
            
            # Replace original with minified
            mv "$BUILD_DIR/$file.min" "$BUILD_DIR/$file"
            rm -f "$BUILD_DIR/$file.min.map"  # Remove source map
            
            # Calculate savings
            SAVED=$((BEFORE - AFTER))
            PERCENT=$((SAVED * 100 / BEFORE))
            
            echo "    ✅ $(numfmt --to=si $BEFORE)B → $(numfmt --to=si $AFTER)B (saved $(numfmt --to=si $SAVED)B, $PERCENT%)"
        else
            echo "    ⚠️  Minification failed, keeping original file"
            rm -f "$BUILD_DIR/$file.min" "$BUILD_DIR/$file.min.map"
            TOTAL_AFTER=$((TOTAL_AFTER + BEFORE))
        fi
    else
        echo "  ⚠️  File not found: $file"
    fi
done

# Show total savings
TOTAL_SAVED=$((TOTAL_BEFORE - TOTAL_AFTER))
if [ $TOTAL_SAVED -gt 0 ]; then
    TOTAL_PERCENT=$((TOTAL_SAVED * 100 / TOTAL_BEFORE))
    echo "💾 Total minification savings: $(numfmt --to=si $TOTAL_SAVED)B ($TOTAL_PERCENT%)"
else
    echo "📊 No minification savings achieved"
fi

# Create the addon zip file
echo "📦 Creating addon archive..."
cd "$BUILD_DIR"
zip -r "../$OUTPUT_FILE" * -q

# Return to original directory
cd ..

# Clean up build directory
echo "🧹 Cleaning up build directory..."
rm -rf "$BUILD_DIR"

# Show final results
if [ -f "$OUTPUT_FILE" ]; then
    FINAL_SIZE=$(stat -f%z "$OUTPUT_FILE" 2>/dev/null || stat -c%s "$OUTPUT_FILE" 2>/dev/null)
    echo "✅ Successfully created: $OUTPUT_FILE ($(numfmt --to=si $FINAL_SIZE)B)"
    echo "🎉 Build complete!"
else
    echo "❌ Failed to create addon file"
    exit 1
fi 