// Model.ts - Base Model class for GunDB with ActiveRecord-like features
import { EventEmitter } from 'events';

// Registry to store model references and resolve circular dependencies
const ModelRegistry: Record<string, typeof Model> = {};

// Types for relation declarations
type RelationType = 'hasMany' | 'belongsTo' | 'hasOne' | 'hasAndBelongsToMany';

interface RelationConfig {
  type: RelationType;
  model: string;
  foreignKey?: string;
  through?: string;
}

interface ModelRelations {
  [relationName: string]: RelationConfig;
}

export class Model {
  static gunInstance: any;
  static modelName: string;
  static tableName: string;
  static relations: ModelRelations = {};

  // Instance properties
  attrs: any = {};
  changed: boolean = false;
  _relationCache: Record<string, any> = {};
  events: EventEmitter = new EventEmitter();

  /**
   * Constructor - takes attributes data and assigns to the model
   */
  constructor(data: any = {}) {
    Object.assign(this.attrs, data);
    Object.keys(data).forEach(key => {
      if (key !== 'attrs' && key !== '_relationCache' && key !== 'events') {
        (this as any)[key] = data[key];
      }
    });
  }

  /**
   * Register a model in the registry
   */
  static register() {
    if (!this.modelName) {
      this.modelName = this.name;
    }
    
    if (!this.tableName) {
      this.tableName = `${this.modelName.toLowerCase()}s`;
    }
    
    ModelRegistry[this.modelName] = this;
    this.setupRelationAccessors();
    return this;
  }

  /**
   * Get a model class from the registry by name
   */
  static getModel(modelName: string): typeof Model {
    const ModelClass = ModelRegistry[modelName];
    if (!ModelClass) {
      throw new Error(`Model ${modelName} not found in registry. Make sure to register it with Model.register()`);
    }
    return ModelClass;
  }

  /**
   * Set the Gun instance for this model
   */
  static setGunInstance(gun: any) {
    this.gunInstance = gun;
  }

  /**
   * Setup relation accessors for this model
   * This creates getters and methods for each relation
   */
  static setupRelationAccessors() {
    for (const [relationName, config] of Object.entries(this.relations)) {
      // Define property getter for relation
      Object.defineProperty(this.prototype, relationName, {
        get: function() {
          // If we've already built the relation object, return from cache
          if (this._relationCache[relationName]) {
            return this._relationCache[relationName];
          }

          // Get the related model class
          const RelatedModel = Model.getModel(config.model);
          
          // Create appropriate accessor based on relation type
          let accessor;
          
          if (config.type === 'hasMany') {
            accessor = {
              // Get all related models
              async all(): Promise<any[]> {
                return this.getRelated(relationName, RelatedModel);
              },
              
              // Add a related model
              async add(model: any): Promise<void> {
                await this.addRelation(relationName, model);
                this.events.emit('relationChanged', relationName);
              },
              
              // Remove a related model
              async remove(model: any): Promise<void> {
                await this.removeRelation(relationName, model);
                this.events.emit('relationChanged', relationName);
              },
              
              // Create and add a new related model
              async create(data: any): Promise<any> {
                const model = new RelatedModel(data);
                await model.save();
                await this.addRelation(relationName, model);
                this.events.emit('relationChanged', relationName);
                return model;
              },
              
              // Find related models with specific attributes
              async where(attrs: any): Promise<any[]> {
                const all = await this.getRelated(relationName, RelatedModel);
                return all.filter(item => {
                  for (const [key, value] of Object.entries(attrs)) {
                    if (item[key] !== value) return false;
                  }
                  return true;
                });
              },
              
              // Check if relation exists
              async exists(): Promise<boolean> {
                const all = await this.getRelated(relationName, RelatedModel);
                return all.length > 0;
              }
            };
          } else if (config.type === 'belongsTo') {
            accessor = {
              // Get the related model
              async get(): Promise<any | null> {
                const relatedModels = await this.getRelated(relationName, RelatedModel);
                return relatedModels.length > 0 ? relatedModels[0] : null;
              },
              
              // Set the related model
              async set(model: any): Promise<void> {
                // Remove any existing relations
                const current = await this.getRelated(relationName, RelatedModel);
                for (const existing of current) {
                  await this.removeRelation(relationName, existing);
                }
                
                // Add the new relation
                if (model) {
                  await this.addRelation(relationName, model);
                }
                
                this.events.emit('relationChanged', relationName);
              }
            };
          } else if (config.type === 'hasOne') {
            accessor = {
              // Get the related model
              async get(): Promise<any | null> {
                const relatedModels = await this.getRelated(relationName, RelatedModel);
                return relatedModels.length > 0 ? relatedModels[0] : null;
              },
              
              // Set the related model
              async set(model: any): Promise<void> {
                // Remove any existing relations
                const current = await this.getRelated(relationName, RelatedModel);
                for (const existing of current) {
                  await this.removeRelation(relationName, existing);
                }
                
                // Add the new relation
                if (model) {
                  await this.addRelation(relationName, model);
                }
                
                this.events.emit('relationChanged', relationName);
              },
              
              // Create and set a new related model
              async create(data: any): Promise<any> {
                const model = new RelatedModel(data);
                await model.save();
                await this.set(model);
                return model;
              }
            };
          }
          
          // Cache and return the accessor
          this._relationCache[relationName] = accessor;
          return accessor;
        },
        configurable: true,
        enumerable: true
      });
    }
  }

  /**
   * Define a hasMany relation
   */
  static hasMany(modelName: string, options: { as?: string, foreignKey?: string } = {}) {
    const relationName = options.as || `${modelName.toLowerCase()}s`;
    this.relations[relationName] = {
      type: 'hasMany',
      model: modelName,
      foreignKey: options.foreignKey
    };
    return this;
  }

  /**
   * Define a belongsTo relation
   */
  static belongsTo(modelName: string, options: { as?: string, foreignKey?: string } = {}) {
    const relationName = options.as || modelName.toLowerCase();
    this.relations[relationName] = {
      type: 'belongsTo',
      model: modelName,
      foreignKey: options.foreignKey
    };
    return this;
  }

  /**
   * Define a hasOne relation
   */
  static hasOne(modelName: string, options: { as?: string, foreignKey?: string } = {}) {
    const relationName = options.as || modelName.toLowerCase();
    this.relations[relationName] = {
      type: 'hasOne',
      model: modelName,
      foreignKey: options.foreignKey
    };
    return this;
  }

  /**
   * Find all instances of this model
   */
  static async findAll(): Promise<any[]> {
    if (!this.gunInstance) {
      throw new Error('Gun instance not set. Call setGunInstance first.');
    }

    return new Promise((resolve, reject) => {
      const items: any[] = [];
      this.gunInstance.get(this.tableName).map().once((data: any, id: string) => {
        if (data) {
          const ModelClass = this;
          const item = new ModelClass(data);
          item.attrs._soul = id;
          items.push(item);
        }
      });

      // In a real app, you might want to use Gun's .then() or other mechanisms to know when data is loaded
      setTimeout(() => resolve(items), 100);
    });
  }

  /**
   * Find a model by ID
   */
  static async findById(id: string): Promise<any | null> {
    if (!this.gunInstance) {
      throw new Error('Gun instance not set. Call setGunInstance first.');
    }

    return new Promise((resolve, reject) => {
      this.gunInstance.get(this.tableName).get(id).once((data: any) => {
        if (data) {
          const ModelClass = this;
          const item = new ModelClass(data);
          item.attrs._soul = id;
          resolve(item);
        } else {
          resolve(null);
        }
      });
    });
  }

  /**
   * Find models matching specified attributes
   */
  static async where(attributes: Record<string, any>): Promise<any[]> {
    const all = await this.findAll();
    
    return all.filter(item => {
      for (const [key, value] of Object.entries(attributes)) {
        if (item[key] !== value) return false;
      }
      return true;
    });
  }

  /**
   * Find the first model matching specified attributes
   */
  static async findBy(attributes: Record<string, any>): Promise<any | null> {
    const results = await this.where(attributes);
    return results.length > 0 ? results[0] : null;
  }

  /**
   * Save this model instance
   */
  async save(): Promise<this> {
    const ModelClass = this.constructor as typeof Model;
    
    if (!ModelClass.gunInstance) {
      throw new Error('Gun instance not set. Call setGunInstance first.');
    }

    return new Promise((resolve, reject) => {
      const node = ModelClass.gunInstance.get(ModelClass.tableName);
      const data = { ...this.attrs };
      delete data._soul; // Don't store the soul in the data
      
      if (this.attrs._soul) {
        // Update existing
        node.get(this.attrs._soul).put(data, (ack: any) => {
          if (ack.err) {
            reject(ack.err);
          } else {
            this.changed = false;
            resolve(this);
          }
        });
      } else {
        // Create new
        node.set(data, (ack: any) => {
          if (ack.err) {
            reject(ack.err);
          } else {
            this.attrs._soul = ack.ref.toString().split('/').pop();
            this.changed = false;
            resolve(this);
          }
        });
      }
    });
  }

  /**
   * Delete this model instance
   */
  async delete(): Promise<void> {
    const ModelClass = this.constructor as typeof Model;
    
    if (!ModelClass.gunInstance) {
      throw new Error('Gun instance not set. Call setGunInstance first.');
    }

    if (!this.attrs._soul) {
      throw new Error('Cannot delete an item without an ID.');
    }

    return new Promise((resolve, reject) => {
      ModelClass.gunInstance.get(ModelClass.tableName).get(this.attrs._soul).put(null, (ack: any) => {
        if (ack.err) {
          reject(ack.err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Add a relation to this model
   */
  async addRelation(relationName: string, relatedModel: any): Promise<void> {
    const ModelClass = this.constructor as typeof Model;
    
    if (!ModelClass.gunInstance) {
      throw new Error('Gun instance not set. Call setGunInstance first.');
    }

    if (!this.attrs._soul) {
      throw new Error('Cannot add relation to an unsaved item. Save the item first.');
    }

    if (!relatedModel.attrs._soul) {
      throw new Error('Cannot add relation to an unsaved item. Save the related model first.');
    }

    return new Promise((resolve, reject) => {
      // Create a relation node if it doesn't exist
      if (!this.attrs[relationName]) {
        this.attrs[relationName] = {};
      }

      // Add the relation by ID
      const relationData = { ...this.attrs[relationName] };
      relationData[relatedModel.attrs._soul] = true;
      this.attrs[relationName] = relationData;

      // Save the updated relations
      ModelClass.gunInstance.get(ModelClass.tableName).get(this.attrs._soul).put(this.attrs, (ack: any) => {
        if (ack.err) {
          reject(ack.err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get related models
   */
  async getRelated<T>(relationName: string, RelatedModel: any): Promise<T[]> {
    const ModelClass = this.constructor as typeof Model;
    
    if (!ModelClass.gunInstance) {
      throw new Error('Gun instance not set. Call setGunInstance first.');
    }

    if (!this.attrs._soul) {
      throw new Error('Cannot get relations from an unsaved item.');
    }

    if (!this.attrs[relationName]) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const items: T[] = [];
      const relationIds = Object.keys(this.attrs[relationName]);
      
      if (relationIds.length === 0) {
        resolve(items);
        return;
      }

      let loaded = 0;
      relationIds.forEach(id => {
        // Only process valid relation entries
        if (this.attrs[relationName][id] === true) {
          RelatedModel.findById(id).then((item: T | null) => {
            if (item) {
              items.push(item);
            }
            loaded++;
            if (loaded === relationIds.length) {
              resolve(items);
            }
          }).catch((err: Error) => {
            loaded++;
            if (loaded === relationIds.length) {
              resolve(items);
            }
          });
        } else {
          loaded++;
          if (loaded === relationIds.length) {
            resolve(items);
          }
        }
      });
    });
  }

  /**
   * Remove a relation from this model
   */
  async removeRelation(relationName: string, relatedModel: any): Promise<void> {
    const ModelClass = this.constructor as typeof Model;
    
    if (!ModelClass.gunInstance) {
      throw new Error('Gun instance not set. Call setGunInstance first.');
    }

    if (!this.attrs._soul || !relatedModel.attrs._soul) {
      throw new Error('Cannot remove relation from an unsaved item.');
    }

    if (!this.attrs[relationName]) {
      return;
    }

    return new Promise((resolve, reject) => {
      // Remove the relation by ID
      const relationData = { ...this.attrs[relationName] };
      delete relationData[relatedModel.attrs._soul];
      this.attrs[relationName] = relationData;

      // Save the updated relations
      ModelClass.gunInstance.get(ModelClass.tableName).get(this.attrs._soul).put(this.attrs, (ack: any) => {
        if (ack.err) {
          reject(ack.err);
        } else {
          resolve();
        }
      });
    });
  }
} 