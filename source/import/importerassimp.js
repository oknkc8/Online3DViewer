OV.ImporterAssimp = class extends OV.ImporterBase
{
    constructor ()
    {
        super ();
		this.assimpjs = null;
    }
	
    CanImportExtension (extension)
    {
        const extensions = ['blend'];
        return extensions.indexOf (extension) !== -1;
    }

    GetUpDirection ()
    {
        // TODO
        return OV.Direction.Y;
    }

	ClearContent ()
	{
	}

    ResetContent ()
    {
    }

    ImportContent (fileContent, onFinish)
    {
		if (this.assimpjs === null) {
			OV.LoadExternalLibrary ('loaders/assimpjs.js').then (() => {
				assimpjs ().then ((assimpjs) => {
					this.assimpjs = assimpjs;
					this.ImportAssimpContent ();
					onFinish ();
				});
            }).catch (() => {
                onFinish ();
            });
		} else {
			this.ImportAssimpContent ();
			onFinish ();
		}
    }

	ImportAssimpContent ()
	{
		const fileBuffers = this.callbacks.getAllBuffers ();
        let fileList = new this.assimpjs.FileList ();
        for (const fileBuffer of fileBuffers) {
            fileList.AddFile (fileBuffer.name, new Uint8Array (fileBuffer.content));
        }

        let assimpJsonText = this.assimpjs.ImportModel (fileList);
        let assimpJson = JSON.parse (assimpJsonText);
        if (assimpJson.error !== undefined) {
            return;
        }

        this.ImportAssimpJson (assimpJson);
	}

    ImportAssimpJson (assimpJson)
    {
        function EnumerateNode (node, processor)
        {
            processor (node);
            if (node.children === undefined) {
                return;
            }
            for (const child of node.children) {
                EnumerateNode (child, processor);
            }
        }

        this.ImportJsonMaterials (assimpJson);

        const rootNode = assimpJson.rootnode;
        if (rootNode === undefined) {
            return;
        }

        EnumerateNode (rootNode, (node) => {
            if (node.meshes === undefined) {
                return;
            }
            // TODO: transformation
            this.ImportJsonMeshes (assimpJson, node.meshes);
        });
    }

    ImportJsonMaterials (assimpJson)
    {
        function JsonColorToColor (jsonColor)
        {
            return new OV.Color (
                parseInt (jsonColor[0] * 255.0, 10),
                parseInt (jsonColor[1] * 255.0, 10),
                parseInt (jsonColor[2] * 255.0, 10)
            );
        }

        if (assimpJson.materials === undefined) {
            return;
        }

        for (const jsonMaterial of assimpJson.materials) {
            let material = new OV.Material (OV.MaterialType.Phong);
            // TODO: other properties
            // TODO: textures
            for (const jsonProperty of jsonMaterial.properties) {
                if (jsonProperty.key === '?mat.name') {
                    material.name = jsonProperty.value;
                } else if (jsonProperty.key === '$clr.diffuse') {
                    material.color = JsonColorToColor (jsonProperty.value);
                } else if (jsonProperty.key === '$clr.ambient') {
                    material.ambient = JsonColorToColor (jsonProperty.value);
                } else if (jsonProperty.key === '$clr.specular') {
                    material.specular = JsonColorToColor (jsonProperty.value);
                }
            }
            this.model.AddMaterial (material);
        }
    }

    ImportJsonMeshes (assimpJson, meshIndices)
    {
        for (const meshIndex of meshIndices) {
            let jsonMesh = assimpJson.meshes[meshIndex];
            if (jsonMesh.vertices === undefined || jsonMesh.faces === undefined) {
                continue;
            }

            let mesh = new OV.Mesh ();
            for (let i = 0; i < jsonMesh.vertices.length; i += 3) {
                let vertex = new OV.Coord3D (
                    jsonMesh.vertices[i],
                    jsonMesh.vertices[i + 1],
                    jsonMesh.vertices[i + 2]
                );
                mesh.AddVertex (vertex);
            }

            let materialIndex = null;
            if (jsonMesh.materialindex !== undefined) {
                materialIndex = jsonMesh.materialindex;
            }

            for (let i = 0; i < jsonMesh.faces.length; i++) {
                let jsonFace = jsonMesh.faces[i];
                let triangle = new OV.Triangle (
                    jsonFace[0],
                    jsonFace[1],
                    jsonFace[2]                    
                );
                triangle.SetMaterial (materialIndex);
                mesh.AddTriangle (triangle);
            }
            
            this.model.AddMesh (mesh);
        }
    }
};
