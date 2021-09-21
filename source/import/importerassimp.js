OV.ImporterAssimp = class extends OV.ImporterBase
{
    constructor ()
    {
        super ();
		this.assimpjs = null;
    }
	
    CanImportExtension (extension)
    {
        const extensions = ['blend', 'nff'];
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
        function EnumerateNode (node, matrix, processor)
        {
            let nodeMatrix = matrix;
            if (node.transformation !== undefined) {
                let nodeTransformationMatrix = new OV.Matrix ([
                    node.transformation[0], node.transformation[4], node.transformation[8], node.transformation[12],
                    node.transformation[1], node.transformation[5], node.transformation[9], node.transformation[13],
                    node.transformation[2], node.transformation[6], node.transformation[10], node.transformation[14],
                    node.transformation[3], node.transformation[7], node.transformation[11], node.transformation[15]
                ]);
                nodeMatrix = nodeTransformationMatrix.MultiplyMatrix (nodeMatrix);
            }
            processor (node, nodeMatrix);
            if (node.children === undefined) {
                return;
            }
            for (const child of node.children) {
                EnumerateNode (child, nodeMatrix, processor);
            }
        }

        this.ImportJsonMaterials (assimpJson);

        const rootNode = assimpJson.rootnode;
        if (rootNode === undefined) {
            return;
        }

        let baseMatrix = new OV.Matrix ().CreateIdentity ();
        EnumerateNode (rootNode, baseMatrix, (node, matrix) => {
            if (node.meshes === undefined) {
                return;
            }
            this.ImportJsonMeshes (assimpJson, node.meshes, matrix);
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
                } else if (jsonProperty.key === '$clr.emissive') {
                    material.emissive = JsonColorToColor (jsonProperty.value);
                } else if (jsonProperty.key === '$mat.opacity') {
                    material.opacity = jsonProperty.value;
                    OV.UpdateMaterialTransparency (material);    
                }
            }
            this.model.AddMaterial (material);
        }
    }

    ImportJsonMeshes (assimpJson, meshIndices, matrix)
    {
        for (const meshIndex of meshIndices) {
            let jsonMesh = assimpJson.meshes[meshIndex];
            if (jsonMesh.vertices === undefined || jsonMesh.faces === undefined) {
                continue;
            }

            let mesh = new OV.Mesh ();
            if (jsonMesh.name !== undefined) {
                mesh.SetName (jsonMesh.name);
            }

            for (let i = 0; i < jsonMesh.vertices.length; i += 3) {
                const vertex = new OV.Coord3D (
                    jsonMesh.vertices[i],
                    jsonMesh.vertices[i + 1],
                    jsonMesh.vertices[i + 2]
                );
                mesh.AddVertex (vertex);
            }

            let hasNormals = false;
            if (jsonMesh.normals !== undefined) {
                hasNormals = true;
                for (let i = 0; i < jsonMesh.normals.length; i += 3) {
                    const normal = new OV.Coord3D (
                        jsonMesh.normals[i],
                        jsonMesh.normals[i + 1],
                        jsonMesh.normals[i + 2]
                    );
                    mesh.AddNormal (normal);
                }                
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
                if (hasNormals) {
                    triangle.SetNormals (
                        jsonFace[0],
                        jsonFace[1],
                        jsonFace[2]
                    );
                }
                triangle.SetMaterial (materialIndex);
                mesh.AddTriangle (triangle);
            }

            let transformation = new OV.Transformation (matrix);
            OV.TransformMesh (mesh, transformation);

            this.model.AddMesh (mesh);
        }
    }
};
