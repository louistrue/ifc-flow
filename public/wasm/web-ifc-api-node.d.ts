/**
 * Web-IFC Main API Class
 * @module web-ifc
 */
import { IfcLineObject } from "./ifc-schema";
export * from "./ifc-schema";
import { Properties } from "./helpers/properties";
export { Properties };
import { LogLevel } from "./helpers/log";
export { LogLevel };
export declare const UNKNOWN = 0;
export declare const STRING = 1;
export declare const LABEL = 2;
export declare const ENUM = 3;
export declare const REAL = 4;
export declare const REF = 5;
export declare const EMPTY = 6;
export declare const SET_BEGIN = 7;
export declare const SET_END = 8;
export declare const LINE_END = 9;
export declare const INTEGER = 10;
/**
 * Settings for the IFCLoader
 * @property {boolean} COORDINATE_TO_ORIGIN - If true, the model will be translated to the origin.
 * @property {number} CIRCLE_SEGMENTS - Number of segments for circles.
 * @property {number} MEMORY_LIMIT - The amount of memory to be reserved for storing IFC data in memory
 * @property {number} TAPE_SIZE - Size of the tape for the loader.
 * @property {number} LINEWRITER_BUFFER - The number of lines to write to memory at a time when writing an IFC file.
 */
export interface LoaderSettings {
    COORDINATE_TO_ORIGIN?: boolean;
    CIRCLE_SEGMENTS?: number;
    MEMORY_LIMIT?: number;
    TAPE_SIZE?: number;
    LINEWRITER_BUFFER?: number;
}
export interface Vector<T> extends Iterable<T> {
    get(index: number): T;
    size(): number;
}
export interface Color {
    x: number;
    y: number;
    z: number;
    w: number;
}
export interface RawLineData {
    ID: number;
    type: number;
    arguments: any[];
}
export interface PlacedGeometry {
    color: Color;
    geometryExpressID: number;
    flatTransformation: Array<number>;
}
export interface FlatMesh {
    geometries: Vector<PlacedGeometry>;
    expressID: number;
    delete(): void;
}
export interface Point {
    x: number;
    y: number;
    z?: number;
}
export interface Curve {
    points: Array<Point>;
    userData: Array<string>;
    arcSegments: Array<number>;
}
export interface SweptDiskSolid {
    profile: Profile;
    axis: Array<Curve>;
    profileRadius: number;
}
export interface Profile {
    curve: Curve;
    holes: Array<Curve>;
    profiles: Array<Profile>;
    isConvex: boolean;
    isComposite: boolean;
}
export interface CrossSection {
    curves: Array<Curve>;
    expressID: Array<number>;
}
export interface AlignmentSegment {
    curves: Array<Curve>;
}
export interface Alignment {
    FlatCoordinationMatrix: Array<number>;
    Horizontal: AlignmentSegment;
    Vertical: AlignmentSegment;
}
export interface IfcGeometry {
    GetVertexData(): number;
    GetVertexDataSize(): number;
    GetIndexData(): number;
    GetIndexDataSize(): number;
    GetSweptDiskSolid(): SweptDiskSolid;
    delete(): void;
}
export interface IfcType {
    typeID: number;
    typeName: string;
}
export interface NewIfcModel {
    schema: string;
    name?: string;
    description?: string[];
    authors?: string[];
    organizations?: string[];
    authorization?: string;
}
export type ModelLoadCallback = (offset: number, size: number) => Uint8Array;
export type ModelSaveCallback = (data: Uint8Array) => void;
/** @ignore */
export declare function ms(): number;
export type LocateFileHandlerFn = (path: string, prefix: string) => string;
export declare class IfcAPI {
    /** @ignore */
    wasmModule: undefined | any;
    private wasmPath;
    private isWasmPathAbsolute;
    private modelSchemaList;
    private modelSchemaNameList;
    /** @ignore */
    ifcGuidMap: Map<number, Map<string | number, string | number>>;
    private deletedLines;
    /**
     * Contains all the logic and methods regarding properties, psets, qsets, etc.
     */
    properties: Properties;
    /**
     * Initializes the WASM module (WebIFCWasm), required before using any other functionality.
     *
     * @param customLocateFileHandler An optional locateFile function that let's
     * you override the path from which the wasm module is loaded.
     */
    Init(customLocateFileHandler?: LocateFileHandlerFn, forceSingleThread?: boolean): Promise<void>;
    /**
    * Opens a set of models and returns model IDs
    * @param dataSets Array of Buffers containing IFC data (bytes)
    * @param settings Settings for loading the model @see LoaderSettings
    * @returns Array of model IDs
   */
    OpenModels(dataSets: Array<Uint8Array>, settings?: LoaderSettings): Array<number>;
    private CreateSettings;
    private LookupSchemaId;
    /**
     * Opens a model and returns a modelID number
     * @param data Buffer containing IFC data (bytes)
     * @param settings Settings for loading the model @see LoaderSettings
     * @returns ModelID or -1 if model fails to open
    */
    OpenModel(data: Uint8Array, settings?: LoaderSettings): number;
    /**
     * Opens a model and returns a modelID number
     * @param callback a function of signature (offset:number, size: number) => Uint8Array that will retrieve the IFC data
     * @param settings Settings for loading the model @see LoaderSettings
     * @returns ModelID or -1 if model fails to open
    */
    OpenModelFromCallback(callback: ModelLoadCallback, settings?: LoaderSettings): number;
    /**
     * Fetches the ifc schema version of a given model
     * @param modelID Model ID
     * @returns IFC Schema version
    */
    GetModelSchema(modelID: number): string;
    /**
     * Creates a new model and returns a modelID number
     * @param schema ifc schema version
     * @returns ModelID
    */
    CreateModel(model: NewIfcModel, settings?: LoaderSettings): number;
    /**
     * Saves a model to a Buffer
     * @param modelID Model ID
     * @returns Buffer containing the model data
     */
    SaveModel(modelID: number): Uint8Array;
    /**
     * Saves a model to a Buffer
     * @param modelID Model ID
     * @returns Buffer containing the model data
     */
    SaveModelToCallback(modelID: number, callback: ModelSaveCallback): void;
    /**
    * Retrieves the geometry of an element
    * @param modelID Model handle retrieved by OpenModel
    * @param geometryExpressID express ID of the element
    * @returns Geometry of the element as a list of vertices and indices
    */
    GetGeometry(modelID: number, geometryExpressID: number): IfcGeometry;
    /**
     * Gets the header information required by the user
     * @param modelID Model handle retrieved by OpenModel
     * @param headerType Type of header data you want to retrieve
     * ifc.FILE_NAME, ifc.FILE_DESCRIPTION or ifc.FILE_SCHEMA
     * @returns An object with parameters ID, type and arguments
     */
    GetHeaderLine(modelID: number, headerType: number): any;
    /**
     * Gets the list of all ifcTypes contained in the model
     * @param modelID Model handle retrieved by OpenModel
     * @returns Array of objects containing typeID and typeName
     */
    GetAllTypesOfModel(modelID: number): IfcType[];
    /**
     * Gets the ifc line data for a given express ID
     * @param modelID Model handle retrieved by OpenModel
     * @param expressID express ID of the line
     * @param flatten recursively flatten the line, default false
     * @param inverse get the inverse properties of the line, default false
     * @param inversePropKey filters out all other properties from a inverse search, for a increase in performance. Default null
     * @returns lineObject
     */
    GetLine(modelID: number, expressID: number, flatten?: boolean, inverse?: boolean, inversePropKey?: string | null | undefined): any;
    /**
     * Gets the next unused expressID
     * @param modelID Model handle retrieved by OpenModel
     * @param expressID Starting expressID value
     * @returns The next unused expressID starting from the value provided
     */
    GetNextExpressID(modelID: number, expressID: number): number;
    /**
     * Creates a new ifc entity
     * @param modelID Model handle retrieved by OpenModel
     * @param type Type code
     * @param args Arguments required by the entity
     * @returns An object contining the parameters of the new entity
     */
    CreateIfcEntity(modelID: number, type: number, ...args: any[]): IfcLineObject;
    /**
     * Creates a new ifc type i.e. IfcLabel, IfcReal, ...
     * @param modelID Model handle retrieved by OpenModel
     * @param type Type code
     * @param value Type value
     * @returns An object with the parameters of the type
     */
    CreateIfcType(modelID: number, type: number, value: any): any;
    /**
     * Gets the name from a type code
     * @param type Code
     * @returns Name
     */
    GetNameFromTypeCode(type: number): string;
    /**
     * Gets the type code  from a name code
     * @param name
     * @returns type code
     */
    GetTypeCodeFromName(typeName: string): number;
    /**
     * Evaluates if a type is subtype of IfcElement
     * @param type Type code
     * @returns True if subtype of Ifcelement, False if it is not subtype
     */
    IsIfcElement(type: number): boolean;
    /**
     * Returns a list with all entity types that are present in the current schema
     * @param modelID Model handle retrieved by OpenModel
     * @returns Array of type codes
     */
    GetIfcEntityList(modelID: number): Array<number>;
    /**
     * Deletes an IFC line from the model
     * @param modelID Model handle retrieved by OpenModel
     * @param expressID express ID of the line to remove
     */
    DeleteLine(modelID: number, expressID: number): void;
    /**
     * Writes a line to the model, can be used to write new lines or to update existing lines
     * @param modelID Model handle retrieved by OpenModel
     * @param lineObject array of line object to write
     */
    WriteLines<Type extends IfcLineObject>(modelID: number, lineObjects: Array<Type>): void;
    /**
     * Writes a set of line to the model, can be used to write new lines or to update existing lines
     * @param modelID Model handle retrieved by OpenModel
     * @param lineObject line object to write
     */
    WriteLine<Type extends IfcLineObject>(modelID: number, lineObject: Type): void;
    /** @ignore */
    FlattenLine(modelID: number, line: any): void;
    /** @ignore */
    GetRawLineData(modelID: number, expressID: number): RawLineData;
    /** @ignore */
    WriteRawLineData(modelID: number, data: RawLineData): void;
    /** @ignore */
    WriteRawLinesData(modelID: number, data: Array<RawLineData>): void;
    /**
     * Get all line IDs of a specific ifc type
     * @param modelID model ID
     * @param type ifc type, @see IfcEntities
     * @param includeInherited if true, also returns all inherited types
     * @returns vector of line IDs
     */
    GetLineIDsWithType(modelID: number, type: number, includeInherited?: boolean): Vector<number>;
    /**
     * Get all line IDs of a model
     * @param modelID model ID
     * @returns vector of all line IDs
     */
    GetAllLines(modelID: number): Vector<number>;
    /**
     * Returns all crossSections in 2D contained in IFCSECTIONEDSOLID, IFCSECTIONEDSURFACE, IFCSECTIONEDSOLIDHORIZONTAL (IFC4x3 or superior)
     * @param modelID model ID
     * @returns Lists with the cross sections curves as sets of points
     */
    GetAllCrossSections2D(modelID: number): Array<CrossSection>;
    /**
     * Returns all crossSections in 3D contained in IFCSECTIONEDSOLID, IFCSECTIONEDSURFACE, IFCSECTIONEDSOLIDHORIZONTAL (IFC4x3 or superior)
     * @param modelID model ID
     * @returns Lists with the cross sections curves as sets of points
     */
    GetAllCrossSections3D(modelID: number): Array<CrossSection>;
    /**
     * Returns all alignments contained in the IFC model (IFC4x3 or superior)
     * @param modelID model ID
     * @returns Lists with horizontal and vertical curves as sets of points
     */
    GetAllAlignments(modelID: number): any;
    /**
     * Set the transformation matrix
     * @param modelID model ID
     * @param transformationMatrix transformation matrix, flat 4x4 matrix as array[16]
     */
    SetGeometryTransformation(modelID: number, transformationMatrix: Array<number>): void;
    /**
     * Get the coordination matrix
     * @param modelID model ID
     * @returns flat 4x4 matrix as array[16]
     */
    GetCoordinationMatrix(modelID: number): Array<number>;
    GetVertexArray(ptr: number, size: number): Float32Array;
    GetIndexArray(ptr: number, size: number): Uint32Array;
    getSubArray(heap: any, startPtr: number, sizeBytes: number): any;
    /**
     * Closes a model and frees all related memory
     * @param modelID Model handle retrieved by OpenModel, model must be closed after use
    */
    CloseModel(modelID: number): void;
    /**
     * Closes all models and frees all related memory. Please note that after calling this you must call Init() again to ensure web-ifc is in a working state.
    */
    Dispose(): void;
    /**
     * Streams meshes of a model with specific express id
     * @param modelID Model handle retrieved by OpenModel
     * @param expressIDs expressIDs of elements to stream
     * @param meshCallback callback function that is called for each mesh
     */
    StreamMeshes(modelID: number, expressIDs: Array<number>, meshCallback: (mesh: FlatMesh, index: number, total: number) => void): void;
    /**
     * Streams all meshes of a model
     * @param modelID Model handle retrieved by OpenModel
     * @param meshCallback callback function that is called for each mesh
     */
    StreamAllMeshes(modelID: number, meshCallback: (mesh: FlatMesh, index: number, total: number) => void): void;
    /**
     * Streams all meshes of a model with a specific ifc type
     * @param modelID Model handle retrieved by OpenModel
     * @param types types of elements to stream
     * @param meshCallback callback function that is called for each mesh
     */
    StreamAllMeshesWithTypes(modelID: number, types: Array<number>, meshCallback: (mesh: FlatMesh, index: number, total: number) => void): void;
    /**
     * Checks if a specific model ID is open or closed
     * @param modelID Model handle retrieved by OpenModel
     * @returns true if model is open, false if model is closed
    */
    IsModelOpen(modelID: number): boolean;
    /**
     * Load all geometry in a model
     * @param modelID Model handle retrieved by OpenModel
     * @returns Vector of FlatMesh objects
    */
    LoadAllGeometry(modelID: number): Vector<FlatMesh>;
    /**
     * Load geometry for a single element
     * @param modelID Model handle retrieved by OpenModel
     * @param expressID ExpressID of the element
     * @returns FlatMesh object
    */
    GetFlatMesh(modelID: number, expressID: number): FlatMesh;
    /**
    * Returns the maximum ExpressID value in the IFC file, ex.- #9999999
    * @param modelID Model handle retrieved by OpenModel
    * @returns Express numerical value
    */
    GetMaxExpressID(modelID: number): number;
    /**
    * Returns the type of a given ifc entity in the fiule.
    * @param modelID Model handle retrieved by OpenModel
    * @param expressID Line Number
    * @returns IFC Type Code
    */
    GetLineType(modelID: number, expressID: number): any;
    /**
    * Returns the version number of web-ifc
    * @returns The current version number as a string
    */
    GetVersion(): any;
    /**
    * Looks up an entities express ID from its GlobalID.
    * @param modelID Model handle retrieved by OpenModel
    * @param guid GobalID to be looked up
    * @returns expressID numerical value
    */
    GetExpressIdFromGuid(modelID: number, guid: string): string | number | undefined;
    /**
     * Looks up an entities GlobalID from its ExpressID.
     * @param modelID Model handle retrieved by OpenModel
     * @param expressID express ID to be looked up
     * @returns globalID string value
     */
    GetGuidFromExpressId(modelID: number, expressID: number): string | number | undefined;
    /** @ignore */
    CreateIfcGuidToExpressIdMapping(modelID: number): void;
    /**
     * Sets the path to the wasm file
     * @param path path to the wasm file
     * @param absolute if true, path is absolute, otherwise it is relative to executing script
     */
    SetWasmPath(path: string, absolute?: boolean): void;
    /**
     * Sets the log level
     * @param level Log level to set
     */
    SetLogLevel(level: LogLevel): void;
    /**
     * Encodes test using IFC Encoding
     * @text the text to encode
     * @returns the text encoded
     */
    EncodeText(text: string): any;
    /**
    * Decodes test using IFC Encoding
    * @text the text to decode
    * @returns the text decoded
    */
    DecodeText(text: string): any;
    /**
    * Resets the Cached IFC Data - useful when changing the geometry of a model
    * @param modelID Model handle retrieved by OpenModel
    */
    ResetCache(modelID: number): any;
}
