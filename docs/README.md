See: https://kindeyegames.itch.io/c3-3dobject-alpha and read dev logs for most recent discussions / information.

This plugin loads a 3D Model into Construct 3, similar to the new built-in 3DShape plugin, but the 3D object can be a more complicated 3D model, loaded from a 3D model file format and texture. It also supports 3D animations.

It only supports gltf embedded and glb formats (preferably with an embedded texture in the file, a separate texture png file can also be supported.)

Please leave feedback or tag @kindeyegames on X or Mikal in the Construct Community Discord.

### Known issues
- The bounding box may not fully track the model with rotations and viewport extremes (edge of viewport)

### 3D Model file requirements:
- *It's highly recommended to set 3DObject projects to 'regular' z-axis settings.*
- Must be gltf/glb embedded format and embedded texture (png, jpg formats are ok)
- The texture should be embedded in the gltf/glb or supplied as an image in the c3 editor, but the gltf/glb file must have a material referring to a texture if it's not using a solid color.
- Do not include other non diffuse textures (e.g. normal map, bump  map, etc.) in the gltf/glb embedded files if possible, they are not used, but would still take up memory.
- Be aware of the 0,0,0 origin relative to the model center (affects rotation center and position.) This can be changed as needed with the Set local center ACE.
- Be aware of the relative scale of the model in model units. This can be scaled up/down with the Set scale ACE or property and xScale, yScale, zScale (note that these are divisors, to match C3 zScale property.)
- 3D models are available on CGTrader and Turbosquid, but you may need to find the ones that have gltf and texture support. If there are multiple textures, usually look for the ones labeled diffuse or albedo. These will be the base color textures (e.g. not normal maps, bump maps, etc.) You can only use models that have one diffuse/albedo texture or multiple textures. (If you have expertise with blender you can load a model with multiple textures and then bake them to a single texture and export texture in the gltf embedded/glb file.)
- If a model you use is not available in gltf file format, try loading the model into blender and exporting with the gltf embedded or glb file format.
- Merge multiple animations into a single file gltf/glb file.
- If you are importing fbx to blender consider using plug-in to improve fbx import to blender: https://blendermarket.com/products/better-fbx-importer--exporter
### Debugging 3D models
- Load gltf/glb model into: https://sandbox.babylonjs.com/
- Does it render correctly, have texture, animate correctly
- Check textures, material, animations
- Check scale
- Load model in https://gltf.report/ - check for errors / validation
- Check the 0,0,0 origin point of your model in a 3D modeling program (e.g. Blender), center your model as needed.
### Performance notes
- Use just a few low polygon models (in the low thousand range, if you have a lot of models, move to the low hundreds range)
- Animating models require additional performance, can offload to workers (other cpu threads)
- You can control the animation rate to reduce the required CPU performance.
- Bake down to a single texture (using 3D modeling tool like blender)
- Use solid color models without texture (will save texture memory).
- Use a smaller texture map to save GPU memory (2k x 2k texture takes up 16MB, 512x512 is 1MB)
- If you are baking texture in blender, consider also baking in AO (on model only), this can give more depth to the model. AO Tutorial

### Some more notes: (From @meta comments on CC Discord)
- Do fake shadows with just sprite
- If you want shadow and light formations in your 3D model texture, you need to texture bake with combine bake type.
- At the same time reduce the number of triangles of the models by editing the meshes and investigate this bake type as high poly to low poly bake.
- You will see more things. The result you need to achieve at the end of the day is to achieve a 30k poly effect with low poly models with wonderful baked textures reduced from 30k tri to 1k tri.
- I suggest you to design your whole scene in blender beforehand and do the lighting there and bake it, and I suggest you to use only 1 material for each 3D model.
- Also generally use 256x256 for texture sizes, 512x512 is ideal for things I care about detail
- See WoW examples for great baking of texture with low poly geometry

### Basic usage:
- Use project setting z axis scale 'regular'
- This sets the z axis scale to the same scale as x and y, which is better for 3D development (and you also can control the project FOV.)
- Add a 3DObject to the project
- Add gltf embedded file or glb file to the project (preferred to include texture in the embedded gltf/glb file)
- If you are using a gltf/glb with an embedded texture (preferred) set the image editor to a solid color, otherwise:
 - Open 3DObject image editor loads the texture file into the image. Note image size must be larger than the Project's setting for spritesheet size (e.g. 512-4096), resize the image larger if needed in the image editor.
- Test! You can use the normal position ACEs to move in x,y direction and position related behaviors should work (though I tend to lock the 3DObject with other sprites w/ behaviors using events)
- To change z position, use the setZ elevation ACE (other behaviors or actions which affect zElevation should also work, e.g. sine behavior, drag and drop, etc.)
- Set the zHeight to match the relative zHeight of the object (used for C3 3D viewport clipping.)
- Please post feedback and pix/vid of your tests.

#### Advanced uses: read the dev logs and look at their associated examples.

### Recent updates:
- *DONE* Support multiple instances of one 3DObject
- *DONE* More animation ACEs (end of animation trigger, etc.)
- *DONE* Add expression for current animation time or frame.
- *DONE* Blend between animation changes
- *DONE* Support multiple textures
- *DONE* Support solid color
- *DONE* Runtime load model (single load allowed)
- *DONE* Load different model for different instances of the same object (single load allowed, allocates memory on CPU and GPU for each instance.)
- *DONE* Dynamic change of a mesh's material (e.g. change a mesh's texture)
- *DONE* Support correct rotation (for mixed multiple node types)
- *DONE* Improve bounding box and z-height regions for rotated models to prevent early clipping.
- *DONE* ACEs for setting animation blend time.
- *DONE* Enable 3D flat lighting in worker animation mode.
- *DONE* Morph targets
- *DONE* Review SS3D Light, changing texture color w/ white lights.
- *DONE* Add vertex snapping (int vertex values) retro mode
- *DONE* Can other parameters (angle x,y,z, etc. be added to timeline)
- *DONE* Enable lighting baking / update lighting in worker animation mode.
- *DONE* Add flashlight example
- Add ACE to preload 3d models at startup w/o draw.
- Review worker animation mode causing issues on ios also with audio and possible crashes
#### QoL:
- *DONE* On animation <name> finished
- *DONE* CurrentAnimationSpeed
- AnimationTimeLength
- AnimationFrameLength
- Reload model in editor if gltf path changes

Big thanks to r0j0hound on the Construct forums for sharing the gltf parsing and animation code which I used as a base for the gltf integration in this plug-in.

Please leave feedback or tag @kindeyegames on Twitter.
