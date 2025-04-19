/**
 * Web-IFC Properties
 * @module Properties
 */
import { IfcAPI } from "../web-ifc-api";
interface Node {
    expressID: number;
    type: string;
    children: Node[];
}
export declare class Properties {
    private api;
    /** @ignore */
    constructor(api: IfcAPI);
    /**
     *
     * @param modelID model handle
     * @param id  expressID of IfcElement
     * @param recursive default false, if true get all nested properties recursively
     * @param inverse default false, if true get all inverse properties recursively
     * @returns IfcElement
     */
    getItemProperties(modelID: number, id: number, recursive?: boolean, inverse?: boolean): Promise<any>;
    /**
     * Get IfcPropertySets of IfcElements
     * @param modelID model handle
     * @param elementID expressID of IfcElement, default 0 (all psets in model)
     * @param recursive default false, if true get all nested properties recursively
     * @returns array of IfcElements inheriting from IfcPropertySetDefinition
     */
    getPropertySets(modelID: number, elementID?: number, recursive?: boolean, includeTypeProperties?: boolean): Promise<any[]>;
    /**
     * Set IfcRelDefinesByProperties relations of IfcElements and IfcPropertySets
     * @param modelID model handle
     * @param elementID expressID or array of expressIDs of IfcElements
     * @param psetID expressID or array of expressIDs of IfcPropertySets
     * @returns true if success or false if error
     */
    setPropertySets(modelID: number, elementID: number | number[], psetID: number | number[]): Promise<boolean>;
    /**
     * Get TypeObject of IfcElements
     * @param modelID model handle
     * @param elementID expressID of IfcElement, default 0 (all type objects in model)
     * @param recursive default false, if true get all nested properties of the type object recursively
     * @returns array of objects inheriting from IfcTypeObject
     */
    getTypeProperties(modelID: number, elementID?: number, recursive?: boolean): Promise<any[]>;
    /**
     * Get materials of IfcElement
     * @param modelID model handle
     * @param elementID expressID of IfcElement, default 0 (all materials in model)
     * @param recursive default false, if true get all nested properties recursively
     * @returns array of IfcElements inheriting from IfcMaterialDefinition
     */
    getMaterialsProperties(modelID: number, elementID?: number, recursive?: boolean, includeTypeMaterials?: boolean): Promise<any[]>;
    /**
     * Set IfcRelAssociatesMaterial relations of IfcElements and IfcMaterialDefinitions
     * @param modelID model handle
     * @param elementID expressID or array of expressIDs of IfcElements
     * @param materialID expressID or array of expressIDs of IfcMaterialDefinitions
     * @returns true if success or false if error
     */
    setMaterialsProperties(modelID: number, elementID: number | number[], materialID: number | number[]): Promise<boolean>;
    /**
     * Get Spatial Structure of IfcProject
     * @param modelID model handle
     * @param includeProperties default false
     * @returns IfcProject as Node
     */
    getSpatialStructure(modelID: number, includeProperties?: boolean): Promise<Node>;
    private getRelatedProperties;
    private getChunks;
    private static newIfcProject;
    private getSpatialNode;
    private getChildren;
    private newNode;
    private getSpatialTreeChunks;
    private saveChunk;
    private setItemProperties;
}
export {};
