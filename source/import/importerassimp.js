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
        for (let i = 0; i < fileBuffers.length; i++) {
            const fileBuffer = fileBuffers[i];
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
            // TODO: recursive
            if (node.children === undefined) {
                return;
            }
            for (let i = 0; i < node.children.length; i++) {
                const child = node.children[i];
                processor (child);
            }
        }

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

    ImportJsonMeshes (assimpJson, meshIndices)
    {
        for (let i = 0; i < meshIndices.length; i++) {
            let jsonMesh = assimpJson.meshes[meshIndices[i]];
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
            for (let i = 0; i < jsonMesh.faces.length; i++) {
                let jsonFace = jsonMesh.faces[i];
                let triangle = new OV.Triangle (
                    jsonFace[0],
                    jsonFace[1],
                    jsonFace[2]                    
                );
                mesh.AddTriangle (triangle);
            }
            this.model.AddMesh (mesh);
        }
    }
};
